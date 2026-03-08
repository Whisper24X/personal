import { BusinessLineCustomRole } from '../../../../domain/business-line-custom-role';
import { BusinessLineCustomRoleEntity } from '../entities/business-line-custom-role.entity';

export class BusinessLineCustomRoleMapper {
  static toDomain(raw: BusinessLineCustomRoleEntity): BusinessLineCustomRole {
    const domainEntity = new BusinessLineCustomRole();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description ?? null;
    domainEntity.capabilities = raw.capabilities ?? [];
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: BusinessLineCustomRole): BusinessLineCustomRoleEntity {
    const persistenceEntity = new BusinessLineCustomRoleEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.description = domainEntity.description ?? null;
    persistenceEntity.capabilities = domainEntity.capabilities ?? [];
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
