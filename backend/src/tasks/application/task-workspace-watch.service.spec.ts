import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

jest.mock('chokidar', () => ({
  __esModule: true,
  default: {
    watch: jest.fn(),
  },
}));

import chokidar from 'chokidar';
import { TaskWorkspaceWatchService } from './task-workspace-watch.service';

type FakeWatcher = {
  on: jest.Mock;
  close: jest.Mock<Promise<void>, []>;
  emit: (event: string, payload: string) => void;
};

const watchMock = chokidar.watch as jest.Mock;

const createFakeWatcher = (): FakeWatcher => {
  const handlers = new Map<string, (payload: string) => void>();
  const watcher: FakeWatcher = {
    on: jest.fn((event: string, handler: (payload: string) => void) => {
      handlers.set(event, handler);
      return watcher;
    }),
    close: jest.fn().mockResolvedValue(undefined),
    emit: (event: string, payload: string) => {
      handlers.get(event)?.(payload);
    },
  };

  return watcher;
};

describe('TaskWorkspaceWatchService', () => {
  let worktreePath: string;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    worktreePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-workspace-watch-'),
    );
  });

  afterEach(async () => {
    jest.useRealTimers();
    await fs.rm(worktreePath, { recursive: true, force: true });
  });

  it('should aggregate workspace changes into a debounced event', async () => {
    const watcher = createFakeWatcher();
    watchMock.mockReturnValue(watcher);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        projectId: 'project-1',
        gitWorktree: 'wk-task-1',
      }),
    };
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
      }),
    };
    const taskRuntimeService = {
      resolveTaskWorktreePath: jest.fn().mockReturnValue(worktreePath),
    };

    const service = new TaskWorkspaceWatchService(
      taskRepository as never,
      projectRepository as never,
      taskRuntimeService as never,
    );
    const listener = jest.fn();

    service.subscribe('task-1', listener);
    await service.syncTaskWatch('task-1');

    watcher.emit('change', path.join(worktreePath, 'src/app.ts'));
    watcher.emit('add', path.join(worktreePath, 'docs/spec.md'));
    await jest.advanceTimersByTimeAsync(800);

    expect(watchMock).toHaveBeenCalledWith(
      worktreePath,
      expect.objectContaining({
        ignoreInitial: true,
      }),
    );
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        truncated: false,
        changes: expect.arrayContaining([
          { path: 'src/app.ts', kind: 'change' },
          { path: 'docs/spec.md', kind: 'add' },
        ]),
      }),
    );
  });

  it('should attach a watcher later when the task worktree becomes available', async () => {
    const watcher = createFakeWatcher();
    watchMock.mockReturnValue(watcher);

    const taskRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'task-1',
          projectId: 'project-1',
          gitWorktree: null,
        })
        .mockResolvedValueOnce({
          id: 'task-1',
          projectId: 'project-1',
          gitWorktree: 'wk-task-1',
        }),
    };
    const projectRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'project-1',
      }),
    };
    const taskRuntimeService = {
      resolveTaskWorktreePath: jest.fn().mockReturnValue(worktreePath),
    };

    const service = new TaskWorkspaceWatchService(
      taskRepository as never,
      projectRepository as never,
      taskRuntimeService as never,
    );

    service.subscribe('task-1', jest.fn());
    await service.syncTaskWatch('task-1');
    expect(watchMock).not.toHaveBeenCalled();

    await service.syncTaskWatch('task-1');
    expect(watchMock).toHaveBeenCalledWith(
      worktreePath,
      expect.objectContaining({
        ignoreInitial: true,
      }),
    );
  });
});
