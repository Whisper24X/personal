import { Injectable } from '@nestjs/common';
import { TaskLogEventsService } from '../task-log-events.service';
import { TaskLog } from '../domain/task-log';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskLogRepository } from '../infrastructure/persistence/task-log.repository';

@Injectable()
export class TaskLogService {
  constructor(
    private readonly taskLogRepository: TaskLogRepository,
    private readonly taskLogEventsService: TaskLogEventsService,
  ) {}

  async appendLog({
    taskId,
    taskNodeId,
    level,
    message,
    payload,
  }: {
    taskId: string;
    taskNodeId?: string | null;
    level: TaskLogLevel;
    message: string;
    payload?: Record<string, unknown> | null;
  }): Promise<TaskLog> {
    const log = await this.taskLogRepository.create({
      taskId,
      taskNodeId: taskNodeId ?? null,
      level,
      message,
      payload: payload ?? null,
    });

    this.taskLogEventsService.emit(log);

    return log;
  }

  async deleteNodeLogs({
    taskId,
    nodeIds,
  }: {
    taskId: string;
    nodeIds: string[];
  }): Promise<number> {
    return this.taskLogRepository.deleteByTaskIdAndNodeIds({
      taskId,
      nodeIds,
    });
  }
}
