import { NotFoundException } from '@nestjs/common';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskSchedulerService } from './task-scheduler.service';

const createService = () => {
  const taskRepository = {
    findTasksReadyForDispatch: jest.fn(),
    countRunningTasksByProjectIds: jest.fn(),
    countRunningTasks: jest.fn(),
    findTasksWithExpiredWorktrees: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  };
  const taskNodeRepository = {
    claimFirstTodoNode: jest.fn(),
    findExpiredInProgressNodes: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    renewNodeLease: jest.fn(),
  };
  const projectRepository = {
    findPage: jest.fn(),
  };
  const dataSource = {
    query: jest
      .fn()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ unlocked: true }]),
  };
  const taskNodeExecutionService = {
    runNode: jest.fn(),
  };
  const taskAccessService = {
    getTaskByIdOrThrow: jest.fn(),
    getProjectByIdOrThrow: jest.fn(),
  };
  const taskRuntimeService = {
    cleanupRuntime: jest.fn(),
  };
  const taskOutputService = {
    writeNodeOutputJsonl: jest.fn(),
  };
  const taskLogService = {
    appendLog: jest.fn(),
  };
  const taskStatusService = {
    recalculateTaskStatus: jest.fn(),
  };
  const taskConfigResolver = {
    readNodeLeaseUntil: jest.fn(),
    readRuntimeWorkerId: jest.fn(),
  };
  const containerExecutionConfig = {
    getMaxContainersPerProject: jest.fn(),
    getSlotTtlMs: jest.fn(),
  };
  const projectExecutionSlotRepository = {
    claimSlotWithinLimit: jest.fn(),
    releaseSlotByTaskId: jest.fn(),
  };
  const containerOrchestration = {
    recoverExpiredSlots: jest.fn().mockResolvedValue(undefined),
  };
  const taskWorkspaceWatchService = {
    syncTaskWatch: jest.fn(),
  };
  const taskWorkspaceContextCache = {
    invalidateTask: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const notificationsService = {
    notifyTaskNodeStatusChanged: jest.fn(),
  };

  const service = new TaskSchedulerService(
    taskRepository as never,
    taskNodeRepository as never,
    projectRepository as never,
    dataSource as never,
    taskNodeExecutionService as never,
    taskAccessService as never,
    taskRuntimeService as never,
    taskOutputService as never,
    taskLogService as never,
    taskStatusService as never,
    taskConfigResolver as never,
    containerExecutionConfig as never,
    projectExecutionSlotRepository as never,
    containerOrchestration as never,
    taskWorkspaceWatchService as never,
    taskWorkspaceContextCache as never,
    configService as never,
    notificationsService as never,
  );

  return {
    service,
    taskNodeRepository,
    taskAccessService,
    taskOutputService,
    taskLogService,
    taskStatusService,
    taskConfigResolver,
    containerOrchestration,
    notificationsService,
  };
};

describe('TaskSchedulerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should mark orphaned expired nodes as in review when task lookup fails', async () => {
    const {
      service,
      taskNodeRepository,
      taskAccessService,
      taskOutputService,
      taskLogService,
      taskStatusService,
      taskConfigResolver,
      containerOrchestration,
      notificationsService,
    } = createService();

    const expiredAt = new Date('2026-04-10T08:00:00.000Z');
    const latestNode = {
      id: 'node-1',
      taskId: 'task-missing',
      nodeOrder: 1,
      name: 'Execute task',
      status: TaskStatus.inProgress,
      agentClioutput: null,
      agentCliSessionId: null,
      runtimeJson: {
        leaseUntil: expiredAt.toISOString(),
      },
      createdAt: new Date('2026-04-10T07:00:00.000Z'),
      updatedAt: new Date('2026-04-10T07:59:00.000Z'),
      finishedAt: null,
    };

    taskNodeRepository.findExpiredInProgressNodes.mockResolvedValue([
      latestNode,
    ]);
    taskNodeRepository.findById.mockResolvedValue(latestNode);
    taskAccessService.getTaskByIdOrThrow.mockRejectedValue(
      new NotFoundException('Task not found'),
    );
    taskConfigResolver.readNodeLeaseUntil.mockReturnValue(expiredAt);
    taskConfigResolver.readRuntimeWorkerId.mockReturnValue('worker-1');

    const warnSpy = jest
      .spyOn(
        (service as never as { logger: { warn: (message: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await expect(
      (
        service as never as {
          recoverExpiredLeases: () => Promise<void>;
        }
      ).recoverExpiredLeases(),
    ).resolves.toBeUndefined();

    expect(taskNodeRepository.update).toHaveBeenCalledWith('node-1', {
      status: TaskStatus.inReview,
      finishedAt: expect.any(Date),
      runtimeJson: null,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Recovered orphaned expired node node-1'),
    );
    expect(taskOutputService.writeNodeOutputJsonl).not.toHaveBeenCalled();
    expect(taskLogService.appendLog).not.toHaveBeenCalled();
    expect(taskStatusService.recalculateTaskStatus).not.toHaveBeenCalled();
    expect(containerOrchestration.recoverExpiredSlots).toHaveBeenCalled();
    expect(
      notificationsService.notifyTaskNodeStatusChanged,
    ).not.toHaveBeenCalled();
  });
});
