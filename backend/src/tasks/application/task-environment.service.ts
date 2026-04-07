import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ContainerExecutionConfigService } from '../../containers/container-execution-config.service';
import { ContainerOrchestrationService } from '../../containers/container-orchestration.service';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskLog } from '../domain/task-log';
import {
  TaskEnvironmentDto,
  TaskEnvironmentStage,
  TaskEnvironmentStatus,
  TaskEnvironmentStepDto,
  TaskEnvironmentStepStatus,
} from '../dto/task-environment.dto';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskLogRepository } from '../infrastructure/persistence/task-log.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskAccessService } from './task-access.service';
import { TaskLogService } from './task-log.service';
import { TaskRuntimeOrchestratorService } from './task-runtime-orchestrator.service';

type EnvironmentEventPayload = {
  scope?: string;
  environmentStatus?: TaskEnvironmentStatus;
  environmentStage?: TaskEnvironmentStage;
  environmentMessage?: string | null;
  failedStage?: TaskEnvironmentStage | null;
};

type EnvironmentEvent = {
  status: TaskEnvironmentStatus;
  stage: TaskEnvironmentStage;
  message: string | null;
  failedStage: TaskEnvironmentStage | null;
  createdAt: Date;
};

const ENVIRONMENT_NOT_READY_MESSAGE = '执行环境未就绪，请先启动环境';

@Injectable()
export class TaskEnvironmentService {
  private readonly environmentStepDefinitions = [
    {
      key: TaskEnvironmentStage.workspacePreparing,
      label: '准备任务工作区',
    },
    {
      key: TaskEnvironmentStage.slotClaiming,
      label: '分配任务执行资源',
    },
    {
      key: TaskEnvironmentStage.containerStarting,
      label: '启动执行容器',
    },
    {
      key: TaskEnvironmentStage.ready,
      label: '执行环境就绪',
    },
  ] as const;

  constructor(
    private readonly taskAccessService: TaskAccessService,
    private readonly taskRuntimeOrchestrator: TaskRuntimeOrchestratorService,
    private readonly taskLogService: TaskLogService,
    private readonly taskLogRepository: TaskLogRepository,
    private readonly taskRepository: TaskRepository,
    private readonly containerOrchestration: ContainerOrchestrationService,
    @Optional()
    private readonly containerExecutionConfig?: ContainerExecutionConfigService,
  ) {}

  async getEnvironment(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskEnvironmentDto> {
    const { task, project } =
      await this.taskAccessService.assertCanAccessTaskProject(
        taskId,
        currentUser,
      );

    return this.buildEnvironmentSnapshot(task, project);
  }

  async startEnvironment(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskEnvironmentDto> {
    const { task } = await this.taskAccessService.assertCanAccessTaskProject(
      taskId,
      currentUser,
    );

    const currentEnvironment = await this.getEnvironment(taskId, currentUser);
    if (currentEnvironment.status === TaskEnvironmentStatus.ready) {
      return currentEnvironment;
    }
    try {
      await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
        status: TaskEnvironmentStatus.starting,
        stage: TaskEnvironmentStage.workspacePreparing,
        message: '开始准备任务执行环境',
      });

      const prepared = await this.taskRuntimeOrchestrator.prepareTaskRuntime(
        task,
        currentUser,
      );

      if (this.isDockerMode()) {
        await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
          status: TaskEnvironmentStatus.starting,
          stage: TaskEnvironmentStage.slotClaiming,
          message: '正在为当前任务分配执行资源',
        });

        await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
          status: TaskEnvironmentStatus.starting,
          stage: TaskEnvironmentStage.containerStarting,
          message: '正在启动执行容器',
        });

        await this.containerOrchestration.ensureContainer({
          task: prepared.task,
          project: prepared.project,
          worktreePath: prepared.task.gitWorktree ?? '',
          trackProjectSlot: false,
        });
      }

      await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
        status: TaskEnvironmentStatus.ready,
        stage: TaskEnvironmentStage.ready,
        message: '执行环境已就绪',
      });

      const refreshedTask =
        (await this.taskRepository.findById(task.id)) ?? prepared.task;
      return this.buildEnvironmentSnapshot(refreshedTask, prepared.project);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '执行环境启动失败';

      await this.appendEnvironmentEvent(task.id, TaskLogLevel.error, {
        status: TaskEnvironmentStatus.failed,
        stage: TaskEnvironmentStage.failed,
        message: errorMessage,
        failedStage: this.isDockerMode()
          ? TaskEnvironmentStage.containerStarting
          : TaskEnvironmentStage.workspacePreparing,
      });

      throw error;
    }
  }

  async assertEnvironmentReady(task: Task): Promise<void> {
    const project = await this.taskAccessService.getProjectByIdOrThrow(
      task.projectId,
    );
    const environment = await this.buildEnvironmentSnapshot(task, project);
    if (environment.status !== TaskEnvironmentStatus.ready) {
      throw new ConflictException(ENVIRONMENT_NOT_READY_MESSAGE);
    }
  }

  private async buildEnvironmentSnapshot(
    task: Task,
    project: Project,
  ): Promise<TaskEnvironmentDto> {
    const [container, latestLogs] = await Promise.all([
      this.containerOrchestration.inspectTaskContainer({
        task,
        project,
      }),
      this.taskLogRepository.findLatestByTaskId({
        taskId: task.id,
        limit: 20,
      }),
    ]);
    const latestEnvironmentEvent =
      this.extractLatestEnvironmentEvent(latestLogs);
    const latestReadyAt = this.findLatestEnvironmentReadyAt(latestLogs);

    if (!this.isDockerMode()) {
      if (latestEnvironmentEvent?.status === TaskEnvironmentStatus.failed) {
        return this.buildDto({
          status: TaskEnvironmentStatus.failed,
          stage: TaskEnvironmentStage.failed,
          message: latestEnvironmentEvent.message,
          updatedAt: latestEnvironmentEvent.createdAt,
          runtime: {
            gitWorktree: task.gitWorktree ?? null,
          },
          failedStage: latestEnvironmentEvent.failedStage,
        });
      }

      if (task.gitWorktree?.trim()) {
        return this.buildDto({
          status: TaskEnvironmentStatus.ready,
          stage: TaskEnvironmentStage.ready,
          message: '执行环境已就绪',
          updatedAt:
            latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
          runtime: {
            gitWorktree: task.gitWorktree,
          },
        });
      }

      return this.buildDto({
        status: TaskEnvironmentStatus.notStarted,
        stage: TaskEnvironmentStage.workspacePreparing,
        message: '尚未启动执行环境',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
      });
    }

    if (container?.running && container.containerId) {
      return this.buildDto({
        status: TaskEnvironmentStatus.ready,
        stage: TaskEnvironmentStage.ready,
        message: '执行环境已就绪',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
          containerId: container.containerId,
          previewAddress: container.accessMetadata?.previewAddress ?? null,
          baseUrl: container.accessMetadata?.baseUrl ?? null,
        },
      });
    }

    if (container?.containerId) {
      return this.buildDto({
        status: TaskEnvironmentStatus.starting,
        stage:
          latestEnvironmentEvent?.stage === TaskEnvironmentStage.slotClaiming
            ? TaskEnvironmentStage.slotClaiming
            : TaskEnvironmentStage.containerStarting,
        message: latestEnvironmentEvent?.message ?? '执行环境启动中',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
          containerId: container.containerId,
          previewAddress: container.accessMetadata?.previewAddress ?? null,
          baseUrl: container.accessMetadata?.baseUrl ?? null,
        },
      });
    }

    if (
      latestEnvironmentEvent?.status === TaskEnvironmentStatus.failed &&
      (!latestReadyAt || latestEnvironmentEvent.createdAt >= latestReadyAt)
    ) {
      return this.buildDto({
        status: TaskEnvironmentStatus.failed,
        stage: TaskEnvironmentStage.failed,
        message: latestEnvironmentEvent.message,
        updatedAt: latestEnvironmentEvent.createdAt,
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
        },
        failedStage: latestEnvironmentEvent.failedStage,
      });
    }

    if (
      latestReadyAt &&
      (task.status === TaskStatus.done || Boolean(task.gitWorktree?.trim()))
    ) {
      return this.buildDto({
        status: TaskEnvironmentStatus.stopped,
        stage: TaskEnvironmentStage.stopped,
        message: '执行环境已释放',
        updatedAt: latestReadyAt,
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
        },
      });
    }

    return this.buildDto({
      status: TaskEnvironmentStatus.notStarted,
      stage: TaskEnvironmentStage.workspacePreparing,
      message: '尚未启动执行环境',
      updatedAt:
        latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
    });
  }

  private buildDto(params: {
    status: TaskEnvironmentStatus;
    stage: TaskEnvironmentStage;
    message: string | null;
    updatedAt: Date;
    runtime?: {
      gitWorktree?: string | null;
      containerId?: string | null;
      previewAddress?: string | null;
      baseUrl?: string | null;
    } | null;
    failedStage?: TaskEnvironmentStage | null;
  }): TaskEnvironmentDto {
    return {
      status: params.status,
      stage: params.stage,
      stageLabel: this.resolveStageLabel(params.stage),
      message: params.message,
      updatedAt: params.updatedAt,
      runtime: params.runtime ?? null,
      steps: this.buildSteps({
        status: params.status,
        stage: params.stage,
        message: params.message,
        failedStage: params.failedStage ?? null,
      }),
    };
  }

  private buildSteps(params: {
    status: TaskEnvironmentStatus;
    stage: TaskEnvironmentStage;
    message: string | null;
    failedStage: TaskEnvironmentStage | null;
  }): TaskEnvironmentStepDto[] {
    const failedStage =
      params.status === TaskEnvironmentStatus.failed
        ? (params.failedStage ?? TaskEnvironmentStage.containerStarting)
        : null;
    const activeStage =
      params.status === TaskEnvironmentStatus.failed
        ? failedStage
        : params.stage === TaskEnvironmentStage.ready
          ? TaskEnvironmentStage.ready
          : params.stage;

    const activeIndex = this.environmentStepDefinitions.findIndex(
      (step) => step.key === activeStage,
    );

    return this.environmentStepDefinitions.map((step, index) => {
      let status = TaskEnvironmentStepStatus.pending;

      if (params.status === TaskEnvironmentStatus.ready) {
        status = TaskEnvironmentStepStatus.done;
      } else if (params.status === TaskEnvironmentStatus.stopped) {
        status = TaskEnvironmentStepStatus.done;
      } else if (params.status === TaskEnvironmentStatus.failed) {
        if (activeIndex > index) {
          status = TaskEnvironmentStepStatus.done;
        } else if (activeIndex === index) {
          status = TaskEnvironmentStepStatus.error;
        }
      } else if (params.status === TaskEnvironmentStatus.starting) {
        if (activeIndex > index) {
          status = TaskEnvironmentStepStatus.done;
        } else if (activeIndex === index) {
          status = TaskEnvironmentStepStatus.inProgress;
        }
      }

      return {
        key: step.key,
        label: step.label,
        status,
        message:
          status === TaskEnvironmentStepStatus.error ||
          status === TaskEnvironmentStepStatus.inProgress ||
          (params.status === TaskEnvironmentStatus.ready &&
            step.key === TaskEnvironmentStage.ready)
            ? params.message
            : null,
      };
    });
  }

  private resolveStageLabel(stage: TaskEnvironmentStage): string {
    const step = this.environmentStepDefinitions.find(
      (item) => item.key === stage,
    );
    if (step) {
      return step.label;
    }

    if (stage === TaskEnvironmentStage.failed) {
      return '执行环境启动失败';
    }

    if (stage === TaskEnvironmentStage.stopped) {
      return '执行环境已释放';
    }

    return '执行环境';
  }

  private async appendEnvironmentEvent(
    taskId: string,
    level: TaskLogLevel,
    input: {
      status: TaskEnvironmentStatus;
      stage: TaskEnvironmentStage;
      message: string;
      failedStage?: TaskEnvironmentStage | null;
    },
  ): Promise<void> {
    await this.taskLogService.appendLog({
      taskId,
      taskNodeId: null,
      level,
      message: input.message,
      payload: {
        scope: 'task_environment',
        environmentStatus: input.status,
        environmentStage: input.stage,
        environmentMessage: input.message,
        failedStage: input.failedStage ?? null,
      },
    });
  }

  private extractLatestEnvironmentEvent(
    logs: TaskLog[],
  ): EnvironmentEvent | null {
    for (const log of logs) {
      const payload = this.readEnvironmentPayload(log);
      if (!payload) {
        continue;
      }

      return {
        status: payload.environmentStatus ?? TaskEnvironmentStatus.notStarted,
        stage:
          payload.environmentStage ?? TaskEnvironmentStage.workspacePreparing,
        message:
          payload.environmentMessage ??
          (typeof log.message === 'string' ? log.message : null),
        failedStage: payload.failedStage ?? null,
        createdAt: log.createdAt,
      };
    }

    return null;
  }

  private findLatestEnvironmentReadyAt(logs: TaskLog[]): Date | null {
    for (const log of logs) {
      const payload = this.readEnvironmentPayload(log);
      if (payload?.environmentStatus === TaskEnvironmentStatus.ready) {
        return log.createdAt;
      }
    }

    return null;
  }

  private readEnvironmentPayload(log: TaskLog): EnvironmentEventPayload | null {
    if (!log.payload || typeof log.payload !== 'object') {
      return null;
    }

    const payload = log.payload as EnvironmentEventPayload;
    if (payload.scope !== 'task_environment') {
      return null;
    }

    return payload;
  }

  private isDockerMode(): boolean {
    return this.containerExecutionConfig?.isDockerMode() ?? false;
  }
}
