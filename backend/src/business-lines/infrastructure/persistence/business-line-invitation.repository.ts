import { NullableType } from '../../../utils/types/nullable.type';
import { BusinessLineInvitation } from '../../domain/business-line-invitation';

export abstract class BusinessLineInvitationRepository {
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
    role: BusinessLineInvitation['role'];
    projectRoles: BusinessLineInvitation['projectRoles'];
    createdBy: BusinessLineInvitation['createdBy'];
    expiresAt: BusinessLineInvitation['expiresAt'];
  }): Promise<BusinessLineInvitation>;
}
