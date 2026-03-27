import { ConflictException } from '@nestjs/common';
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
    findByProjectId: jest.fn().mockResolvedValue(null),
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
  };
};

describe('TaskCommandService.remove', () => {
  it('should clean up task runtime before soft deleting the task', async () => {
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
    expect(
      taskRuntimeService.cleanupRuntime.mock.invocationCallOrder[0],
    ).toBeLessThan(taskRepository.remove.mock.invocationCallOrder[0]);
  });

  it('should remove the runner when the project slot is still owned by the task', async () => {
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
    projectExecutionSlotRepository.findByProjectId.mockResolvedValue({
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

  it('should delete tasks without a stored worktree identifier', async () => {
    const {
      service,
      taskRepository,
      taskRuntimeService,
      taskLogService,
      taskAccessService,
      containerOrchestration,
    } = createService();
    const task = createTask({ gitWorktree: null, gitBranch: null });
    const currentUser = createCurrentUser();

    taskAccessService.getTaskOrThrow.mockResolvedValue(task);

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
  });
});
