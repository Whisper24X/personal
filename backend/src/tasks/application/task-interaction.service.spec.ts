import { TaskInteractionService } from './task-interaction.service';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';

const createTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'Workflow task',
  prompt: 'task prompt',
  status: TaskStatus.done,
  gitBranch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktree: 'wk-20260319-1',
  configJson: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-03-19T10:00:00.000Z'),
  updatedAt: new Date('2026-03-19T10:00:00.000Z'),
  ...overrides,
});

const createNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'Node 1',
  input: null,
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  agentClioutput: '/tmp/node-1.jsonl',
  agentCliSessionId: null,
  configJson: null,
  loopJson: null,
  runtimeJson: null,
  status: TaskStatus.done,
  startedAt: new Date('2026-03-19T10:00:00.000Z'),
  finishedAt: new Date('2026-03-19T10:10:00.000Z'),
  createdAt: new Date('2026-03-19T10:00:00.000Z'),
  updatedAt: new Date('2026-03-19T10:10:00.000Z'),
  ...overrides,
});

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createService = () => {
  const task = createTask();
  const taskRepository = {
    update: jest.fn().mockImplementation((_taskId, payload) => ({
      ...task,
      ...payload,
    })),
  };
  const taskNodeRepository = {
    findInProgressByTaskId: jest.fn().mockResolvedValue(null),
    findFirstByTaskIdAndStatus: jest.fn().mockResolvedValue(null),
    findByTaskIdAndStatus: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
  };
  const taskRuntimeService = {
    cleanupRuntime: jest.fn(),
  };
  const taskAccessService = {
    getTaskOrThrow: jest.fn().mockResolvedValue(task),
    getProjectByIdOrThrow: jest.fn(),
  };
  const taskRuntimeOrchestrator = {
    prepareTaskRuntime: jest.fn().mockResolvedValue({ task }),
  };
  const taskConfigResolver = {
    buildPendingReplyRuntimeJson: jest
      .fn()
      .mockImplementation((message: string) => ({
        pendingUserMessage: message,
      })),
  };
  const taskLogService = {
    appendLog: jest.fn().mockResolvedValue(undefined),
  };
  const taskOutputService = {
    writeNodeOutputJsonl: jest.fn(),
  };
  const taskStatusService = {
    recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
  };
  const taskQueryService = {
    detailById: jest.fn().mockResolvedValue({ task, nodes: [] }),
  };
  const taskSchedulerService = {
    triggerDispatch: jest.fn().mockResolvedValue(undefined),
  };

  const service = new TaskInteractionService(
    taskRepository as never,
    taskNodeRepository as never,
    taskRuntimeService as never,
    taskAccessService as never,
    taskRuntimeOrchestrator as never,
    taskConfigResolver as never,
    taskLogService as never,
    taskOutputService as never,
    taskStatusService as never,
    taskQueryService as never,
    taskSchedulerService as never,
  );

  return {
    service,
    task,
    taskRepository,
    taskNodeRepository,
    taskAccessService,
    taskRuntimeOrchestrator,
    taskConfigResolver,
    taskLogService,
    taskStatusService,
    taskQueryService,
    taskSchedulerService,
  };
};

describe('TaskInteractionService', () => {
  it('should reuse the most recent done node with a cli session when replying', async () => {
    const {
      service,
      taskNodeRepository,
      taskConfigResolver,
      taskQueryService,
    } = createService();
    const currentUser = createCurrentUser();
    const olderDoneNode = createNode({
      id: 'node-1',
      nodeOrder: 1,
      finishedAt: new Date('2026-03-19T10:10:00.000Z'),
      agentCliSessionId: 'session-older',
    });
    const latestDoneNodeWithoutSession = createNode({
      id: 'node-2',
      nodeOrder: 2,
      finishedAt: new Date('2026-03-19T10:20:00.000Z'),
      agentCliSessionId: null,
    });
    const latestDoneNodeWithSession = createNode({
      id: 'node-3',
      nodeOrder: 3,
      finishedAt: new Date('2026-03-19T10:30:00.000Z'),
      agentCliSessionId: 'session-latest',
    });

    taskNodeRepository.findByTaskIdAndStatus.mockResolvedValue([
      olderDoneNode,
      latestDoneNodeWithoutSession,
      latestDoneNodeWithSession,
    ]);

    await service.reply(
      'task-1',
      { message: 'Please continue' } as never,
      currentUser as never,
    );

    expect(taskNodeRepository.update).toHaveBeenCalledWith('node-3', {
      status: TaskStatus.todo,
      finishedAt: null,
      runtimeJson:
        taskConfigResolver.buildPendingReplyRuntimeJson('Please continue'),
    });
    expect(taskQueryService.detailById).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );
  });

  it('should fall back to the latest done node when no cli session exists', async () => {
    const { service, taskNodeRepository, taskConfigResolver } = createService();
    const currentUser = createCurrentUser();
    const olderDoneNode = createNode({
      id: 'node-1',
      nodeOrder: 1,
      finishedAt: new Date('2026-03-19T10:10:00.000Z'),
      agentCliSessionId: null,
    });
    const latestDoneNode = createNode({
      id: 'node-2',
      nodeOrder: 2,
      finishedAt: new Date('2026-03-19T10:20:00.000Z'),
      agentCliSessionId: null,
    });

    taskNodeRepository.findByTaskIdAndStatus.mockResolvedValue([
      olderDoneNode,
      latestDoneNode,
    ]);

    await service.reply(
      'task-1',
      { message: 'Please continue' } as never,
      currentUser as never,
    );

    expect(taskNodeRepository.update).toHaveBeenCalledWith('node-2', {
      status: TaskStatus.todo,
      finishedAt: null,
      runtimeJson:
        taskConfigResolver.buildPendingReplyRuntimeJson('Please continue'),
    });
  });
});
