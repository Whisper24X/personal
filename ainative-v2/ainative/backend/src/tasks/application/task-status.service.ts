import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';
import { Task } from '../domain/task';
import { TaskNode } from '../domain/task-node';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskNodeStatus } from '../dto/task-node-status.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskLogService } from './task-log.service';
import { ContainerOrchestrationService } from '../../containers/container-orchestration.service';
import { TaskGoalService } from './task-goal.service';
import {
  MEMORY_INGEST_ENQUEUE,
  type MemoryIngestEnqueuePort,
} from '../contracts/memory-ingest-enqueue.port';

@Injectable()
export class TaskStatusService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly notificationsService: NotificationsService,
    private readonly taskLogService: TaskLogService,
    private readonly containerOrchestration: ContainerOrchestrationService,
    private readonly taskGoalService: TaskGoalService,
    @Optional()
    @Inject(MEMORY_INGEST_ENQUEUE)
    private readonly memoryIngestEnqueue?: MemoryIngestEnqueuePort,
  ) {}

  async recalculateTaskStatus(taskId: string): Promise<void> {
    const currentTask = await this.taskRepository.findById(taskId);

    if (!currentTask) {
      throw new NotFoundException('Task not found');
    }

    const nodes = await this.taskNodeRepository.findByTaskId(taskId);
    const status = this.calculateTaskStatus(nodes, currentTask.status);

    await this.persistTaskStatus(currentTask, status);
  }

  async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const currentTask = await this.taskRepository.findById(taskId);

    if (!currentTask) {
      throw new NotFoundException('Task not found');
    }

    await this.persistTaskStatus(currentTask, status);
  }

  calculateTaskStatus(
    nodes: TaskNode[],
    currentStatus: TaskStatus = TaskStatus.todo,
  ): TaskStatus {
    if (!nodes.length) {
      return TaskStatus.todo;
    }

    if (nodes.every((node) => node.status === TaskNodeStatus.done)) {
      return currentStatus === TaskStatus.done
        ? TaskStatus.done
        : TaskStatus.inReview;
    }

    if (nodes.every((node) => node.status === TaskNodeStatus.todo)) {
      return currentStatus === TaskStatus.todo
        ? TaskStatus.todo
        : TaskStatus.inProgress;
    }

    return TaskStatus.inProgress;
  }

  private async persistTaskStatus(
    task: Task,
    status: TaskStatus,
  ): Promise<void> {
    const previousStatus = task.status;

    await this.taskRepository.update(task.id, {
      status,
      finishedAt: status === TaskStatus.done ? new Date() : null,
    });

    if (
      status === TaskStatus.done &&
      previousStatus !== TaskStatus.done &&
      this.memoryIngestEnqueue
    ) {
      const t = await this.taskRepository.findById(task.id);
      if (t) {
        const key = `memory:ingest:v1:${t.id}:${(t.finishedAt ?? new Date()).toISOString()}`;
        void this.memoryIngestEnqueue.enqueueAfterTaskDone({
          projectId: t.projectId,
          taskId: t.id,
          idempotencyKey: key,
        });
      }
    }

    await this.taskGoalService.syncPlanSubTaskStatusFromTask(task.id, status);

    if (previousStatus !== status) {
      await this.applySandboxLifecycle(task.id, task.gitWorktree, status);

      if (
        status === TaskStatus.inReview &&
        task.createdBy &&
        task.mode === TaskMode.workflow
      ) {
        await this.notificationsService.notifyTaskStatusChanged({
          userId: task.createdBy,
          taskId: task.id,
          taskTitle: task.title,
          status,
        });
      }
    }
  }

  private async applySandboxLifecycle(
    taskId: string,
    gitWorktree: string | null | undefined,
    status: TaskStatus,
  ): Promise<void> {
    if (status === TaskStatus.done) {
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
        message: 'Task kept worktree while pending review',
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
