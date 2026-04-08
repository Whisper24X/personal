import { BadRequestException, ConflictException } from '@nestjs/common';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskCommandService } from './task-command.service';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.conversation,
  title: 'task title',
  prompt: 'task prompt',
  status: TaskStatus.todo,
  gitBranch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktree: 'wk-task-1',
  configJson: null,
  createdBy: 'user-1',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-03-20T00:00:00.000Z'),
  updatedAt: new Date('2026-03-20T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative Project',
  description: null,
  gitUrl: 'git@example.com:group/repo.git',
  defaultBranch: 'main',
  configJson: null,
  createdAt: new Date('2026-03-20T00:00:00.000Z'),
  updatedAt: new Date('2026-03-20T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createService = () => {
  const taskRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByGitWorktree: jest.fn(),
    findMaxGitWorktreeSequence: jest.fn(),
    bulkUpdateBusinessLineIdByProjectId: jest.fn(),
    findAllWithPagination: jest.fn(),
    countRunningTasks: jest.fn(),
    countRunningTasksByProjectIds: jest.fn(),
    countQueuedTasksByProjectIds: jest.fn(),
    countStaleRunningTasks: jest.fn(),
    findOldestQueuedTaskCreatedAt: jest.fn(),
    findTasksReadyForDispatch: jest.fn(),
    findTasksWithExpiredWorktrees: jest.fn(),
    update: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const taskNodeRepository = {
    createMany: jest.fn(),
    findByTaskId: jest.fn(),
    findById: jest.fn(),
    findInProgressByTaskId: jest.fn().mockResolvedValue(null),
    findFirstByTaskIdAndStatus: jest.fn(),
    findByTaskIdAndStatus: jest.fn(),
    claimFirstTodoNode: jest.fn(),
    renewNodeLease: jest.fn(),
    releaseNodeLease: jest.fn(),
    findExpiredInProgressNodes: jest.fn(),
    update: jest.fn(),
  };
  const projectsService = {
    assertProjectCapability: jest.fn(),
  };
  const workflowTemplatesService = {
    getTemplateForTask: jest.fn(),
  };
  const taskRuntimeService = {
    ensureRuntime: jest.fn(),
    cleanupRuntime: jest.fn().mockResolvedValue({ cleaned: true }),
    cleanupTaskDataDir: jest.fn().mockResolvedValue(undefined),
  };
  const taskConfigResolver = {
    mergeTaskConfig: jest.fn(),
    toObjectRecord: jest.fn(),
    readTaskWorkflowTemplateId: jest.fn(),
    readNodeExecutionConfig: jest.fn(),
    ensureTemplateNodesSupported: jest.fn(),
    resolveRequiredNodeExecutionConfig: jest.fn(),
    buildTaskNodeInput: jest.fn(),
    readTemplateNodeInput: jest.fn(),
    buildTaskNodeConfig: jest.fn(),
    resolveNodeLoopJson: jest.fn(),
    normalizeOptionalString: jest.fn(),
    normalizeGitBranch: jest.fn(),
    withTaskInput: jest.fn(),
  };
  const taskLogService = {
    appendLog: jest.fn().mockResolvedValue(undefined),
  };
  const taskRuntimeOrchestrator = {
    initializeTaskRuntime: jest.fn(),
  };
  const taskQueryService = {
    detailById: jest.fn(),
  };
  const taskAccessService = {
    getTaskOrThrow: jest.fn(),
    getProjectByIdOrThrow: jest.fn(),
  };
  const taskTitleSuggestionService = {
    regenerateTitleAfterCreate: jest.fn().mockResolvedValue(undefined),
  };
  const containerOrchestration = {
    removeContainerForTask: jest.fn().mockResolvedValue(undefined),
  };
  const projectExecutionSlotRepository = {
    findByTaskId: jest.fn().mockResolvedValue(null),
  };
  const taskWorkspaceWatchService = {
    syncTaskWatch: jest.fn().mockResolvedValue(undefined),
  };
  const goalRepository = {
    shouldBlockTaskDeletionForPlan: jest.fn().mockResolvedValue(false),
  };
  const taskWorkspaceContextCache = {
    invalidateTask: jest.fn(),
  };

  const service = new TaskCommandService(
    taskRepository as never,
    taskNodeRepository as never,
    projectsService as never,
    workflowTemplatesService as never,
    taskRuntimeService as never,
    taskConfigResolver as never,
    taskLogService as never,
    taskRuntimeOrchestrator as never,
    taskQueryService as never,
    taskAccessService as never,
    taskTitleSuggestionService as never,
    containerOrchestration as never,
    projectExecutionSlotRepository as never,
    taskWorkspaceWatchService as never,
    goalRepository as never,
    taskWorkspaceContextCache as never,
  );

  return {
    service,
    taskRepository,
    taskNodeRepository,
    taskRuntimeService,
    taskLogService,
    taskAccessService,
    containerOrchestration,
    projectExecutionSlotRepository,
    taskWorkspaceWatchService,
    taskConfigResolver,
    projectsService,
    taskRuntimeOrchestrator,
    goalRepository,
    taskWorkspaceContextCache,
  };
};

describe('TaskCommandService.create', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should persist title from createTaskDto when prompt is longer (goal plan materialize)', async () => {
    const {
      service,
      taskRepository,
      projectsService,
      taskConfigResolver,
      taskRuntimeOrchestrator,
    } = createService();
    const project = createProject();
    const currentUser = createCurrentUser();

    projectsService.assertProjectCapability.mockResolvedValue(project);

    taskConfigResolver.mergeTaskConfig.mockReturnValue({
      agentCliId: 'cli-1',
      agentCliConfigId: 'cfg-1',
    });
    taskConfigResolver.toObjectRecord.mockImplementation((value) =>
      value && typeof value === 'object' ? (value as object) : {},
    );
    taskConfigResolver.readTaskWorkflowTemplateId.mockReturnValue(null);
    taskConfigResolver.readNodeExecutionConfig.mockReturnValue({
      agentCliId: 'cli-1',
      agentCliConfigId: 'cfg-1',
    });
    taskConfigResolver.resolveRequiredNodeExecutionConfig.mockReturnValue({
      agentCliId: 'cli-1',
      agentCliConfigId: 'cfg-1',
    });
    taskConfigResolver.buildTaskNodeInput.mockReturnValue({});
    taskConfigResolver.resolveNodeLoopJson.mockReturnValue(null);
    taskConfigResolver.normalizeOptionalString.mockImplementation((value) =>
      typeof value === 'string' ? value.trim() || null : null,
    );
    taskConfigResolver.normalizeGitBranch.mockImplementation((value) =>
      typeof value === 'string' ? value.trim() || null : null,
    );

    taskRepository.findByGitWorktree.mockResolvedValue(null);
    const createdTask = createTask({
      id: 'new-task',
      title: '计划子任务标题',
      prompt: 'long',
    });
    taskRepository.create.mockResolvedValue(createdTask);
    taskRuntimeOrchestrator.initializeTaskRuntime.mockResolvedValue({
      task: createdTask,
    });

    const longPrompt = `${'x'.repeat(180)} prompt body`;

    await service.create(
      {
        projectId: project.id,
        mode: TaskMode.conversation,
        title: '计划子任务标题',
        prompt: longPrompt,
        gitBaseBranch: 'main',
        configJson: {
          agentCliId: 'cli-1',
          agentCliConfigId: 'cfg-1',
        },
      } as never,
      currentUser as never,
    );

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '计划子任务标题',
        prompt: longPrompt,
      }),
    );
  });

  it('should generate short default branch and worktree names', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 31, 11, 52, 20, 454));

    const {
      service,
      taskRepository,
      projectsService,
      taskConfigResolver,
      taskRuntimeOrchestrator,
    } = createService();
    const project = createProject();
    const currentUser = createCurrentUser();

    projectsService.assertProjectCapability.mockResolvedValue(project);

    taskConfigResolver.mergeTaskConfig.mockReturnValue({
      agentCliId: 'cli-1',
      agentCliConfigId: 'cfg-1',
    });
    taskConfigResolver.toObjectRecord.mockImplementation((value) =>
      value && typeof value === 'object' ? (value as object) : {},
    );
    taskConfigResolver.readTaskWorkflowTemplateId.mockReturnValue(null);
    taskConfigResolver.readNodeExecutionConfig.mockReturnValue({
      agentCliId: 'cli-1',
      agentCliConfigId: 'cfg-1',
    });
    taskConfigResolver.resolveRequiredNodeExecutionConfig.mockReturnValue({
      agentCliId: 'cli-1',
      agentCliConfigId: 'cfg-1',
    });
    taskConfigResolver.buildTaskNodeInput.mockReturnValue({});
    taskConfigResolver.resolveNodeLoopJson.mockReturnValue(null);
    taskConfigResolver.normalizeOptionalString.mockImplementation((value) =>
      typeof value === 'string' ? value.trim() || null : null,
    );
    taskConfigResolver.normalizeGitBranch.mockImplementation((value) =>
      typeof value === 'string' ? value.trim() || null : null,
    );

    taskRepository.findByGitWorktree.mockResolvedValue(null);
    const createdTask = createTask({
      id: 'new-task',
      gitBranch: 'feature/2603311152-abcd',
      gitWorktree: 'wk-2603311152-abcd',
    });
    taskRepository.create.mockResolvedValue(createdTask);
    taskRuntimeOrchestrator.initializeTaskRuntime.mockResolvedValue({
      task: createdTask,
    });

    await service.create(
      {
        projectId: project.id,
        mode: TaskMode.conversation,
        title: '任务标题',
        prompt: 'task prompt',
        gitBaseBranch: 'main',
        configJson: {
          agentCliId: 'cli-1',
          agentCliConfigId: 'cfg-1',
        },
      } as never,
      currentUser as never,
    );

    const createdPayload = taskRepository.create.mock.calls[0]?.[0];

    expect(createdPayload).toEqual(
      expect.objectContaining({
        gitBranch: expect.stringMatching(/^feature\/2603311152-[a-z0-9]{4}$/),
        gitWorktree: expect.stringMatching(/^wk-2603311152-[a-z0-9]{4}$/),
      }),
    );
    expect(createdPayload?.gitWorktree).toBe(
      `wk-${String(createdPayload?.gitBranch).slice('feature/'.length)}`,
    );
  });
});

describe('TaskCommandService.remove', () => {
  it('should clean up task runtime before soft deleting the task', async () => {
    const {
      service,
      taskRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
      containerOrchestration,
      taskWorkspaceContextCache,
    } = createService();
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockResolvedValue(project);

    await service.remove(task.id, currentUser as never);

    expect(taskAccessService.getTaskOrThrow).toHaveBeenCalledWith(
      task.id,
      currentUser,
      'project.task.read',
    );
    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(
      task,
      project,
      {
        deleteBranch: true,
      },
    );
    expect(
      containerOrchestration.removeContainerForTask,
    ).not.toHaveBeenCalled();
    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task deleted',
      payload: {
        deletedBy: currentUser.sub,
        gitWorktree: task.gitWorktree,
        gitBranch: task.gitBranch,
      },
    });
    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
    expect(taskWorkspaceContextCache.invalidateTask).toHaveBeenCalledWith(
      task.id,
    );
    expect(taskRuntimeService.cleanupTaskDataDir).toHaveBeenCalledWith(
      task,
      project,
    );
    expect(
      taskRuntimeService.cleanupRuntime.mock.invocationCallOrder[0],
    ).toBeLessThan(taskRepository.remove.mock.invocationCallOrder[0]);
  });

  it('should remove the runner when the task slot still exists', async () => {
    const {
      service,
      taskRepository,
      taskRuntimeService,
      taskAccessService,
      containerOrchestration,
      projectExecutionSlotRepository,
    } = createService();
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockResolvedValue(project);
    projectExecutionSlotRepository.findByTaskId.mockResolvedValue({
      projectId: task.projectId,
      taskId: task.id,
      expiresAt: new Date('2026-03-20T00:30:00.000Z'),
    });

    await service.remove(task.id, currentUser as never);

    expect(containerOrchestration.removeContainerForTask).toHaveBeenCalledWith(
      task.id,
      task.projectId,
    );
    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(
      task,
      project,
      {
        deleteBranch: true,
      },
    );
    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
  });

  it('should log cleanup decisions when skipping runner removal', async () => {
    const { service, taskAccessService, taskRepository } = createService();
    const task = createTask({ gitWorktree: null, gitBranch: null });
    const currentUser = createCurrentUser();
    const loggerLog = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockRejectedValue(
      new Error('project removed'),
    );

    await service.remove(task.id, currentUser as never);

    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('task_delete_cleanup_decision '),
    );
    expect(loggerLog).not.toHaveBeenCalledWith(
      expect.stringContaining('task_delete_remove_runner '),
    );
  });

  it('should block deletion when worktree cleanup fails', async () => {
    const {
      service,
      taskRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
      containerOrchestration,
    } = createService();
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockResolvedValue(project);
    taskRuntimeService.cleanupRuntime.mockResolvedValue({
      cleaned: false,
      errorMessage: 'git worktree remove failed',
    });

    await expect(service.remove(task.id, currentUser as never)).rejects.toThrow(
      new ConflictException(
        'Task deletion blocked because runtime cleanup failed: git worktree remove failed',
      ),
    );

    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.warn,
      message: 'Task deletion blocked because runtime cleanup failed',
      payload: {
        deletedBy: currentUser.sub,
        gitWorktree: task.gitWorktree,
        gitBranch: task.gitBranch,
        errorMessage: 'git worktree remove failed',
      },
    });
    expect(
      containerOrchestration.removeContainerForTask,
    ).not.toHaveBeenCalled();
    expect(taskRepository.remove).not.toHaveBeenCalled();
  });

  it('should remove the runner before deleting a task that is still executing', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
      containerOrchestration,
    } = createService();
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockResolvedValue(project);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue({
      id: 'node-1',
    });
    const loggerLog = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);

    await service.remove(task.id, currentUser as never);

    expect(containerOrchestration.removeContainerForTask).toHaveBeenCalledWith(
      task.id,
      task.projectId,
    );
    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(
      task,
      project,
      {
        deleteBranch: true,
      },
    );
    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task deleted',
      payload: {
        deletedBy: currentUser.sub,
        gitWorktree: task.gitWorktree,
        gitBranch: task.gitBranch,
      },
    });
    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('task_delete_remove_runner '),
    );
    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
  });

  it('should block deletion when linked to goal plan sub-task', async () => {
    const { service, taskRepository, taskAccessService, goalRepository } =
      createService();
    const task = createTask({ status: TaskStatus.todo });
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    goalRepository.shouldBlockTaskDeletionForPlan.mockResolvedValue(true);

    await expect(service.remove(task.id, currentUser as never)).rejects.toThrow(
      BadRequestException,
    );

    expect(goalRepository.shouldBlockTaskDeletionForPlan).toHaveBeenCalledWith(
      task.id,
      task.status,
    );
    expect(taskRepository.remove).not.toHaveBeenCalled();
  });

  it('should delete tasks without a stored worktree identifier', async () => {
    const {
      service,
      taskRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
      containerOrchestration,
      taskWorkspaceContextCache,
    } = createService();
    const task = createTask({ gitWorktree: null, gitBranch: null });
    const project = createProject();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockResolvedValue(project);

    await service.remove(task.id, currentUser as never);

    expect(taskRuntimeService.cleanupRuntime).not.toHaveBeenCalled();
    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task deleted',
      payload: {
        deletedBy: currentUser.sub,
        gitWorktree: null,
        gitBranch: null,
      },
    });
    expect(
      containerOrchestration.removeContainerForTask,
    ).not.toHaveBeenCalled();
    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
    expect(taskWorkspaceContextCache.invalidateTask).toHaveBeenCalledWith(
      task.id,
    );
    expect(taskRuntimeService.cleanupTaskDataDir).toHaveBeenCalledWith(
      task,
      project,
    );
  });
});
