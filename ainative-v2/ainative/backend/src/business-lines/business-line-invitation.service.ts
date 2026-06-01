import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import ms from 'ms';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { NullableType } from '../utils/types/nullable.type';
import { BusinessLineProjectRoleAssignmentService } from './business-line-project-role-assignment.service';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { AcceptBusinessLineInviteDto } from './dto/accept-business-line-invite.dto';
import { AcceptBusinessLineInviteResponseDto } from './dto/accept-business-line-invite-response.dto';
import { BusinessLineInviteDto } from './dto/business-line-invite.dto';
import { CreateBusinessLineInviteDto } from './dto/create-business-line-invite.dto';
import { BusinessLineInvitation } from './domain/business-line-invitation';
import { BusinessLineMember } from './domain/business-line-member';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { BusinessLineInvitationRepository } from './infrastructure/persistence/business-line-invitation.repository';
import { BusinessLineMemberRepository } from './infrastructure/persistence/business-line-member.repository';

@Injectable()
export class BusinessLineInvitationService {
  private static readonly INVITE_TOKEN_EXPIRES_IN: ms.StringValue = '7d';

  constructor(
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly businessLineInvitationRepository: BusinessLineInvitationRepository,
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly businessLineProjectRoleAssignmentService: BusinessLineProjectRoleAssignmentService,
    private readonly businessLineRoleCatalogService: BusinessLineRoleCatalogService,
  ) {}

  async createInvite(args: {
    businessLineId: string;
    createBusinessLineInviteDto: CreateBusinessLineInviteDto;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<BusinessLineInviteDto> {
    const {
      businessLineId,
      createBusinessLineInviteDto,
      actorMember,
      currentUser,
    } = args;
    const assignment =
      await this.businessLineRoleCatalogService.resolveBusinessLineMemberAssignment(
        businessLineId,
        createBusinessLineInviteDto.roleId,
      );

    this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      nextRoleId: assignment.roleId,
    });

    const projectRoles =
      this.businessLineProjectRoleAssignmentService.normalizeInviteProjectRoles(
        createBusinessLineInviteDto.projectRoles,
      );

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ms(BusinessLineInvitationService.INVITE_TOKEN_EXPIRES_IN),
    );
    const token = this.generateInviteToken();

    await this.businessLineInvitationRepository.revokeActiveByBusinessLineId(
      businessLineId,
      now,
    );

    const invitation = await this.businessLineInvitationRepository.create({
      businessLineId,
      token,
      roleId: assignment.roleId,
      projectRoles,
      createdBy: currentUser.sub,
      expiresAt,
    });

    return this.mapInvitationToInviteDto(invitation);
  }

  async findLatestInvite(
    businessLineId: string,
  ): Promise<NullableType<BusinessLineInviteDto>> {
    const invitation =
      await this.businessLineInvitationRepository.findLatestActiveByBusinessLineId(
        businessLineId,
        new Date(),
      );

    if (!invitation) {
      return null;
    }

    return this.mapInvitationToInviteDto(invitation);
  }

  async acceptInvite(
    acceptBusinessLineInviteDto: AcceptBusinessLineInviteDto,
    currentUser: JwtPayloadType,
  ): Promise<AcceptBusinessLineInviteResponseDto> {
    const invitation =
      await this.businessLineInvitationRepository.findActiveByToken(
        acceptBusinessLineInviteDto.token,
        new Date(),
      );

    if (!invitation) {
      throw new ForbiddenException('Invalid or expired invitation token');
    }

    await this.ensureBusinessLineExists(invitation.businessLineId);

    const existedMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        invitation.businessLineId,
        currentUser.sub,
      );

    if (existedMember) {
      throw new ConflictException('Member already exists in business line');
    }

    const member = await this.businessLineMemberRepository.create({
      businessLineId: invitation.businessLineId,
      userId: currentUser.sub,
      roleId: invitation.roleId,
    });

    const failedProjects =
      await this.businessLineProjectRoleAssignmentService.syncProjectRoleAssignments(
        {
          businessLineId: invitation.businessLineId,
          userId: currentUser.sub,
          projectRoles: invitation.projectRoles,
        },
      );

    return {
      member:
        await this.businessLineRoleCatalogService.attachCustomRoleNameToBusinessLineMember(
          member,
        ),
      failedProjects,
    };
  }

  private ensureActorCanManageMemberMutation(_args: {
    currentUser: JwtPayloadType;
    businessLineId: string;
    actorMember: BusinessLineMember | null;
    nextRoleId?: string;
  }): void {
    void _args;
  }

  private generateInviteToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async mapInvitationToInviteDto(
    invitation: BusinessLineInvitation,
  ): Promise<BusinessLineInviteDto> {
    return {
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      businessLineId: invitation.businessLineId,
      roleId: invitation.roleId,
      projectRoles: invitation.projectRoles,
      customRoleName:
        await this.businessLineRoleCatalogService.findBusinessLineCustomRoleName(
          invitation.roleId,
        ),
    };
  }

  private async ensureBusinessLineExists(
    businessLineId: string,
  ): Promise<void> {
    const businessLine =
      await this.businessLineRepository.findById(businessLineId);

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }
  }
}
