import { Injectable, Logger } from '@nestjs/common';

interface LockState {
  tail: Promise<void>;
  pending: number;
}

/**
 * 项目级 Git 串行锁。
 *
 * 按 projectId 粒度串行化所有 Git 写操作
 * （sync / createWorktree / merge / subtreePush / untrackCleanup）。
 *
 * 锁服务只负责串行，不耦合 phase 校验。
 * phase 检查由调用方或 ProjectGitStateRepository.transitionPhase() 负责。
 */
@Injectable()
export class ProjectGitLockService {
  private readonly logger = new Logger(ProjectGitLockService.name);
  private readonly locks = new Map<string, LockState>();

  /**
   * 在项目级锁内执行操作。同一 projectId 的操作串行执行，
   * 不同 projectId 互不阻塞。
   */
  async withProjectGitLock<T>(
    projectId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let state = this.locks.get(projectId);

    if (!state) {
      state = { tail: Promise.resolve(), pending: 0 };
      this.locks.set(projectId, state);
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
          `[${projectId}] Git lock held for ${elapsed}ms (> 30s)`,
        );
      }

      releaseCurrent();
      state.pending -= 1;

      if (state.pending === 0) {
        this.locks.delete(projectId);
      }
    }
  }

  /** 当前等待中的锁数量（用于监控） */
  getPendingCount(projectId: string): number {
    return this.locks.get(projectId)?.pending ?? 0;
  }
}
