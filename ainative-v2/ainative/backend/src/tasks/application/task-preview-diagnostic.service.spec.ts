import { TaskPreviewDiagnosticService } from './task-preview-diagnostic.service';
import { TaskLogLevel } from '../dto/task-log-level.enum';

describe('TaskPreviewDiagnosticService', () => {
  const currentUser = { sub: 'user-1', roles: ['admin'] } as never;

  const createService = () => {
    const taskAccessService = {
      assertCanAccessTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskLogRepository = {
      findLatestByTaskId: jest.fn().mockResolvedValue([]),
    };

    const service = new TaskPreviewDiagnosticService(
      taskAccessService as never,
      taskLogService as never,
      taskLogRepository as never,
    );

    return {
      service,
      taskLogService,
      taskLogRepository,
    };
  };

  it('writes preview runtime diagnostics into task logs', async () => {
    const { service, taskLogService } = createService();

    await service.reportDiagnostic(
      'task-1',
      {
        kind: 'workspace-runtime-error',
        message: 'Preview runtime error',
        summary: 'TypeError: bootstrap failed',
        detail: {
          source: 'unhandledrejection',
          message: 'TypeError: bootstrap failed',
          stack: 'TypeError: bootstrap failed\n at bootstrap.ts:1:1',
          token: 'should-not-pass-through',
        },
      },
      currentUser,
    );

    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: 'task-1',
      level: TaskLogLevel.warn,
      message: 'Preview runtime error',
      payload: {
        category: 'preview-diagnostic',
        diagnosticKind: 'workspace-runtime-error',
        summary: 'TypeError: bootstrap failed',
        dedupeKey: expect.any(String),
        detail: {
          source: 'unhandledrejection',
          message: 'TypeError: bootstrap failed',
          stack: 'TypeError: bootstrap failed\n at bootstrap.ts:1:1',
        },
      },
    });
  });

  it('deduplicates recently repeated diagnostics', async () => {
    const { service, taskLogService, taskLogRepository } = createService();
    taskLogRepository.findLatestByTaskId.mockResolvedValue([
      {
        id: 'log-1',
        taskId: 'task-1',
        level: 'warn',
        message: 'Preview runtime error',
        payload: {
          category: 'preview-diagnostic',
          dedupeKey: 'workspace-runtime-error|TypeError: bootstrap failed',
        },
        createdAt: new Date(),
      },
    ]);

    await service.reportDiagnostic(
      'task-1',
      {
        kind: 'workspace-runtime-error',
        summary: 'TypeError: bootstrap failed',
        dedupeKey: 'workspace-runtime-error|TypeError: bootstrap failed',
      },
      currentUser,
    );

    expect(taskLogService.appendLog).not.toHaveBeenCalled();
  });
});
