import { Injectable } from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { NullableType } from '../utils/types/nullable.type';
import { BusinessLineInvitationService } from './business-line-invitation.service';
import { BusinessLineMemberManagementService } from './business-line-member-management.service';
import { AcceptBusinessLineInviteDto } from './dto/accept-business-line-invite.dto';
import { AcceptBusinessLineInviteResponseDto } from './dto/accept-business-line-invite-response.dto';
import { BusinessLineInviteDto } from './dto/business-line-invite.dto';
import { CreateBusinessLineInviteDto } from './dto/create-business-line-invite.dto';
import { CreateBusinessLineMemberDto } from './dto/create-business-line-member.dto';
import { UpdateBusinessLineMemberDto } from './dto/update-business-line-member.dto';
import { BusinessLineMember } from './domain/business-line-member';

@Injectable()
export class BusinessLineMembershipService {
  constructor(
    private readonly businessLineInvitationService: BusinessLineInvitationService,
    private readonly businessLineMemberManagementService: BusinessLineMemberManagementService,
  ) {}

  findMemberByBusinessLineIdAndUserId(
    businessLineId: string,
    userId: string,
  ): Promise<BusinessLineMember | null> {
    return this.businessLineMemberManagementService.findMemberByBusinessLineIdAndUserId(
      businessLineId,
      userId,
    );
  }

  findMembers(businessLineId: string): Promise<BusinessLineMember[]> {
    return this.businessLineMemberManagementService.findMembers(businessLineId);
  }

  addMember(args: {
    businessLineId: string;
    createBusinessLineMemberDto: CreateBusinessLineMemberDto;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<BusinessLineMember> {
    return this.businessLineMemberManagementService.addMember(args);
  }

  createInvite(args: {
    businessLineId: string;
    createBusinessLineInviteDto: CreateBusinessLineInviteDto;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<BusinessLineInviteDto> {
    return this.businessLineInvitationService.createInvite(args);
  }

  findLatestInvite(
    businessLineId: string,
  ): Promise<NullableType<BusinessLineInviteDto>> {
    return this.businessLineInvitationService.findLatestInvite(businessLineId);
  }

  acceptInvite(
    acceptBusinessLineInviteDto: AcceptBusinessLineInviteDto,
    currentUser: JwtPayloadType,
  ): Promise<AcceptBusinessLineInviteResponseDto> {
    return this.businessLineInvitationService.acceptInvite(
      acceptBusinessLineInviteDto,
      currentUser,
    );
  }

  findMemberProjectRoles(
    businessLineId: string,
    userId: string,
  ): Promise<{ projectRoles: Record<string, string> }> {
    return this.businessLineMemberManagementService.findMemberProjectRoles(
      businessLineId,
      userId,
    );
  }

  updateMemberRole(args: {
    businessLineId: string;
    userId: string;
    updateBusinessLineMemberDto: UpdateBusinessLineMemberDto;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<BusinessLineMember> {
    return this.businessLineMemberManagementService.updateMemberRole(args);
  }

  removeMember(args: {
    businessLineId: string;
    userId: string;
    actorMember: BusinessLineMember | null;
    currentUser: JwtPayloadType;
  }): Promise<void> {
    return this.businessLineMemberManagementService.removeMember(args);
  }
}
