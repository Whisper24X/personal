import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveAinativeDataRootDir } from '../../../../../utils/workspace-paths';
import { Task } from '../../../../domain/task';
import { TaskLog } from '../../../../domain/task-log';
import { TaskRepository } from '../../task.repository';
import { TaskLogRepository } from '../../task-log.repository';

@Injectable()
export class TaskLogFileRepository implements TaskLogRepository {
  constructor(private readonly taskRepository: TaskRepository) {}

  async create(data: Omit<TaskLog, 'id' | 'createdAt'>): Promise<TaskLog> {
    const task = await this.requireTask(data.taskId);
    const createdAt = new Date();
    const log: TaskLog = {
      id: randomUUID(),
      taskId: data.taskId,
      taskNodeId: data.taskNodeId ?? null,
      level: data.level,
      message: data.message,
      payload: data.payload ?? null,
      createdAt,
    };
    const filePath = this.resolveTaskLogPath(task);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(
      filePath,
      `${JSON.stringify(this.serialize(log))}\n`,
      'utf-8',
    );

    return log;
  }

  async findByTaskIdSince({
    taskId,
    since,
    afterId,
    limit,
  }: {
    taskId: TaskLog['taskId'];
    since?: Date;
    afterId?: string;
    limit?: number;
  }): Promise<TaskLog[]> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return [];
    }

    const logs = await this.readTaskLogs(task);
    const sortedLogs = [...logs].sort((left, right) => {
      const createdAtDiff =
        left.createdAt.getTime() - right.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return left.id.localeCompare(right.id);
    });

    const filteredLogs = sortedLogs.filter((log) => {
      if (since && afterId) {
        return (
          log.createdAt.getTime() > since.getTime() ||
          (log.createdAt.getTime() === since.getTime() &&
            log.id.localeCompare(afterId) > 0)
        );
      }

      if (since) {
        return log.createdAt.getTime() > since.getTime();
      }

      return true;
    });

    return filteredLogs.slice(0, limit ?? 200);
  }

  async deleteByTaskIdAndNodeIds({
    taskId,
    nodeIds,
  }: {
    taskId: TaskLog['taskId'];
    nodeIds: string[];
  }): Promise<number> {
    if (!nodeIds.length) {
      return 0;
    }

    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return 0;
    }

    const filePath = this.resolveTaskLogPath(task);
    const existingLogs = await this.readTaskLogs(task);
    const nodeIdSet = new Set(nodeIds);
    const filteredLogs = existingLogs.filter((log) => {
      return !(
        typeof log.taskNodeId === 'string' && nodeIdSet.has(log.taskNodeId)
      );
    });
    const removedCount = existingLogs.length - filteredLogs.length;

    if (removedCount === 0) {
      return 0;
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const nextContent = filteredLogs
      .map((log) => JSON.stringify(this.serialize(log)))
      .join('\n');

    await fs.writeFile(
      filePath,
      nextContent ? `${nextContent}\n` : '',
      'utf-8',
    );

    return removedCount;
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found for task log persistence`);
    }

    return task;
  }

  private resolveTaskLogPath(task: Task): string {
    return path.resolve(
      resolveAinativeDataRootDir(),
      task.businessLineId?.trim() || 'unknown-business-line',
      'projects',
      task.projectId?.trim() || 'unknown-project',
      'tasks',
      task.id,
      'task-log.jsonl',
    );
  }

  private async readTaskLogs(task: Task): Promise<TaskLog[]> {
    const filePath = this.resolveTaskLogPath(task);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => this.deserialize(line))
        .filter((log): log is TaskLog => Boolean(log));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  private serialize(log: TaskLog): Record<string, unknown> {
    return {
      ...log,
      createdAt: log.createdAt.toISOString(),
    };
  }

  private deserialize(line: string): TaskLog | null {
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      if (typeof raw.id !== 'string' || typeof raw.taskId !== 'string') {
        return null;
      }

      const createdAt = new Date(String(raw.createdAt ?? ''));
      if (Number.isNaN(createdAt.getTime())) {
        return null;
      }

      return {
        id: raw.id,
        taskId: raw.taskId,
        taskNodeId: typeof raw.taskNodeId === 'string' ? raw.taskNodeId : null,
        level: String(raw.level ?? 'info') as TaskLog['level'],
        message: typeof raw.message === 'string' ? raw.message : '',
        payload:
          raw.payload &&
          typeof raw.payload === 'object' &&
          !Array.isArray(raw.payload)
            ? (raw.payload as Record<string, unknown>)
            : null,
        createdAt,
      };
    } catch {
      return null;
    }
  }
}
