import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { DataSource } from 'typeorm';
import { TaskLogEventsService } from './task-log-events.service';
import { TaskLogLevel } from './dto/task-log-level.enum';
import { TaskMode } from './dto/task-mode.enum';
import { TaskStatus } from './dto/task-status.enum';
import { TasksService } from './tasks.service';

const originalDataRootDir = process.env.AINATIVE_DATA_ROOT_DIR;
let testDataRootDir: string | undefined;

const defaultExecutionConfig = {
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
};

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
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'task title',
  prompt: 'task description',
  status: TaskStatus.todo,
  gitBranch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktree: '/tmp/worktree-task-1',
  configJson: null,
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

const createNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'node-1',
  taskId: 'task-1',
  nodeOrder: 1,
  name: 'agent-node',
  input: {
    taskInput: 'task description',
    nodeInput: null,
  },
  agentCliId: defaultExecutionConfig.agentCliId,
  agentCliConfigId: defaultExecutionConfig.agentCliConfigId,
  agentClioutput: null,
  agentCliSessionId: null,
  loopJson: {
    enabled: false,
    loopCount: 0,
    maxLoops: 1,
  },
  runtimeJson: null,
  status: TaskStatus.inProgress,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createNodeWithStatus = (status: TaskStatus) => ({
  ...createNode(),
  status,
});

const createTasksService = () => {
  const taskRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByGitWorktree: jest.fn().mockResolvedValue(null),
    findMaxGitWorktreeSequence: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    findTasksReadyForDispatch: jest.fn().mockResolvedValue([]),
    findTasksWithExpiredWorktrees: jest.fn().mockResolvedValue([]),
    countRunningTasks: jest.fn().mockResolvedValue(0),
    countRunningTasksByProjectIds: jest.fn().mockResolvedValue({}),
    countQueuedTasksByProjectIds: jest.fn().mockResolvedValue({}),
    countStaleRunningTasks: jest.fn().mockResolvedValue(0),
    findOldestQueuedTaskCreatedAt: jest.fn().mockResolvedValue(null),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const taskNodeRepository = {
    createMany: jest.fn(),
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
    create: jest.fn().mockImplementation((data) => ({
      id: 'log-1',
      taskId: data.taskId,
      taskNodeId: data.taskNodeId ?? null,
      level: data.level,
      message: data.message,
      payload: data.payload ?? null,
      createdAt: new Date('2026-03-09T15:00:00.000Z'),
    })),
    findByTaskIdSince: jest.fn().mockResolvedValue([]),
  };
  const projectsService = {
    assertProjectCapability: jest.fn(),
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
    ensureRuntime: jest.fn().mockResolvedValue({
      gitBranch: 'feature/task-1',
      gitBaseBranch: 'main',
      gitWorktree: '/tmp/worktree-task-1',
      worktreePath: '/tmp/worktree-task-1',
    }),
    cleanupRuntime: jest.fn().mockResolvedValue({ cleaned: false }),
    collectGitDiffArtifact: jest.fn(),
    resolveAndValidateCreateWorktreePath: jest.fn(),
  };
  const agentRunnerService = {
    executeAgentNode: jest.fn(),
  };
  const projectRepository = {
    findById: jest.fn().mockResolvedValue(createProject()),
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
    taskRuntimeService,
    notificationsService,
    projectsService,
    workflowTemplatesService,
    agentRunnerService,
    projectRepository,
    dataSource,
  };
};

describe('TasksService', () => {
  beforeAll(async () => {
    testDataRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-test-data-'),
    );
    process.env.AINATIVE_DATA_ROOT_DIR = testDataRootDir;
  });

  beforeEach(async () => {
    if (testDataRootDir) {
      await fs.rm(testDataRootDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    if (testDataRootDir) {
      await fs.rm(testDataRootDir, { recursive: true, force: true });
    }

    if (originalDataRootDir === undefined) {
      delete process.env.AINATIVE_DATA_ROOT_DIR;
      return;
    }

    process.env.AINATIVE_DATA_ROOT_DIR = originalDataRootDir;
  });

  it('should create task with normalized git fields', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectsService,
      taskRuntimeService,
    } = createTasksService() as any;
    const currentUser = createCurrentUser();
    const project = createProject();

    projectsService.assertProjectCapability.mockResolvedValue(project);
    taskRuntimeService.resolveAndValidateCreateWorktreePath.mockResolvedValue(
      '/tmp/worktrees/task-1',
    );
    taskRepository.findByGitWorktree.mockResolvedValue(null);
    taskRepository.create.mockResolvedValue({
      ...createTask(),
      mode: TaskMode.conversation,
      projectId: project.id,
      gitBranch: 'feature/new-task',
      gitBaseBranch: 'develop',
      gitWorktree: 'task-1',
    });
    taskRuntimeService.ensureRuntime.mockResolvedValue({
      gitBranch: 'feature/new-task',
      gitBaseBranch: 'develop',
      gitWorktree: 'task-1',
      worktreePath: '/tmp/worktrees/task-1',
    });

    await service.create(
      {
        projectId: project.id,
        title: 'Create task',
        prompt: 'Do something',
        gitBranch: 'feature/new-task',
        gitBaseBranch: ' develop ',
        gitWorktree: '/tmp/worktrees/task-1',
        configJson: defaultExecutionConfig,
      } as never,
      currentUser as never,
    );

    expect(
      taskRuntimeService.resolveAndValidateCreateWorktreePath,
    ).toHaveBeenCalledWith(project, '/tmp/worktrees/task-1');
    expect(taskRepository.findByGitWorktree).toHaveBeenCalledWith('task-1');
    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.id,
        businessLineId: project.businessLineId,
        mode: TaskMode.conversation,
        gitBranch: 'feature/new-task',
        gitBaseBranch: 'develop',
        gitWorktree: 'task-1',
      }),
    );
    expect(taskRuntimeService.ensureRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        gitBranch: 'feature/new-task',
        gitBaseBranch: 'develop',
        gitWorktree: 'task-1',
      }),
      project,
    );
    expect(taskNodeRepository.createMany).toHaveBeenCalledTimes(1);
  });

  it('should throw bad request when gitWorktree is outside allowed root', async () => {
    const { service, taskRepository, projectsService, taskRuntimeService } =
      createTasksService() as any;
    const currentUser = createCurrentUser();
    const project = createProject();

    projectsService.assertProjectCapability.mockResolvedValue(project);
    taskRuntimeService.resolveAndValidateCreateWorktreePath.mockRejectedValue(
      new Error('worktree path /tmp/outside is outside allowed root /tmp/in'),
    );

    await expect(
      service.create(
        {
          projectId: project.id,
          title: 'Create task',
          gitWorktree: '/tmp/outside',
          configJson: defaultExecutionConfig,
        } as never,
        currentUser as never,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(taskRepository.create).not.toHaveBeenCalled();
  });

  it('should throw conflict when gitWorktree is already in use', async () => {
    const { service, taskRepository, projectsService, taskRuntimeService } =
      createTasksService() as any;
    const currentUser = createCurrentUser();
    const project = createProject();

    projectsService.assertProjectCapability.mockResolvedValue(project);
    taskRuntimeService.resolveAndValidateCreateWorktreePath.mockResolvedValue(
      '/tmp/worktrees/task-dup',
    );
    taskRepository.findByGitWorktree.mockResolvedValue(createTask());

    await expect(
      service.create(
        {
          projectId: project.id,
          title: 'Create task',
          gitWorktree: '/tmp/worktrees/task-dup',
          configJson: defaultExecutionConfig,
        } as never,
        currentUser as never,
      ),
    ).rejects.toThrow(ConflictException);

    expect(taskRepository.findByGitWorktree).toHaveBeenCalledWith('task-dup');

    expect(taskRepository.create).not.toHaveBeenCalled();
  });

  it('should generate default git names when create payload does not provide them', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectsService,
      taskRuntimeService,
    } = createTasksService() as any;
    const currentUser = createCurrentUser();
    const project = createProject();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-06T10:20:00Z'));

    projectsService.assertProjectCapability.mockResolvedValue(project);
    taskRepository.create.mockResolvedValue({
      ...createTask(),
      mode: TaskMode.conversation,
      gitBaseBranch: null,
      gitBranch: 'feature/20260306-182000',
      gitWorktree: 'wk-20260306-182000',
    });
    taskRuntimeService.ensureRuntime.mockResolvedValue({
      gitBranch: 'feature/20260306-182000',
      gitBaseBranch: null,
      gitWorktree: 'wk-20260306-182000',
      worktreePath: '/tmp/worktrees/wk-20260306-182000',
    });

    await service.create(
      {
        projectId: project.id,
        title: 'Create task',
        prompt: 'Do something',
        configJson: defaultExecutionConfig,
      } as never,
      currentUser as never,
    );

    expect(taskRepository.findByGitWorktree).toHaveBeenCalledWith(
      'wk-20260306-182000',
    );
    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessLineId: project.businessLineId,
        gitBranch: 'feature/20260306-182000',
        gitBaseBranch: null,
        gitWorktree: 'wk-20260306-182000',
      }),
    );
    expect(taskNodeRepository.createMany).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should create workflow task from configJson workflowTemplateId', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectsService,
      workflowTemplatesService,
      taskRuntimeService,
    } = createTasksService() as any;
    const currentUser = createCurrentUser();
    const project = createProject();

    projectsService.assertProjectCapability.mockResolvedValue(project);
    workflowTemplatesService.getTemplateForTask.mockResolvedValue({
      id: 'wf-1',
      nodesJson: [
        {
          nodeOrder: 2,
          name: 'second-node',
          type: 'agent',
          input: {
            agentCliId: 'gemini-cli',
            agentCliConfigId: 'cfg-2',
          },
        },
        {
          nodeOrder: 1,
          name: 'first-node',
          type: 'agent',
          input: {
            agentCliId: 'codex',
            agentCliConfigId: 'cfg-1',
          },
        },
      ],
    });
    taskRepository.create.mockResolvedValue({
      ...createTask(),
      mode: TaskMode.workflow,
      configJson: {
        workflowTemplateId: 'wf-1',
      },
    });

    await service.create(
      {
        projectId: project.id,
        mode: TaskMode.workflow,
        configJson: {
          workflowTemplateId: 'wf-1',
        },
        title: 'Workflow task',
      } as never,
      currentUser as never,
    );

    expect(workflowTemplatesService.getTemplateForTask).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'wf-1',
        projectId: project.id,
      }),
    );
    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: TaskMode.workflow,
        configJson: expect.objectContaining({
          workflowTemplateId: 'wf-1',
        }),
      }),
    );
    expect(taskNodeRepository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          nodeOrder: 1,
          name: 'first-node',
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-1',
        }),
        expect.objectContaining({
          nodeOrder: 2,
          name: 'second-node',
          agentCliId: 'gemini-cli',
          agentCliConfigId: 'cfg-2',
        }),
      ]),
    );
    expect(taskRuntimeService.ensureRuntime).toHaveBeenCalledTimes(1);
  });

  it('should update workflow task prompt without requiring task-level cli config', async () => {
    const { service, taskRepository, projectsService, taskNodeRepository } =
      createTasksService() as any;
    const task = {
      ...createTask(),
      mode: TaskMode.workflow,
      configJson: {
        workflowTemplateId: 'wf-1',
      },
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.update.mockResolvedValue({
      ...task,
      prompt: 'Updated workflow prompt',
    });
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    taskNodeRepository.findByTaskId.mockResolvedValue([
      createNode({
        status: TaskStatus.todo,
        agentCliId: 'gemini-cli',
        agentCliConfigId: 'cfg-2',
      }),
    ]);

    await service.update(
      task.id,
      {
        prompt: 'Updated workflow prompt',
      } as never,
      currentUser as never,
    );

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({
        agentCliId: 'gemini-cli',
        agentCliConfigId: 'cfg-2',
      }),
    );
  });

  it('should cleanup created task when runtime initialization fails during create', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      projectsService,
      taskRuntimeService,
    } = createTasksService() as any;
    const currentUser = createCurrentUser();
    const project = createProject();
    const createdTask = {
      ...createTask(),
      projectId: project.id,
      gitBranch: 'feature/20260306-182000',
      gitBaseBranch: null,
      gitWorktree: 'wk-20260306-182000',
      configJson: {
        ...defaultExecutionConfig,
      },
    };

    projectsService.assertProjectCapability.mockResolvedValue(project);
    taskRepository.create.mockResolvedValue(createdTask);
    taskRuntimeService.ensureRuntime.mockRejectedValue(
      new Error('git clone failed'),
    );

    await expect(
      service.create(
        {
          projectId: project.id,
          title: 'Create task',
          configJson: defaultExecutionConfig,
        } as never,
        currentUser as never,
      ),
    ).rejects.toThrow(ConflictException);

    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(
      createdTask,
      project,
    );
    expect(taskRepository.remove).toHaveBeenCalledWith(createdTask.id);
    expect(taskNodeRepository.createMany).not.toHaveBeenCalled();
  });

  it('should dispatch runnable node to executeAgentNode', async () => {
    const { service, taskRepository, taskNodeRepository } =
      createTasksService();
    const serviceAny = service as any;

    const task = createTask();
    const node = createNode();
    const project = createProject();

    taskRepository.findById.mockResolvedValue(task);
    taskNodeRepository.findById
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node);

    const executeAgentNodeSpy = jest
      .spyOn(serviceAny, 'executeAgentNode')
      .mockResolvedValue(undefined);
    jest.spyOn(serviceAny, 'delay').mockResolvedValue(undefined);
    jest.spyOn(serviceAny, 'appendLog').mockResolvedValue({});
    jest
      .spyOn(serviceAny, 'recalculateTaskStatus')
      .mockResolvedValue(undefined);

    await serviceAny.runNode(task.id, node.id, project);

    expect(executeAgentNodeSpy).toHaveBeenCalledTimes(1);
  });

  it('should mark agent node done when execution succeeds', async () => {
    const {
      service,
      taskNodeRepository,
      agentRunnerService,
      taskLogRepository,
    } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode();
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
        agentClioutput: expect.any(String),
        runtimeJson: null,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: node.id,
        level: TaskLogLevel.info,
        message: 'Agent CLI stdout chunk',
        payload: expect.objectContaining({
          stream: 'stdout',
          chunkIndex: 1,
          chunkCount: 1,
          text: 'agent output',
          command: 'codex',
          args: ['exec', '-'],
          exitCode: 0,
        }),
      }),
    );
  });

  it('should persist only stdout json lines into output jsonl', async () => {
    const { service, agentRunnerService } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode();
    const project = createProject();
    const stdoutJsonl = [
      '{"type":"message","delta":"hello"}',
      '{"type":"result","ok":true}',
    ].join('\n');

    agentRunnerService.executeAgentNode.mockResolvedValue({
      success: true,
      timedOut: false,
      exitCode: 0,
      signal: null,
      command: 'codex',
      args: ['exec', '-'],
      cwd: '/tmp/worktree-task-1',
      durationMs: 50,
      stdout: stdoutJsonl,
      stderr: '',
      prompt: 'prompt',
    });

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual([
      '{"type":"message","delta":"hello"}',
      '{"type":"result","ok":true}',
    ]);
  });

  it('should append agent cli stdout json lines one by one during execution', async () => {
    const { service, agentRunnerService, taskLogRepository } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode();
    const project = createProject();
    const stdoutLines = [
      '{"type":"system","subtype":"init"}',
      '{"type":"result","ok":true}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        callbacks?.onStdoutLine?.(stdoutLines[0]);
        callbacks?.onStdoutLine?.(stdoutLines[1]);

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'agent',
          args: ['-p', '--output-format', 'stream-json', '--verbose'],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: stdoutLines.join('\n'),
          stderr: '',
          prompt: 'prompt',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(stdoutLines);
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: node.id,
        level: TaskLogLevel.info,
        message: 'Agent CLI stdout chunk',
        payload: expect.objectContaining({
          stream: 'stdout',
          lineIndex: 1,
          text: stdoutLines[0],
        }),
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: node.id,
        level: TaskLogLevel.info,
        message: 'Agent CLI stdout chunk',
        payload: expect.objectContaining({
          stream: 'stdout',
          lineIndex: 2,
          text: stdoutLines[1],
        }),
      }),
    );
  });

  it('should append claude code stdout json lines into output jsonl during execution', async () => {
    const { service, agentRunnerService } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      agentCliId: 'claude-code',
    });
    const project = createProject({
      agentAdapter: 'claude-code',
    });
    const stdoutLines = [
      '{"type":"system","subtype":"init","session_id":"claude-session-1"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}',
      '{"type":"result","subtype":"success","session_id":"claude-session-1"}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        stdoutLines.forEach((line) => callbacks?.onStdoutLine?.(line));

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'claude',
          args: ['-p', '--output-format', 'stream-json', '--verbose'],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: stdoutLines.join('\n'),
          stderr: '',
          prompt: 'prompt',
          sessionId: 'claude-session-1',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(stdoutLines);
  });

  it('should append gemini stdout json lines into output jsonl during execution', async () => {
    const { service, agentRunnerService } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      agentCliId: 'gemini-cli',
    });
    const project = createProject({
      agentAdapter: 'gemini-cli',
    });
    const stdoutLines = [
      '{"type":"system","subtype":"init","session_id":"gemini-session-1"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}',
      '{"type":"result","subtype":"success","session_id":"gemini-session-1"}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        stdoutLines.forEach((line) => callbacks?.onStdoutLine?.(line));

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'gemini',
          args: ['--output-format', 'stream-json'],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: stdoutLines.join('\n'),
          stderr: '',
          prompt: 'prompt',
          sessionId: 'gemini-session-1',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(stdoutLines);
  });

  it('should append opencode stdout json lines into output jsonl during execution', async () => {
    const { service, agentRunnerService } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      agentCliId: 'opencode',
    });
    const project = createProject({
      agentAdapter: 'opencode',
    });
    const stdoutLines = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]},"session_id":"opencode-session-1"}',
      '{"type":"tool_call","tool":"read","input":{"path":"README.md"},"id":"call-1","session_id":"opencode-session-1"}',
      '{"type":"tool_result","result":{"content":"done"},"call_id":"call-1","session_id":"opencode-session-1"}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        stdoutLines.forEach((line) => callbacks?.onStdoutLine?.(line));

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'opencode',
          args: ['run', '--format', 'json'],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: stdoutLines.join('\n'),
          stderr: '',
          prompt: 'prompt',
          sessionId: 'opencode-session-1',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual(stdoutLines);
  });

  it('should extract embedded gemini json lines from mixed stdout chunks', async () => {
    const { service, agentRunnerService } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      agentCliId: 'gemini-cli',
    });
    const project = createProject({
      agentAdapter: 'gemini-cli',
    });
    const mixedStdoutLines = [
      'MCP issues detected. Run /mcp list for status.{"type":"init","timestamp":"2026-03-12T08:40:39.670Z","session_id":"gemini-session-1","model":"gemini-3-pro-preview"}',
      '{"type":"message","timestamp":"2026-03-12T08:40:39.671Z","role":"user","content":"prompt"}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        mixedStdoutLines.forEach((line) => callbacks?.onStdoutLine?.(line));

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'gemini',
          args: ['--output-format', 'stream-json'],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: mixedStdoutLines.join('\n'),
          stderr: '',
          prompt: 'prompt',
          sessionId: 'gemini-session-1',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual([
      '{"type":"init","timestamp":"2026-03-12T08:40:39.670Z","session_id":"gemini-session-1","model":"gemini-3-pro-preview"}',
      '{"type":"message","timestamp":"2026-03-12T08:40:39.671Z","role":"user","content":"prompt"}',
    ]);
  });

  it('should preserve existing output.jsonl data when continuing a session', async () => {
    const { service, agentRunnerService } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      agentCliSessionId: 'existing-session-1',
    });
    const project = createProject();

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const existingData =
      [
        '{"type":"system","subtype":"init","session_id":"existing-session-1"}',
        '{"type":"result","ok":true,"session_id":"existing-session-1"}',
      ].join('\n') + '\n';
    await fs.writeFile(outputPath, existingData, 'utf-8');

    const newStdoutLines = [
      '{"type":"user","message":"continue","session_id":"existing-session-1"}',
      '{"type":"result","ok":true,"session_id":"existing-session-1"}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        callbacks?.onStdoutLine?.(newStdoutLines[0]);
        callbacks?.onStdoutLine?.(newStdoutLines[1]);

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'cursor',
          args: ['-p', '--resume', 'existing-session-1'],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: newStdoutLines.join('\n'),
          stderr: '',
          prompt: 'continue working',
          sessionId: 'existing-session-1',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);

    expect(lines.length).toBe(4);
    expect(lines[0]).toBe(
      '{"type":"system","subtype":"init","session_id":"existing-session-1"}',
    );
    expect(lines[1]).toBe(
      '{"type":"result","ok":true,"session_id":"existing-session-1"}',
    );
    expect(lines[2]).toBe(newStdoutLines[0]);
    expect(lines[3]).toBe(newStdoutLines[1]);
  });

  it('should preserve existing claude output jsonl data when continuing a session', async () => {
    const { service, agentRunnerService, taskNodeRepository } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      agentCliId: 'claude-code',
      agentCliSessionId: 'claude-session-1',
    });
    const project = createProject({
      agentAdapter: 'claude-code',
    });

    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const existingData =
      [
        '{"type":"system","subtype":"init","session_id":"claude-session-1"}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"first turn"}]}}',
      ].join('\n') + '\n';
    await fs.writeFile(outputPath, existingData, 'utf-8');

    const newStdoutLines = [
      '{"type":"user","message":{"content":"continue"},"session_id":"claude-session-1"}',
      '{"type":"result","subtype":"success","session_id":"claude-session-1"}',
    ];

    agentRunnerService.executeAgentNode.mockImplementation(
      ({
        callbacks,
      }: {
        callbacks?: { onStdoutLine?: (line: string) => void };
      }) => {
        newStdoutLines.forEach((line) => callbacks?.onStdoutLine?.(line));

        return Promise.resolve({
          success: true,
          timedOut: false,
          exitCode: 0,
          signal: null,
          command: 'claude',
          args: [
            '-p',
            '--output-format',
            'stream-json',
            '--verbose',
            '--resume',
            'claude-session-1',
          ],
          cwd: '/tmp/worktree-task-1',
          durationMs: 50,
          stdout: newStdoutLines.join('\n'),
          stderr: '',
          prompt: 'continue working',
          sessionId: 'claude-session-1',
        });
      },
    );

    await serviceAny.executeAgentNode({
      taskId: task.id,
      nodeId: node.id,
      task,
      node,
      project,
    });

    const content = await fs.readFile(outputPath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);

    expect(lines).toEqual([
      '{"type":"system","subtype":"init","session_id":"claude-session-1"}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"first turn"}]}}',
      '{"type":"user","message":{"content":"continue"},"session_id":"claude-session-1"}',
      '{"type":"result","subtype":"success","session_id":"claude-session-1"}',
    ]);
    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      node.id,
      expect.objectContaining({
        agentCliSessionId: 'claude-session-1',
      }),
    );
  });

  it('should fallback to output jsonl content when no summary metadata exists', async () => {
    const { service } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode();
    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      [
        '{"type":"message","delta":"hello"}',
        '{"type":"result","ok":true}',
      ].join('\n') + '\n',
      'utf-8',
    );

    const summary = await serviceAny.readNodeOutputSummary({
      ...node,
      agentClioutput: outputPath,
    });

    expect(summary).toBe(
      [
        '{"type":"message","delta":"hello"}',
        '{"type":"result","ok":true}',
      ].join('\n'),
    );
  });

  it('should queue next loop when agent node has remaining loops', async () => {
    const { service, taskNodeRepository, agentRunnerService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      status: TaskStatus.inProgress,
      loopJson: {
        enabled: true,
        loopCount: 1,
        maxLoops: 3,
      },
    });
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
        status: TaskStatus.todo,
        loopJson: {
          enabled: true,
          loopCount: 2,
          maxLoops: 3,
        },
        startedAt: null,
        finishedAt: null,
        agentClioutput: expect.any(String),
        runtimeJson: null,
      }),
    );
  });

  it('should keep final node in_review when approval is required', async () => {
    const { service, taskNodeRepository, agentRunnerService } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode({
      status: TaskStatus.inProgress,
      configJson: {
        requiresApproval: true,
      },
      loopJson: {
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      },
    });
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
        runtimeJson: null,
      }),
    );
  });

  it('should mark agent node in_review when execution fails', async () => {
    const {
      service,
      taskNodeRepository,
      agentRunnerService,
      taskLogRepository,
    } = createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode();
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
        agentClioutput: expect.any(String),
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: node.id,
        level: TaskLogLevel.warn,
        message: 'Agent CLI stderr chunk',
        payload: expect.objectContaining({
          stream: 'stderr',
          text: 'timeout',
          command: 'codex',
          args: ['exec', '-'],
          exitCode: 1,
          timedOut: true,
        }),
      }),
    );
  });

  it('should split long agent cli output into multiple task log chunks', () => {
    const { service } = createTasksService();
    const serviceAny = service as any;
    const content = 'a'.repeat(4_500);

    const chunks = serviceAny.chunkAgentCliLogContent(content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(4_000);
    expect(chunks[1]).toHaveLength(500);
  });

  it('should finalize node as unknown error when node executor throws', async () => {
    const { service, taskRepository, taskNodeRepository } =
      createTasksService();
    const serviceAny = service as any;
    const task = createTask();
    const node = createNode();
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
        agentClioutput: expect.any(String),
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

  it('should preserve worktree and notify user when status changes to done', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      taskLogRepository,
      notificationsService,
    } = createTasksService();
    const serviceAny = service as any;
    const task = {
      ...createTask(),
      status: TaskStatus.inProgress,
      createdBy: 'user-1',
      gitWorktree: '/tmp/worktree-task-1',
    };

    taskNodeRepository.findByTaskId.mockResolvedValue([
      createNodeWithStatus(TaskStatus.done),
      createNodeWithStatus(TaskStatus.done),
    ]);
    taskRepository.findById.mockResolvedValue(task);

    await serviceAny.recalculateTaskStatus(task.id);

    expect(taskRuntimeService.cleanupRuntime).not.toHaveBeenCalled();
    expect(taskRepository.update).toHaveBeenNthCalledWith(
      1,
      task.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        message: 'Task completed; worktree preserved',
      }),
    );
    expect(notificationsService.notifyTaskStatusChanged).toHaveBeenCalledWith({
      userId: 'user-1',
      taskId: task.id,
      taskTitle: task.title,
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
      gitWorktree: '/tmp/worktree-task-2',
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
      taskTitle: task.title,
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
      ...createNode(),
      status: TaskStatus.inProgress,
      loopJson: {
        enabled: true,
        loopCount: 2,
        maxLoops: 3,
      },
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasks.mockResolvedValue(0);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({
      [task.projectId]: 0,
    });
    projectsService.assertProjectCapability.mockResolvedValue(project);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findFirstByTaskIdAndStatus.mockResolvedValue({
      ...todoNode,
      status: TaskStatus.todo,
      loopJson: {
        enabled: true,
        loopCount: 1,
        maxLoops: 3,
      },
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

  it('should always attempt dispatch after queueing a task', async () => {
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
      ...createNode(),
      status: TaskStatus.inProgress,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasks.mockResolvedValue(0);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({
      [task.projectId]: 0,
    });
    projectsService.assertProjectCapability.mockResolvedValue(project);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findFirstByTaskIdAndStatus.mockResolvedValue({
      ...createNode(),
      status: TaskStatus.todo,
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

  it('should reject execute when task already has in-progress node', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const project = createProject();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertProjectCapability.mockResolvedValue(project);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(createNode());
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
      ...createNode(),
      status: TaskStatus.inReview,
      loopJson: {
        enabled: true,
        loopCount: 2,
        maxLoops: 3,
      },
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.findTasksReadyForDispatch.mockResolvedValue([task]);
    taskRepository.countRunningTasks.mockResolvedValue(0);
    taskRepository.countRunningTasksByProjectIds.mockResolvedValue({
      [task.projectId]: 0,
    });
    projectsService.assertProjectCapability.mockResolvedValue(project);
    projectRepository.findAllWithPagination.mockResolvedValue([project]);
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findById.mockResolvedValue(reviewNode);
    taskNodeRepository.claimFirstTodoNode.mockResolvedValue({
      ...reviewNode,
      status: TaskStatus.inProgress,
      loopJson: {
        enabled: true,
        loopCount: 2,
        maxLoops: 3,
      },
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
        agentClioutput: null,
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
      ...createNode(),
      status: TaskStatus.done,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertProjectCapability.mockResolvedValue(project);
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
      ...createNode(),
      status: TaskStatus.inReview,
      finishedAt: null,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
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
        runtimeJson: null,
      }),
    );
  });

  it('should cancel in-progress node and move it to in_review', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const serviceAny = service as any;
    const task = createTask();
    const runningNode = {
      ...createNode(),
      status: TaskStatus.inProgress,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
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
        agentClioutput: expect.any(String),
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

    taskRepository.findById.mockResolvedValueOnce(task).mockResolvedValueOnce({
      ...task,
      title: 'Updated title',
    });
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    taskRuntimeService.cleanupRuntime.mockResolvedValue({
      cleaned: true,
    });
    taskNodeRepository.findByTaskId.mockResolvedValue([]);

    await service.cleanupWorktree(task.id, currentUser as never);

    expect(taskRuntimeService.cleanupRuntime).toHaveBeenCalledWith(
      task,
      expect.objectContaining({ id: task.projectId }),
    );
    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        gitWorktree: null,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        message: 'Task worktree cleaned manually',
      }),
    );
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
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
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
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
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
      gitWorktree: '/tmp/worktree-task-fail',
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    taskRuntimeService.cleanupRuntime.mockResolvedValue({
      cleaned: false,
      errorMessage: 'cleanup failed',
    });
    taskNodeRepository.findByTaskId.mockResolvedValue([]);

    await service.cleanupWorktree(task.id, currentUser as never);

    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.not.objectContaining({
        gitWorktree: null,
      }),
    );
    expect(taskLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Task worktree cleanup skipped or failed',
      }),
    );
  });

  it('should update task and append update log', async () => {
    const { service, taskRepository, projectsService, taskNodeRepository } =
      createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.update.mockResolvedValue({
      ...task,
      title: 'Updated title',
    });
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    taskNodeRepository.findByTaskId.mockResolvedValue([]);

    const result = await service.update(
      task.id,
      {
        title: 'Updated title',
      } as never,
      currentUser as never,
    );

    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        title: 'Updated title',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        task: expect.any(Object),
        nodes: expect.any(Array),
      }),
    );
  });

  it('should merge task config fields on update', async () => {
    const { service, taskRepository, projectsService, taskNodeRepository } =
      createTasksService() as any;
    const task = {
      ...createTask(),
      configJson: {
        agentCliId: 'codex',
      },
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.update.mockResolvedValue({
      ...task,
      configJson: {
        agentCliId: 'codex',
        agentCliConfigId: 'cfg-2',
      },
    });
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    taskNodeRepository.findByTaskId.mockResolvedValue([createNode()]);

    await service.update(
      task.id,
      {
        configJson: {
          agentCliConfigId: 'cfg-2',
        },
      } as never,
      currentUser as never,
    );

    expect(taskRepository.update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({
        configJson: {
          agentCliId: 'codex',
          agentCliConfigId: 'cfg-2',
        },
      }),
    );
    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({
        agentCliId: 'codex',
        agentCliConfigId: 'cfg-2',
      }),
    );
  });

  it('should queue reply by moving in_review node back to todo', async () => {
    const {
      service,
      taskRepository,
      taskNodeRepository,
      taskRuntimeService,
      projectsService,
    } = createTasksService() as any;
    const task = createTask();
    const inReviewNode = {
      ...createNodeWithStatus(TaskStatus.inReview),
      taskId: task.id,
    };
    const currentUser = createCurrentUser();

    taskRepository.findById.mockResolvedValue(task);
    taskRepository.update.mockResolvedValue(task);
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    taskRuntimeService.ensureRuntime.mockResolvedValue({
      gitBranch: task.gitBranch,
      gitBaseBranch: task.gitBaseBranch,
      gitWorktree: task.gitWorktree,
      worktreePath: task.gitWorktree,
    });
    taskNodeRepository.findInProgressByTaskId.mockResolvedValue(null);
    taskNodeRepository.findFirstByTaskIdAndStatus.mockImplementation(
      ({ status }) => {
        if (status === TaskStatus.inReview) {
          return Promise.resolve(inReviewNode);
        }

        return Promise.resolve(null);
      },
    );
    taskNodeRepository.findByTaskId.mockResolvedValue([inReviewNode]);

    await service.reply(
      task.id,
      {
        message: 'continue',
      } as never,
      currentUser as never,
    );

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      inReviewNode.id,
      expect.objectContaining({
        status: TaskStatus.todo,
        runtimeJson: {
          pendingUserMessage: 'continue',
        },
      }),
    );

    const updateArgs = taskNodeRepository.update.mock.calls.find(
      (call: unknown[]) => call[0] === inReviewNode.id,
    );
    expect(updateArgs?.[1]).not.toHaveProperty('agentClioutput');
  });

  it('should read task messages from node output jsonl files', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();
    const node = createNode({
      id: 'node-1',
      status: TaskStatus.inProgress,
      startedAt: new Date('2026-03-12T03:00:00.000Z'),
    });
    const outputPath = path.resolve(
      testDataRootDir!,
      task.businessLineId,
      'projects',
      task.projectId,
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );

    taskRepository.findById.mockResolvedValue(task);
    taskNodeRepository.findByTaskId.mockResolvedValue([node]);
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      [
        '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]},"timestamp_ms":1741748400000}',
        '{"type":"user","message":{"content":"continue"},"timestamp_ms":1741748401000}',
        '{"type":"result","subtype":"error","timestamp_ms":1741748402000}',
      ].join('\n') + '\n',
      'utf-8',
    );

    const messages = await service.listMessages(task.id, currentUser as never);

    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      content:
        '{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]},"timestamp_ms":1741748400000}',
      taskNodeId: node.id,
      level: TaskLogLevel.info,
    });
    expect(messages[1]).toMatchObject({
      role: 'user',
      content:
        '{"type":"user","message":{"content":"continue"},"timestamp_ms":1741748401000}',
      taskNodeId: node.id,
      level: TaskLogLevel.info,
    });
    expect(messages[2]).toMatchObject({
      role: 'error',
      content:
        '{"type":"result","subtype":"error","timestamp_ms":1741748402000}',
      taskNodeId: node.id,
      level: TaskLogLevel.error,
    });
    expect(messages[0].createdAt.toISOString()).toBe(
      '2025-03-12T03:00:00.000Z',
    );
    expect(messages[1].createdAt.toISOString()).toBe(
      '2025-03-12T03:00:01.000Z',
    );
    expect(messages[2].createdAt.toISOString()).toBe(
      '2025-03-12T03:00:02.000Z',
    );
  });

  it('should use stored node output path when listing task messages', async () => {
    const { service, taskRepository, taskNodeRepository, projectsService } =
      createTasksService() as any;
    const task = createTask();
    const currentUser = createCurrentUser();
    const outputPath = path.resolve(testDataRootDir!, 'custom-output.jsonl');
    const node = createNode({
      id: 'node-1',
      agentClioutput: outputPath,
      status: TaskStatus.done,
      createdAt: new Date('2026-03-12T04:00:00.000Z'),
    });

    taskRepository.findById.mockResolvedValue(task);
    taskNodeRepository.findByTaskId.mockResolvedValue([node]);
    projectsService.assertProjectCapability.mockResolvedValue(createProject());
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      '{"type":"system","subtype":"init"}\n',
      'utf-8',
    );

    const messages = await service.listMessages(task.id, currentUser as never);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: 'system',
      content: '{"type":"system","subtype":"init"}',
      taskNodeId: node.id,
      level: TaskLogLevel.info,
    });
  });
});
