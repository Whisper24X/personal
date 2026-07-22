import { ConflictException } from '@nestjs/common';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import {
  TaskEnvironmentCoreMode,
  TaskEnvironmentDiagnosticStatus,
  TaskEnvironmentStage,
  TaskEnvironmentServicePhase,
  TaskEnvironmentStatus,
  TaskPreviewStatus,
  TaskWorkspaceStatus,
} from '../dto/task-environment.dto';
import { TaskEnvironmentService } from './task-environment.service';

const createTask = (overrides: Record<string, unknown> = {}) => ({
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
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createProject = (overrides: Record<string, unknown> = {}) => ({
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

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createService = (
  options: {
    task?: ReturnType<typeof createTask>;
    project?: ReturnType<typeof createProject>;
  } = {},
) => {
  const task = options.task ?? createTask();
  const project = options.project ?? createProject();
  const taskAccessService = {
    assertCanAccessTaskProject: jest.fn().mockResolvedValue({ task, project }),
    getProjectByIdOrThrow: jest.fn().mockResolvedValue(project),
  };
  const taskRuntimeOrchestrator = {
    prepareTaskRuntime: jest.fn().mockResolvedValue({ task, project }),
  };
  const taskLogService = {
    appendLog: jest.fn().mockResolvedValue(undefined),
  };
  const taskLogRepository = {
    findLatestByTaskId: jest.fn().mockResolvedValue([]),
  };
  const taskNodeRepository = {
    findInProgressByTaskId: jest.fn().mockResolvedValue(null),
  };
  const taskRepository = {
    findById: jest.fn().mockResolvedValue(task),
    update: jest.fn().mockResolvedValue(task),
  };
  const projectExecutionSlotRepository = {
    claimSlotWithinLimit: jest.fn(),
    findByTaskId: jest.fn().mockResolvedValue(null),
  };
  const containerExecutionConfig = {
    getSlotTtlMs: jest.fn().mockReturnValue(5_000),
    getMaxContainersPerProject: jest.fn().mockReturnValue(2),
  };
  const containerOrchestration = {
    inspectTaskContainer: jest
      .fn()
      .mockResolvedValue({ kind: 'missing', slotState: 'none' }),
    inspectTaskContainerRuntimeState: jest
      .fn()
      .mockResolvedValue({ kind: 'missing', slotState: 'none' }),
    ensureContainer: jest.fn().mockResolvedValue({
      containerId: 'container-1',
    }),
    removeContainerForTask: jest.fn().mockResolvedValue(undefined),
    resolvePreviewConfigForTask: jest.fn().mockResolvedValue(null),
  };

  const service = new TaskEnvironmentService(
    taskAccessService as never,
    taskRuntimeOrchestrator as never,
    taskLogService as never,
    taskLogRepository as never,
    taskNodeRepository as never,
    taskRepository as never,
    projectExecutionSlotRepository as never,
    containerExecutionConfig as never,
    containerOrchestration as never,
  );

  return {
    service,
    task,
    project,
    taskAccessService,
    taskRuntimeOrchestrator,
    taskLogService,
    taskLogRepository,
    taskNodeRepository,
    taskRepository,
    projectExecutionSlotRepository,
    containerExecutionConfig,
    containerOrchestration,
  };
};

describe('TaskEnvironmentService', () => {
  it('should fail direct environment start when the project container limit is reached', async () => {
    const {
      service,
      task,
      projectExecutionSlotRepository,
      containerOrchestration,
    } = createService();
    const currentUser = createCurrentUser();

    projectExecutionSlotRepository.claimSlotWithinLimit.mockResolvedValue(
      'limit_reached',
    );

    try {
      await service.startEnvironment(task.id, currentUser as never);
      throw new Error('expected startEnvironment to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe('当前项目已达到容器启动上限（2）');
    }

    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).toHaveBeenCalledWith('project-1', 'task-1', 5_000, 2);
    expect(containerOrchestration.ensureContainer).not.toHaveBeenCalled();
  });

  it('should expose workspace-native provisioning status without starting runtime', async () => {
    const task = createTask({
      configJson: {
        workspaceStatus: 'provisioning',
        workspaceStage: 'fetching_sub_repos',
        workspaceMessage: '正在拉取子仓代码',
        workspaceSnapshotStatus: 'pending',
        workspaceSnapshot: {
          taskBranch: 'feature/task-1',
          snapshotCommitSha: 'abc123',
        },
      },
    });
    const project = createProject({
      configJson: {
        subtreeMode: 'workspace-native',
      },
    });
    const {
      service,
      taskRuntimeOrchestrator,
      projectExecutionSlotRepository,
      containerOrchestration,
    } = createService({ task, project });
    const currentUser = createCurrentUser();

    const result = await service.getEnvironment(task.id, currentUser as never);

    expect(result.status).toBe(TaskEnvironmentStatus.starting);
    expect(result.stage).toBe(TaskEnvironmentStage.workspacePreparing);
    expect(result.workspaceStatus).toBe(TaskWorkspaceStatus.provisioning);
    expect(result.workspaceStage).toBe('fetching_sub_repos');
    expect(result.workspaceMessage).toBe('正在拉取子仓代码');
    expect(result.workspaceSnapshotStatus).toBe('pending');
    expect(result.message).toBe('正在拉取子仓代码');
    expect(taskRuntimeOrchestrator.prepareTaskRuntime).not.toHaveBeenCalled();
    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).not.toHaveBeenCalled();
    expect(containerOrchestration.ensureContainer).not.toHaveBeenCalled();
  });

  it('should expose workspace-native failure status without starting runtime', async () => {
    const task = createTask({
      configJson: {
        workspaceStatus: 'failed',
        workspaceStage: 'failed',
        workspaceMessage: '任务工作区准备失败',
        workspaceError: 'git worktree add failed',
        workspaceSnapshotStatus: 'failed',
        workspaceSnapshotError: 'push failed',
        workspaceSnapshot: {
          taskBranch: 'feature/task-1',
          snapshotCommitSha: 'abc123',
        },
      },
    });
    const project = createProject({
      configJson: {
        subtreeMode: 'workspace-native',
      },
    });
    const { service, taskRuntimeOrchestrator, containerOrchestration } =
      createService({ task, project });
    const currentUser = createCurrentUser();

    const result = await service.startEnvironment(
      task.id,
      currentUser as never,
    );

    expect(result.status).toBe(TaskEnvironmentStatus.failed);
    expect(result.workspaceStatus).toBe(TaskWorkspaceStatus.failed);
    expect(result.workspaceStage).toBe('failed');
    expect(result.workspaceMessage).toBe('任务工作区准备失败');
    expect(result.workspaceError).toBe('git worktree add failed');
    expect(result.workspaceSnapshotStatus).toBe('failed');
    expect(result.workspaceSnapshotError).toBe('push failed');
    expect(result.steps[0].status).toBe('error');
    expect(taskRuntimeOrchestrator.prepareTaskRuntime).not.toHaveBeenCalled();
    expect(containerOrchestration.ensureContainer).not.toHaveBeenCalled();
  });

  it('should treat an existing task slot as idempotent and continue startup', async () => {
    const {
      service,
      task,
      project,
      projectExecutionSlotRepository,
      containerOrchestration,
    } = createService();
    const currentUser = createCurrentUser();

    containerOrchestration.inspectTaskContainerRuntimeState
      .mockResolvedValueOnce({ kind: 'missing', slotState: 'none' })
      .mockResolvedValueOnce({
        kind: 'running',
        containerId: 'container-1',
        accessMetadata: null,
        runtimeReadiness: {
          preview: {
            status: TaskPreviewStatus.unavailable,
            url: null,
            partial: false,
            reason: 'unavailable',
          },
          serviceStatuses: [],
          routeDiagnostics: [],
        },
      });
    projectExecutionSlotRepository.claimSlotWithinLimit.mockResolvedValue(
      'existing',
    );

    const result = await service.startEnvironment(
      task.id,
      currentUser as never,
    );

    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).toHaveBeenCalledWith(project.id, task.id, 5_000, 2);
    expect(containerOrchestration.ensureContainer).toHaveBeenCalledWith({
      task,
      project,
      worktreePath: 'wk-task-1',
      trackProjectSlot: true,
    });
    expect(result.status).toBe(TaskEnvironmentStatus.ready);
    expect(result.stage).toBe(TaskEnvironmentStage.ready);
  });

  it('should terminate environment by removing the task container and return stopped status', async () => {
    const {
      service,
      task,
      containerOrchestration,
      taskLogService,
      taskLogRepository,
    } = createService();
    const currentUser = createCurrentUser();

    taskLogRepository.findLatestByTaskId.mockResolvedValue([
      {
        id: 'log-stop',
        taskId: task.id,
        taskNodeId: null,
        level: 'info',
        message: '执行环境已释放',
        payload: {
          scope: 'task_environment',
          environmentStatus: TaskEnvironmentStatus.stopped,
          environmentStage: TaskEnvironmentStage.stopped,
          environmentMessage: '执行环境已释放',
          failedStage: null,
        },
        createdAt: new Date('2026-04-08T00:05:00.000Z'),
      },
      {
        id: 'log-ready',
        taskId: task.id,
        taskNodeId: null,
        level: 'info',
        message: '执行环境已就绪',
        payload: {
          scope: 'task_environment',
          environmentStatus: TaskEnvironmentStatus.ready,
          environmentStage: TaskEnvironmentStage.ready,
          environmentMessage: '执行环境已就绪',
          failedStage: null,
        },
        createdAt: new Date('2026-04-08T00:04:00.000Z'),
      },
    ]);

    const result = await service.terminateEnvironment(
      task.id,
      currentUser as never,
    );

    expect(containerOrchestration.removeContainerForTask).toHaveBeenCalledWith(
      task.id,
      task.projectId,
    );
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: null,
        level: 'info',
        message: '执行环境已释放',
      }),
    );
    expect(result.status).toBe(TaskEnvironmentStatus.stopped);
    expect(result.stage).toBe(TaskEnvironmentStage.stopped);
    expect(result.message).toBe('执行环境已释放');
  });

  it('should resolve to stopped after a previously ready environment loses its container', async () => {
    const { service, task, taskLogRepository } = createService();
    const currentUser = createCurrentUser();

    taskLogRepository.findLatestByTaskId.mockResolvedValue([
      {
        id: 'log-ready',
        taskId: 'task-1',
        taskNodeId: null,
        level: 'info',
        message: '执行环境已就绪',
        payload: {
          scope: 'task_environment',
          environmentStatus: TaskEnvironmentStatus.ready,
          environmentStage: TaskEnvironmentStage.ready,
          environmentMessage: '执行环境已就绪',
          failedStage: null,
        },
        createdAt: new Date('2026-04-08T00:04:00.000Z'),
      },
    ]);

    const result = await service.getEnvironment(task.id, currentUser as never);

    expect(result.status).toBe(TaskEnvironmentStatus.stopped);
    expect(result.stage).toBe(TaskEnvironmentStage.stopped);
    expect(result.message).toBe('执行环境已释放');
    expect(result.preview.status).toBe('unavailable');
  });

  it('should report not_started when the runner container exists but is paused', async () => {
    const {
      service,
      task,
      containerOrchestration,
      projectExecutionSlotRepository,
      taskLogRepository,
    } = createService();
    const currentUser = createCurrentUser();

    taskLogRepository.findLatestByTaskId.mockResolvedValue([]);
    projectExecutionSlotRepository.findByTaskId.mockResolvedValue({
      taskId: task.id,
      projectId: task.projectId,
      containerId: 'cid-paused',
      accessMetadata: null,
    });
    containerOrchestration.inspectTaskContainerRuntimeState.mockResolvedValue({
      kind: 'missing',
      slotState: 'released-stale',
    });

    const result = await service.getEnvironment(task.id, currentUser as never);

    expect(result.status).toBe(TaskEnvironmentStatus.notStarted);
    expect(result.message).toContain('未运行');
    expect(result.runtime?.containerId).toBe('cid-paused');
  });

  it('should report not_started when the runner container exists but is not running', async () => {
    const {
      service,
      task,
      containerOrchestration,
      projectExecutionSlotRepository,
      taskLogRepository,
    } = createService();
    const currentUser = createCurrentUser();

    taskLogRepository.findLatestByTaskId.mockResolvedValue([]);
    projectExecutionSlotRepository.findByTaskId.mockResolvedValue({
      taskId: task.id,
      projectId: task.projectId,
      containerId: 'cid-exited',
      accessMetadata: null,
    });
    containerOrchestration.inspectTaskContainerRuntimeState.mockResolvedValue({
      kind: 'missing',
      slotState: 'released-stale',
    });

    const result = await service.getEnvironment(task.id, currentUser as never);

    expect(result.status).toBe(TaskEnvironmentStatus.notStarted);
    expect(result.message).toContain('未运行');
    expect(result.runtime?.containerId).toBe('cid-exited');
  });

  it('should allow environment termination when task status is in_progress but no node is running', async () => {
    const {
      service,
      task,
      taskAccessService,
      containerOrchestration,
      taskLogRepository,
    } = createService();
    const currentUser = createCurrentUser();
    const runningReviewTask = {
      ...task,
      status: TaskStatus.inProgress,
    };

    taskAccessService.assertCanAccessTaskProject.mockResolvedValue({
      task: runningReviewTask,
      project: createProject(),
    });
    taskLogRepository.findLatestByTaskId.mockResolvedValue([
      {
        id: 'log-stop',
        taskId: task.id,
        taskNodeId: null,
        level: 'info',
        message: '执行环境已释放',
        payload: {
          scope: 'task_environment',
          environmentStatus: TaskEnvironmentStatus.stopped,
          environmentStage: TaskEnvironmentStage.stopped,
          environmentMessage: '执行环境已释放',
          failedStage: null,
        },
        createdAt: new Date('2026-04-08T00:05:00.000Z'),
      },
    ]);

    const result = await service.terminateEnvironment(
      task.id,
      currentUser as never,
    );

    expect(containerOrchestration.removeContainerForTask).toHaveBeenCalledWith(
      task.id,
      task.projectId,
    );
    expect(result.status).toBe(TaskEnvironmentStatus.stopped);
  });

  it('should keep preview provisioning when container is running but preview services are not ready yet', async () => {
    const { service, task, containerOrchestration, taskLogRepository } =
      createService();
    const currentUser = createCurrentUser();

    taskLogRepository.findLatestByTaskId.mockResolvedValue([]);
    containerOrchestration.resolvePreviewConfigForTask.mockResolvedValue({
      service: 'yanxue',
      path: '/api/',
    });
    containerOrchestration.inspectTaskContainerRuntimeState.mockResolvedValue({
      kind: 'running',
      containerId: 'container-1',
      accessMetadata: {
        previewUrl: 'http://localhost:39144/api/',
        coreMode: TaskEnvironmentCoreMode.preview,
        previewConfigured: true,
        previewFallbackUsed: false,
      },
      runtimeReadiness: {
        preview: {
          status: TaskPreviewStatus.provisioning,
          url: null,
          partial: false,
          reason: null,
        },
        serviceStatuses: [
          {
            name: 'yanxue',
            port: 8000,
            phase: TaskEnvironmentServicePhase.starting,
            message: null,
            exitCode: null,
            updatedAt: null,
            isPrimaryPreview: true,
          },
        ],
        routeDiagnostics: [
          {
            path: '/api/',
            service: 'yanxue',
            port: 8000,
            status: TaskEnvironmentDiagnosticStatus.failed,
            statusCode: null,
            error: 'connection refused',
          },
        ],
      },
    });

    const result = await service.getEnvironment(task.id, currentUser as never);

    expect(result.status).toBe(TaskEnvironmentStatus.ready);
    expect(result.preview.status).toBe(TaskPreviewStatus.provisioning);
    expect(result.preview.url).toBeNull();
    expect(result.serviceStatuses).toEqual([
      expect.objectContaining({
        name: 'yanxue',
        phase: TaskEnvironmentServicePhase.starting,
        isPrimaryPreview: true,
      }),
    ]);
    expect(result.routeDiagnostics).toEqual([
      expect.objectContaining({
        path: '/api/',
        status: TaskEnvironmentDiagnosticStatus.failed,
      }),
    ]);
  });

  it('should reject environment termination when the task is running', async () => {
    const { service, task, taskNodeRepository, containerOrchestration } =
      createService();
    const currentUser = createCurrentUser();

    taskNodeRepository.findInProgressByTaskId.mockResolvedValue({
      id: 'node-1',
      status: TaskStatus.inProgress,
    });

    await expect(
      service.terminateEnvironment(task.id, currentUser as never),
    ).rejects.toThrow('任务执行中，无法终止执行环境');

    expect(
      containerOrchestration.removeContainerForTask,
    ).not.toHaveBeenCalled();
  });

  it('should await workspace-native provisioning before prepareTaskRuntime', async () => {
    jest.useFakeTimers();
    try {
      const {
        service,
        task,
        project,
        taskAccessService,
        taskRuntimeOrchestrator,
        taskRepository,
        projectExecutionSlotRepository,
      } = createService();

      projectExecutionSlotRepository.claimSlotWithinLimit.mockResolvedValue(
        undefined as never,
      );

      const wsProject = {
        ...project,
        configJson: { subtreeMode: 'workspace-native' as const },
      };
      const provisioningTask = {
        ...task,
        configJson: { workspaceStatus: 'provisioning' },
      };
      const readyTask = {
        ...task,
        configJson: { workspaceStatus: 'ready' },
      };

      taskAccessService.assertCanAccessTaskProject.mockResolvedValue({
        task: provisioningTask,
        project: wsProject,
      });

      taskRepository.findById
        .mockResolvedValueOnce(provisioningTask as never)
        .mockResolvedValueOnce(provisioningTask as never)
        .mockResolvedValue(readyTask as never);

      taskRuntimeOrchestrator.prepareTaskRuntime.mockResolvedValue({
        task: readyTask as never,
        project: wsProject as never,
      });

      const currentUser = createCurrentUser();
      const done = service.startEnvironment(task.id, currentUser as never);

      await jest.advanceTimersByTimeAsync(750);
      await jest.advanceTimersByTimeAsync(750);
      await jest.advanceTimersByTimeAsync(750);

      await done;

      expect(taskRuntimeOrchestrator.prepareTaskRuntime).toHaveBeenCalledWith(
        expect.objectContaining({ id: readyTask.id }),
        currentUser as never,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
