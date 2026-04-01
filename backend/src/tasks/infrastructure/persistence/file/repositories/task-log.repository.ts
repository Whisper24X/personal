import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveAinativeDataRootDir } from '../../../../../utils/workspace-paths';
import { Task } from '../../../../domain/task';
import { TaskLog } from '../../../../domain/task-log';
import { TaskRepository } from '../../task.repository';
import { TaskLogRepository } from '../../task-log.repository';
import {
  SlowApiDiagnosticsSession,
  createSlowApiDiagnostics,
} from '../../../../../observability/slow-api-diagnostics';

type CachedTaskLogsEntry = {
  filePath: string;
  size: number;
  mtimeMs: number;
  lineCount: number;
  logs: TaskLog[];
};

@Injectable()
export class TaskLogFileRepository implements TaskLogRepository {
  private readonly maxTaskLogCacheEntries = 128;
  private readonly taskLogCache = new Map<string, CachedTaskLogsEntry>();

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
    this.invalidateTaskLogCache(filePath);

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
    const diagnostics = createSlowApiDiagnostics('tasks.logs.repository', {
      taskId,
      since: since?.toISOString() ?? null,
      afterId: afterId ?? null,
      limit: limit ?? null,
    });

    try {
      const task = await diagnostics.measure(
        'findTask',
        () => this.taskRepository.findById(taskId),
        (result) => ({
          taskFound: Boolean(result),
        }),
      );
      if (!task) {
        return [];
      }

      const logs = await this.readTaskLogs(task, diagnostics);
      const sortedLogs = await diagnostics.measure(
        'sort',
        () =>
          [...logs].sort((left, right) => {
            const createdAtDiff =
              left.createdAt.getTime() - right.createdAt.getTime();
            if (createdAtDiff !== 0) {
              return createdAtDiff;
            }

            return left.id.localeCompare(right.id);
          }),
        (result) => ({
          totalLogCount: result.length,
        }),
      );

      const filteredLogs = await diagnostics.measure(
        'filter',
        () =>
          sortedLogs.filter((log) => {
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
          }),
        (result) => ({
          filteredLogCount: result.length,
        }),
      );

      return await diagnostics.measure(
        'slice',
        () => filteredLogs.slice(0, limit ?? 200),
        (result) => ({
          resultCount: result.length,
        }),
      );
    } finally {
      diagnostics.flush();
    }
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
    this.invalidateTaskLogCache(filePath);

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

  private async readTaskLogs(
    task: Task,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<TaskLog[]> {
    const filePath = this.resolveTaskLogPath(task);
    const stat = diagnostics
      ? await diagnostics.measure(
          'stat',
          () => this.readTaskLogStat(filePath),
          (result) => ({
            fileBytes: result?.size ?? 0,
          }),
        )
      : await this.readTaskLogStat(filePath);

    if (!stat) {
      this.invalidateTaskLogCache(filePath);
      diagnostics?.add({
        cacheHit: false,
        logLineCount: 0,
        deserializedLogCount: 0,
      });
      return [];
    }

    const cachedEntry = this.taskLogCache.get(filePath);
    if (
      cachedEntry &&
      cachedEntry.size === stat.size &&
      cachedEntry.mtimeMs === stat.mtimeMs
    ) {
      this.touchTaskLogCache(filePath, cachedEntry);
      diagnostics?.add({
        cacheHit: true,
        fileBytes: cachedEntry.size,
        logLineCount: cachedEntry.lineCount,
        deserializedLogCount: cachedEntry.logs.length,
      });
      return cachedEntry.logs;
    }

    const content = diagnostics
      ? await diagnostics.measure(
          'readFile',
          () => this.readTaskLogFile(filePath),
          (result) => ({
            fileBytes: result ? Buffer.byteLength(result, 'utf-8') : 0,
          }),
        )
      : await this.readTaskLogFile(filePath);

    if (content === null) {
      this.invalidateTaskLogCache(filePath);
      diagnostics?.add({
        cacheHit: false,
        logLineCount: 0,
        deserializedLogCount: 0,
      });
      return [];
    }

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!diagnostics) {
      const logs = lines
        .map((line) => this.deserialize(line))
        .filter((log): log is TaskLog => Boolean(log));
      this.setTaskLogCache({
        filePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        lineCount: lines.length,
        logs,
      });
      return logs;
    }

    const logs = await diagnostics.measure(
      'deserialize',
      () =>
        lines
          .map((line) => this.deserialize(line))
          .filter((log): log is TaskLog => Boolean(log)),
      (result) => ({
        logLineCount: lines.length,
        deserializedLogCount: result.length,
      }),
    );
    this.setTaskLogCache({
      filePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      lineCount: lines.length,
      logs,
    });
    diagnostics.add({
      cacheHit: false,
    });
    return logs;
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

  private async readTaskLogStat(filePath: string) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  private async readTaskLogFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  private invalidateTaskLogCache(filePath: string): void {
    this.taskLogCache.delete(filePath);
  }

  private touchTaskLogCache(
    filePath: string,
    entry: CachedTaskLogsEntry,
  ): void {
    this.taskLogCache.delete(filePath);
    this.taskLogCache.set(filePath, entry);
  }

  private setTaskLogCache(entry: CachedTaskLogsEntry): void {
    this.taskLogCache.delete(entry.filePath);
    this.taskLogCache.set(entry.filePath, entry);

    while (this.taskLogCache.size > this.maxTaskLogCacheEntries) {
      const oldestKey = this.taskLogCache.keys().next().value;
      if (!oldestKey) {
        break;
      }

      this.taskLogCache.delete(oldestKey);
    }
  }
}
