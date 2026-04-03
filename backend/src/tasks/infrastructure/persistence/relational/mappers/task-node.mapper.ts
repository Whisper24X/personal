import { TaskNode } from '../../../../domain/task-node';
import {
  TaskLoopConfig,
  TaskNodeConfig,
} from '../../../../types/task-config.type';
import { TaskNodeEntity } from '../entities/task-node.entity';

export class TaskNodeMapper {
  static toDomain(raw: TaskNodeEntity): TaskNode {
    const domainEntity = new TaskNode();
    domainEntity.id = raw.id;
    domainEntity.taskId = raw.taskId;
    domainEntity.nodeOrder = raw.nodeOrder;
    domainEntity.name = raw.name;
    domainEntity.input = raw.input;
    domainEntity.agentCliId = raw.agentCliId;
    domainEntity.agentCliConfigId = raw.agentCliConfigId;
    domainEntity.agentClioutput = raw.agentClioutput;
    domainEntity.agentCliSessionId = raw.agentCliSessionId;
    domainEntity.configJson = raw.configJson as TaskNodeConfig | null;
    domainEntity.loopJson = raw.loopJson as TaskLoopConfig | null;
    domainEntity.runtimeJson = raw.runtimeJson;
    domainEntity.beforeRunCommitSha = raw.beforeRunCommitSha;
    domainEntity.afterRunCommitSha = raw.afterRunCommitSha;
    domainEntity.status = raw.status;
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
    persistenceEntity.agentCliId = domainEntity.agentCliId ?? '';
    persistenceEntity.agentCliConfigId = domainEntity.agentCliConfigId ?? '';
    persistenceEntity.agentClioutput = domainEntity.agentClioutput ?? null;
    persistenceEntity.agentCliSessionId =
      domainEntity.agentCliSessionId ?? null;
    persistenceEntity.configJson = domainEntity.configJson ?? null;
    persistenceEntity.loopJson = domainEntity.loopJson ?? null;
    persistenceEntity.runtimeJson = domainEntity.runtimeJson ?? null;
    persistenceEntity.beforeRunCommitSha =
      domainEntity.beforeRunCommitSha ?? null;
    persistenceEntity.afterRunCommitSha =
      domainEntity.afterRunCommitSha ?? null;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.startedAt = domainEntity.startedAt ?? null;
    persistenceEntity.finishedAt = domainEntity.finishedAt ?? null;

    return persistenceEntity;
  }
}
