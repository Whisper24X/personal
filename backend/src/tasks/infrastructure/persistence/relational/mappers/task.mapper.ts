import { Task } from '../../../../domain/task';
import { TaskEntity } from '../entities/task.entity';

export class TaskMapper {
  static toDomain(raw: TaskEntity): Task {
    const domainEntity = new Task();
    domainEntity.id = raw.id;
    domainEntity.projectId = raw.projectId;
    domainEntity.workflowTemplateId = raw.workflowTemplateId;
    domainEntity.mode = raw.mode;
    domainEntity.title = raw.title;
    domainEntity.description = raw.description;
    domainEntity.acceptanceCriteria = raw.acceptanceCriteria;
    domainEntity.status = raw.status;
    domainEntity.branch = raw.branch;
    domainEntity.gitBaseBranch = raw.gitBaseBranch;
    domainEntity.gitWorktreePath = raw.gitWorktreePath;
    domainEntity.sandboxCleanupAt = raw.sandboxCleanupAt;
    domainEntity.environment = raw.environment;
    domainEntity.toolVersionsSnapshot = raw.toolVersionsSnapshot;
    domainEntity.createdBy = raw.createdBy;
    domainEntity.startedAt = raw.startedAt;
    domainEntity.finishedAt = raw.finishedAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Task): TaskEntity {
    const persistenceEntity = new TaskEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.projectId = domainEntity.projectId;
    persistenceEntity.workflowTemplateId = domainEntity.workflowTemplateId;
    persistenceEntity.mode = domainEntity.mode;
    persistenceEntity.title = domainEntity.title;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.acceptanceCriteria = domainEntity.acceptanceCriteria;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.branch = domainEntity.branch;
    persistenceEntity.gitBaseBranch = domainEntity.gitBaseBranch;
    persistenceEntity.gitWorktreePath = domainEntity.gitWorktreePath;
    persistenceEntity.sandboxCleanupAt = domainEntity.sandboxCleanupAt;
    persistenceEntity.environment = domainEntity.environment;
    persistenceEntity.toolVersionsSnapshot = domainEntity.toolVersionsSnapshot;
    persistenceEntity.createdBy = domainEntity.createdBy;
    persistenceEntity.startedAt = domainEntity.startedAt;
    persistenceEntity.finishedAt = domainEntity.finishedAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;

    return persistenceEntity;
  }
}
