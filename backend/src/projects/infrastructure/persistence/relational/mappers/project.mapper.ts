import { Project } from '../../../../domain/project';
import { RepositoryProvisioningStatus } from '../../../../domain/repository-provisioning-status.enum';
import { ProjectEntity } from '../entities/project.entity';

export class ProjectMapper {
  static toDomain(raw: ProjectEntity): Project {
    const domainEntity = new Project();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.gitUrl = raw.gitUrl;
    domainEntity.defaultBranch = raw.defaultBranch;
    domainEntity.configJson = raw.configJson;
    domainEntity.repositoryProvisioningStatus =
      raw.repositoryProvisioningStatus;
    domainEntity.repositoryProvisioningError = raw.repositoryProvisioningError;
    domainEntity.repositoryProvisionedAt = raw.repositoryProvisionedAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Project): ProjectEntity {
    const persistenceEntity = new ProjectEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.gitUrl = domainEntity.gitUrl;
    persistenceEntity.defaultBranch = domainEntity.defaultBranch;
    persistenceEntity.configJson = domainEntity.configJson;
    persistenceEntity.repositoryProvisioningStatus =
      domainEntity.repositoryProvisioningStatus ??
      RepositoryProvisioningStatus.Ready;
    persistenceEntity.repositoryProvisioningError =
      domainEntity.repositoryProvisioningError;
    persistenceEntity.repositoryProvisionedAt =
      domainEntity.repositoryProvisionedAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;

    return persistenceEntity;
  }
}
