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
};

@Injectable()
export class TaskWorkspaceWatchService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskWorkspaceWatchService.name);
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
    private readonly configService: ConfigService = new ConfigService(),
  ) {}

  subscribe(taskId: string, listener: TaskWorkspaceListener): () => void {
    const state = this.ensureTaskState(taskId);
    state.listeners.add(listener);
    void this.syncTaskWatch(taskId);

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

    state.syncPromise = this.performSyncTaskWatch(taskId, state);

    try {
      await state.syncPromise;
    } finally {
      state.syncPromise = null;

      if (state.resyncRequested) {
        state.resyncRequested = false;
        await this.syncTaskWatch(taskId);
      }
    }
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
      this.logger.warn(
        `workspace_watch_failed taskId=${taskId} message=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return watcher;
  }

  private scheduleFlush(taskId: string, state: TaskWatchState): void {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(() => {
      state.debounceTimer = null;
      this.flushChanges(taskId, state);
    }, this.debounceMs);
  }

  private flushChanges(taskId: string, state: TaskWatchState): void {
    if (!state.pendingChanges.size && !state.truncated) {
      return;
    }

    const changes: TaskWorkspaceChangeEntry[] = [
      ...state.pendingChanges.entries(),
    ].map(([relativePath, kind]) => ({
      path: relativePath,
      kind,
    }));

    state.pendingChanges.clear();
    const truncated = state.truncated;
    state.truncated = false;
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

    return relativePath === '.git' || relativePath.startsWith('.git/');
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
