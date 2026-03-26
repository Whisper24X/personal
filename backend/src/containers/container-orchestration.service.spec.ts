import { TaskMode } from '../tasks/dto/task-mode.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { ContainerOrchestrationService } from './container-orchestration.service';

describe('ContainerOrchestrationService', () => {
  const createTask = (status: TaskStatus) => ({
    id: 'task-1',
    projectId: 'project-1',
    businessLineId: 'business-line-1',
    mode: TaskMode.workflow,
    title: 'Workflow task',
    prompt: 'task prompt',
    status,
    gitBranch: 'feature/task-1',
    gitBaseBranch: 'main',
    gitWorktree: 'wk-task-1',
    configJson: null,
    startedAt: new Date('2026-03-19T10:00:00.000Z'),
    finishedAt: null,
    createdAt: new Date('2026-03-19T10:00:00.000Z'),
    updatedAt: new Date('2026-03-19T10:00:00.000Z'),
    deletedAt: null,
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should resume heartbeat for valid paused task slots on startup', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      remove: jest.fn().mockResolvedValue(undefined),
      listAinativeContainers: jest.fn().mockResolvedValue([]),
    };
    const slotRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'slot-1',
          projectId: 'project-1',
          taskId: 'task-1',
          containerId: 'container-1',
          claimedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date(Date.now() + 60_000),
          heartbeatAt: null,
        },
      ]),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.inReview)),
    };

    const service = new ContainerOrchestrationService(
      config as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );

    await service.resumeActiveSlotsOnStartup();
    await jest.advanceTimersByTimeAsync(1000);

    expect(slotRepository.renewSlot).toHaveBeenCalledWith('project-1', 5000);
    expect(slotRepository.releaseSlot).not.toHaveBeenCalled();
    expect(isolatedRunner.remove).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('should release stale done-task slots on startup instead of resuming them', async () => {
    const config = {
      isDockerMode: jest.fn().mockReturnValue(true),
      getSlotHeartbeatMs: jest.fn().mockReturnValue(1000),
      getSlotTtlMs: jest.fn().mockReturnValue(5000),
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };
    const isolatedRunner = {
      remove: jest.fn().mockResolvedValue(undefined),
      listAinativeContainers: jest.fn().mockResolvedValue([]),
    };
    const slotRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'slot-1',
          projectId: 'project-1',
          taskId: 'task-1',
          containerId: 'container-1',
          claimedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date(Date.now() + 60_000),
          heartbeatAt: null,
        },
      ]),
      renewSlot: jest.fn().mockResolvedValue(undefined),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.done)),
    };

    const service = new ContainerOrchestrationService(
      config as never,
      isolatedRunner as never,
      slotRepository as never,
      taskRepository as never,
    );

    await service.resumeActiveSlotsOnStartup();
    await jest.advanceTimersByTimeAsync(1000);

    expect(isolatedRunner.remove).toHaveBeenCalledWith('ainative-task-task-1');
    expect(slotRepository.releaseSlot).toHaveBeenCalledWith('project-1');
    expect(slotRepository.renewSlot).not.toHaveBeenCalled();
  });
});
