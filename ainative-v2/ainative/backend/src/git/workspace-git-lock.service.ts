import { Injectable, Logger } from '@nestjs/common';

interface LockState {
  tail: Promise<void>;
  pending: number;
}

/**
 * ainative-workspace 仓库级 Git 串行锁。
 *
 * 按 repositoryRoot 粒度串行化仓库元数据操作
 * （clone / worktree add/remove / branch delete / remote push delete）。
 *
 * 子仓 fetch/read-tree 在独立 worktree 内可并行，不受此锁限制。
 *
 * v1 使用 in-memory mutex；多实例部署必须升级为 DB/Redis 分布式锁。
 */
@Injectable()
export class WorkspaceGitLockService {
  private readonly logger = new Logger(WorkspaceGitLockService.name);
  private readonly locks = new Map<string, LockState>();

  async withLock<T>(
    repositoryRoot: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let state = this.locks.get(repositoryRoot);

    if (!state) {
      state = { tail: Promise.resolve(), pending: 0 };
      this.locks.set(repositoryRoot, state);
    }

    const previous = state.tail;
    state.pending += 1;

    let releaseCurrent!: () => void;
    state.tail = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    await previous.catch(() => undefined);

    const startTime = Date.now();
    try {
      return await operation();
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed > 30_000) {
        this.logger.warn(
          `[workspace-lock] ${repositoryRoot} held for ${elapsed}ms (> 30s)`,
        );
      }

      releaseCurrent();
      state.pending -= 1;

      if (state.pending === 0) {
        this.locks.delete(repositoryRoot);
      }
    }
  }

  getPendingCount(repositoryRoot: string): number {
    return this.locks.get(repositoryRoot)?.pending ?? 0;
  }
}
