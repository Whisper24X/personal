import { spawnSync } from 'child_process';
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
  emit: (event: string, payload: unknown) => void;
};

const watchMock = chokidar.watch as jest.Mock;
const debounceMs = 10;

const createFakeWatcher = (): FakeWatcher => {
  const handlers = new Map<string, (payload: unknown) => void>();
  const watcher: FakeWatcher = {
    on: jest.fn((event: string, handler: (payload: unknown) => void) => {
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

const createConfigService = () => ({
  get: jest.fn((key: string) => {
    if (key === 'AINATIVE_TASK_WORKSPACE_EVENT_DEBOUNCE_MS') {
      return String(debounceMs);
    }

    return undefined;
  }),
});

const runGit = (cwd: string, args: string[]) => {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`,
    );
  }
};

const initGitRepo = (cwd: string) => {
  runGit(cwd, ['init']);
  runGit(cwd, ['config', 'user.email', 'test@example.com']);
  runGit(cwd, ['config', 'user.name', 'AINative Test']);
};

const waitForWorkspaceFlush = async () => {
  await new Promise((resolve) => setTimeout(resolve, debounceMs * 4));
};

describe('TaskWorkspaceWatchService', () => {
  let worktreePath: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    worktreePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-workspace-watch-'),
    );
    initGitRepo(worktreePath);
  });

  afterEach(async () => {
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
      createConfigService() as never,
    );
    const listener = jest.fn();

    service.subscribe('task-1', listener);
    await service.syncTaskWatch('task-1');

    watcher.emit('change', path.join(worktreePath, 'src/app.ts'));
    watcher.emit('add', path.join(worktreePath, 'docs/spec.md'));
    await waitForWorkspaceFlush();

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

  it('should skip untracked files ignored by gitignore', async () => {
    const watcher = createFakeWatcher();
    watchMock.mockReturnValue(watcher);

    await fs.writeFile(worktreePath + '/.gitignore', '*.log\ndist/\n', 'utf-8');
    await fs.mkdir(path.join(worktreePath, 'dist'), { recursive: true });

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
      createConfigService() as never,
    );
    const listener = jest.fn();

    service.subscribe('task-1', listener);
    await service.syncTaskWatch('task-1');

    watcher.emit('change', path.join(worktreePath, 'debug.log'));
    watcher.emit('add', path.join(worktreePath, 'dist/server.js'));
    await waitForWorkspaceFlush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('should keep files re-included by gitignore negation', async () => {
    const watcher = createFakeWatcher();
    watchMock.mockReturnValue(watcher);

    await fs.writeFile(
      worktreePath + '/.gitignore',
      'dist/*\n!dist/keep.js\n',
      'utf-8',
    );
    await fs.mkdir(path.join(worktreePath, 'dist'), { recursive: true });

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
      createConfigService() as never,
    );
    const listener = jest.fn();

    service.subscribe('task-1', listener);
    await service.syncTaskWatch('task-1');

    watcher.emit('change', path.join(worktreePath, 'dist/output.js'));
    watcher.emit('change', path.join(worktreePath, 'dist/keep.js'));
    await waitForWorkspaceFlush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [{ path: 'dist/keep.js', kind: 'change' }],
        truncated: false,
      }),
    );
  });

  it('should continue emitting changes for tracked files matched by gitignore', async () => {
    const watcher = createFakeWatcher();
    watchMock.mockReturnValue(watcher);

    await fs.mkdir(path.join(worktreePath, 'dist'), { recursive: true });
    await fs.writeFile(worktreePath + '/.gitignore', 'dist/\n', 'utf-8');
    await fs.writeFile(
      path.join(worktreePath, 'dist/tracked.js'),
      'console.log(1)\n',
    );
    runGit(worktreePath, ['add', '.gitignore']);
    runGit(worktreePath, ['add', '-f', 'dist/tracked.js']);
    runGit(worktreePath, ['commit', '-m', 'seed tracked build output']);

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
      createConfigService() as never,
    );
    const listener = jest.fn();

    service.subscribe('task-1', listener);
    await service.syncTaskWatch('task-1');

    watcher.emit('change', path.join(worktreePath, 'dist/tracked.js'));
    await waitForWorkspaceFlush();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [{ path: 'dist/tracked.js', kind: 'change' }],
        truncated: false,
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
      createConfigService() as never,
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

  it('should ignore dependency and build output directories', async () => {
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
      createConfigService() as never,
    );

    service.subscribe('task-1', jest.fn());
    await service.syncTaskWatch('task-1');

    const [, options] = watchMock.mock.calls[0] as [
      string,
      { ignored: (watchedPath: string) => boolean },
    ];

    expect(
      options.ignored(path.join(worktreePath, 'ainative-app/node_modules')),
    ).toBe(true);
    expect(
      options.ignored(path.join(worktreePath, 'ainative-shadow/dist/assets')),
    ).toBe(true);
    expect(
      options.ignored(path.join(worktreePath, 'ainative-backend/tmp/build')),
    ).toBe(true);
    expect(options.ignored(path.join(worktreePath, 'logs/backend.log'))).toBe(
      true,
    );
    expect(
      options.ignored(path.join(worktreePath, 'ainative-app/src/app.ts')),
    ).toBe(false);
  });

  it('should suppress duplicate capacity warnings for the same watcher', async () => {
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
      createConfigService() as never,
    );
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    service.subscribe('task-1', jest.fn());
    await service.syncTaskWatch('task-1');

    watcher.emit(
      'error',
      Object.assign(new Error('EMFILE: too many open files, watch'), {
        code: 'EMFILE',
      }),
    );
    watcher.emit(
      'error',
      Object.assign(new Error('EMFILE: too many open files, watch'), {
        code: 'EMFILE',
      }),
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'workspace_watch_failed taskId=task-1 message=EMFILE: too many open files, watch',
      ),
    );
  });
});
