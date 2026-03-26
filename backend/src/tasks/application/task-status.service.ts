import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';
import { TaskNode } from '../domain/task-node';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import { ContainerExecutionConfigService } from '../../containers/container-execution-config.service';
import { ContainerOrchestrationService } from '../../containers/container-orchestration.service';

@Injectable()
export class TaskStatusService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly notificationsService: NotificationsService,
    private readonly taskLogService: TaskLogService,
    private readonly taskConfigResolver: TaskConfigResolverService,
    private readonly containerExecutionConfig: ContainerExecutionConfigService,
    private readonly containerOrchestration: ContainerOrchestrationService,
  ) {}

  async recalculateTaskStatus(taskId: string): Promise<void> {
    const nodes = await this.taskNodeRepository.findByTaskId(taskId);
    const status = this.calculateTaskStatus(nodes);
    const currentTask = await this.taskRepository.findById(taskId);

    if (!currentTask) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = currentTask.status;

    await this.taskRepository.update(taskId, {
      status,
      finishedAt: status === TaskStatus.done ? new Date() : null,
    });

    if (previousStatus !== status) {
      await this.applySandboxLifecycle(
        currentTask.id,
        currentTask.gitWorktree,
        status,
      );

      if (currentTask.createdBy && currentTask.mode === TaskMode.workflow) {
        await this.notificationsService.notifyTaskStatusChanged({
          userId: currentTask.createdBy,
          taskId,
          taskTitle: currentTask.title,
          status,
        });
      }
    }
  }

  calculateTaskStatus(nodes: TaskNode[]): TaskStatus {
    if (!nodes.length) {
      return TaskStatus.todo;
    }

    if (nodes.some((node) => node.status === TaskStatus.inProgress)) {
      return TaskStatus.inProgress;
    }

    if (nodes.some((node) => node.status === TaskStatus.inReview)) {
      return TaskStatus.inReview;
    }

    const hasTodo = nodes.some((node) => node.status === TaskStatus.todo);
    const hasDone = nodes.some((node) => node.status === TaskStatus.done);
    const hasQueuedLoop = nodes.some((node) => {
      const loopJson = this.taskConfigResolver.readNodeLoopConfig(
        node.loopJson,
      );
      return (
        node.status === TaskStatus.todo &&
        loopJson.loopCount > 0 &&
        loopJson.loopCount < loopJson.maxLoops
      );
    });

    if (hasQueuedLoop || (hasTodo && hasDone)) {
      return TaskStatus.inProgress;
    }

    if (nodes.every((node) => node.status === TaskStatus.done)) {
      return TaskStatus.done;
    }

    if (nodes.every((node) => node.status === TaskStatus.todo)) {
      return TaskStatus.todo;
    }

    return TaskStatus.todo;
  }

  private async applySandboxLifecycle(
    taskId: string,
    gitWorktree: string | null | undefined,
    status: TaskStatus,
  ): Promise<void> {
    if (
      this.containerExecutionConfig.isDockerMode() &&
      status === TaskStatus.done
    ) {
      const task = await this.taskRepository.findById(taskId);
      if (task) {
        await this.containerOrchestration.removeContainerForTask(
          taskId,
          task.projectId,
        );
      }
    }

    if (status === TaskStatus.inReview && gitWorktree) {
      await this.taskLogService.appendLog({
        taskId,
        taskNodeId: null,
        level: TaskLogLevel.warn,
        message: 'Task kept sandbox for troubleshooting',
        payload: {
          gitWorktree,
        },
      });
      return;
    }

    if (status !== TaskStatus.done) {
      return;
    }

    await this.taskLogService.appendLog({
      taskId,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task completed; worktree preserved',
      payload: {
        gitWorktree,
      },
    });
  }
}
