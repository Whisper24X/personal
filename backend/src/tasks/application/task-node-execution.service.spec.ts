import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { AgentRunnerResult } from '../agent-runner.service';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskNodeExecutionService } from './task-node-execution.service';

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

const createTask = (): Task => ({
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

describe('TaskNodeExecutionService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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
          timedOut: false,
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
});
