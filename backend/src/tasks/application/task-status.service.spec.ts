import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskStatusService } from './task-status.service';

describe('TaskStatusService', () => {
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
    createdBy: 'user-1',
  });

  const createNode = (status: TaskStatus) => ({
    id: `node-${status}`,
    taskId: 'task-1',
    nodeOrder: 1,
    name: 'Agent node',
    input: {
      taskInput: 'task prompt',
      nodeInput: 'Run task',
    },
    agentClioutput: null,
    agentCliSessionId: null,
    agentCliId: 'codex',
    agentCliConfigId: 'cfg-1',
    configJson: null,
    loopJson: {
      enabled: false,
      loopCount: 0,
      maxLoops: 1,
    },
    runtimeJson: null,
    status,
    startedAt: new Date('2026-03-19T10:00:00.000Z'),
    finishedAt:
      status === TaskStatus.inProgress
        ? null
        : new Date('2026-03-19T10:05:00.000Z'),
    createdAt: new Date('2026-03-19T10:00:00.000Z'),
    updatedAt: new Date('2026-03-19T10:05:00.000Z'),
  });

  it('should keep the task container when status moves to in_review', async () => {
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.inProgress)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskNodeRepository = {
      findByTaskId: jest
        .fn()
        .mockResolvedValue([createNode(TaskStatus.inReview)]),
    };
    const notificationsService = {
      notifyTaskStatusChanged: jest.fn().mockResolvedValue(undefined),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskConfigResolver = {
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
    };
    const containerExecutionConfig = {
      isDockerMode: jest.fn().mockReturnValue(true),
    };
    const containerOrchestration = {
      removeContainerForTask: jest.fn().mockResolvedValue(undefined),
    };
    const goalsService = {
      syncPlanSubTaskStatusFromLinkedTask: jest
        .fn()
        .mockResolvedValue(undefined),
    };

    const service = new TaskStatusService(
      taskRepository as never,
      taskNodeRepository as never,
      notificationsService as never,
      taskLogService as never,
      taskConfigResolver as never,
      containerExecutionConfig as never,
      containerOrchestration as never,
      goalsService as never,
    );

    await service.recalculateTaskStatus('task-1');

    expect(taskRepository.update).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: TaskStatus.inReview,
        finishedAt: null,
      }),
    );
    expect(
      containerOrchestration.removeContainerForTask,
    ).not.toHaveBeenCalled();
    expect(
      goalsService.syncPlanSubTaskStatusFromLinkedTask,
    ).toHaveBeenCalledWith('task-1', TaskStatus.inReview);
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        taskNodeId: null,
        message: 'Task kept sandbox for troubleshooting',
      }),
    );
  });

  it('should remove the task container only when status reaches done', async () => {
    const taskRepository = {
      findById: jest.fn().mockResolvedValue(createTask(TaskStatus.inReview)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskNodeRepository = {
      findByTaskId: jest.fn().mockResolvedValue([createNode(TaskStatus.done)]),
    };
    const notificationsService = {
      notifyTaskStatusChanged: jest.fn().mockResolvedValue(undefined),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskConfigResolver = {
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
    };
    const containerExecutionConfig = {
      isDockerMode: jest.fn().mockReturnValue(true),
    };
    const containerOrchestration = {
      removeContainerForTask: jest.fn().mockResolvedValue(undefined),
    };
    const goalsService = {
      syncPlanSubTaskStatusFromLinkedTask: jest
        .fn()
        .mockResolvedValue(undefined),
    };

    const service = new TaskStatusService(
      taskRepository as never,
      taskNodeRepository as never,
      notificationsService as never,
      taskLogService as never,
      taskConfigResolver as never,
      containerExecutionConfig as never,
      containerOrchestration as never,
      goalsService as never,
    );

    await service.recalculateTaskStatus('task-1');

    expect(containerOrchestration.removeContainerForTask).toHaveBeenCalledWith(
      'task-1',
      'project-1',
    );
    expect(
      goalsService.syncPlanSubTaskStatusFromLinkedTask,
    ).toHaveBeenCalledWith('task-1', TaskStatus.done);
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        taskNodeId: null,
        message: 'Task completed; worktree preserved',
      }),
    );
  });
});
