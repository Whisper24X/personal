import { NotFoundException } from '@nestjs/common';
import { TaskNodeStatus } from '../dto/task-node-status.enum';
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
    findAllWithPagination: jest.fn(),
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
    taskRepository,
    taskNodeRepository,
    projectRepository,
    taskAccessService,
    taskOutputService,
    taskLogService,
    taskStatusService,
    taskConfigResolver,
    projectExecutionSlotRepository,
    containerOrchestration,
    taskNodeExecutionService,
    notificationsService,
    containerExecutionConfig,
  };
};

describe('TaskSchedulerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should mark orphaned expired nodes as failed when task lookup fails', async () => {
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
      status: TaskNodeStatus.failed,
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

  it('should not dispatch workspace-native task while workspace is provisioning', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectRepository,
      projectExecutionSlotRepository,
      taskNodeExecutionService,
      containerExecutionConfig,
    } = createService();
    const task = {
      id: 'task-1',
      projectId: 'project-1',
      configJson: {
        workspaceStatus: 'provisioning',
      },
    };
    const project = {
      id: 'project-1',
      configJson: {
        subtreeMode: 'workspace-native',
      },
    };

    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({});
    taskRepository.countRunningTasks.mockResolvedValue(0);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    containerExecutionConfig.getMaxContainersPerProject.mockReturnValue(2);

    await expect(
      (
        service as never as {
          scheduleQueuedNodes: () => Promise<void>;
        }
      ).scheduleQueuedNodes(),
    ).resolves.toBeUndefined();

    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).not.toHaveBeenCalled();
    expect(taskNodeRepository.claimFirstTodoNode).not.toHaveBeenCalled();
    expect(taskNodeExecutionService.runNode).not.toHaveBeenCalled();
  });

  it('should dispatch legacy workspace-native task when workspace status is missing', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectRepository,
      projectExecutionSlotRepository,
      taskNodeExecutionService,
      taskStatusService,
      taskLogService,
      containerExecutionConfig,
    } = createService();
    const task = {
      id: 'task-legacy',
      projectId: 'project-1',
      configJson: {
        workspaceSnapshot: {
          taskBranch: 'feature/legacy',
          snapshotCommitSha: 'abc123',
        },
      },
    };
    const project = {
      id: 'project-1',
      configJson: {
        subtreeMode: 'workspace-native',
      },
    };
    const node = {
      id: 'node-1',
      nodeOrder: 1,
    };

    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({});
    taskRepository.countRunningTasks.mockResolvedValue(0);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    containerExecutionConfig.getMaxContainersPerProject.mockReturnValue(2);
    containerExecutionConfig.getSlotTtlMs.mockReturnValue(5_000);
    projectExecutionSlotRepository.claimSlotWithinLimit.mockResolvedValue(
      'claimed',
    );
    taskNodeRepository.claimFirstTodoNode.mockResolvedValue(node);

    await expect(
      (
        service as never as {
          scheduleQueuedNodes: () => Promise<void>;
        }
      ).scheduleQueuedNodes(),
    ).resolves.toBeUndefined();

    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).toHaveBeenCalledWith('project-1', 'task-legacy', 5_000, 2);
    expect(taskNodeRepository.claimFirstTodoNode).toHaveBeenCalled();
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-legacy',
        taskNodeId: 'node-1',
        message: 'Node execution started',
      }),
    );
    expect(taskStatusService.recalculateTaskStatus).toHaveBeenCalledWith(
      'task-legacy',
    );
    expect(taskNodeExecutionService.runNode).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-legacy',
        nodeId: 'node-1',
        project,
      }),
    );
  });
});
