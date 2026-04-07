import { Project } from '../../projects/domain/project';
import { readFile } from 'node:fs/promises';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { AgentRunnerResult } from '../agent-runner.service';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskNodeExecutionService } from './task-node-execution.service';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

const mockedReadFile = jest.mocked(readFile);

const createProject = (): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative',
  description: null,
  gitUrl: 'https://example.com/repo.git',
  defaultBranch: 'main',
  configJson: null,
  createdAt: new Date('2026-03-19T10:00:00.000Z'),
  updatedAt: new Date('2026-03-19T10:00:00.000Z'),
  deletedAt: null,
});

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'Workflow task',
  prompt: 'task prompt',
  status: TaskStatus.inProgress,
  gitBranch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktree: 'wk-task-1',
  configJson: null,
  startedAt: new Date('2026-03-19T10:00:00.000Z'),
  finishedAt: null,
  createdAt: new Date('2026-03-19T10:00:00.000Z'),
  updatedAt: new Date('2026-03-19T10:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createNode = (status: TaskStatus): TaskNode => ({
  id: 'node-1',
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
  startedAt:
    status === TaskStatus.inProgress
      ? new Date('2026-03-19T10:00:00.000Z')
      : new Date('2026-03-19T10:00:00.000Z'),
  finishedAt:
    status === TaskStatus.inProgress
      ? null
      : new Date('2026-03-19T10:05:00.000Z'),
  createdAt: new Date('2026-03-19T10:00:00.000Z'),
  updatedAt: new Date('2026-03-19T10:05:00.000Z'),
});

const containerOrchestrationStub = {
  ensureContainer: jest.fn().mockResolvedValue({ containerId: 'container-1' }),
  onNodeFinished: jest.fn().mockResolvedValue(undefined),
};

describe('TaskNodeExecutionService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockedReadFile.mockReset();
  });

  it('should append Codex prompt records to output jsonl before execution starts', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);
    const preparedAt = new Date('2026-03-19T10:01:00.000Z');

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockImplementation(
        async ({
          callbacks,
        }: {
          callbacks?: {
            onPrepared?: (input: {
              adapter: 'codex';
              prompt: string;
              preparedAt: Date;
            }) => Promise<void> | void;
          };
        }) => {
          await callbacks?.onPrepared?.({
            adapter: 'codex',
            prompt: 'Run task',
            preparedAt,
          });

          return {
            success: true,
            interrupted: false,
            exitCode: 0,
            signal: null,
            command: 'codex',
            args: ['exec', '--json'],
            cwd: '/tmp/worktrees/wk-task-1',
            durationMs: 250,
            stdout: '',
            stderr: '',
            prompt: 'Run task',
            sessionId: 'thread-1',
          };
        },
      ),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(1),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskOutputService.appendNodeOutputJsonlRecords).toHaveBeenCalledWith(
      {
        task,
        node: runningNode,
        records: [
          {
            type: 'user_message',
            message: 'Run task',
            created_at: preparedAt.toISOString(),
            source: 'ainative_injected_prompt',
          },
        ],
      },
    );
  });

  it('should skip pre-execution output injection for non-Codex adapters', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      agentCliId: 'claude',
    };

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockImplementation(
        async ({
          callbacks,
        }: {
          callbacks?: {
            onPrepared?: (input: {
              adapter: 'claude';
              prompt: string;
              preparedAt: Date;
            }) => Promise<void> | void;
          };
        }) => {
          await callbacks?.onPrepared?.({
            adapter: 'claude',
            prompt: 'Continue from the previous result',
            preparedAt: new Date('2026-03-19T10:02:00.000Z'),
          });

          return {
            success: true,
            interrupted: false,
            exitCode: 0,
            signal: null,
            command: 'claude',
            args: ['-p'],
            cwd: '/tmp/worktrees/wk-task-1',
            durationMs: 250,
            stdout: '',
            stderr: '',
            prompt: 'Continue from the previous result',
            sessionId: 'thread-2',
          };
        },
      ),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(
      taskOutputService.appendNodeOutputJsonlRecords,
    ).not.toHaveBeenCalled();
  });

  it('should auto-commit workspace changes before completing a node without approval', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };
    const taskGitService = {
      commitIfChangedForTask: jest.fn().mockResolvedValue({
        committed: true,
        commitSha: 'abc123',
        subject: 'chore(task): complete node #1 Agent node',
      }),
    };
    const containerOrchestrationStub = {
      ensureContainer: jest
        .fn()
        .mockResolvedValue({ containerId: 'container-1' }),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
      undefined as never,
      taskGitService as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskGitService.commitIfChangedForTask).toHaveBeenCalledWith(
      task,
      project,
      'chore(task): complete node #1 Agent node',
    );
    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: runningNode.id,
        message: 'Node completion auto-committed staged changes',
        payload: expect.objectContaining({
          commitSha: 'abc123',
        }),
      }),
    );
  });

  it('should skip auto-commit and still complete when no workspace changes exist', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };
    const taskGitService = {
      commitIfChangedForTask: jest.fn().mockResolvedValue({
        committed: false,
        skippedReason: 'no_changes',
      }),
    };
    const containerOrchestrationStub = {
      ensureContainer: jest
        .fn()
        .mockResolvedValue({ containerId: 'container-1' }),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
      undefined as never,
      taskGitService as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskGitService.commitIfChangedForTask).toHaveBeenCalledTimes(1);
    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: runningNode.id,
        message: 'Node completion skipped auto-commit; no workspace changes',
      }),
    );
  });

  it('should stop auto-advancing when completion auto-commit fails', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };
    const taskGitService = {
      commitIfChangedForTask: jest
        .fn()
        .mockRejectedValue(new Error('git commit failed')),
    };
    const containerOrchestrationStub = {
      ensureContainer: jest
        .fn()
        .mockResolvedValue({ containerId: 'container-1' }),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
      undefined as never,
      taskGitService as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        finishedAt: expect.any(Date),
        agentClioutput: '/tmp/node-1.jsonl',
        agentCliSessionId: null,
        runtimeJson: null,
      }),
    );
    expect(taskNodeRepository.update).not.toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: runningNode.id,
        level: 'error',
        message: 'Node completion auto-commit failed',
      }),
    );
  });

  it('should stop looping early when marker status is 已完成', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode: TaskNode = {
      ...createNode(TaskStatus.inProgress),
      input: {
        ...createNode(TaskStatus.inProgress).input,
        earlyExitMarkerFileName: 'taskResult',
      },
      loopJson: {
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      },
    };
    mockedReadFile.mockResolvedValueOnce('已完成\n全部任务已完成');

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, fileName: 'taskResult' }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
  });

  it('should keep looping when marker status is 未完成', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      input: {
        ...createNode(TaskStatus.inProgress).input,
        earlyExitMarkerFileName: 'taskResult',
      },
      loopJson: {
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      },
    };
    mockedReadFile.mockResolvedValueOnce('未完成\n仍有子任务待处理');

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, fileName: 'taskResult' }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.todo,
      }),
    );
  });

  it('should continue looping when marker is not found in docs/{gitBranch}/', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      input: {
        ...createNode(TaskStatus.inProgress).input,
        earlyExitMarkerFileName: 'missingResult',
      },
      loopJson: {
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      },
    };
    const enoentError = Object.assign(new Error('not found'), {
      code: 'ENOENT',
    });
    mockedReadFile.mockRejectedValueOnce(enoentError);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/20260325-172655',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, fileName: 'missingResult' }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(mockedReadFile).toHaveBeenCalledTimes(1);
    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.todo,
      }),
    );
  });

  it('should read marker from docs/{gitBranch}/marker path', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      input: {
        ...createNode(TaskStatus.inProgress).input,
        earlyExitMarkerFileName: 'resultResult',
      },
      loopJson: {
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      },
    };
    mockedReadFile.mockResolvedValueOnce('已完成\n来自分支前缀目录');

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/20260325-174910',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, fileName: 'resultResult' }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.done,
      }),
    );
  });

  it('should mark node as failure when marker status is 未找到', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      input: {
        ...createNode(TaskStatus.inProgress).input,
        earlyExitMarkerFileName: 'taskResult',
      },
      loopJson: {
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      },
    };
    mockedReadFile.mockResolvedValueOnce('未找到\n目标任务文件不存在');

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, fileName: 'taskResult' }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
      }),
    );
  });

  it('should notify when node execution ends in in_review for workflow tasks', async () => {
    jest.useFakeTimers();

    const task = createTask({
      createdBy: 'user-1',
      mode: TaskMode.workflow,
    });
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      input: {
        ...createNode(TaskStatus.inProgress).input,
        earlyExitMarkerFileName: 'taskResult',
      },
      loopJson: {
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      },
    };
    const notificationsService = {
      notifyTaskNodeStatusChanged: jest.fn().mockResolvedValue(undefined),
    };
    mockedReadFile.mockResolvedValueOnce('未找到\n目标任务文件不存在');

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      }),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: true,
        loopCount: 0,
        maxLoops: 3,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: true, fileName: 'taskResult' }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
      undefined,
      undefined,
      undefined,
      notificationsService as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(
      notificationsService.notifyTaskNodeStatusChanged,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      taskId: 'task-1',
      taskTitle: 'Workflow task',
      nodeId: 'node-1',
      nodeName: 'Agent node',
      nodeOrder: 1,
      status: TaskStatus.inReview,
    });
  });

  it('should interrupt the local agent process when the node is cancelled elsewhere', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);
    const cancelledNode = createNode(TaskStatus.inReview);

    let resolveExecution: ((result: AgentRunnerResult) => void) | undefined;

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce(runningNode)
        .mockResolvedValueOnce(runningNode)
        .mockResolvedValueOnce(runningNode)
        .mockResolvedValueOnce(cancelledNode)
        .mockResolvedValueOnce(cancelledNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn(),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockImplementation(
        () =>
          new Promise<AgentRunnerResult>((resolve) => {
            resolveExecution = resolve;
          }),
      ),
      interruptExecution: jest.fn().mockImplementation(() => {
        resolveExecution?.({
          success: false,
          interrupted: true,
          exitCode: null,
          signal: 'SIGTERM',
          command: 'codex',
          args: ['exec', '--json'],
          cwd: '/tmp/worktrees/wk-task-1',
          durationMs: 250,
          stdout: '',
          stderr: '',
          prompt: 'Run task',
          sessionId: null,
          errorMessage: 'Agent execution interrupted',
        });
        return true;
      }),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn(),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await Promise.resolve();
    expect(agentRunnerService.executeAgentNode).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(500);
    await executionPromise;

    expect(agentRunnerService.interruptExecution).toHaveBeenCalledWith(
      runningNode.id,
    );
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: runningNode.id,
        level: 'warn',
        message: 'Agent node execution interrupted after cancellation',
      }),
    );
    expect(taskLogService.appendLog).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agent node execution failed',
      }),
    );
  });

  it('should clear stale agent session id when runner requests session reset on failure', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = {
      ...createNode(TaskStatus.inProgress),
      agentCliSessionId: 'stale-thread-1',
    };

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: false,
        interrupted: false,
        exitCode: 1,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: 'Error: thread/resume failed',
        prompt: 'Run task',
        sessionId: null,
        errorMessage: 'Agent execution exited with code 1',
        clearPreviousSessionId: true,
      } satisfies AgentRunnerResult),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue('stale-thread-1'),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(false),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestrationStub as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(taskNodeRepository.update).toHaveBeenCalledWith(
      runningNode.id,
      expect.objectContaining({
        status: TaskStatus.inReview,
        agentCliSessionId: null,
      }),
    );
  });

  it('should fail before agent launch when docker handoff has no container ref', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn(),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };
    const containerOrchestration = {
      ensureContainer: jest.fn().mockResolvedValue({}),
      onNodeFinished: jest.fn().mockResolvedValue(undefined),
    };
    const containerExecutionConfig = {
      resolveContainerName: jest.fn().mockReturnValue('ainative-task-task-1'),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestration as never,
      containerExecutionConfig as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(containerOrchestration.ensureContainer).toHaveBeenCalledTimes(1);
    expect(agentRunnerService.executeAgentNode).not.toHaveBeenCalled();
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: runningNode.id,
        level: TaskLogLevel.error,
        message: 'Docker handoff failed before agent launch',
        payload: expect.objectContaining({
          containerName: 'ainative-task-task-1',
          worktreePath: '/tmp/worktrees/wk-task-1',
        }),
      }),
    );
    expect(taskOutputService.writeNodeOutputJsonl).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          summary: expect.stringContaining(
            'Docker orchestration did not provide a runnable task container',
          ),
        }),
      }),
    );
  });

  it('should preserve orchestration startup errors in task logs', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);
    const startupError =
      'Container ainative-task-task-1 reached running state but readiness probe http://127.0.0.1:8080/health did not pass within 300000ms';

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      findByTaskId: jest.fn().mockResolvedValue([runningNode]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn(),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };
    const containerOrchestration = {
      ensureContainer: jest.fn().mockRejectedValue(new Error(startupError)),
      onNodeFinished: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestration as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(agentRunnerService.executeAgentNode).not.toHaveBeenCalled();
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        taskNodeId: runningNode.id,
        level: TaskLogLevel.error,
        message: 'Node execution failed',
        payload: expect.objectContaining({
          errorMessage: startupError,
        }),
      }),
    );
  });

  it('should not depend on per-node container cleanup after execution settles', async () => {
    jest.useFakeTimers();

    const task = createTask();
    const project = createProject();
    const runningNode = createNode(TaskStatus.inProgress);

    const taskRepository = {
      findById: jest.fn().mockResolvedValue(task),
    };
    const taskNodeRepository = {
      findById: jest.fn().mockResolvedValue(runningNode),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeService = {
      ensureRuntime: jest.fn().mockResolvedValue({
        gitBranch: 'feature/task-1',
        gitBaseBranch: 'main',
        gitWorktree: 'wk-task-1',
        worktreePath: '/tmp/worktrees/wk-task-1',
      }),
    };
    const agentRunnerService = {
      executeAgentNode: jest.fn().mockResolvedValue({
        success: true,
        interrupted: false,
        exitCode: 0,
        signal: null,
        command: 'codex',
        args: ['exec', '--json'],
        cwd: '/tmp/worktrees/wk-task-1',
        durationMs: 250,
        stdout: '',
        stderr: '',
        prompt: 'Run task',
        sessionId: 'thread-1',
      } satisfies AgentRunnerResult),
      interruptExecution: jest.fn(),
    };
    const taskConfigResolver = {
      normalizeOptionalString: jest.fn().mockReturnValue(null),
      readNodeLoopConfig: jest.fn().mockReturnValue({
        enabled: false,
        loopCount: 0,
        maxLoops: 1,
      }),
      readNodeRequiresApproval: jest.fn().mockReturnValue(true),
      readNodeEarlyExitMarkerConfig: jest
        .fn()
        .mockReturnValue({ enabled: false, fileName: null }),
    };
    const taskOutputService = {
      clearNodeOutputJsonl: jest.fn().mockResolvedValue(undefined),
      appendNodeOutputJsonlRecords: jest.fn().mockResolvedValue(0),
      extractJsonLinesFromContent: jest.fn().mockReturnValue([]),
      appendNodeOutputJsonlLines: jest.fn().mockResolvedValue(0),
      resolveNodeOutputPath: jest.fn().mockReturnValue('/tmp/node-1.jsonl'),
      writeNodeOutputJsonl: jest.fn().mockResolvedValue('/tmp/node-1.jsonl'),
    };
    const taskLogService = {
      appendLog: jest.fn().mockResolvedValue(undefined),
    };
    const taskStatusService = {
      recalculateTaskStatus: jest.fn().mockResolvedValue(undefined),
    };
    const taskRuntimeOrchestrator = {
      createRuntimeTaskSnapshot: jest.fn().mockImplementation(() => task),
    };
    const containerOrchestration = {
      ensureContainer: jest
        .fn()
        .mockResolvedValue({ containerId: 'container-1' }),
    };

    const service = new TaskNodeExecutionService(
      taskRepository as never,
      taskNodeRepository as never,
      taskRuntimeService as unknown as TaskRuntimeService,
      agentRunnerService as never,
      taskConfigResolver as never,
      taskOutputService as never,
      taskLogService as never,
      taskStatusService as never,
      taskRuntimeOrchestrator as never,
      containerOrchestration as never,
    );

    const executionPromise = service.runNode({
      taskId: task.id,
      nodeId: runningNode.id,
      project,
    });

    await jest.advanceTimersByTimeAsync(150);
    await executionPromise;

    expect(containerOrchestration.ensureContainer).toHaveBeenCalledTimes(1);
    expect(taskStatusService.recalculateTaskStatus).toHaveBeenCalledWith(
      task.id,
    );
  });
});
