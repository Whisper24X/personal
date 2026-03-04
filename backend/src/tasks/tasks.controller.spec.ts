import { firstValueFrom } from 'rxjs';
import { TasksController } from './tasks.controller';

describe('TasksController', () => {
  it('should pass through afterId query when opening stream', async () => {
    const tasksService = {
      openLogStream: jest.fn().mockResolvedValue({
        history: [
          {
            id: 'log-1',
            taskId: 'task-1',
            level: 'info',
            message: 'history',
            createdAt: new Date(),
          },
        ],
        subscribe: jest.fn().mockReturnValue(() => undefined),
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

    const controller = new TasksController(
      tasksService as never,
      taskWorkspaceService as never,
      taskGitService as never,
      taskTerminalService as never,
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
        id: 'log-1',
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
});
