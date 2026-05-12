import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { NotificationsService } from '../../notifications/notifications.service';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { ApproveTaskDto } from '../dto/approve-task.dto';
import { ReplyTaskDto } from '../dto/reply-task.dto';
import { TaskDetailDto } from '../dto/task-detail.dto';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskMessageRole } from '../dto/task-message.dto';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskNodeStatus } from '../dto/task-node-status.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskGitService } from '../task-git.service';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskAccessService } from './task-access.service';
import {
  buildApproveCommitMessage,
  commitNodeWorkspaceIfChanged,
} from './task-node-auto-commit';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import { TaskOutputService } from './task-output.service';
import { TaskQueryService } from './task-query.service';
import { TaskEnvironmentService } from './task-environment.service';
import { TaskRuntimeOrchestratorService } from './task-runtime-orchestrator.service';
import { TaskSchedulerService } from './task-scheduler.service';
import { TaskStatusService } from './task-status.service';
import { TaskWorkspaceContextCacheService } from './task-workspace-context-cache.service';
import { TaskWorkspaceWatchService } from './task-workspace-watch.service';

@Injectable()
export class TaskInteractionService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly taskAccessService: TaskAccessService,
    private readonly taskRuntimeOrchestrator: TaskRuntimeOrchestratorService,
    private readonly taskConfigResolver: TaskConfigResolverService,
    private readonly taskLogService: TaskLogService,
    private readonly taskOutputService: TaskOutputService,
    private readonly taskStatusService: TaskStatusService,
    private readonly taskQueryService: TaskQueryService,
    private readonly taskSchedulerService: TaskSchedulerService,
    private readonly taskEnvironmentService: TaskEnvironmentService,
    private readonly taskGitService: TaskGitService,
    private readonly taskWorkspaceWatchService: TaskWorkspaceWatchService,
    private readonly taskWorkspaceContextCache: TaskWorkspaceContextCacheService,
    @Optional()
    @Inject(NotificationsService)
    private readonly notificationsService: Pick<
      NotificationsService,
      'notifyTaskNodeStatusChanged'
    > = {
      notifyTaskNodeStatusChanged: () => Promise.resolve(null),
    },
  ) {}

  async reply(
    taskId: Task['id'],
    replyTaskDto: ReplyTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );
    if (task.status === TaskStatus.done) {
      throw new ConflictException('Completed task cannot accept reply');
    }

    const prepared = await this.taskRuntimeOrchestrator.prepareTaskRuntime(
      task,
      currentUser,
    );
    task = prepared.task;

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException(
        'Task already has an in-progress node and cannot accept reply',
      );
    }

    const normalizedMessage = replyTaskDto.message.trim();
    if (!normalizedMessage) {
      throw new ConflictException('Reply message cannot be empty');
    }

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: normalizedMessage,
      payload: {
        messageRole: TaskMessageRole.user,
        kind: 'reply',
        repliedBy: currentUser.sub,
      },
    });

    const failedNode = await this.taskNodeRepository.findFirstByTaskIdAndStatus(
      {
        taskId: task.id,
        status: TaskNodeStatus.failed,
      },
    );
    if (failedNode) {
      await this.taskNodeRepository.update(failedNode.id, {
        status: TaskNodeStatus.todo,
        finishedAt: null,
        runtimeJson:
          this.taskConfigResolver.buildPendingReplyRuntimeJson(
            normalizedMessage,
          ),
      });

      await this.taskLogService.appendLog({
        taskId: task.id,
        taskNodeId: failedNode.id,
        level: TaskLogLevel.info,
        message: 'Failed node moved back to todo by reply',
        payload: {
          nodeOrder: failedNode.nodeOrder,
          repliedBy: currentUser.sub,
        },
      });
    } else {
      const inReviewNode =
        await this.taskNodeRepository.findFirstByTaskIdAndStatus({
          taskId: task.id,
          status: TaskNodeStatus.inReview,
        });
      if (inReviewNode) {
        await this.taskNodeRepository.update(inReviewNode.id, {
          status: TaskNodeStatus.todo,
          finishedAt: null,
          runtimeJson:
            this.taskConfigResolver.buildPendingReplyRuntimeJson(
              normalizedMessage,
            ),
        });

        await this.taskLogService.appendLog({
          taskId: task.id,
          taskNodeId: inReviewNode.id,
          level: TaskLogLevel.info,
          message: 'In-review node moved back to todo by reply',
          payload: {
            nodeOrder: inReviewNode.nodeOrder,
            repliedBy: currentUser.sub,
          },
        });
      } else {
        const todoNode =
          await this.taskNodeRepository.findFirstByTaskIdAndStatus({
            taskId: task.id,
            status: TaskNodeStatus.todo,
          });

        if (todoNode) {
          await this.taskNodeRepository.update(todoNode.id, {
            runtimeJson:
              this.taskConfigResolver.buildPendingReplyRuntimeJson(
                normalizedMessage,
              ),
          });
        } else {
          const fallbackNodes =
            await this.taskNodeRepository.findByTaskIdAndStatus({
              taskId: task.id,
              status: TaskNodeStatus.done,
            });
          const fallbackNode = this.selectReplyFallbackNode(fallbackNodes);

          if (!fallbackNode) {
            throw new ConflictException(
              'No node available for reply execution',
            );
          }

          await this.taskNodeRepository.update(fallbackNode.id, {
            status: TaskNodeStatus.todo,
            finishedAt: null,
            runtimeJson:
              this.taskConfigResolver.buildPendingReplyRuntimeJson(
                normalizedMessage,
              ),
          });
        }
      }
    }

    task = await this.markTaskStartedIfNeeded(task);

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task queued after reply',
      payload: {
        repliedBy: currentUser.sub,
        requestedAt: new Date().toISOString(),
      },
    });

    await this.taskStatusService.recalculateTaskStatus(task.id);
    await this.taskSchedulerService.triggerDispatch();

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async execute(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );
    await this.taskEnvironmentService.assertEnvironmentReady(task);

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );

    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const inReviewNode =
      await this.taskNodeRepository.findFirstByTaskIdAndStatus({
        taskId: task.id,
        status: TaskNodeStatus.inReview,
      });

    if (inReviewNode) {
      throw new ConflictException('Task has in_review node and cannot execute');
    }

    const failedNode = await this.taskNodeRepository.findFirstByTaskIdAndStatus(
      {
        taskId: task.id,
        status: TaskNodeStatus.failed,
      },
    );

    if (failedNode) {
      throw new ConflictException('Task has failed node and cannot execute');
    }

    const nextTodoNode =
      await this.taskNodeRepository.findFirstByTaskIdAndStatus({
        taskId: task.id,
        status: TaskNodeStatus.todo,
      });

    if (!nextTodoNode) {
      throw new ConflictException('No runnable node in todo status');
    }

    const startedTask = await this.markTaskStartedIfNeeded(task);

    await this.taskLogService.appendLog({
      taskId: startedTask.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task queued for execution',
      payload: {
        requestedBy: currentUser.sub,
        requestedAt: new Date().toISOString(),
        nodeOrder: nextTodoNode.nodeOrder,
      },
    });

    await this.taskStatusService.recalculateTaskStatus(startedTask.id);
    await this.taskSchedulerService.triggerDispatch();

    return this.taskQueryService.detailById(startedTask.id, currentUser);
  }

  /**
   * Repeat without specifying a node: ensures runtime (worktree), then repeats
   * the in_review node if any, otherwise the last completed node (by nodeOrder).
   */
  async repeat(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );
    const prepared = await this.taskRuntimeOrchestrator.prepareTaskRuntime(
      task,
      currentUser,
    );
    task = prepared.task;

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const nodes = await this.taskNodeRepository.findByTaskId(task.id);
    const hasInReview = nodes.some((n) => n.status === TaskNodeStatus.inReview);
    if (task.status !== TaskStatus.done && !hasInReview) {
      throw new ConflictException(
        'Task can be repeated only when done or has in_review node',
      );
    }

    let targetNode: TaskNode | undefined;
    if (hasInReview) {
      targetNode =
        (await this.taskNodeRepository.findFirstByTaskIdAndStatus({
          taskId: task.id,
          status: TaskNodeStatus.inReview,
        })) ?? undefined;
    } else {
      const doneNodes = nodes.filter((n) => n.status === TaskNodeStatus.done);
      if (doneNodes.length === 0) {
        throw new ConflictException('No completed node to repeat');
      }
      targetNode = doneNodes.reduce((a, b) =>
        a.nodeOrder > b.nodeOrder ? a : b,
      );
    }

    if (!targetNode) {
      throw new NotFoundException('Task node not found');
    }

    return this.repeatNode(taskId, targetNode.id, currentUser);
  }

  async repeatNode(
    taskId: Task['id'],
    nodeId: TaskNode['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const targetNode = await this.taskNodeRepository.findById(nodeId);
    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    const nodes = await this.taskNodeRepository.findByTaskId(task.id);
    const hasInReview = nodes.some((n) => n.status === TaskNodeStatus.inReview);
    if (task.status !== TaskStatus.done && !hasInReview) {
      throw new ConflictException(
        'Task can be repeated only when done or has in_review node',
      );
    }

    await this.taskNodeRepository.update(targetNode.id, {
      status: TaskNodeStatus.todo,
      finishedAt: null,
      agentClioutput: null,
      runtimeJson: null,
    });

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: targetNode.id,
      level: TaskLogLevel.info,
      message: 'Node repeated by user',
      payload: {
        requestedBy: currentUser.sub,
        requestedAt: new Date().toISOString(),
        nodeOrder: targetNode.nodeOrder,
      },
    });

    await this.taskStatusService.recalculateTaskStatus(task.id);
    await this.taskSchedulerService.triggerDispatch();

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async resetNode(
    taskId: Task['id'],
    nodeId: TaskNode['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );
    const prepared = await this.taskRuntimeOrchestrator.prepareTaskRuntime(
      task,
      currentUser,
    );
    task = prepared.task;
    const project = prepared.project;

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const targetNode = await this.taskNodeRepository.findById(nodeId);
    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    if (
      targetNode.status !== TaskNodeStatus.done &&
      targetNode.status !== TaskNodeStatus.inReview &&
      targetNode.status !== TaskNodeStatus.failed
    ) {
      throw new ConflictException(
        'Only done, in_review, or failed node can be reset',
      );
    }

    const resetToCommitSha = targetNode.beforeRunCommitSha?.trim();
    if (!resetToCommitSha) {
      throw new ConflictException(
        'Task node cannot be reset because execution snapshot is unavailable',
      );
    }

    const nodes = await this.taskNodeRepository.findByTaskId(task.id);
    const resetNodes = nodes.filter(
      (node) => node.nodeOrder >= targetNode.nodeOrder,
    );

    await this.taskGitService.resetHardToCommitForTask(
      task,
      project,
      resetToCommitSha,
    );

    await Promise.all(
      resetNodes.map((node) =>
        this.taskOutputService.removeNodeOutputFiles({
          task,
          node,
        }),
      ),
    );
    await this.taskLogService.deleteNodeLogs({
      taskId: task.id,
      nodeIds: resetNodes.map((node) => node.id),
    });

    await Promise.all(
      resetNodes.map((node) => {
        const loopConfig = this.taskConfigResolver.readNodeLoopConfig(
          node.loopJson,
        );

        return this.taskNodeRepository.update(node.id, {
          status: TaskNodeStatus.todo,
          startedAt: null,
          finishedAt: null,
          agentClioutput: null,
          agentCliSessionId: null,
          runtimeJson: null,
          afterRunCommitSha: null,
          loopJson: {
            enabled: loopConfig.enabled,
            loopCount: 0,
            maxLoops: loopConfig.maxLoops,
          },
        });
      }),
    );

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.warn,
      message: 'Node reset completed',
      payload: {
        requestedBy: currentUser.sub,
        requestedAt: new Date().toISOString(),
        targetNodeId: targetNode.id,
        targetNodeOrder: targetNode.nodeOrder,
        resetToCommitSha,
        clearedNodeIds: resetNodes.map((node) => node.id),
        clearedNodeOrders: resetNodes.map((node) => node.nodeOrder),
      },
    });

    await this.taskStatusService.recalculateTaskStatus(task.id);

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async cancel(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );

    if (!runningNode) {
      throw new ConflictException('Task has no in-progress node to cancel');
    }

    const cancelledAt = new Date();
    const agentClioutput =
      runningNode.agentClioutput ??
      this.taskOutputService.resolveNodeOutputPath(task, runningNode);

    await this.taskNodeRepository.update(runningNode.id, {
      status: TaskNodeStatus.inReview,
      finishedAt: cancelledAt,
      agentClioutput,
      runtimeJson: null,
    });

    await this.notifyTaskNodeInReview(task, runningNode);

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: runningNode.id,
      level: TaskLogLevel.warn,
      message: 'Node execution cancelled',
      payload: {
        nodeOrder: runningNode.nodeOrder,
      },
    });

    await this.taskStatusService.recalculateTaskStatus(task.id);
    await this.taskSchedulerService.triggerDispatch();

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async approve(
    taskId: Task['id'],
    approveTaskDto: ApproveTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );
    const project = await this.taskAccessService.getProjectByIdOrThrow(
      task.projectId,
    );

    const targetNode = await this.taskNodeRepository.findById(
      approveTaskDto.nodeId,
    );

    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    if (targetNode.status !== TaskNodeStatus.inReview) {
      throw new ConflictException('Only in_review node can be approved');
    }

    const commitMessage = buildApproveCommitMessage(targetNode);

    const autoCommitResult = await commitNodeWorkspaceIfChanged({
      taskId: task.id,
      node: targetNode,
      commitMessage,
      currentUser,
      commitIfChanged: (message, commitUser) =>
        this.taskGitService.commitIfChanged(
          task.id,
          message,
          commitUser as JwtPayloadType,
        ),
      taskLogService: this.taskLogService,
      committedLogMessage: 'Node approval auto-committed staged changes',
      skippedLogMessage:
        'Node approval skipped auto-commit; no workspace changes',
      failedLogMessage: 'Node approval auto-commit failed',
    });
    const afterRunCommitSha =
      autoCommitResult.commitSha ??
      (await this.taskGitService.resolveHeadCommitShaForTask(task, project));

    await this.taskNodeRepository.update(targetNode.id, {
      status: TaskNodeStatus.done,
      finishedAt: targetNode.finishedAt ?? new Date(),
      runtimeJson: null,
      afterRunCommitSha,
    });

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: targetNode.id,
      level: TaskLogLevel.info,
      message: 'Node approved and marked as done',
      payload: {
        nodeOrder: targetNode.nodeOrder,
      },
    });

    await this.taskStatusService.recalculateTaskStatus(task.id);
    await this.taskSchedulerService.triggerDispatch();

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async complete(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );

    if (task.status !== TaskStatus.inReview) {
      throw new ConflictException('Only in_review task can be completed');
    }

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const nodes = await this.taskNodeRepository.findByTaskId(task.id);
    const allNodesDone =
      nodes.length > 0 &&
      nodes.every((node) => node.status === TaskNodeStatus.done);

    if (!allNodesDone) {
      throw new ConflictException(
        'Only task with all nodes done can be completed',
      );
    }

    await this.taskStatusService.setTaskStatus(task.id, TaskStatus.done);

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task marked as done manually',
      payload: {
        completedBy: currentUser.sub,
        completedAt: new Date().toISOString(),
      },
    });

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async cleanupWorktree(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );
    const project = await this.taskAccessService.getProjectByIdOrThrow(
      task.projectId,
    );

    const cleanupResult = await this.taskRuntimeService.cleanupRuntime(
      task,
      project,
    );

    await this.taskRepository.update(task.id, {
      ...(cleanupResult.cleaned ? { gitWorktree: null } : {}),
    });
    if (cleanupResult.cleaned) {
      this.taskWorkspaceContextCache.invalidateTask(task.id);
    }
    await this.taskWorkspaceWatchService.syncTaskWatch(task.id);

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: cleanupResult.cleaned ? TaskLogLevel.info : TaskLogLevel.warn,
      message: cleanupResult.cleaned
        ? 'Task worktree cleaned manually'
        : 'Task worktree cleanup skipped or failed',
      payload: {
        gitWorktree: task.gitWorktree,
        errorMessage: cleanupResult.errorMessage ?? null,
      },
    });

    return this.taskQueryService.detailById(task.id, currentUser);
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
      status: TaskNodeStatus.inReview,
    });
  }

  private selectReplyFallbackNode(nodes: TaskNode[]): TaskNode | null {
    if (!nodes.length) {
      return null;
    }

    const nodesWithSession = nodes.filter((node) =>
      this.hasAgentCliSession(node),
    );
    const candidates = nodesWithSession.length > 0 ? nodesWithSession : nodes;

    const sortedCandidates = [...candidates].sort((left, right) => {
      const finishedAtDiff =
        this.resolveNodeFinishedAtMs(right) -
        this.resolveNodeFinishedAtMs(left);
      if (finishedAtDiff !== 0) {
        return finishedAtDiff;
      }

      return right.nodeOrder - left.nodeOrder;
    });

    return sortedCandidates[0] ?? null;
  }

  private hasAgentCliSession(node: TaskNode): boolean {
    return typeof node.agentCliSessionId === 'string'
      ? node.agentCliSessionId.trim().length > 0
      : false;
  }

  private resolveNodeFinishedAtMs(node: TaskNode): number {
    return node.finishedAt instanceof Date ? node.finishedAt.getTime() : 0;
  }

  private async markTaskStartedIfNeeded(task: Task): Promise<Task> {
    const queueRequestedAt = new Date();
    if (!task.startedAt) {
      const updatedTask = await this.taskRepository.update(task.id, {
        startedAt: queueRequestedAt,
      });
      return updatedTask ?? task;
    }

    return task;
  }
}
