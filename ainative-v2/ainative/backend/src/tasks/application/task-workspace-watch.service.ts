import { spawn } from 'child_process';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import chokidar, { FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import path from 'path';
import { ProjectRepository } from '../../projects/infrastructure/persistence/project.repository';
import {
  TaskWorkspaceChangeEntry,
  TaskWorkspaceChangeEvent,
  TaskWorkspaceChangeKind,
} from '../task-workspace-change.event';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskRepository } from '../infrastructure/persistence/task.repository';

type TaskWorkspaceListener = (event: TaskWorkspaceChangeEvent) => void;

type TaskWatchState = {
  listeners: Set<TaskWorkspaceListener>;
  watcher: FSWatcher | null;
  worktreePath: string | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  pendingChanges: Map<string, TaskWorkspaceChangeKind>;
  truncated: boolean;
  eventSeq: number;
  syncPromise: Promise<void> | null;
  resyncRequested: boolean;
  reportedCapacityErrorCodes: Set<string>;
};

const DEFAULT_IGNORED_WORKTREE_SEGMENTS = new Set<string>([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.turbo',
  '.vite',
  '.yarn',
  '.pnpm-store',
  'tmp',
  'logs',
  'out',
]);

@Injectable()
export class TaskWorkspaceWatchService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskWorkspaceWatchService.name);
  private readonly gitCheckIgnoreTimeoutMs = 5_000;
  private readonly debounceMs = this.readPositiveNumberFromEnv(
    'AINATIVE_TASK_WORKSPACE_EVENT_DEBOUNCE_MS',
    800,
  );
  private readonly maxChangesPerEvent = this.readPositiveNumberFromEnv(
    'AINATIVE_TASK_WORKSPACE_EVENT_MAX_CHANGES',
    100,
  );
  private readonly taskStates = new Map<string, TaskWatchState>();

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly configService: ConfigService,
  ) {}

  subscribe(taskId: string, listener: TaskWorkspaceListener): () => void {
    const state = this.ensureTaskState(taskId);
    state.listeners.add(listener);
    this.syncTaskWatch(taskId).catch((error) => {
      this.logger.warn(
        `workspace_watch_sync_failed taskId=${taskId} message=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return () => {
      this.unsubscribe(taskId, listener);
    };
  }

  async syncTaskWatch(taskId: string): Promise<void> {
    const state = this.taskStates.get(taskId);
    if (!state || state.listeners.size === 0) {
      return;
    }

    if (state.syncPromise) {
      state.resyncRequested = true;
      await state.syncPromise;
      return;
    }

    state.syncPromise = (async () => {
      try {
        await this.performSyncTaskWatch(taskId, state);

        while (state.resyncRequested) {
          state.resyncRequested = false;
          await this.performSyncTaskWatch(taskId, state);
        }
      } finally {
        state.syncPromise = null;
      }
    })();

    await state.syncPromise;
  }

  async onModuleDestroy(): Promise<void> {
    const taskIds = [...this.taskStates.keys()];

    await Promise.all(taskIds.map((taskId) => this.teardownTaskState(taskId)));
  }

  private async performSyncTaskWatch(
    taskId: string,
    expectedState: TaskWatchState,
  ): Promise<void> {
    const nextWorktreePath = await this.resolveExistingWorktreePath(taskId);
    const currentState = this.taskStates.get(taskId);

    if (currentState !== expectedState || !currentState) {
      return;
    }

    if (currentState.listeners.size === 0) {
      await this.teardownTaskState(taskId);
      return;
    }

    if (!nextWorktreePath) {
      await this.replaceWatcher(taskId, currentState, null, null);
      return;
    }

    if (
      currentState.worktreePath === nextWorktreePath &&
      currentState.watcher
    ) {
      return;
    }

    const watcher = this.createWatcher(taskId, nextWorktreePath, currentState);
    await this.replaceWatcher(taskId, currentState, nextWorktreePath, watcher);
  }

  private createWatcher(
    taskId: string,
    worktreePath: string,
    state: TaskWatchState,
  ): FSWatcher {
    const watcher = chokidar.watch(worktreePath, {
      ignoreInitial: true,
      ignored: (watchedPath) =>
        this.isIgnoredWorktreePath(worktreePath, watchedPath),
      persistent: true,
    });

    const enqueue = (kind: TaskWorkspaceChangeKind, changedPath: string) => {
      const relativePath = this.toRelativePath(worktreePath, changedPath);
      if (!relativePath) {
        return;
      }

      if (
        !state.pendingChanges.has(relativePath) &&
        state.pendingChanges.size >= this.maxChangesPerEvent
      ) {
        state.truncated = true;
        this.scheduleFlush(taskId, state);
        return;
      }

      state.pendingChanges.set(relativePath, kind);
      this.scheduleFlush(taskId, state);
    };

    watcher.on('add', (changedPath) => enqueue('add', changedPath));
    watcher.on('change', (changedPath) => enqueue('change', changedPath));
    watcher.on('unlink', (changedPath) => enqueue('unlink', changedPath));
    watcher.on('error', (error) => {
      this.handleWatcherError(taskId, state, error);
    });

    return watcher;
  }

  private scheduleFlush(taskId: string, state: TaskWatchState): void {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      void this.flushChanges(taskId, state);
    }, this.debounceMs);
  }

  private async flushChanges(
    taskId: string,
    state: TaskWatchState,
  ): Promise<void> {
    if (!state.pendingChanges.size && !state.truncated) {
      return;
    }

    const pendingChanges: TaskWorkspaceChangeEntry[] = [
      ...state.pendingChanges.entries(),
    ].map(([relativePath, kind]) => ({
      path: relativePath,
      kind,
    }));

    state.pendingChanges.clear();
    const truncated = state.truncated;
    state.truncated = false;

    const changes = await this.filterGitIgnoredChanges(
      state.worktreePath,
      pendingChanges,
      taskId,
    );

    if (!changes.length && !truncated) {
      return;
    }

    state.eventSeq += 1;

    const event: TaskWorkspaceChangeEvent = {
      id: `${taskId}:${Date.now()}:${state.eventSeq}`,
      taskId,
      changedAt: new Date().toISOString(),
      changes,
      truncated,
    };

    for (const listener of state.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn(
          `workspace_event_listener_failed taskId=${taskId} message=${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async filterGitIgnoredChanges(
    worktreePath: string | null,
    changes: TaskWorkspaceChangeEntry[],
    taskId: string,
  ): Promise<TaskWorkspaceChangeEntry[]> {
    if (!worktreePath || changes.length === 0) {
      return changes;
    }

    const mainPaths: string[] = [];
    const subRepoGroups = new Map<string, string[]>();
    const subRepoCache = new Map<string, boolean>();

    for (const change of changes) {
      const firstSlash = change.path.indexOf('/');
      if (firstSlash > 0) {
        const firstDir = change.path.slice(0, firstSlash);

        if (!subRepoCache.has(firstDir)) {
          const gitPath = path.join(worktreePath, firstDir, '.git');
          try {
            await fs.access(gitPath);
            subRepoCache.set(firstDir, true);
          } catch {
            subRepoCache.set(firstDir, false);
          }
        }

        if (subRepoCache.get(firstDir)) {
          const relPath = change.path.slice(firstSlash + 1);
          if (!subRepoGroups.has(firstDir)) {
            subRepoGroups.set(firstDir, []);
          }
          subRepoGroups.get(firstDir)!.push(relPath);
          continue;
        }
      }
      mainPaths.push(change.path);
    }

    const ignoredPaths = new Set<string>();

    if (mainPaths.length > 0) {
      const result = await this.runGitCheckIgnore(worktreePath, mainPaths);
      if (!result.success) {
        this.logger.warn(
          `workspace_check_ignore_failed taskId=${taskId} message=${
            result.stderr ||
            `git exited with code ${result.exitCode ?? 'unknown'}`
          }`,
        );
      } else {
        for (const p of result.ignoredPaths) {
          ignoredPaths.add(p);
        }
      }
    }

    for (const [prefix, paths] of subRepoGroups) {
      const subCwd = path.join(worktreePath, prefix);
      const result = await this.runGitCheckIgnore(subCwd, paths);
      if (result.success) {
        for (const p of result.ignoredPaths) {
          ignoredPaths.add(`${prefix}/${p}`);
        }
      }
    }

    if (ignoredPaths.size === 0) {
      return changes;
    }

    return changes.filter((change) => !ignoredPaths.has(change.path));
  }

  private async runGitCheckIgnore(
    cwd: string,
    relativePaths: string[],
  ): Promise<{
    success: boolean;
    ignoredPaths: string[];
    stderr: string;
    exitCode: number | null;
  }> {
    return new Promise((resolve) => {
      const processRef = spawn(
        'git',
        ['-C', cwd, 'check-ignore', '--stdin', '-z'],
        {
          stdio: 'pipe',
          env: process.env,
        },
      );

      const stdoutChunks: Buffer[] = [];
      let stderr = '';
      let settled = false;

      const finish = (result: {
        success: boolean;
        ignoredPaths: string[];
        stderr: string;
        exitCode: number | null;
      }) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      };

      processRef.stdout?.on('data', (chunk) => {
        stdoutChunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf-8'),
        );
      });

      processRef.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      processRef.stdin?.on('error', () => {
        // Ignore broken pipes and rely on the close handler result.
      });

      const timeoutRef = setTimeout(() => {
        processRef.kill('SIGTERM');
      }, this.gitCheckIgnoreTimeoutMs);

      processRef.on('error', (error) => {
        clearTimeout(timeoutRef);
        finish({
          success: false,
          ignoredPaths: [],
          stderr: error.message,
          exitCode: null,
        });
      });

      processRef.on('close', (code) => {
        clearTimeout(timeoutRef);

        const success = code === 0 || code === 1;
        const ignoredPaths = success
          ? Buffer.concat(stdoutChunks)
              .toString('utf-8')
              .split('\0')
              .filter(Boolean)
          : [];

        finish({
          success,
          ignoredPaths,
          stderr: stderr.trimEnd(),
          exitCode: code,
        });
      });

      processRef.stdin?.end(
        Buffer.from(`${relativePaths.join('\0')}\0`, 'utf-8'),
      );
    });
  }

  private unsubscribe(taskId: string, listener: TaskWorkspaceListener): void {
    const state = this.taskStates.get(taskId);
    if (!state) {
      return;
    }

    state.listeners.delete(listener);

    if (state.listeners.size === 0) {
      void this.teardownTaskState(taskId);
    }
  }

  private async replaceWatcher(
    taskId: string,
    state: TaskWatchState,
    worktreePath: string | null,
    watcher: FSWatcher | null,
  ): Promise<void> {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }

    state.pendingChanges.clear();
    state.truncated = false;
    state.reportedCapacityErrorCodes.clear();

    const previousWatcher = state.watcher;
    state.watcher = watcher;
    state.worktreePath = worktreePath;

    if (!previousWatcher) {
      return;
    }

    try {
      await previousWatcher.close();
    } catch (error) {
      this.logger.warn(
        `workspace_watch_close_failed taskId=${taskId} message=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async teardownTaskState(taskId: string): Promise<void> {
    const state = this.taskStates.get(taskId);
    if (!state) {
      return;
    }

    this.taskStates.delete(taskId);
    await this.replaceWatcher(taskId, state, null, null);
  }

  private ensureTaskState(taskId: string): TaskWatchState {
    const existingState = this.taskStates.get(taskId);
    if (existingState) {
      return existingState;
    }

    const nextState: TaskWatchState = {
      listeners: new Set<TaskWorkspaceListener>(),
      watcher: null,
      worktreePath: null,
      debounceTimer: null,
      pendingChanges: new Map<string, TaskWorkspaceChangeKind>(),
      truncated: false,
      eventSeq: 0,
      syncPromise: null,
      resyncRequested: false,
      reportedCapacityErrorCodes: new Set<string>(),
    };

    this.taskStates.set(taskId, nextState);
    return nextState;
  }

  private async resolveExistingWorktreePath(
    taskId: string,
  ): Promise<string | null> {
    const task = await this.taskRepository.findById(taskId);
    if (!task?.gitWorktree?.trim()) {
      return null;
    }

    const project = await this.projectRepository.findById(task.projectId);
    if (!project) {
      return null;
    }

    const worktreePath = this.taskRuntimeService.resolveTaskWorktreePath(
      task,
      project,
    );
    const stat = await fs.stat(worktreePath).catch(() => null);

    return stat?.isDirectory() ? path.resolve(worktreePath) : null;
  }

  private isIgnoredWorktreePath(
    worktreePath: string,
    watchedPath: string,
  ): boolean {
    const relativePath = this.toRelativePath(worktreePath, watchedPath);
    if (!relativePath) {
      return false;
    }

    return relativePath
      .split('/')
      .some((segment) => DEFAULT_IGNORED_WORKTREE_SEGMENTS.has(segment));
  }

  private handleWatcherError(
    taskId: string,
    state: TaskWatchState,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    const capacityCode = this.readCapacityErrorCode(error, message);

    if (capacityCode) {
      if (state.reportedCapacityErrorCodes.has(capacityCode)) {
        return;
      }

      state.reportedCapacityErrorCodes.add(capacityCode);
      this.logger.warn(
        `workspace_watch_failed taskId=${taskId} message=${message} note=watcher_resource_limit_reached`,
      );
      return;
    }

    this.logger.warn(
      `workspace_watch_failed taskId=${taskId} message=${message}`,
    );
  }

  private readCapacityErrorCode(
    error: unknown,
    message: string,
  ): 'EMFILE' | 'ENOSPC' | null {
    const rawCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code.toUpperCase()
        : null;

    if (rawCode === 'EMFILE' || rawCode === 'ENOSPC') {
      return rawCode;
    }

    const normalizedMessage = message.toUpperCase();

    if (normalizedMessage.includes('EMFILE')) {
      return 'EMFILE';
    }

    if (normalizedMessage.includes('ENOSPC')) {
      return 'ENOSPC';
    }

    return null;
  }

  private toRelativePath(
    worktreePath: string,
    changedPath: string,
  ): string | null {
    const absolutePath = path.isAbsolute(changedPath)
      ? path.resolve(changedPath)
      : path.resolve(worktreePath, changedPath);
    const relativePath = path
      .relative(worktreePath, absolutePath)
      .replace(/\\/g, '/');

    if (
      !relativePath ||
      relativePath === '.' ||
      relativePath.startsWith('../') ||
      relativePath === '..'
    ) {
      return null;
    }

    return relativePath;
  }

  private readPositiveNumberFromEnv(key: string, defaultValue: number): number {
    const rawValue = this.configService.get<string>(key, { infer: true });

    if (!rawValue) {
      return defaultValue;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return defaultValue;
    }

    return Math.floor(parsedValue);
  }
}
