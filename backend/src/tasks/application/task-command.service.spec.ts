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
  const taskWorkspaceWatchService = {
    syncTaskWatch: jest.fn().mockResolvedValue(undefined),
  };
  const goalRepository = {
    shouldBlockTaskDeletionForPlan: jest.fn().mockResolvedValue(false),
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
    taskWorkspaceWatchService as never,
    goalRepository as never,
  );

  return {
    service,
    taskRepository,
    taskNodeRepository,
    taskRuntimeService,
    taskLogService,
    taskAccessService,
    taskConfigResolver,
    projectsService,
    taskRuntimeOrchestrator,
    goalRepository,
  };
};

describe('TaskCommandService.create', () => {
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
});

describe('TaskCommandService.remove', () => {
  it('should clean up task runtime before soft deleting the task', async () => {
    const { service, taskRepository, taskRuntimeService, taskAccessService } =
      createService();
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
    );
    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
    expect(taskRuntimeService.cleanupTaskDataDir).toHaveBeenCalledWith(
      task,
      project,
    );
    expect(
      taskRuntimeService.cleanupRuntime.mock.invocationCallOrder[0],
    ).toBeLessThan(taskRepository.remove.mock.invocationCallOrder[0]);
  });

  it('should block deletion when worktree cleanup fails', async () => {
    const {
      service,
      taskRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
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
        'Task deletion blocked because worktree cleanup failed: git worktree remove failed',
      ),
    );

    expect(taskLogService.appendLog).toHaveBeenCalledWith({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.warn,
      message: 'Task deletion blocked because worktree cleanup failed',
      payload: {
        deletedBy: currentUser.sub,
        gitWorktree: task.gitWorktree,
        errorMessage: 'git worktree remove failed',
      },
    });
    expect(taskRepository.remove).not.toHaveBeenCalled();
  });

  it('should reject deletion while task execution is in progress', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
    } = createService();
    const task = createTask();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue({
      id: 'node-1',
    });

    await expect(service.remove(task.id, currentUser as never)).rejects.toThrow(
      new ConflictException(
        'Cannot delete task while execution is in progress',
      ),
    );

    expect(taskRuntimeService.cleanupRuntime).not.toHaveBeenCalled();
    expect(taskLogService.appendLog).not.toHaveBeenCalled();
    expect(taskRepository.remove).not.toHaveBeenCalled();
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
    const { service, taskRepository, taskRuntimeService, taskAccessService } =
      createService();
    const task = createTask({ gitWorktree: null });
    const project = createProject();
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);
    taskAccessService.getProjectByIdOrThrow.mockResolvedValue(project);

    await service.remove(task.id, currentUser as never);

    expect(taskRuntimeService.cleanupRuntime).not.toHaveBeenCalled();
    expect(taskRepository.remove).toHaveBeenCalledWith(task.id);
    expect(taskRuntimeService.cleanupTaskDataDir).toHaveBeenCalledWith(
      task,
      project,
    );
  });
});
