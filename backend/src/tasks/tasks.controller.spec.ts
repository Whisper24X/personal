import { firstValueFrom } from 'rxjs';
import { TasksController } from './tasks.controller';

describe('TasksController', () => {
  it('should pass through afterId query when opening stream', async () => {
    const tasksService = {
      openLogStream: jest.fn().mockResolvedValue({
        subscribe: jest.fn().mockImplementation((listener) => {
          listener({
            id: 'log-2',
            taskId: 'task-1',
            level: 'info',
            message: 'live',
            createdAt: new Date(),
          });
          return () => undefined;
        }),
      }),
      listLogs: jest.fn().mockResolvedValue([]),
    };
    const taskWorkspaceService = {
      getWorkspaceTree: jest.fn(),
      getWorkspaceFile: jest.fn(),
      getWorkspacePreview: jest.fn(),
    };
    const taskGitService = {
      getStatus: jest.fn(),
      getDiff: jest.fn(),
      getBranchDiffFiles: jest.fn(),
      getBranchDiff: jest.fn(),
      stageFiles: jest.fn(),
      unstageFiles: jest.fn(),
      commit: jest.fn(),
      merge: jest.fn(),
      rebase: jest.fn(),
      getPrLink: jest.fn(),
    };
    const taskTerminalService = {
      createSession: jest.fn(),
      listSessions: jest.fn(),
      input: jest.fn(),
      stopSession: jest.fn(),
      openSessionStream: jest.fn(),
    };
    const taskTitleSuggestionService = {
      suggestTitle: jest.fn(),
    };
    const taskWorkspaceWatchService = {
      subscribe: jest.fn().mockReturnValue(() => undefined),
    };

    const controller = new TasksController(
      tasksService as never,
      taskWorkspaceService as never,
      taskGitService as never,
      taskTerminalService as never,
      taskTitleSuggestionService as never,
      taskWorkspaceWatchService as never,
    );
    const observable = await controller.stream(
      {
        user: {
          sub: 'user-1',
        },
      },
      '3e790cce-84fe-4aad-a4cf-cf0a2cb090f7',
      {
        since: '2026-02-16T00:00:00.000Z',
        afterId: 'f89a1514-a8de-4e7a-a5fd-085d0c410846',
        limit: 10,
      },
    );

    const emitted = await firstValueFrom(observable);

    expect(emitted.data).toEqual(
      expect.objectContaining({
        id: 'log-2',
      }),
    );
    expect(tasksService.openLogStream).toHaveBeenCalledWith({
      taskId: '3e790cce-84fe-4aad-a4cf-cf0a2cb090f7',
      query: {
        since: '2026-02-16T00:00:00.000Z',
        afterId: 'f89a1514-a8de-4e7a-a5fd-085d0c410846',
        limit: 10,
      },
      currentUser: {
        sub: 'user-1',
      },
    });
  });

  it('should emit workspace change events from the shared task stream', async () => {
    const tasksService = {
      openLogStream: jest.fn().mockResolvedValue({
        subscribe: jest.fn().mockReturnValue(() => undefined),
      }),
    };
    const taskWorkspaceService = {
      getWorkspaceTree: jest.fn(),
      getWorkspaceFile: jest.fn(),
      getWorkspacePreview: jest.fn(),
    };
    const taskGitService = {
      getStatus: jest.fn(),
      getDiff: jest.fn(),
      getBranchDiffFiles: jest.fn(),
      getBranchDiff: jest.fn(),
      stageFiles: jest.fn(),
      unstageFiles: jest.fn(),
      commit: jest.fn(),
      merge: jest.fn(),
      rebase: jest.fn(),
      getPrLink: jest.fn(),
    };
    const taskTerminalService = {
      createSession: jest.fn(),
      listSessions: jest.fn(),
      input: jest.fn(),
      stopSession: jest.fn(),
      openSessionStream: jest.fn(),
    };
    const taskTitleSuggestionService = {
      suggestTitle: jest.fn(),
    };
    const taskWorkspaceWatchService = {
      subscribe: jest.fn().mockImplementation((_taskId, listener) => {
        listener({
          id: 'workspace-1',
          taskId: 'task-1',
          changedAt: '2026-03-27T10:00:00.000Z',
          changes: [{ path: 'src/app.ts', kind: 'change' }],
          truncated: false,
        });
        return () => undefined;
      }),
    };

    const controller = new TasksController(
      tasksService as never,
      taskWorkspaceService as never,
      taskGitService as never,
      taskTerminalService as never,
      taskTitleSuggestionService as never,
      taskWorkspaceWatchService as never,
    );

    const observable = await controller.stream(
      {
        user: {
          sub: 'user-1',
        },
      },
      '3e790cce-84fe-4aad-a4cf-cf0a2cb090f7',
      {},
    );

    const emitted = await firstValueFrom(observable);

    expect(emitted.type).toBe('task-workspace-change');
    expect(emitted.data).toEqual(
      expect.objectContaining({
        id: 'workspace-1',
        changes: [{ path: 'src/app.ts', kind: 'change' }],
      }),
    );
  });
});
