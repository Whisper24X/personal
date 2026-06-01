import { ProjectCustomRole } from '../../../../domain/project-custom-role';
import { ProjectCustomRoleEntity } from '../entities/project-custom-role.entity';

export class ProjectCustomRoleMapper {
  static toDomain(raw: ProjectCustomRoleEntity): ProjectCustomRole {
    const domainEntity = new ProjectCustomRole();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description ?? null;
    domainEntity.capabilities = raw.capabilities ?? [];
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(
    domainEntity: ProjectCustomRole,
  ): ProjectCustomRoleEntity {
    const persistenceEntity = new ProjectCustomRoleEntity();
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
