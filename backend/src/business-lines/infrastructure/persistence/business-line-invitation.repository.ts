import { NullableType } from '../../../utils/types/nullable.type';
import { BusinessLineInvitation } from '../../domain/business-line-invitation';

export abstract class BusinessLineInvitationRepository {
  abstract findLatestActiveByBusinessLineId(
    businessLineId: BusinessLineInvitation['businessLineId'],
    now: Date,
  ): Promise<NullableType<BusinessLineInvitation>>;

  abstract findActiveByToken(
    token: BusinessLineInvitation['token'],
    now: Date,
  ): Promise<NullableType<BusinessLineInvitation>>;

  abstract revokeActiveByBusinessLineId(
    businessLineId: BusinessLineInvitation['businessLineId'],
    now: Date,
  ): Promise<void>;

  abstract create(data: {
    businessLineId: BusinessLineInvitation['businessLineId'];
    token: BusinessLineInvitation['token'];
    roleId: BusinessLineInvitation['roleId'];
    projectRoles: BusinessLineInvitation['projectRoles'];
    createdBy: BusinessLineInvitation['createdBy'];
    expiresAt: BusinessLineInvitation['expiresAt'];
  }): Promise<BusinessLineInvitation>;

  abstract countActiveByBusinessLineIdAndRoleId(
    businessLineId: string,
    roleId: string,
    now: Date,
  ): Promise<number>;
}
