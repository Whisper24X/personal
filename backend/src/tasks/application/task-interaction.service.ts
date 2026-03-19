import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { Task } from '../domain/task';
import { ApproveTaskDto } from '../dto/approve-task.dto';
import { ReplyTaskDto } from '../dto/reply-task.dto';
import { RetryTaskDto } from '../dto/retry-task.dto';
import { TaskDetailDto } from '../dto/task-detail.dto';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskMessageRole } from '../dto/task-message.dto';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskAccessService } from './task-access.service';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import { TaskOutputService } from './task-output.service';
import { TaskQueryService } from './task-query.service';
import { TaskRuntimeOrchestratorService } from './task-runtime-orchestrator.service';
import { TaskSchedulerService } from './task-scheduler.service';
import { TaskStatusService } from './task-status.service';

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

    const inReviewNode =
      await this.taskNodeRepository.findFirstByTaskIdAndStatus({
        taskId: task.id,
        status: TaskStatus.inReview,
      });
    if (inReviewNode) {
      await this.taskNodeRepository.update(inReviewNode.id, {
        status: TaskStatus.todo,
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
      const todoNode = await this.taskNodeRepository.findFirstByTaskIdAndStatus(
        {
          taskId: task.id,
          status: TaskStatus.todo,
        },
      );

      if (todoNode) {
        await this.taskNodeRepository.update(todoNode.id, {
          runtimeJson:
            this.taskConfigResolver.buildPendingReplyRuntimeJson(
              normalizedMessage,
            ),
        });
      } else {
        const fallbackNode =
          await this.taskNodeRepository.findFirstByTaskIdAndStatus({
            taskId: task.id,
            status: TaskStatus.done,
          });

        if (!fallbackNode) {
          throw new ConflictException('No node available for reply execution');
        }

        await this.taskNodeRepository.update(fallbackNode.id, {
          status: TaskStatus.todo,
          finishedAt: null,
          runtimeJson:
            this.taskConfigResolver.buildPendingReplyRuntimeJson(
              normalizedMessage,
            ),
        });
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

    const nextTodoNode =
      await this.taskNodeRepository.findFirstByTaskIdAndStatus({
        taskId: task.id,
        status: TaskStatus.todo,
      });

    if (!nextTodoNode) {
      throw new ConflictException('No runnable node in todo status');
    }

    task = await this.markTaskStartedIfNeeded(task);

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task queued for execution',
      payload: {
        requestedBy: currentUser.sub,
        requestedAt: new Date().toISOString(),
        nodeOrder: nextTodoNode.nodeOrder,
      },
    });

    await this.taskStatusService.recalculateTaskStatus(task.id);
    await this.taskSchedulerService.triggerDispatch();

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async retry(
    taskId: Task['id'],
    retryTaskDto: RetryTaskDto,
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

    const targetNode = retryTaskDto.nodeId
      ? await this.taskNodeRepository.findById(retryTaskDto.nodeId)
      : await this.taskNodeRepository.findFirstByTaskIdAndStatus({
          taskId: task.id,
          status: TaskStatus.inReview,
        });

    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    if (targetNode.status !== TaskStatus.inReview) {
      throw new ConflictException('Only in_review node can be retried');
    }

    await this.taskNodeRepository.update(targetNode.id, {
      status: TaskStatus.todo,
      finishedAt: null,
      agentClioutput: null,
      runtimeJson: null,
    });

    task = await this.markTaskStartedIfNeeded(task);

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: targetNode.id,
      level: TaskLogLevel.info,
      message: 'Node retry queued',
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

    await this.taskNodeRepository.update(runningNode.id, {
      status: TaskStatus.inReview,
      finishedAt: new Date(),
      agentClioutput: await this.taskOutputService.writeNodeOutputJsonl({
        task,
        node: runningNode,
        output: {
          summary: 'Execution cancelled by user',
          finishedAt: new Date().toISOString(),
          error: {
            code: 'CANCELLED',
            message: 'Execution cancelled by user',
          },
        },
      }),
      runtimeJson: null,
    });

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

    const targetNode = await this.taskNodeRepository.findById(
      approveTaskDto.nodeId,
    );

    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    if (targetNode.status !== TaskStatus.inReview) {
      throw new ConflictException('Only in_review node can be approved');
    }

    await this.taskNodeRepository.update(targetNode.id, {
      status: TaskStatus.done,
      finishedAt: targetNode.finishedAt ?? new Date(),
      runtimeJson: null,
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
