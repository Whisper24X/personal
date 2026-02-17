import { BusinessLineMember } from '../../../../domain/business-line-member';
import { BusinessLineMemberEntity } from '../entities/business-line-member.entity';

export class BusinessLineMemberMapper {
  static toDomain(raw: BusinessLineMemberEntity): BusinessLineMember {
    const domainEntity = new BusinessLineMember();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.userId = raw.userId;
    domainEntity.role = raw.role;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

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
    persistenceEntity.role = domainEntity.role;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
