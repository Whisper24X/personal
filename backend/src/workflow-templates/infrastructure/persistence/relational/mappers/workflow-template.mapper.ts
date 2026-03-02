import { WorkflowTemplate } from '../../../../domain/workflow-template';
import { WorkflowTemplateEntity } from '../entities/workflow-template.entity';

export class WorkflowTemplateMapper {
  static toDomain(raw: WorkflowTemplateEntity): WorkflowTemplate {
    const domainEntity = new WorkflowTemplate();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.mode = raw.mode;
    domainEntity.scope = raw.scope;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.isActive = raw.isActive;
    domainEntity.latestVersion = raw.latestVersion;
    domainEntity.nodesJson = raw.nodesJson;
    domainEntity.createdBy = raw.createdBy;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: WorkflowTemplate): WorkflowTemplateEntity {
    const persistenceEntity = new WorkflowTemplateEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.name = domainEntity.name;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.mode = domainEntity.mode;
    persistenceEntity.scope = domainEntity.scope;
    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.latestVersion = domainEntity.latestVersion;
    persistenceEntity.nodesJson = domainEntity.nodesJson;
    persistenceEntity.createdBy = domainEntity.createdBy;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;

    return persistenceEntity;
  }
}
