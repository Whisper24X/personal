import { TaskLog } from '../../../../domain/task-log';
import { TaskLogEntity } from '../entities/task-log.entity';

export class TaskLogMapper {
  static toDomain(raw: TaskLogEntity): TaskLog {
    const domainEntity = new TaskLog();
    domainEntity.id = raw.id;
    domainEntity.taskId = raw.taskId;
    domainEntity.taskNodeId = raw.taskNodeId;
    domainEntity.level = raw.level;
    domainEntity.message = raw.message;
    domainEntity.payload = raw.payload;
    domainEntity.createdAt = raw.createdAt;

    return domainEntity;
  }
}
