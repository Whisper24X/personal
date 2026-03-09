import { TaskNode } from '../../../../domain/task-node';
import { TaskNodeEntity } from '../entities/task-node.entity';

export class TaskNodeMapper {
  static toDomain(raw: TaskNodeEntity): TaskNode {
    const domainEntity = new TaskNode();
    domainEntity.id = raw.id;
    domainEntity.taskId = raw.taskId;
    domainEntity.nodeOrder = raw.nodeOrder;
    domainEntity.name = raw.name;
    domainEntity.input = raw.input;
    domainEntity.cliToolId = raw.cliToolId;
    domainEntity.agentToolConfigId = raw.agentToolConfigId;
    domainEntity.outputRef = raw.outputRef;
    domainEntity.runtimeJson = raw.runtimeJson;
    domainEntity.status = raw.status;
    domainEntity.attempt = raw.attempt;
    domainEntity.startedAt = raw.startedAt;
    domainEntity.finishedAt = raw.finishedAt;
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
    persistenceEntity.input = domainEntity.input ?? null;
    persistenceEntity.cliToolId = domainEntity.cliToolId ?? '';
    persistenceEntity.agentToolConfigId = domainEntity.agentToolConfigId ?? '';
    persistenceEntity.outputRef = domainEntity.outputRef ?? null;
    persistenceEntity.runtimeJson = domainEntity.runtimeJson ?? null;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.attempt = domainEntity.attempt;
    persistenceEntity.startedAt = domainEntity.startedAt ?? null;
    persistenceEntity.finishedAt = domainEntity.finishedAt ?? null;

    return persistenceEntity;
  }
}
