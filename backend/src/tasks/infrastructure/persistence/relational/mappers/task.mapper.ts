import { Task } from '../../../../domain/task';
import { TaskEntity } from '../entities/task.entity';

export class TaskMapper {
  static toDomain(raw: TaskEntity): Task {
    const domainEntity = new Task();
    domainEntity.id = raw.id;
    domainEntity.projectId = raw.projectId;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.mode = raw.mode;
    domainEntity.title = raw.title;
    domainEntity.prompt = raw.prompt;
    domainEntity.status = raw.status;
    domainEntity.gitBranch = raw.gitBranch;
    domainEntity.gitBaseBranch = raw.gitBaseBranch;
    domainEntity.gitWorktree = raw.gitWorktree;
    domainEntity.configJson = raw.configJson;
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
    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.mode = domainEntity.mode;
    persistenceEntity.title = domainEntity.title;
    persistenceEntity.prompt = domainEntity.prompt;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.gitBranch = domainEntity.gitBranch;
    persistenceEntity.gitBaseBranch = domainEntity.gitBaseBranch;
    persistenceEntity.gitWorktree = domainEntity.gitWorktree;
    persistenceEntity.configJson = domainEntity.configJson;
    persistenceEntity.createdBy = domainEntity.createdBy;
    persistenceEntity.startedAt = domainEntity.startedAt;
    persistenceEntity.finishedAt = domainEntity.finishedAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;

    return persistenceEntity;
  }
}
