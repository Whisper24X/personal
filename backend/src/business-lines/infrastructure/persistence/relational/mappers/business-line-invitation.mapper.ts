import { BusinessLineInvitation } from '../../../../domain/business-line-invitation';
import { BusinessLineInviteProjectRole } from '../../../../dto/business-line-invite-project-role.enum';
import { BusinessLineInvitationEntity } from '../entities/business-line-invitation.entity';

export class BusinessLineInvitationMapper {
  static toDomain(raw: BusinessLineInvitationEntity): BusinessLineInvitation {
    const domainEntity = new BusinessLineInvitation();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.token = raw.token;
    domainEntity.role = raw.role;
    domainEntity.projectRoles = raw.projectRoles ?? {};
    domainEntity.createdBy = raw.createdBy;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.revokedAt = raw.revokedAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(
    domainEntity: BusinessLineInvitation,
  ): BusinessLineInvitationEntity {
    const persistenceEntity = new BusinessLineInvitationEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.token = domainEntity.token;
    persistenceEntity.role = domainEntity.role;
    persistenceEntity.projectRoles = (domainEntity.projectRoles ??
      {}) as Record<string, BusinessLineInviteProjectRole>;
    persistenceEntity.createdBy = domainEntity.createdBy;
    persistenceEntity.expiresAt = domainEntity.expiresAt;
    persistenceEntity.revokedAt = domainEntity.revokedAt ?? null;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
