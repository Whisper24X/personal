import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NotificationsService } from '../../notifications/notifications.service';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { AgentCliAdapterRegistry } from '../agent-cli/agent-cli-adapter.registry';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { RunnerAgentExecutionService } from '../runner-agent-execution.service';
import { TaskGitService } from '../task-git.service';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import {
  buildCompleteCommitMessage,
  commitNodeWorkspaceIfChanged,
} from './task-node-auto-commit';
import { TaskOutputService } from './task-output.service';
import { TaskRuntimeOrchestratorService } from './task-runtime-orchestrator.service';
import { TaskStatusService } from './task-status.service';
import { ContainerOrchestrationService } from '../../containers/container-orchestration.service';
import { ContainerExecutionConfigService } from '../../containers/container-execution-config.service';

@Injectable()
export class TaskNodeExecutionService {
  private readonly agentCliLogChunkLength = 4_000;
  private readonly cancellationPollIntervalMs = 500;
  private readonly runningNodeSet = new Set<string>();

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly runnerAgentExecutionService: RunnerAgentExecutionService,
    private readonly taskConfigResolver: TaskConfigResolverService,
    private readonly taskOutputService: TaskOutputService,
    private readonly taskLogService: TaskLogService,
    private readonly taskStatusService: TaskStatusService,
    private readonly taskRuntimeOrchestrator: TaskRuntimeOrchestratorService,
    private readonly containerOrchestration: ContainerOrchestrationService,
    @Optional()
    private readonly containerExecutionConfig?: ContainerExecutionConfigService,
    @Inject(TaskGitService)
    private readonly taskGitService: Pick<
      TaskGitService,
      'commitIfChangedForTask' | 'resolveHeadCommitShaForTask'
    > = {
      commitIfChangedForTask: () =>
        Promise.resolve({
          committed: false,
          skippedReason: 'no_changes',
        }),
      resolveHeadCommitShaForTask: () => Promise.resolve(null),
    },
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry = new AgentCliAdapterRegistry(),
    @Optional()
    @Inject(NotificationsService)
    private readonly notificationsService: Pick<
      NotificationsService,
      'notifyTaskNodeStatusChanged'
    > = {
      notifyTaskNodeStatusChanged: () => Promise.resolve(null),
    },
  ) {}

  async runNode({
    taskId,
    nodeId,
    project,
    workerId,
    startLeaseHeartbeat,
    onSettled,
  }: {
    taskId: string;
    nodeId: string;
    project: Project;
    workerId?: string;
    startLeaseHeartbeat?: (input: {
      nodeId: string;
      workerId?: string;
    }) => () => void;
    onSettled?: () => Promise<void> | void;
  }): Promise<void> {
    if (this.runningNodeSet.has(nodeId)) {
      return;
    }

    this.runningNodeSet.add(nodeId);
    let stopLeaseHeartbeat: (() => void) | undefined;
    let stopCancellationWatcher: (() => void) | undefined;
    let executionTask: Task | null = null;

    try {
      await this.delay(150);

      const pendingNode = await this.taskNodeRepository.findById(nodeId);
      if (!pendingNode || pendingNode.status !== TaskStatus.inProgress) {
        return;
      }

      const runtimeTask = await this.taskRepository.findById(taskId);

      if (!runtimeTask) {
        throw new NotFoundException('Task not found');
      }

      const runtime = await this.taskRuntimeService.ensureRuntime(
        runtimeTask,
        project,
      );
      executionTask = this.taskRuntimeOrchestrator.createRuntimeTaskSnapshot(
        runtimeTask,
        runtime,
      );
      const beforeRunCommitSha = await this.resolveHeadCommitShaForTask(
        executionTask,
        project,
      );

      await this.taskNodeRepository.update(nodeId, {
        beforeRunCommitSha,
        afterRunCommitSha: null,
      });

      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.info,
        message: 'Runner attached to node',
        payload: {
          nodeOrder: pendingNode.nodeOrder,
          gitBranch: runtime.gitBranch,
          gitBaseBranch: runtime.gitBaseBranch,
          gitWorktree: runtime.gitWorktree,
          worktreePath: runtime.worktreePath,
        },
      });

      const runningNode = await this.taskNodeRepository.findById(nodeId);
      if (!runningNode || runningNode.status !== TaskStatus.inProgress) {
        return;
      }

      stopLeaseHeartbeat = startLeaseHeartbeat?.({
        nodeId,
        workerId,
      });
      stopCancellationWatcher = this.startExecutionCancellationWatcher(nodeId);

      const containerBundle = await this.containerOrchestration.ensureContainer(
        {
          task: executionTask,
          project,
          worktreePath: runtime.worktreePath,
        },
      );
      const containerExecRef = containerBundle.containerId;
      await this.assertDockerHandoff({
        task: executionTask,
        nodeId,
        worktreePath: runtime.worktreePath,
        containerExecRef,
      });

      await this.executeAgentNode({
        taskId,
        nodeId,
        task: executionTask,
        node: runningNode,
        project,
        runtimeContext: runtime,
        containerExecRef,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected execution error';

      const latestNode = await this.taskNodeRepository.findById(nodeId);
      const outputTask =
        executionTask ?? (await this.taskRepository.findById(taskId));

      if (latestNode && outputTask) {
        const afterRunCommitSha = await this.resolveHeadCommitShaForTask(
          outputTask,
          project,
        );
        const agentClioutput =
          await this.taskOutputService.writeNodeOutputJsonl({
            task: outputTask,
            node: latestNode,
            output: {
              summary: errorMessage,
              finishedAt: new Date().toISOString(),
              error: {
                code: 'UNKNOWN',
                message: errorMessage,
              },
            },
          });

        await this.finalizeNodeAsFailure({
          task: outputTask,
          nodeId,
          agentClioutput,
          agentCliSessionId: latestNode.agentCliSessionId ?? null,
          afterRunCommitSha,
        });
      }

      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.error,
        message: 'Node execution failed',
        payload: {
          errorMessage,
        },
      });
    } finally {
      stopLeaseHeartbeat?.();
      stopCancellationWatcher?.();
      await this.taskStatusService.recalculateTaskStatus(taskId);
      this.runningNodeSet.delete(nodeId);
      await onSettled?.();
    }
  }

  private async assertDockerHandoff({
    task,
    nodeId,
    worktreePath,
    containerExecRef,
  }: {
    task: Task;
    nodeId: string;
    worktreePath: string;
    containerExecRef?: string;
  }): Promise<void> {
    if (containerExecRef) {
      return;
    }

    const containerName =
      this.containerExecutionConfig?.resolveContainerName(task) ??
      `ainative-task-${task.id}`;
    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: nodeId,
      level: TaskLogLevel.error,
      message: 'Docker handoff failed before agent launch',
      payload: {
        containerName,
        worktreePath,
      },
    });
    throw new Error(
      `Docker orchestration did not provide a runnable task container (taskId=${task.id}, nodeId=${nodeId}, containerName=${containerName}, worktreePath=${worktreePath})`,
    );
  }

  private async executeAgentNode({
    taskId,
    nodeId,
    task,
    node,
    project,
    runtimeContext,
    containerExecRef,
  }: {
    taskId: string;
    nodeId: string;
    task: Task;
    node: TaskNode;
    project: Project;
    runtimeContext?: {
      gitBranch: string;
      gitBaseBranch: string;
      gitWorktree: string;
      worktreePath: string;
    };
    containerExecRef?: string;
  }): Promise<void> {
    let streamedStdoutLineCount = 0;
    let streamedStderrLineCount = 0;
    let persistedStdoutJsonlLineCount = 0;
    let streamPersistQueue = Promise.resolve();
    const isContinuation = !!this.taskConfigResolver.normalizeOptionalString(
      node.agentCliSessionId,
    );

    if (!isContinuation) {
      await this.taskOutputService.clearNodeOutputJsonl({
        task,
        node,
      });
    }

    const executionResult =
      await this.runnerAgentExecutionService.executeAgentNode({
        task,
        node,
        project,
        containerExecRef,
        runtimeContext: runtimeContext
          ? {
              gitBranch: runtimeContext.gitBranch,
              gitBaseBranch: runtimeContext.gitBaseBranch,
              gitWorktree: runtimeContext.gitWorktree,
              gitWorktreePath: runtimeContext.worktreePath,
            }
          : undefined,
        callbacks: {
          onPrepared: async ({ adapter, prompt, preparedAt }) => {
            await this.appendPreExecutionOutputRecords({
              task,
              node,
              adapter,
              prompt,
              preparedAt,
            });
          },
          onStdoutLine: (line) => {
            streamedStdoutLineCount += 1;
            const lineIndex = streamedStdoutLineCount;
            streamPersistQueue = streamPersistQueue.then(async () => {
              persistedStdoutJsonlLineCount +=
                await this.persistAgentCliStreamLine({
                  taskId,
                  nodeId,
                  task,
                  node,
                  stream: 'stdout',
                  line,
                  lineIndex,
                });
            });
          },
          onStderrLine: (line) => {
            streamedStderrLineCount += 1;
            const lineIndex = streamedStderrLineCount;
            streamPersistQueue = streamPersistQueue.then(async () => {
              await this.persistAgentCliStreamLine({
                taskId,
                nodeId,
                task,
                node,
                stream: 'stderr',
                line,
                lineIndex,
              });
            });
          },
        },
      });

    await streamPersistQueue;

    await this.appendAgentCliProcessLogs({
      taskId,
      nodeId,
      executionResult,
      streamedStdoutLineCount,
      streamedStderrLineCount,
    });

    if (executionResult.success) {
      const fullOutput =
        executionResult.stdout ??
        'Agent execution finished without stdout output';
      const summary =
        fullOutput.length > 2_000 ? fullOutput.slice(0, 2_000) : fullOutput;
      const finishedAt = new Date().toISOString();
      const agentClioutput =
        isContinuation || persistedStdoutJsonlLineCount > 0
          ? this.taskOutputService.resolveNodeOutputPath(task, node)
          : await this.taskOutputService.writeNodeOutputJsonl({
              task,
              node,
              output: {
                summary,
                stdout: executionResult.stdout,
                stderr: executionResult.stderr || null,
                exitCode: executionResult.exitCode,
                durationMs: executionResult.durationMs,
                finishedAt,
                command: executionResult.command,
                args: executionResult.args,
                prompt: executionResult.prompt,
                sessionId: executionResult.sessionId ?? null,
              },
            });

      const loopResult = await this.finalizeNodeAsSuccess({
        taskId,
        task,
        project,
        node,
        agentClioutput,
        agentCliSessionId: executionResult.sessionId ?? null,
        clearAgentCliSessionId: executionResult.clearPreviousSessionId === true,
        earlyExitDecision: await this.resolveEarlyExitDecision({
          taskId,
          nodeId,
          node,
          runtimeContext,
        }),
      });

      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.info,
        message: loopResult.queuedNextLoop
          ? 'Agent node loop completed; queued next loop'
          : loopResult.pendingApproval
            ? 'Agent node completed; pending approval'
            : 'Agent node completed successfully',
        payload: {
          status: loopResult.status,
          durationMs: executionResult.durationMs,
          command: executionResult.command,
          args: executionResult.args,
          loopJson: loopResult.loopJson,
          pendingApproval: loopResult.pendingApproval,
          earlyExitCompleted: loopResult.earlyExitCompleted,
          earlyExitReason: loopResult.earlyExitReason,
          earlyExitSourceFile: loopResult.earlyExitSourceFile,
        },
      });

      return;
    }

    if (executionResult.interrupted) {
      const latestNode = await this.taskNodeRepository.findById(nodeId);

      if (!latestNode || latestNode.status !== TaskStatus.inProgress) {
        await this.taskLogService.appendLog({
          taskId,
          taskNodeId: nodeId,
          level: TaskLogLevel.warn,
          message: 'Agent node execution interrupted after cancellation',
          payload: {
            exitCode: executionResult.exitCode,
            signal: executionResult.signal,
            durationMs: executionResult.durationMs,
          },
        });
        return;
      }
    }

    const agentClioutput =
      isContinuation || persistedStdoutJsonlLineCount > 0
        ? this.taskOutputService.resolveNodeOutputPath(task, node)
        : await this.taskOutputService.writeNodeOutputJsonl({
            task,
            node,
            output: {
              summary: executionResult.errorMessage ?? 'Agent execution failed',
              stdout: executionResult.stdout || null,
              stderr: executionResult.stderr || null,
              exitCode: executionResult.exitCode,
              signal: executionResult.signal,
              durationMs: executionResult.durationMs,
              finishedAt: new Date().toISOString(),
              command: executionResult.command,
              args: executionResult.args,
              prompt: executionResult.prompt,
              sessionId: executionResult.sessionId ?? null,
              error: {
                code: 'RUNNER_FAILED',
                message:
                  executionResult.errorMessage ?? 'Agent execution failed',
              },
            },
          });
    const afterRunCommitSha = await this.resolveHeadCommitShaForTask(
      task,
      project,
    );

    await this.finalizeNodeAsFailure({
      task,
      nodeId,
      agentClioutput,
      agentCliSessionId: executionResult.sessionId ?? null,
      clearAgentCliSessionId: executionResult.clearPreviousSessionId === true,
      afterRunCommitSha,
    });

    await this.taskLogService.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: TaskLogLevel.error,
      message: 'Agent node execution failed',
      payload: {
        errorMessage: executionResult.errorMessage ?? null,
        exitCode: executionResult.exitCode,
        signal: executionResult.signal,
        durationMs: executionResult.durationMs,
        interrupted: executionResult.interrupted,
        stderr: executionResult.stderr || null,
      },
    });
  }

  private startExecutionCancellationWatcher(nodeId: string): () => void {
    let stopped = false;
    let checking = false;

    const inspectNodeState = async (): Promise<void> => {
      if (stopped || checking) {
        return;
      }

      checking = true;

      try {
        const latestNode = await this.taskNodeRepository.findById(nodeId);

        if (!latestNode || latestNode.status !== TaskStatus.inProgress) {
          this.runnerAgentExecutionService.interruptExecution(nodeId);
          stopped = true;
          clearInterval(watcherTimer);
        }
      } finally {
        checking = false;
      }
    };

    const watcherTimer = setInterval(() => {
      void inspectNodeState();
    }, this.cancellationPollIntervalMs);
    watcherTimer.unref();
    void inspectNodeState();

    return () => {
      stopped = true;
      clearInterval(watcherTimer);
    };
  }

  private async appendAgentCliProcessLogs({
    taskId,
    nodeId,
    executionResult,
    streamedStdoutLineCount,
    streamedStderrLineCount,
  }: {
    taskId: string;
    nodeId: string;
    executionResult: {
      stdout: string;
      stderr: string;
      durationMs: number;
      command: string;
      args: string[];
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    };
    streamedStdoutLineCount?: number;
    streamedStderrLineCount?: number;
  }): Promise<void> {
    if (!streamedStdoutLineCount) {
      await this.appendAgentCliStreamLogs({
        taskId,
        nodeId,
        stream: 'stdout',
        content: executionResult.stdout,
        level: TaskLogLevel.info,
        executionResult,
      });
    }
    if (!streamedStderrLineCount) {
      await this.appendAgentCliStreamLogs({
        taskId,
        nodeId,
        stream: 'stderr',
        content: executionResult.stderr,
        level: TaskLogLevel.warn,
        executionResult,
      });
    }
  }

  private async persistAgentCliStreamLine({
    taskId,
    nodeId,
    task,
    node,
    stream,
    line,
    lineIndex,
  }: {
    taskId: string;
    nodeId: string;
    task: Task;
    node: TaskNode;
    stream: 'stdout' | 'stderr';
    line: string;
    lineIndex: number;
  }): Promise<number> {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      return 0;
    }

    let persistedJsonlLineCount = 0;
    const stdoutJsonlLines =
      stream === 'stdout'
        ? this.taskOutputService.extractJsonLinesFromContent(normalizedLine)
        : [];

    if (stdoutJsonlLines.length) {
      persistedJsonlLineCount =
        await this.taskOutputService.appendNodeOutputJsonlLines({
          task,
          node,
          lines: stdoutJsonlLines,
        });
    }

    await this.taskLogService.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: stream === 'stdout' ? TaskLogLevel.info : TaskLogLevel.warn,
      message: `Agent CLI ${stream} chunk`,
      payload: {
        stream,
        lineIndex,
        text: normalizedLine,
      },
    });

    return persistedJsonlLineCount;
  }

  private async appendAgentCliStreamLogs({
    taskId,
    nodeId,
    stream,
    content,
    level,
    executionResult,
  }: {
    taskId: string;
    nodeId: string;
    stream: 'stdout' | 'stderr';
    content: string;
    level: TaskLogLevel;
    executionResult: {
      durationMs: number;
      command: string;
      args: string[];
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    };
  }): Promise<void> {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    const chunks = this.chunkAgentCliLogContent(normalizedContent);

    for (let index = 0; index < chunks.length; index += 1) {
      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: nodeId,
        level,
        message: `Agent CLI ${stream} chunk`,
        payload: {
          stream,
          chunkIndex: index + 1,
          chunkCount: chunks.length,
          text: chunks[index],
          durationMs: executionResult.durationMs,
          command: executionResult.command,
          args: executionResult.args,
          exitCode: executionResult.exitCode,
          signal: executionResult.signal,
        },
      });
    }
  }

  private chunkAgentCliLogContent(content: string): string[] {
    const chunks: string[] = [];

    for (
      let index = 0;
      index < content.length;
      index += this.agentCliLogChunkLength
    ) {
      chunks.push(content.slice(index, index + this.agentCliLogChunkLength));
    }

    return chunks;
  }

  private async appendPreExecutionOutputRecords({
    task,
    node,
    adapter,
    prompt,
    preparedAt,
  }: {
    task: Task;
    node: TaskNode;
    adapter: Parameters<AgentCliAdapterRegistry['getById']>[0];
    prompt: string;
    preparedAt: Date;
  }): Promise<void> {
    const records = this.agentCliAdapterRegistry
      .getById(adapter)
      .buildPreExecutionOutputRecords({
        prompt,
        createdAt: preparedAt,
      });

    if (!records.length) {
      return;
    }

    await this.taskOutputService.appendNodeOutputJsonlRecords({
      task,
      node,
      records,
    });
  }

  private async finalizeNodeAsSuccess({
    taskId,
    task,
    project,
    node,
    agentClioutput,
    agentCliSessionId,
    clearAgentCliSessionId,
    earlyExitDecision,
  }: {
    taskId: string;
    task: Task;
    project: Project;
    node: TaskNode;
    agentClioutput: string;
    agentCliSessionId?: string | null;
    clearAgentCliSessionId?: boolean;
    earlyExitDecision?: {
      completed: boolean;
      reason: string | null;
      sourceFile: string | null;
    };
  }): Promise<{
    status: TaskStatus;
    loopJson: { enabled: boolean; loopCount: number; maxLoops: number };
    queuedNextLoop: boolean;
    pendingApproval: boolean;
    earlyExitCompleted: boolean;
    earlyExitReason: string | null;
    earlyExitSourceFile: string | null;
  }> {
    const currentLoop = this.taskConfigResolver.readNodeLoopConfig(
      node.loopJson,
    );
    const nextLoopJson = {
      enabled: currentLoop.enabled,
      loopCount: Math.max(currentLoop.loopCount + 1, 1),
      maxLoops: currentLoop.maxLoops,
    };
    // 下一轮是否排队：默认按次数控制；若 marker 判定完成则提前退出
    const queuedByLoopCount = nextLoopJson.loopCount < nextLoopJson.maxLoops;
    const queuedNextLoop =
      queuedByLoopCount && !(earlyExitDecision?.completed ?? false);
    const pendingApproval =
      !queuedNextLoop && this.taskConfigResolver.readNodeRequiresApproval(node);
    const status = queuedNextLoop
      ? TaskStatus.todo
      : pendingApproval
        ? TaskStatus.inReview
        : TaskStatus.done;
    let afterRunCommitSha = await this.resolveHeadCommitShaForTask(
      task,
      project,
    );

    if (!queuedNextLoop && !pendingApproval) {
      const autoCommitResult = await commitNodeWorkspaceIfChanged({
        taskId,
        node,
        commitMessage: buildCompleteCommitMessage(node),
        commitIfChanged: (message) =>
          this.taskGitService.commitIfChangedForTask(task, project, message),
        taskLogService: this.taskLogService,
        committedLogMessage: 'Node completion auto-committed staged changes',
        skippedLogMessage:
          'Node completion skipped auto-commit; no workspace changes',
        failedLogMessage: 'Node completion auto-commit failed',
      });
      afterRunCommitSha = autoCommitResult.commitSha ?? afterRunCommitSha;
    }

    await this.taskNodeRepository.update(node.id, {
      status,
      loopJson: nextLoopJson,
      startedAt: queuedNextLoop ? null : (node.startedAt ?? null),
      finishedAt: queuedNextLoop ? null : new Date(),
      agentClioutput,
      agentCliSessionId: clearAgentCliSessionId
        ? (agentCliSessionId ?? null)
        : (agentCliSessionId ?? node.agentCliSessionId ?? null),
      runtimeJson: null,
      afterRunCommitSha,
    });

    if (status === TaskStatus.inReview) {
      await this.notifyTaskNodeInReview(task, node);
    }

    return {
      status,
      loopJson: nextLoopJson,
      queuedNextLoop,
      pendingApproval,
      earlyExitCompleted: earlyExitDecision?.completed ?? false,
      earlyExitReason: earlyExitDecision?.reason ?? null,
      earlyExitSourceFile: earlyExitDecision?.sourceFile ?? null,
    };
  }

  private async resolveEarlyExitDecision({
    taskId,
    nodeId,
    node,
    runtimeContext,
  }: {
    taskId: string;
    nodeId: string;
    node: TaskNode;
    runtimeContext?: {
      gitBranch: string;
      gitBaseBranch: string;
      gitWorktree: string;
      worktreePath: string;
    };
  }): Promise<{
    completed: boolean;
    reason: string | null;
    sourceFile: string | null;
  }> {
    const markerConfig =
      this.taskConfigResolver.readNodeEarlyExitMarkerConfig(node);
    if (!markerConfig.enabled || !markerConfig.fileName) {
      return { completed: false, reason: null, sourceFile: null };
    }

    if (!runtimeContext?.worktreePath) {
      return { completed: false, reason: null, sourceFile: null };
    }

    const markerFilePaths = this.resolveMarkerFilePaths({
      worktreePath: runtimeContext.worktreePath,
      gitBranch: runtimeContext.gitBranch,
      markerFileName: markerConfig.fileName,
    });
    if (!markerFilePaths.length) {
      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.warn,
        message: 'Early-exit marker file path rejected',
        payload: {
          markerFileName: markerConfig.fileName,
        },
      });
      return { completed: false, reason: null, sourceFile: null };
    }

    let markerContent = '';
    let loadedMarkerFilePath: string | null = null;
    let lastReadError: NodeJS.ErrnoException | null = null;
    for (const markerFilePath of markerFilePaths) {
      try {
        markerContent = await readFile(markerFilePath, 'utf-8');
        loadedMarkerFilePath = markerFilePath;
        break;
      } catch (error) {
        const readError = error as NodeJS.ErrnoException;
        if (readError.code !== 'ENOENT') {
          throw error;
        }
        lastReadError = readError;
      }
    }

    if (!loadedMarkerFilePath) {
      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.warn,
        message: 'Early-exit marker file not found; continue looping',
        payload: {
          markerFilePaths,
          errorCode: lastReadError?.code ?? null,
        },
      });
      return {
        completed: false,
        reason: null,
        sourceFile: markerFilePaths[0] ?? null,
      };
    }

    const [statusLine = '', reasonLine = ''] = markerContent
      .split('\n')
      .map((line) => line.trim());
    const reason = reasonLine || null;

    if (statusLine === '已完成') {
      return {
        completed: true,
        reason,
        sourceFile: loadedMarkerFilePath,
      };
    }

    if (statusLine === '未完成') {
      return {
        completed: false,
        reason,
        sourceFile: loadedMarkerFilePath,
      };
    }

    if (statusLine === '未找到') {
      throw new Error(
        `Early-exit marker reports missing target: ${reason ?? 'unknown reason'}`,
      );
    }

    await this.taskLogService.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: TaskLogLevel.warn,
      message: 'Early-exit marker status invalid; continue looping',
      payload: {
        markerFilePath: loadedMarkerFilePath,
        statusLine,
        reason,
      },
    });

    return {
      completed: false,
      reason,
      sourceFile: loadedMarkerFilePath,
    };
  }

  private resolveMarkerFilePaths({
    worktreePath,
    gitBranch,
    markerFileName,
  }: {
    worktreePath: string;
    gitBranch?: string;
    markerFileName: string;
  }): string[] {
    const rootPath = path.resolve(worktreePath);
    const gitBranchSegments = (gitBranch ?? '')
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment && segment !== '.' && segment !== '..');
    if (!gitBranchSegments.length) {
      return [];
    }

    const markerRelativePathCandidates = [
      path.join('docs', ...gitBranchSegments, `${markerFileName}.md`),
    ];
    const safePrefix = `${rootPath}${path.sep}`;
    const dedupedRelativePaths = Array.from(
      new Set(markerRelativePathCandidates),
    );

    return dedupedRelativePaths
      .map((relativePath) => path.resolve(rootPath, relativePath))
      .filter((candidatePath) => candidatePath.startsWith(safePrefix));
  }

  private async finalizeNodeAsFailure({
    task,
    nodeId,
    agentClioutput,
    agentCliSessionId,
    clearAgentCliSessionId,
    afterRunCommitSha,
  }: {
    task: Task;
    nodeId: string;
    agentClioutput: string;
    agentCliSessionId?: string | null;
    clearAgentCliSessionId?: boolean;
    afterRunCommitSha?: string | null;
  }): Promise<void> {
    const latestNode = await this.taskNodeRepository.findById(nodeId);

    if (!latestNode || latestNode.status !== TaskStatus.inProgress) {
      return;
    }

    await this.taskNodeRepository.update(nodeId, {
      status: TaskStatus.inReview,
      finishedAt: new Date(),
      agentClioutput,
      agentCliSessionId: clearAgentCliSessionId
        ? (agentCliSessionId ?? null)
        : (agentCliSessionId ?? latestNode.agentCliSessionId ?? null),
      runtimeJson: null,
      afterRunCommitSha:
        afterRunCommitSha ?? latestNode.afterRunCommitSha ?? null,
    });

    await this.notifyTaskNodeInReview(task, latestNode);
  }

  private async resolveHeadCommitShaForTask(
    task: Task,
    project: Project,
  ): Promise<string | null> {
    return (
      (await this.taskGitService.resolveHeadCommitShaForTask?.(
        task,
        project,
      )) ?? null
    );
  }

  private async notifyTaskNodeInReview(
    task: Task,
    node: Pick<TaskNode, 'id' | 'name' | 'nodeOrder'>,
  ): Promise<void> {
    if (!task.createdBy || task.mode !== TaskMode.workflow) {
      return;
    }

    await this.notificationsService.notifyTaskNodeStatusChanged({
      userId: task.createdBy,
      taskId: task.id,
      taskTitle: task.title,
      nodeId: node.id,
      nodeName: node.name,
      nodeOrder: node.nodeOrder,
      status: TaskStatus.inReview,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
