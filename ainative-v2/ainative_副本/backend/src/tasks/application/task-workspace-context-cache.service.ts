import { Injectable } from '@nestjs/common';
import { Task } from '../domain/task';

export type ResolvedWorkspaceContext = {
  task: Task;
  workspaceRoot: string;
};

export type TaskWorkspaceContextCacheEntry = {
  expiresAt: number;
  promise: Promise<ResolvedWorkspaceContext>;
};

@Injectable()
export class TaskWorkspaceContextCacheService {
  private readonly entries = new Map<string, TaskWorkspaceContextCacheEntry>();

  get(
    taskId: string,
    userId: string,
    now: number,
  ): TaskWorkspaceContextCacheEntry | null {
    const entry = this.entries.get(this.toCacheKey(taskId, userId));

    if (!entry || entry.expiresAt <= now) {
      return null;
    }

    return entry;
  }

  begin(
    taskId: string,
    userId: string,
    promise: Promise<ResolvedWorkspaceContext>,
  ): void {
    this.entries.set(this.toCacheKey(taskId, userId), {
      expiresAt: Number.POSITIVE_INFINITY,
      promise,
    });
  }

  finalize(
    taskId: string,
    userId: string,
    promise: Promise<ResolvedWorkspaceContext>,
    expiresAt: number,
  ): boolean {
    const current = this.entries.get(this.toCacheKey(taskId, userId));

    if (!current || current.promise !== promise) {
      return false;
    }

    current.expiresAt = expiresAt;
    return true;
  }

  delete(
    taskId: string,
    userId: string,
    promise?: Promise<ResolvedWorkspaceContext>,
  ): boolean {
    const cacheKey = this.toCacheKey(taskId, userId);
    const current = this.entries.get(cacheKey);

    if (!current) {
      return false;
    }

    if (promise && current.promise !== promise) {
      return false;
    }

    return this.entries.delete(cacheKey);
  }

  pruneExpired(now: number, maxEntries: number): void {
    if (this.entries.size < maxEntries) {
      return;
    }

    for (const [cacheKey, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(cacheKey);
      }
    }
  }

  invalidateTask(taskId: string): void {
    const suffix = `:${taskId}`;

    for (const cacheKey of this.entries.keys()) {
      if (cacheKey.endsWith(suffix)) {
        this.entries.delete(cacheKey);
      }
    }
  }

  private toCacheKey(taskId: string, userId: string): string {
    return `${userId}:${taskId}`;
  }
}
