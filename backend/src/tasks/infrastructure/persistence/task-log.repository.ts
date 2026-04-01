import { TaskLog } from '../../domain/task-log';

export abstract class TaskLogRepository {
  abstract create(data: Omit<TaskLog, 'id' | 'createdAt'>): Promise<TaskLog>;

  abstract findByTaskIdSince({
    taskId,
    since,
    afterId,
    limit,
  }: {
    taskId: TaskLog['taskId'];
    since?: Date;
    afterId?: string;
    limit?: number;
  }): Promise<TaskLog[]>;

  abstract deleteByTaskIdAndNodeIds({
    taskId,
    nodeIds,
  }: {
    taskId: TaskLog['taskId'];
    nodeIds: string[];
  }): Promise<number>;
}
