import { BusinessLineMember } from '../../../../domain/business-line-member';
import { defineMemberRoleCapabilities } from '../../../../../utils/member-role-capabilities';
import { BusinessLineMemberEntity } from '../entities/business-line-member.entity';

export class BusinessLineMemberMapper {
  static toDomain(raw: BusinessLineMemberEntity): BusinessLineMember {
    const domainEntity = new BusinessLineMember();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.userId = raw.userId;
    domainEntity.roleId = raw.roleId;
    domainEntity.customRoleName = raw.roleRef?.name ?? null;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    defineMemberRoleCapabilities(domainEntity, raw.roleRef?.capabilities);
    return domainEntity;
  }

  static toPersistence(
    domainEntity: BusinessLineMember,
  ): BusinessLineMemberEntity {
    const persistenceEntity = new BusinessLineMemberEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.roleId = domainEntity.roleId;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
