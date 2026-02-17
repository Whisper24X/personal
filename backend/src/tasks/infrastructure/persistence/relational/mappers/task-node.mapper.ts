import { TaskNode } from '../../../../domain/task-node';
import { TaskNodeEntity } from '../entities/task-node.entity';

export class TaskNodeMapper {
  static toDomain(raw: TaskNodeEntity): TaskNode {
    const domainEntity = new TaskNode();
    domainEntity.id = raw.id;
    domainEntity.taskId = raw.taskId;
    domainEntity.nodeOrder = raw.nodeOrder;
    domainEntity.name = raw.name;
    domainEntity.nodeType = raw.nodeType;
    domainEntity.input = raw.input;
    domainEntity.output = raw.output;
    domainEntity.requiresApproval = raw.requiresApproval;
    domainEntity.status = raw.status;
    domainEntity.attempt = raw.attempt;
    domainEntity.errorCode = raw.errorCode;
    domainEntity.errorMessage = raw.errorMessage;
    domainEntity.startedAt = raw.startedAt;
    domainEntity.finishedAt = raw.finishedAt;
    domainEntity.workerId = raw.workerId;
    domainEntity.leaseUntil = raw.leaseUntil;
    domainEntity.heartbeatAt = raw.heartbeatAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: TaskNode): TaskNodeEntity {
    const persistenceEntity = new TaskNodeEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.taskId = domainEntity.taskId;
    persistenceEntity.nodeOrder = domainEntity.nodeOrder;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.nodeType = domainEntity.nodeType;
    persistenceEntity.input = domainEntity.input;
    persistenceEntity.output = domainEntity.output;
    persistenceEntity.requiresApproval = domainEntity.requiresApproval;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.attempt = domainEntity.attempt;
    persistenceEntity.errorCode = domainEntity.errorCode;
    persistenceEntity.errorMessage = domainEntity.errorMessage;
    persistenceEntity.startedAt = domainEntity.startedAt;
    persistenceEntity.finishedAt = domainEntity.finishedAt;
    persistenceEntity.workerId = domainEntity.workerId;
    persistenceEntity.leaseUntil = domainEntity.leaseUntil;
    persistenceEntity.heartbeatAt = domainEntity.heartbeatAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
