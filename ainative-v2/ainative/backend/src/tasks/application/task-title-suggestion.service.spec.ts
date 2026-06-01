import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { initialTitleFromPrompt } from '../utils/task-title-placeholder';
import { TaskTitleSuggestionService } from './task-title-suggestion.service';

const createTask = (overrides: Partial<Task> = {}): Task => {
  const prompt = overrides.prompt ?? '优化后端登录页UI配色';

  return {
    id: 'task-1',
    projectId: 'project-1',
    businessLineId: 'business-line-1',
    goalId: null,
    mode: TaskMode.conversation,
    title: initialTitleFromPrompt(prompt ?? ''),
    prompt,
    status: TaskStatus.todo,
    gitBranch: 'feature/task-1',
    gitBaseBranch: 'main',
    gitWorktree: 'wk-task-1',
    configJson: null,
    createdBy: 'user-1',
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-04-08T00:00:00.000Z'),
    updatedAt: new Date('2026-04-08T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
};

const createProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative Project',
  description: null,
  gitUrl: 'git@example.com:group/repo.git',
  defaultBranch: 'main',
  configJson: null,
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createTaskNode = (overrides: Partial<TaskNode> = {}): TaskNode => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'conversation-node',
  input: null,
  agentClioutput: null,
  agentCliSessionId: null,
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  configJson: null,
  loopJson: null,
  runtimeJson: null,
  status: TaskStatus.todo,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  ...overrides,
});

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createService = () => {
  const projectAccessService = {
    assertProjectCapability: jest.fn(),
  };
  const controlPlaneAgentExecutionService = {
    executeCustomPrompt: jest.fn(),
  };
  const taskRepository = {
    update: jest.fn(),
  };
  const taskNodeRepository = {
    findByTaskId: jest.fn(),
  };
  const taskLogService = {
    appendLog: jest.fn().mockResolvedValue(undefined),
  };
  const taskAccessService = {
    getTaskOrThrow: jest.fn(),
  };

  const service = new TaskTitleSuggestionService(
    projectAccessService as never,
    controlPlaneAgentExecutionService as never,
    taskRepository as never,
    taskNodeRepository as never,
    taskLogService as never,
    taskAccessService as never,
  );
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
  };

  Object.assign(service as object, { logger });

  return {
    service,
    logger,
    projectAccessService,
    controlPlaneAgentExecutionService,
    taskRepository,
    taskNodeRepository,
    taskLogService,
    taskAccessService,
  };
};

const findLoggedPayload = (
  logger: { log: jest.Mock },
  event: string,
): Record<string, unknown> => {
  const call = logger.log.mock.calls.find(
    ([message]) =>
      typeof message === 'string' && message.startsWith(`${event} `),
  );

  if (!call) {
    throw new Error(`Expected log event ${event} to be emitted`);
  }

  return JSON.parse((call[0] as string).slice(event.length + 1)) as Record<
    string,
    unknown
  >;
};

describe('TaskTitleSuggestionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log skip reason when title is no longer placeholder', async () => {
    const { service, logger, taskRepository, taskAccessService } =
      createService();
    const currentUser = createCurrentUser();
    const task = createTask({
      title: '人工确认后的标题',
    });

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);

    await service.regenerateTitleAfterCreate(task.id, currentUser as never);

    expect(taskRepository.update).not.toHaveBeenCalled();
    expect(findLoggedPayload(logger, 'task_title_suggest_skipped')).toEqual(
      expect.objectContaining({
        taskId: task.id,
        currentTitle: '人工确认后的标题',
        skipReason: 'title_not_placeholder',
        updated: false,
      }),
    );
  });

  it('should update task title and log update lifecycle when generated title differs', async () => {
    const {
      service,
      logger,
      projectAccessService,
      controlPlaneAgentExecutionService,
      taskRepository,
      taskNodeRepository,
      taskLogService,
      taskAccessService,
    } = createService();
    const currentUser = createCurrentUser();
    const task = createTask({
      prompt:
        '请把后端登录页的视觉层次和主色调整体优化一下，同时保持现有交互逻辑不变',
    });
    const project = createProject({ id: task.projectId });
    const node = createTaskNode({ taskId: task.id });

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    projectAccessService.assertProjectCapability.mockResolvedValue(project);
    taskNodeRepository.findByTaskId.mockResolvedValue([node]);
    controlPlaneAgentExecutionService.executeCustomPrompt.mockResolvedValue({
      success: true,
      stdout: [
        '{"type":"thread.started","thread_id":"thread-1"}',
        '{"type":"turn.started"}',
        '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"{\\"title\\":\\"优化后端登录页UI配色\\"}"}}',
        '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}',
      ].join('\n'),
      stderr: '',
      exitCode: 0,
      signal: null,
      errorMessage: null,
    });
    taskRepository.update.mockResolvedValue(
      createTask({
        title: '优化后端登录页UI配色',
      }),
    );

    await service.regenerateTitleAfterCreate(task.id, currentUser as never);

    expect(taskRepository.update).toHaveBeenCalledWith(task.id, {
      title: '优化后端登录页UI配色',
    });
    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task title generated',
      payload: null,
    });
    expect(
      findLoggedPayload(logger, 'task_title_suggest_update_started'),
    ).toEqual(
      expect.objectContaining({
        taskId: task.id,
        currentTitle: task.title,
        generatedTitle: '优化后端登录页UI配色',
        updated: false,
      }),
    );
    expect(
      findLoggedPayload(logger, 'task_title_suggest_update_completed'),
    ).toEqual(
      expect.objectContaining({
        taskId: task.id,
        previousTitle: task.title,
        generatedTitle: '优化后端登录页UI配色',
        updated: true,
      }),
    );
  });

  it('should log skip reason when generated title matches current title', async () => {
    const {
      service,
      logger,
      projectAccessService,
      controlPlaneAgentExecutionService,
      taskRepository,
      taskNodeRepository,
      taskAccessService,
    } = createService();
    const currentUser = createCurrentUser();
    const task = createTask();
    const project = createProject({ id: task.projectId });
    const node = createTaskNode({ taskId: task.id });

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    projectAccessService.assertProjectCapability.mockResolvedValue(project);
    taskNodeRepository.findByTaskId.mockResolvedValue([node]);
    controlPlaneAgentExecutionService.executeCustomPrompt.mockResolvedValue({
      success: true,
      stdout: '{"title":"优化后端登录页UI配色"}',
      stderr: '',
      exitCode: 0,
      signal: null,
      errorMessage: null,
    });

    await service.regenerateTitleAfterCreate(task.id, currentUser as never);

    expect(taskRepository.update).not.toHaveBeenCalled();
    expect(findLoggedPayload(logger, 'task_title_suggest_skipped')).toEqual(
      expect.objectContaining({
        taskId: task.id,
        currentTitle: task.title,
        generatedTitle: task.title,
        skipReason: 'generated_same_as_current',
        updated: false,
      }),
    );
  });

  it('should log fallback reason when parser cannot extract title json', async () => {
    const {
      service,
      logger,
      projectAccessService,
      controlPlaneAgentExecutionService,
      taskRepository,
      taskNodeRepository,
      taskAccessService,
    } = createService();
    const currentUser = createCurrentUser();
    const task = createTask({
      prompt:
        '这是一段非常非常长的任务描述，需要生成一个足够短的标题来验证回退逻辑生效，并且确保最终可以看出为什么没有按模型结果更新',
    });
    const project = createProject({ id: task.projectId });
    const node = createTaskNode({ taskId: task.id });

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    projectAccessService.assertProjectCapability.mockResolvedValue(project);
    taskNodeRepository.findByTaskId.mockResolvedValue([node]);
    controlPlaneAgentExecutionService.executeCustomPrompt.mockResolvedValue({
      success: true,
      stdout: '{"type":"thread.started"}',
      stderr: '',
      exitCode: 0,
      signal: null,
      errorMessage: null,
    });
    taskRepository.update.mockResolvedValue(
      createTask({
        title:
          '这是一段非常非常长的任务描述，需要生成一个足够短的标题来验证回退逻辑生效，',
      }),
    );

    await service.regenerateTitleAfterCreate(task.id, currentUser as never);

    expect(findLoggedPayload(logger, 'task_title_suggest_fallback')).toEqual(
      expect.objectContaining({
        taskId: task.id,
        fallbackReason: 'parse_failed',
        updated: false,
      }),
    );
    expect(taskRepository.update).toHaveBeenCalled();
  });
});
