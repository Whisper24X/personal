import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TaskLogEventsService } from './task-log-events.service';
import { TaskArtifactType } from './dto/task-artifact-type.enum';
import { TaskMode } from './dto/task-mode.enum';
import { TaskNodeType } from './dto/task-node-type.enum';
import { TaskStatus } from './dto/task-status.enum';
import { TasksService } from './tasks.service';

const createProject = (configJson?: Record<string, unknown>) => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative',
  gitUrl: 'https://example.com/repo.git',
  defaultBranch: 'main',
  configJson: configJson ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const createTask = () => ({
  id: 'task-1',
  projectId: 'project-1',
  mode: TaskMode.workflow,
  title: 'task title',
  description: 'task description',
  acceptanceCriteria: ['criteria'],
  status: TaskStatus.todo,
  branch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktreePath: '/tmp/worktree-task-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createNonAdminUser = () => ({
  sub: 'user-2',
  roles: ['user'],
  iat: 1,
  exp: 9999999999,
});

const createNode = (nodeType: TaskNodeType) => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: `${nodeType}-node`,
  nodeType,
  input: null,
  output: null,
  requiresApproval: false,
  status: TaskStatus.inProgress,
  attempt: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createNodeWithStatus = (status: TaskStatus) => ({
  ...createNode(TaskNodeType.agent),
  status,
});

const createTasksService = ({ runtimeRole = 'worker' } = {}) => {
  process.env.AINATIVE_RUNTIME_ROLE = runtimeRole;

  const taskRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    findTasksReadyForDispatch: jest.fn().mockResolvedValue([]),
    countRunningTasks: jest.fn().mockResolvedValue(0),
    countRunningTasksByProjectIds: jest.fn().mockResolvedValue({}),
    countQueuedTasksByProjectIds: jest.fn().mockResolvedValue({}),
    countStaleRunningTasks: jest.fn().mockResolvedValue(0),
    findOldestQueuedTaskCreatedAt: jest.fn().mockResolvedValue(null),
  };
  const taskNodeRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    findByTaskId: jest.fn(),
    findInProgressByTaskId: jest.fn(),
    findFirstByTaskIdAndStatus: jest.fn(),
    claimFirstTodoNode: jest.fn().mockResolvedValue(null),
    renewNodeLease: jest.fn().mockResolvedValue(true),
    releaseNodeLease: jest.fn().mockResolvedValue(undefined),
    findExpiredInProgressNodes: jest.fn().mockResolvedValue([]),
  };
  const taskLogRepository = {
    create: jest.fn().mockResolvedValue({
      id: 'log-1',
    }),
    findByTaskIdSince: jest.fn().mockResolvedValue([]),
  };
  const taskArtifactRepository = {
    create: jest.fn(),
    findByTaskId: jest.fn().mockResolvedValue([]),
  };
  const projectsService = {
    assertCanAccessProject: jest.fn(),
  };
  const workflowTemplatesService = {
    getTemplateForTask: jest.fn(),
  };
  const taskLogEventsService: Pick<TaskLogEventsService, 'emit' | 'subscribe'> =
    {
      emit: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => undefined),
    };
  const notificationsService = {
    notifyTaskStatusChanged: jest.fn(),
  };
  const taskRuntimeService = {
    ensureRuntime: jest.fn(),
    cleanupRuntime: jest.fn(),
    collectGitDiffArtifact: jest.fn(),
  };
  const agentRunnerService = {
    executeAgentNode: jest.fn(),
  };
  const projectRepository = {
    findAllWithPagination: jest.fn().mockResolvedValue([]),
  };
  const dataSource = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) {
        return Promise.resolve([{ locked: true }]);
      }

      return Promise.resolve([{ unlocked: true }]);
    }),
  };

  const service = new TasksService(
    taskRepository as never,
    taskNodeRepository as never,
    taskLogRepository as never,
    taskArtifactRepository as never,
    projectsService as never,
    workflowTemplatesService as never,
    taskLogEventsService as TaskLogEventsService,
    notificationsService as never,
    taskRuntimeService as never,
    agentRunnerService as never,
    projectRepository as never,
    dataSource as unknown as DataSource,
  );

  return {
    service,
    taskRepository,
    taskNodeRepository,
    taskLogRepository,
    taskLogEventsService,
    taskArtifactRepository,
    taskRuntimeService,
    notificationsService,
    projectsService,
    agentRunnerService,
    projectRepository,
    dataSource,
  };
};

describe('TasksService', () => {
  it('should dispatch manual node to executeManualNode', async () => {
    const { service, taskRepository, taskNodeRepository } =
      createTasksService();
    const serviceAny = service as any;

    const task = createTask();
    const node = createNode(TaskNodeType.manual);
    const project = createProject();

    taskRepository.findById.mockResolvedValue(task);
    taskNodeRepository.findById
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node);

    const executeManualNodeSpy = jest
      .spyOn(serviceAny, 'executeManualNode')
      .mockResolvedValue(undefined);
    const executeAgentNodeSpy = jest
      .spyOn(serviceAny, 'executeAgentNode')
      .mockResolvedValue(undefined);
    jest.spyOn(serviceAny, 'delay').mockResolvedValue(undefined);
    jest.spyOn(serviceAny, 'appendLog').mockResolvedValue({});
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);

    await serviceAny.runNode(task.id, node.id, project);

    expect(executeManualNodeSpy).toHaveBeenCalledTimes(1);
    expect(executeAgentNodeSpy).not.toHaveBeenCalled();
  });

  it('should move manual node to in_review and append warning log', async () => {
    const { service, taskNodeRepository, taskLogRepository } =
      createTasksService();
    const serviceAny = service as any;
    const node = createNode(TaskNodeType.manual);

    await serviceAny.executeManualNode({
      taskId: 'task-1',
      nodeId: node.id,
      node,
    });

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        taskNodeId: node.id,
        level: 'warn',
      }),
    );
  });

  it('should mark agent node done and create artifact when execution succeeds', async () => {
    const { service, taskNodeRepository, agentRunnerService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode(TaskNodeType.agent);
    const project = createProject();

    agentRunnerService.executeAgentNode.mockResolvedValue({
      success: true,
      timedOut: false,
      exitCode: 0,
      signal: null,
      command: 'codex',
      args: ['exec', '-'],
      cwd: '/tmp/worktree-task-1',
      durationMs: 50,
      stdout: 'agent output',
      stderr: '',
      prompt: 'prompt',
    });

    const artifactSpy = jest
      .spyOn(serviceAny, 'createNodeExecutionArtifact')
      .mockResolvedValue(undefined);

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        status: TaskStatus.done,
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(artifactSpy).toHaveBeenCalledTimes(1);
  });

  it('should mark agent node in_review without artifact when approval is required', async () => {
    const { service, taskNodeRepository, agentRunnerService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = {
      ...createNode(TaskNodeType.agent),
      requiresApproval: true,
    };
    const project = createProject();

    agentRunnerService.executeAgentNode.mockResolvedValue({
      success: true,
      timedOut: false,
      exitCode: 0,
      signal: null,
      command: 'codex',
      args: ['exec', '-'],
      cwd: '/tmp/worktree-task-1',
      durationMs: 50,
      stdout: 'agent output',
      stderr: '',
      prompt: 'prompt',
    });

    const artifactSpy = jest
      .spyOn(serviceAny, 'createNodeExecutionArtifact')
      .mockResolvedValue(undefined);

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
      }),
    );
    expect(artifactSpy).not.toHaveBeenCalled();
  });

  it('should mark agent node in_review when execution fails', async () => {
    const { service, taskNodeRepository, agentRunnerService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode(TaskNodeType.agent);
    const project = createProject();

    agentRunnerService.executeAgentNode.mockResolvedValue({
      success: false,
      timedOut: true,
      exitCode: 1,
      signal: null,
      command: 'codex',
      args: ['exec', '-'],
      cwd: '/tmp/worktree-task-1',
      durationMs: 1000,
      stdout: '',
      stderr: 'timeout',
      prompt: 'prompt',
      errorMessage: 'execution timeout',
    });
    taskNodeRepository.findById.mockResolvedValue(node);

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        errorCode: 'TIMEOUT',
      }),
    );
  });

  it('should skip creating duplicated git diff artifact for same node', async () => {
    const { service, taskArtifactRepository, taskRuntimeService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode(TaskNodeType.agent);
    const diffArtifactName = 'task-task-1-changes.diff';

    taskRuntimeService.collectGitDiffArtifact.mockResolvedValue({
      name: diffArtifactName,
      content: '# diff',
      metadata: {
        branch: 'feature/task-1',
      },
    });
    taskArtifactRepository.findByTaskId.mockResolvedValue([
      {
        id: 'artifact-1',
        taskId: task.id,
        taskNodeId: node.id,
        artifactType: TaskArtifactType.diff,
        name: `node-${node.nodeOrder}-${diffArtifactName}`,
        content: '# existing',
        metadata: null,
      },
    ]);

    await serviceAny.createGitDiffArtifact({
      task,
      taskNode: node,
    });

    expect(taskArtifactRepository.create).not.toHaveBeenCalled();
  });

  it('should create git diff artifact when node artifact does not exist', async () => {
    const { service, taskArtifactRepository, taskRuntimeService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode(TaskNodeType.agent);
    const diffArtifactName = 'task-task-1-changes.diff';

    taskRuntimeService.collectGitDiffArtifact.mockResolvedValue({
      name: diffArtifactName,
      content: '# diff',
      metadata: {
        branch: 'feature/task-1',
      },
    });
    taskArtifactRepository.findByTaskId.mockResolvedValue([]);

    await serviceAny.createGitDiffArtifact({
      task,
      taskNode: node,
    });

    expect(taskArtifactRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: node.id,
        artifactType: TaskArtifactType.diff,
        name: `node-${node.nodeOrder}-${diffArtifactName}`,
      }),
    );
  });

  it('should finalize node as unsupported type when runNode receives unknown node type', async () => {
    const { service, taskRepository, taskNodeRepository } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = {
      ...createNode(TaskNodeType.agent),
      nodeType: 'unknown-node-type' as TaskNodeType,
    };
    const project = createProject();

    taskRepository.findById.mockResolvedValue(task);
    taskNodeRepository.findById.mockResolvedValue(node);
    jest.spyOn(serviceAny, 'delay').mockResolvedValue(undefined);
    jest.spyOn(serviceAny, 'appendLog').mockResolvedValue({});
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);

    await serviceAny.runNode(task.id, node.id, project);

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        errorCode: 'UNSUPPORTED_NODE_TYPE',
      }),
    );
  });

  it('should finalize node as unknown error when node executor throws', async () => {
    const { service, taskRepository, taskNodeRepository } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode(TaskNodeType.agent);
    const project = createProject();

    taskRepository.findById.mockResolvedValue(task);
    taskNodeRepository.findById.mockResolvedValue(node);
    jest.spyOn(serviceAny, 'delay').mockResolvedValue(undefined);
    jest.spyOn(serviceAny, 'appendLog').mockResolvedValue({});
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);
    jest
      .spyOn(serviceAny, 'executeAgentNode')
      .mockRejectedValue(new Error('agent failed'));

    await serviceAny.runNode(task.id, node.id, project);

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        errorCode: 'UNKNOWN',
        errorMessage: 'agent failed',
      }),
    );
  });

  it('should return in_progress when nodes contain both todo and done', () => {
    const { service } = createTasksService();
    const serviceAny = service as any;

    const status = serviceAny.calculateTaskStatus([
      createNodeWithStatus(TaskStatus.todo),
      createNodeWithStatus(TaskStatus.done),
    ]);

    expect(status).toBe(TaskStatus.inProgress);
  });

  it('should return in_review when at least one node is in_review and none in_progress', () => {
    const { service } = createTasksService();
    const serviceAny = service as any;

    const status = serviceAny.calculateTaskStatus([
      createNodeWithStatus(TaskStatus.todo),
      createNodeWithStatus(TaskStatus.inReview),
      createNodeWithStatus(TaskStatus.done),
    ]);

    expect(status).toBe(TaskStatus.inReview);
  });

  it('should return done when all nodes are done', () => {
    const { service } = createTasksService();
    const serviceAny = service as any;

    const status = serviceAny.calculateTaskStatus([
      createNodeWithStatus(TaskStatus.done),
      createNodeWithStatus(TaskStatus.done),
    ]);

    expect(status).toBe(TaskStatus.done);
  });

  it('should cleanup runtime and notify user when status changes to done', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      notificationsService,
    } = createTasksService();
    const serviceAny = service as any;
    const task = {
      ...createTask(),
      status: TaskStatus.inProgress,
      createdBy: 'user-1',
      gitWorktreePath: '/tmp/worktree-task-1',
    };

    taskNodeRepository.findByTaskId.mockResolvedValue([
      createNodeWithStatus(TaskStatus.done),
      createNodeWithStatus(TaskStatus.done),
    ]);
    taskRepository.findById.mockResolvedValue(task);
    taskRuntimeService.cleanupRuntime.mockResolvedValue({
      cleaned: true,
    });

    await serviceAny.recalculateTaskStatus(task.id);

    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(task);
    expect(taskRepository.update).toHaveBeenNthCalledWith(
      1,
      task.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
    expect(taskRepository.update).toHaveBeenNthCalledWith(
      2,
      task.id,
      expect.objectContaining({
        gitWorktreePath: null,
      }),
    );
    expect(notificationsService.notifyTaskStatusChanged).toHaveBeenCalledWith({
      userId: 'user-1',
      taskId: task.id,
      status: TaskStatus.done,
    });
  });

  it('should keep sandbox and notify when status changes to in_review', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      notificationsService,
      taskLogRepository,
    } = createTasksService();
    const serviceAny = service as any;
    const task = {
      ...createTask(),
      status: TaskStatus.inProgress,
      createdBy: 'user-2',
      gitWorktreePath: '/tmp/worktree-task-2',
      sandboxCleanupAt: null,
    };

    taskNodeRepository.findByTaskId.mockResolvedValue([
      createNodeWithStatus(TaskStatus.inReview),
      createNodeWithStatus(TaskStatus.done),
    ]);
    taskRepository.findById.mockResolvedValue(task);

    await serviceAny.recalculateTaskStatus(task.id);

    expect(taskRuntimeService.cleanupRuntime).not.toHaveBeenCalled();
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        message: 'Task kept sandbox for troubleshooting',
      }),
    );
    expect(notificationsService.notifyTaskStatusChanged).toHaveBeenCalledWith({
      userId: 'user-2',
      taskId: task.id,
      status: TaskStatus.inReview,
    });
  });

  it('should skip cleanup and notification when status does not change', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      notificationsService,
    } = createTasksService();
    const serviceAny = service as any;
    const task = {
      ...createTask(),
      status: TaskStatus.todo,
      createdBy: 'user-3',
    };

    taskNodeRepository.findByTaskId.mockResolvedValue([
      createNodeWithStatus(TaskStatus.todo),
      createNodeWithStatus(TaskStatus.todo),
    ]);
    taskRepository.findById.mockResolvedValue(task);

    await serviceAny.recalculateTaskStatus(task.id);

    expect(taskRuntimeService.cleanupRuntime).not.toHaveBeenCalled();
    expect(notificationsService.notifyTaskStatusChanged).not.toHaveBeenCalled();
  });

  it('should queue and dispatch first todo node when slots are available', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectsService,
      projectRepository,
    } = createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const project = createProject();
    const todoNode = {
      ...createNode(TaskNodeType.agent),
      status: TaskStatus.inProgress,
      attempt: 2,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasks.mockResolvedValue(0);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({
      [task.projectId]: 0,
    });
    projectsService.assertCanAccessProject.mockResolvedValue(project);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findFirstByTaskIdAndStatus.mockResolvedValue({
      ...todoNode,
      status: TaskStatus.todo,
      attempt: 1,
    });
    taskNodeRepository.claimFirstTodoNode.mockResolvedValue(todoNode);
    taskNodeRepository.findByTaskId.mockResolvedValue([todoNode]);
    jest
      .spyOn(serviceAny, 'prepareTaskRuntime')
      .mockResolvedValue({ task, project });
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);
    const runNodeSpy = jest
      .spyOn(serviceAny, 'runNode')
      .mockResolvedValue(undefined);

    await service.execute(task.id, currentUser as never);

    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        startedAt: expect.any(Date),
      }),
    );
    expect(taskNodeRepository.claimFirstTodoNode).toHaveBeenCalledWith(
      task.id,
      expect.any(String),
      expect.any(Date),
    );
    expect(runNodeSpy).toHaveBeenCalledWith(
      task.id,
      todoNode.id,
      project,
      expect.any(String),
    );
  });

  it('should queue task without dispatch in api role', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService({ runtimeRole: 'api' }) as any;
    const serviceAny = service as any;
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(project);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findFirstByTaskIdAndStatus.mockResolvedValue({
      ...createNode(TaskNodeType.agent),
      status: TaskStatus.todo,
    });
    taskNodeRepository.findByTaskId.mockResolvedValue([
      createNodeWithStatus(TaskStatus.todo),
    ]);
    jest
      .spyOn(serviceAny, 'prepareTaskRuntime')
      .mockResolvedValue({ task, project });
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);
    const runNodeSpy = jest
      .spyOn(serviceAny, 'runNode')
      .mockResolvedValue(undefined);

    await service.execute(task.id, currentUser as never);

    expect(taskNodeRepository.claimFirstTodoNode).not.toHaveBeenCalled();
    expect(runNodeSpy).not.toHaveBeenCalled();
  });

  it('should reject execute when task already has in-progress node', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(project);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(
      createNode(TaskNodeType.agent),
    );
    jest
      .spyOn(serviceAny, 'prepareTaskRuntime')
      .mockResolvedValue({ task, project });

    await expect(
      service.execute(task.id, currentUser as never),
    ).rejects.toThrow(ConflictException);
  });

  it('should queue retry node and dispatch it when slots are available', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectsService,
      projectRepository,
    } = createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const project = createProject();
    const reviewNode = {
      ...createNode(TaskNodeType.agent),
      status: TaskStatus.inReview,
      attempt: 2,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasks.mockResolvedValue(0);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({
      [task.projectId]: 0,
    });
    projectsService.assertCanAccessProject.mockResolvedValue(project);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findById.mockResolvedValue(reviewNode);
    taskNodeRepository.claimFirstTodoNode.mockResolvedValue({
      ...reviewNode,
      status: TaskStatus.inProgress,
      attempt: 3,
    });
    taskNodeRepository.findByTaskId.mockResolvedValue([reviewNode]);
    jest
      .spyOn(serviceAny, 'prepareTaskRuntime')
      .mockResolvedValue({ task, project });
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);
    const runNodeSpy = jest
      .spyOn(serviceAny, 'runNode')
      .mockResolvedValue(undefined);

    await service.retry(
      task.id,
      {
        nodeId: reviewNode.id,
      } as never,
      currentUser as never,
    );

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      reviewNode.id,
      expect.objectContaining({
        status: TaskStatus.todo,
        output: null,
      }),
    );
    expect(runNodeSpy).toHaveBeenCalledWith(
      task.id,
      reviewNode.id,
      project,
      expect.any(String),
    );
  });

  it('should reject retry when target node is not in_review', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const project = createProject();
    const doneNode = {
      ...createNode(TaskNodeType.agent),
      status: TaskStatus.done,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(project);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findById.mockResolvedValue(doneNode);
    jest
      .spyOn(serviceAny, 'prepareTaskRuntime')
      .mockResolvedValue({ task, project });

    await expect(
      service.retry(
        task.id,
        {
          nodeId: doneNode.id,
        } as never,
        currentUser as never,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should approve in_review node and mark it done', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const reviewNode = {
      ...createNode(TaskNodeType.manual),
      status: TaskStatus.inReview,
      finishedAt: null,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskNodeRepository.findById.mockResolvedValue(reviewNode);
    taskNodeRepository.findByTaskId.mockResolvedValue([reviewNode]);
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);

    await service.approve(
      task.id,
      {
        nodeId: reviewNode.id,
      } as never,
      currentUser as never,
    );

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      reviewNode.id,
      expect.objectContaining({
        status: TaskStatus.done,
        errorCode: null,
        errorMessage: null,
      }),
    );
  });

  it('should cancel in-progress node and move it to in_review', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const runningNode = {
      ...createNode(TaskNodeType.agent),
      status: TaskStatus.inProgress,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(runningNode);
    taskNodeRepository.findByTaskId.mockResolvedValue([runningNode]);
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);

    await service.cancel(task.id, currentUser as never);

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        errorCode: 'CANCELLED',
      }),
    );
  });

  it('should cleanup worktree and clear path when runtime cleanup succeeds', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      projectsService,
      taskLogRepository,
    } = createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskRuntimeService.cleanupRuntime.mockResolvedValue({
      cleaned: true,
    });
    taskNodeRepository.findByTaskId.mockResolvedValue([]);

    await service.cleanupWorktree(task.id, currentUser as never);

    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(task);
    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        gitWorktreePath: null,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        message: 'Task worktree cleaned manually',
      }),
    );
  });

  it('should create artifact and append upload log', async () => {
    const {
      service,
      taskRepository,
      projectsService,
      taskArtifactRepository,
      taskLogRepository,
    } = createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskArtifactRepository.create.mockResolvedValue({
      id: 'artifact-1',
      taskId: task.id,
      artifactType: TaskArtifactType.report,
    });

    await service.createArtifact(
      task.id,
      {
        taskNodeId: null,
        artifactType: TaskArtifactType.report,
        name: 'summary.md',
        content: '# summary',
      } as never,
      currentUser as never,
    );

    expect(taskArtifactRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        artifactType: TaskArtifactType.report,
        name: 'summary.md',
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Task artifact uploaded',
      }),
    );
  });

  it('should reject createArtifact when taskNode does not belong to task', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskNodeRepository.findById.mockResolvedValue({
      ...createNode(TaskNodeType.agent),
      taskId: 'another-task-id',
    });

    await expect(
      service.createArtifact(
        task.id,
        {
          taskNodeId: 'node-1',
          artifactType: TaskArtifactType.report,
          name: 'summary.md',
        } as never,
        currentUser as never,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should open log stream with history and subscribe function', async () => {
    const {
      service,
      taskRepository,
      projectsService,
      taskLogRepository,
      taskLogEventsService,
    } = createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();
    const history = [
      {
        id: 'log-1',
        taskId: task.id,
        level: 'info',
        message: 'hello',
        createdAt: new Date(),
      },
    ];
    const unsubscribe = jest.fn();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskLogRepository.findByTaskIdSince
      .mockResolvedValueOnce(history)
      .mockResolvedValue([]);
    taskLogEventsService.subscribe.mockReturnValue(unsubscribe);

    const stream = await service.openLogStream({
      taskId: task.id,
      query: {
        limit: 50,
      } as never,
      currentUser: currentUser as never,
    });

    const listener = jest.fn();
    const result = stream.subscribe(listener);

    expect(stream.history).toEqual(history);
    expect(taskLogRepository.findByTaskIdSince).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
      }),
    );
    expect(taskLogEventsService.subscribe).toHaveBeenCalledWith(
      task.id,
      expect.any(Function),
    );
    result();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should return null from findById when task does not exist', async () => {
    const { service, taskRepository } = createTasksService() as any;
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(null);

    const result = await service.findById('missing-task', currentUser as never);

    expect(result).toBeNull();
  });

  it('should reject findAllWithPagination for non-admin without projectId', async () => {
    const { service } = createTasksService() as any;
    const currentUser = createNonAdminUser();

    await expect(
      service.findAllWithPagination({
        query: {
          page: 1,
          limit: 10,
        },
        currentUser,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should list artifacts after permission check', async () => {
    const { service, taskRepository, projectsService, taskArtifactRepository } =
      createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();
    const artifacts = [
      {
        id: 'artifact-1',
        taskId: task.id,
        artifactType: TaskArtifactType.report,
        name: 'summary.md',
      },
    ];

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskArtifactRepository.findByTaskId.mockResolvedValue(artifacts);

    const result = await service.listArtifacts(task.id, currentUser as never);

    expect(taskArtifactRepository.findByTaskId).toHaveBeenCalledWith(task.id);
    expect(result).toEqual(artifacts);
  });

  it('should list logs with parsed since date', async () => {
    const { service, taskRepository, projectsService, taskLogRepository } =
      createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();
    const logs = [
      {
        id: 'log-1',
        taskId: task.id,
        level: 'info',
        message: 'hello',
      },
    ];
    const since = new Date().toISOString();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskLogRepository.findByTaskIdSince.mockResolvedValue(logs);

    const result = await service.listLogs(
      task.id,
      {
        since,
        limit: 20,
      } as never,
      currentUser as never,
    );

    expect(taskLogRepository.findByTaskIdSince).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        limit: 20,
      }),
    );
    expect(result).toEqual(logs);
  });

  it('should keep git worktree path when cleanupWorktree fails', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      projectsService,
      taskLogRepository,
    } = createTasksService() as any;
    const task = {
      ...createTask(),
      gitWorktreePath: '/tmp/worktree-task-fail',
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertCanAccessProject.mockResolvedValue(createProject());
    taskRuntimeService.cleanupRuntime.mockResolvedValue({
      cleaned: false,
      errorMessage: 'cleanup failed',
    });
    taskNodeRepository.findByTaskId.mockResolvedValue([]);

    await service.cleanupWorktree(task.id, currentUser as never);

    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.not.objectContaining({
        gitWorktreePath: null,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Task worktree cleanup skipped or failed',
      }),
    );
  });
});
