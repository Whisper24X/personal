import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { resolveAinativeDataRootDir } from '../../../../../utils/workspace-paths';
import { TaskLog } from '../../../../domain/task-log';
import { TaskLogRepository } from '../../task-log.repository';

@Injectable()
export class TaskLogFileRepository implements TaskLogRepository {
  private readonly baseDir = path.resolve(
    resolveAinativeDataRootDir(),
    'meta',
    'task-logs',
  );

  async create(data: Omit<TaskLog, 'id' | 'createdAt'>): Promise<TaskLog> {
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

    const filePath = this.resolveTaskLogPath(log.taskId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(this.serialize(log))}\n`, 'utf-8');

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
    const logs = await this.readTaskLogs(taskId);
    const sortedLogs = logs.sort((left, right) => {
      const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
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

  private resolveTaskLogPath(taskId: string): string {
    return path.resolve(this.baseDir, `${taskId}.jsonl`);
  }

  private async readTaskLogs(taskId: string): Promise<TaskLog[]> {
    const filePath = this.resolveTaskLogPath(taskId);

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
          raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
            ? (raw.payload as Record<string, unknown>)
            : null,
        createdAt,
      };
    } catch {
      return null;
    }
  }
}
