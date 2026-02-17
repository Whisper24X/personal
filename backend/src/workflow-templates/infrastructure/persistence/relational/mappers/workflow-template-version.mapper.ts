import { WorkflowTemplateVersion } from '../../../../domain/workflow-template-version';
import { WorkflowTemplateVersionEntity } from '../entities/workflow-template-version.entity';

export class WorkflowTemplateVersionMapper {
  static toDomain(raw: WorkflowTemplateVersionEntity): WorkflowTemplateVersion {
    const domainEntity = new WorkflowTemplateVersion();
    domainEntity.id = raw.id;
    domainEntity.templateId = raw.templateId;
    domainEntity.version = raw.version;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.mode = raw.mode;
    domainEntity.nodesJson = raw.nodesJson;
    domainEntity.publishedBy = raw.publishedBy;
    domainEntity.createdAt = raw.createdAt;

    return domainEntity;
  }

  static toPersistence(
    domainEntity: WorkflowTemplateVersion,
  ): WorkflowTemplateVersionEntity {
    const persistenceEntity = new WorkflowTemplateVersionEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.templateId = domainEntity.templateId;
    persistenceEntity.version = domainEntity.version;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.mode = domainEntity.mode;
    persistenceEntity.nodesJson = domainEntity.nodesJson;
    persistenceEntity.publishedBy = domainEntity.publishedBy;
    persistenceEntity.createdAt = domainEntity.createdAt;

    return persistenceEntity;
  }
}
