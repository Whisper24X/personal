import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isBusinessLineOwnerCapabilities } from '../access/access.constants';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectCustomRoleRepository } from '../projects/infrastructure/persistence/project-custom-role.repository';
import { ProjectMemberRepository } from '../projects/infrastructure/persistence/project-member.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { UsersService } from '../users/users.service';
import { BusinessLineProjectRoleAssignmentService } from './business-line-project-role-assignment.service';
import { BusinessLineRoleCatalogService } from './business-line-role-catalog.service';
import { CreateBusinessLineMemberDto } from './dto/create-business-line-member.dto';
import { UpdateBusinessLineMemberDto } from './dto/update-business-line-member.dto';
import { BusinessLineMember } from './domain/business-line-member';
import { BusinessLineMemberRepository } from './infrastructure/persistence/business-line-member.repository';

@Injectable()
export class BusinessLineMemberManagementService {
  constructor(
    private readonly businessLineMemberRepository: BusinessLineMemberRepository,
    private readonly usersService: UsersService,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly projectCustomRoleRepository: ProjectCustomRoleRepository,
    private readonly businessLineProjectRoleAssignmentService: BusinessLineProjectRoleAssignmentService,
    private readonly businessLineRoleCatalogService: BusinessLineRoleCatalogService,
  ) {}

  findMemberByBusinessLineIdAndUserId(
    businessLineId: string,
    userId: string,
  ): Promise<BusinessLineMember | null> {
    return this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
      businessLineId,
      userId,
    );
  }

  async findMembers(businessLineId: string): Promise<BusinessLineMember[]> {
    const members =
      await this.businessLineMemberRepository.findByBusinessLineId(
        businessLineId,
      );

    return this.businessLineRoleCatalogService.attachCustomRoleNamesToBusinessLineMembers(
      members,
    );
  }

  async addMember(args: {
    businessLineId: string;
    createBusinessLineMemberDto: CreateBusinessLineMemberDto;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<BusinessLineMember> {
    const {
      businessLineId,
      createBusinessLineMemberDto,
      actorMember,
      currentUser,
    } = args;
    const assignment =
      await this.businessLineRoleCatalogService.resolveBusinessLineMemberAssignment(
        businessLineId,
        createBusinessLineMemberDto.roleId,
      );

    this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      nextRoleId: assignment.roleId,
    });

    const existedMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        createBusinessLineMemberDto.userId,
      );

    if (existedMember) {
      throw new ConflictException('Member already exists in business line');
    }

    const user = await this.usersService.findById(
      createBusinessLineMemberDto.userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const member = await this.businessLineMemberRepository.create({
      businessLineId,
      userId: createBusinessLineMemberDto.userId,
      roleId: assignment.roleId,
    });

    return this.businessLineRoleCatalogService.attachCustomRoleNameToBusinessLineMember(
      member,
    );
  }

  async findMemberProjectRoles(
    businessLineId: string,
    userId: string,
  ): Promise<{ projectRoles: Record<string, string> }> {
    const [projects, memberships, roles] = await Promise.all([
      this.projectRepository.findByBusinessLineId(businessLineId),
      this.projectMemberRepository.findByUserId(userId),
      this.projectCustomRoleRepository.findAllByBusinessLineId(businessLineId),
    ]);

    const projectIdSet = new Set(projects.map((project) => project.id));
    const projectMembershipMap = new Map(
      memberships
        .filter((membership) => projectIdSet.has(membership.projectId))
        .map((membership) => [membership.projectId, membership]),
    );
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const projectRoles: Record<string, string> = {};

    for (const project of projects) {
      const membership = projectMembershipMap.get(project.id);
      const role = membership ? (roleMap.get(membership.roleId) ?? null) : null;
      projectRoles[project.id] = role?.id ?? 'none';
    }

    return { projectRoles };
  }

  async updateMemberRole(args: {
    businessLineId: string;
    userId: string;
    updateBusinessLineMemberDto: UpdateBusinessLineMemberDto;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<BusinessLineMember> {
    const {
      businessLineId,
      userId,
      updateBusinessLineMemberDto,
      actorMember,
      currentUser,
    } = args;

    const currentMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        userId,
      );

    if (!currentMember) {
      throw new NotFoundException('Business line member not found');
    }

    const assignment =
      await this.businessLineRoleCatalogService.resolveBusinessLineMemberAssignment(
        businessLineId,
        updateBusinessLineMemberDto.roleId,
      );

    this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      targetMember: currentMember,
      nextRoleId: assignment.roleId,
    });

    if (
      (await this.businessLineRoleCatalogService.isBusinessLineOwnerRole(
        businessLineId,
        currentMember.roleId,
      )) &&
      !(await this.businessLineRoleCatalogService.isBusinessLineOwnerRole(
        businessLineId,
        assignment.roleId,
      ))
    ) {
      this.ensureOwnerSelfProtection(currentMember, currentUser);
      await this.ensureOwnerCanBeModified(businessLineId);
    }

    const updatedMember = await this.businessLineMemberRepository.update(
      businessLineId,
      userId,
      {
        roleId: assignment.roleId,
      },
    );

    if (!updatedMember) {
      throw new NotFoundException('Business line member not found');
    }

    await this.businessLineProjectRoleAssignmentService.syncExplicitProjectRoleAssignments(
      {
        businessLineId,
        userId,
        projectRoles:
          this.businessLineProjectRoleAssignmentService.normalizeExplicitProjectRoles(
            updateBusinessLineMemberDto.projectRoles,
          ),
      },
    );

    return this.businessLineRoleCatalogService.attachCustomRoleNameToBusinessLineMember(
      updatedMember,
    );
  }

  async removeMember(args: {
    businessLineId: string;
    userId: string;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<void> {
    const { businessLineId, userId, actorMember, currentUser } = args;
    const existedMember =
      await this.businessLineMemberRepository.findByBusinessLineIdAndUserId(
        businessLineId,
        userId,
      );

    if (!existedMember) {
      throw new NotFoundException('Business line member not found');
    }

    this.ensureActorCanManageMemberMutation({
      currentUser,
      businessLineId,
      actorMember,
      targetMember: existedMember,
    });

    if (
      await this.businessLineRoleCatalogService.isBusinessLineOwnerRole(
        businessLineId,
        existedMember.roleId,
      )
    ) {
      this.ensureOwnerSelfProtection(existedMember, currentUser);
      await this.ensureOwnerCanBeModified(businessLineId);
    }

    await this.businessLineMemberRepository.remove(businessLineId, userId);
  }

  private async ensureOwnerCanBeModified(
    businessLineId: string,
  ): Promise<void> {
    const [members, roles] = await Promise.all([
      this.businessLineMemberRepository.findByBusinessLineId(businessLineId),
      this.businessLineRoleCatalogService.findCustomRoles(businessLineId),
    ]);
    const ownerRoleIdSet = new Set(
      roles
        .filter((role) => isBusinessLineOwnerCapabilities(role.capabilities))
        .map((role) => role.id),
    );
    const ownerCount = members.filter((member) =>
      ownerRoleIdSet.has(member.roleId),
    ).length;

    if (ownerCount <= 1) {
      throw new ConflictException('At least one owner is required');
    }
  }

  private ensureOwnerSelfProtection(
    member: BusinessLineMember,
    currentUser: JwtPayloadType,
  ): void {
    if (member.userId === currentUser.sub && !this.isAdmin(currentUser)) {
      throw new ConflictException('Owner cannot remove or downgrade self');
    }
  }

  private ensureActorCanManageMemberMutation(_args: {
    currentUser: JwtPayloadType;
    businessLineId: string;
    actorMember: BusinessLineMember | null;
    targetMember?: BusinessLineMember;
    nextRoleId?: string;
  }): void {
    void _args;
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }
}
