import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ContainerExecutionConfigService } from '../../containers/container-execution-config.service';
import { ContainerOrchestrationService } from '../../containers/container-orchestration.service';
import { ProjectExecutionSlotRepository } from '../../containers/infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import { TaskLog } from '../domain/task-log';
import {
  TaskEnvironmentCoreMode,
  TaskEnvironmentDto,
  TaskEnvironmentRouteDiagnosticDto,
  TaskEnvironmentServicePhase,
  TaskEnvironmentServiceStatusDto,
  TaskEnvironmentStage,
  TaskEnvironmentStatus,
  TaskPreviewStatus,
  TaskEnvironmentStepDto,
  TaskEnvironmentStepStatus,
  TaskEnvironmentStartupFailureDto,
  TaskWorkspaceStatus,
  TaskWorkspaceSnapshotStatus,
} from '../dto/task-environment.dto';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { isWorkspaceNativeEnabled } from '../../git/snapshot-sync.types';
import { TaskLogRepository } from '../infrastructure/persistence/task-log.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskAccessService } from './task-access.service';
import { TaskLogService } from './task-log.service';
import { TaskRuntimeOrchestratorService } from './task-runtime-orchestrator.service';

const WS_NATIVE_PROVISION_POLL_MS = 700;
const WS_NATIVE_PROVISION_MAX_WAIT_MS = 180_000;

type EnvironmentEventPayload = {
  scope?: string;
  environmentStatus?: TaskEnvironmentStatus;
  environmentStage?: TaskEnvironmentStage;
  environmentMessage?: string | null;
  failedStage?: TaskEnvironmentStage | null;
  startupFailureSnapshot?: {
    services?: Array<{
      name?: string;
      phase?: string;
      message?: string | null;
      exitCode?: number | null;
      updatedAt?: string | null;
    }>;
    lastError?: string | null;
  } | null;
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
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskRepository: TaskRepository,
    private readonly projectExecutionSlotRepository: ProjectExecutionSlotRepository,
    private readonly containerExecutionConfig: ContainerExecutionConfigService,
    private readonly containerOrchestration: ContainerOrchestrationService,
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
    const { task, project } =
      await this.taskAccessService.assertCanAccessTaskProject(
        taskId,
        currentUser,
      );

    const currentEnvironment = await this.buildEnvironmentSnapshot(
      task,
      project,
    );
    if (currentEnvironment.status === TaskEnvironmentStatus.ready) {
      return currentEnvironment;
    }
    if (currentEnvironment.workspaceStatus === TaskWorkspaceStatus.failed) {
      return currentEnvironment;
    }
    let failedStage = TaskEnvironmentStage.workspacePreparing;
    try {
      await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
        status: TaskEnvironmentStatus.starting,
        stage: TaskEnvironmentStage.workspacePreparing,
        message: '开始准备任务执行环境',
      });

      let runtimeTask = task;
      if (isWorkspaceNativeEnabled(project)) {
        const wsStatus = this.readWorkspaceProvisioningStatus(task);
        if (wsStatus === 'provisioning') {
          runtimeTask = await this.awaitWorkspaceNativeProvisioning(task.id);
        }
      }

      const prepared = await this.taskRuntimeOrchestrator.prepareTaskRuntime(
        runtimeTask,
        currentUser,
      );

      failedStage = TaskEnvironmentStage.slotClaiming;
      await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
        status: TaskEnvironmentStatus.starting,
        stage: TaskEnvironmentStage.slotClaiming,
        message: '正在为当前任务分配执行资源',
      });
      const maxContainersPerProject =
        this.containerExecutionConfig.getMaxContainersPerProject();

      const slotClaimResult =
        await this.projectExecutionSlotRepository.claimSlotWithinLimit(
          prepared.project.id,
          prepared.task.id,
          this.containerExecutionConfig.getSlotTtlMs(),
          maxContainersPerProject,
        );

      if (slotClaimResult === 'limit_reached') {
        throw new ConflictException(
          `当前项目已达到容器启动上限（${maxContainersPerProject}）`,
        );
      }

      failedStage = TaskEnvironmentStage.containerStarting;
      await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
        status: TaskEnvironmentStatus.starting,
        stage: TaskEnvironmentStage.containerStarting,
        message: '正在启动执行容器',
      });

      await this.containerOrchestration.ensureContainer({
        task: prepared.task,
        project: prepared.project,
        worktreePath: prepared.task.gitWorktree ?? '',
        trackProjectSlot: true,
      });

      failedStage = TaskEnvironmentStage.ready;
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
      const startupFailureSnapshot =
        this.extractStartupFailureSnapshot(error) ?? null;

      await this.appendEnvironmentEvent(task.id, TaskLogLevel.error, {
        status: TaskEnvironmentStatus.failed,
        stage: TaskEnvironmentStage.failed,
        message: errorMessage,
        failedStage,
        startupFailureSnapshot,
      });

      throw error;
    }
  }

  async terminateEnvironment(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskEnvironmentDto> {
    const { task, project } =
      await this.taskAccessService.assertCanAccessTaskProject(
        taskId,
        currentUser,
      );

    if (task.status === TaskStatus.done) {
      throw new ConflictException('已完成任务不能终止执行环境');
    }

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException('任务执行中，无法终止执行环境');
    }

    await this.containerOrchestration.removeContainerForTask(
      task.id,
      task.projectId,
    );
    await this.appendEnvironmentEvent(task.id, TaskLogLevel.info, {
      status: TaskEnvironmentStatus.stopped,
      stage: TaskEnvironmentStage.stopped,
      message: '执行环境已释放',
    });

    const refreshedTask = (await this.taskRepository.findById(task.id)) ?? task;
    return this.buildEnvironmentSnapshot(refreshedTask, project);
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
    const [container, latestLogs, slot] = await Promise.all([
      this.containerOrchestration.inspectTaskContainerRuntimeState({
        task,
        project,
      }),
      this.taskLogRepository.findLatestByTaskId({
        taskId: task.id,
        limit: 20,
      }),
      this.projectExecutionSlotRepository.findByTaskId(task.id),
    ]);
    const latestEnvironmentEvent =
      this.extractLatestEnvironmentEvent(latestLogs);
    const latestReadyAt = this.findLatestEnvironmentReadyAt(latestLogs);
    const previewConfig = await this.resolvePreviewConfig(task, project);
    const previewEnabled = Boolean(previewConfig);
    const workspaceState = this.readWorkspaceState(task, project);
    const startupFailureSnapshot =
      this.extractLatestStartupFailureSnapshot(latestLogs) ?? null;

    if (workspaceState?.status === TaskWorkspaceStatus.provisioning) {
      return this.buildDto({
        status: TaskEnvironmentStatus.starting,
        stage: TaskEnvironmentStage.workspacePreparing,
        message:
          workspaceState.message ?? '工作区准备中，请稍后再启动执行环境。',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
        workspaceStatus: workspaceState.status,
        workspaceError: workspaceState.error ?? null,
        workspaceStage: workspaceState.stage ?? null,
        workspaceMessage: workspaceState.message ?? null,
        workspaceSnapshotStatus: workspaceState.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState.snapshotPushedAt ?? null,
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
        },
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.starting,
          previewEnabled,
        }),
        startupFailureSnapshot,
      });
    }

    if (workspaceState?.status === TaskWorkspaceStatus.failed) {
      return this.buildDto({
        status: TaskEnvironmentStatus.failed,
        stage: TaskEnvironmentStage.failed,
        message:
          workspaceState.error ??
          workspaceState.message ??
          '工作区准备失败，请删除当前任务后重新创建。',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
        workspaceStatus: workspaceState.status,
        workspaceError: workspaceState.error ?? null,
        workspaceStage: workspaceState.stage ?? null,
        workspaceMessage: workspaceState.message ?? null,
        workspaceSnapshotStatus: workspaceState.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState.snapshotPushedAt ?? null,
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
        },
        failedStage: TaskEnvironmentStage.workspacePreparing,
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.failed,
          previewEnabled,
        }),
        startupFailureSnapshot,
      });
    }

    if (container.kind === 'running') {
      const coreMode =
        container.accessMetadata?.coreMode === 'core-only'
          ? TaskEnvironmentCoreMode.coreOnly
          : TaskEnvironmentCoreMode.preview;
      return this.buildDto({
        status: TaskEnvironmentStatus.ready,
        stage: TaskEnvironmentStage.ready,
        message: '执行环境已就绪',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
          containerId: container.containerId,
        },
        workspaceStatus: workspaceState?.status ?? null,
        workspaceError: workspaceState?.error ?? null,
        workspaceStage: workspaceState?.stage ?? null,
        workspaceMessage: workspaceState?.message ?? null,
        workspaceSnapshotStatus: workspaceState?.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState?.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState?.snapshotPushedAt ?? null,
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.ready,
          previewEnabled,
          runtimePreview: container.runtimeReadiness.preview,
        }),
        coreMode,
        serviceStatuses: container.runtimeReadiness.serviceStatuses,
        routeDiagnostics: container.runtimeReadiness.routeDiagnostics,
        startupFailureSnapshot,
      });
    }

    if (slot) {
      return this.buildDto({
        status: TaskEnvironmentStatus.notStarted,
        stage: TaskEnvironmentStage.workspacePreparing,
        message: '检测到执行容器未运行，请点击「启动环境」重新拉起执行环境',
        updatedAt:
          latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
          containerId: slot.containerId ?? null,
        },
        workspaceStatus: workspaceState?.status ?? null,
        workspaceError: workspaceState?.error ?? null,
        workspaceStage: workspaceState?.stage ?? null,
        workspaceMessage: workspaceState?.message ?? null,
        workspaceSnapshotStatus: workspaceState?.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState?.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState?.snapshotPushedAt ?? null,
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.notStarted,
          previewEnabled,
        }),
        startupFailureSnapshot,
      });
    }

    if (
      latestEnvironmentEvent?.status === TaskEnvironmentStatus.stopped &&
      (!latestReadyAt || latestEnvironmentEvent.createdAt >= latestReadyAt)
    ) {
      return this.buildDto({
        status: TaskEnvironmentStatus.stopped,
        stage: TaskEnvironmentStage.stopped,
        message: latestEnvironmentEvent.message ?? '执行环境已释放',
        updatedAt: latestEnvironmentEvent.createdAt,
        runtime: {
          gitWorktree: task.gitWorktree ?? null,
        },
        workspaceStatus: workspaceState?.status ?? null,
        workspaceError: workspaceState?.error ?? null,
        workspaceStage: workspaceState?.stage ?? null,
        workspaceMessage: workspaceState?.message ?? null,
        workspaceSnapshotStatus: workspaceState?.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState?.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState?.snapshotPushedAt ?? null,
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.stopped,
          previewEnabled,
        }),
        startupFailureSnapshot,
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
        workspaceStatus: workspaceState?.status ?? null,
        workspaceError: workspaceState?.error ?? null,
        workspaceStage: workspaceState?.stage ?? null,
        workspaceMessage: workspaceState?.message ?? null,
        workspaceSnapshotStatus: workspaceState?.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState?.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState?.snapshotPushedAt ?? null,
        failedStage: latestEnvironmentEvent.failedStage,
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.failed,
          previewEnabled,
        }),
        startupFailureSnapshot,
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
        workspaceStatus: workspaceState?.status ?? null,
        workspaceError: workspaceState?.error ?? null,
        workspaceStage: workspaceState?.stage ?? null,
        workspaceMessage: workspaceState?.message ?? null,
        workspaceSnapshotStatus: workspaceState?.snapshotStatus ?? null,
        workspaceSnapshotError: workspaceState?.snapshotError ?? null,
        workspaceSnapshotPushedAt: workspaceState?.snapshotPushedAt ?? null,
        preview: this.buildPreview({
          environmentStatus: TaskEnvironmentStatus.stopped,
          previewEnabled,
        }),
        startupFailureSnapshot,
      });
    }

    return this.buildDto({
      status: TaskEnvironmentStatus.notStarted,
      stage: TaskEnvironmentStage.workspacePreparing,
      message: '尚未启动执行环境',
      updatedAt:
        latestEnvironmentEvent?.createdAt ?? task.updatedAt ?? new Date(),
      workspaceStatus: workspaceState?.status ?? null,
      workspaceError: workspaceState?.error ?? null,
      workspaceStage: workspaceState?.stage ?? null,
      workspaceMessage: workspaceState?.message ?? null,
      workspaceSnapshotStatus: workspaceState?.snapshotStatus ?? null,
      workspaceSnapshotError: workspaceState?.snapshotError ?? null,
      workspaceSnapshotPushedAt: workspaceState?.snapshotPushedAt ?? null,
      preview: this.buildPreview({
        environmentStatus: TaskEnvironmentStatus.notStarted,
        previewEnabled,
      }),
      startupFailureSnapshot,
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
    } | null;
    workspaceStatus?: TaskWorkspaceStatus | null;
    workspaceError?: string | null;
    workspaceStage?: string | null;
    workspaceMessage?: string | null;
    workspaceSnapshotStatus?: TaskWorkspaceSnapshotStatus | null;
    workspaceSnapshotError?: string | null;
    workspaceSnapshotPushedAt?: string | null;
    preview?: {
      status: TaskPreviewStatus;
      url?: string | null;
      partial?: boolean;
    };
    failedStage?: TaskEnvironmentStage | null;
    coreMode?: TaskEnvironmentCoreMode | null;
    serviceStatuses?: TaskEnvironmentServiceStatusDto[] | null;
    routeDiagnostics?: TaskEnvironmentRouteDiagnosticDto[] | null;
    startupFailureSnapshot?: TaskEnvironmentStartupFailureDto | null;
  }): TaskEnvironmentDto {
    return {
      status: params.status,
      stage: params.stage,
      stageLabel: this.resolveStageLabel(params.stage),
      message: params.message,
      updatedAt: params.updatedAt,
      workspaceStatus: params.workspaceStatus ?? null,
      workspaceError: params.workspaceError ?? null,
      workspaceStage: params.workspaceStage ?? null,
      workspaceMessage: params.workspaceMessage ?? null,
      workspaceSnapshotStatus: params.workspaceSnapshotStatus ?? null,
      workspaceSnapshotError: params.workspaceSnapshotError ?? null,
      workspaceSnapshotPushedAt: params.workspaceSnapshotPushedAt ?? null,
      runtime: params.runtime ?? null,
      preview:
        params.preview ??
        this.buildPreview({
          environmentStatus: params.status,
          previewEnabled: false,
        }),
      coreMode: params.coreMode ?? null,
      serviceStatuses: params.serviceStatuses ?? null,
      routeDiagnostics: params.routeDiagnostics ?? null,
      startupFailureSnapshot: params.startupFailureSnapshot ?? null,
      steps: this.buildSteps({
        status: params.status,
        stage: params.stage,
        message: params.message,
        failedStage: params.failedStage ?? null,
      }),
    };
  }

  private buildPreview(params: {
    environmentStatus: TaskEnvironmentStatus;
    previewUrl?: string | null;
    previewEnabled: boolean;
    runtimePreview?: {
      status: TaskPreviewStatus;
      url?: string | null;
      partial?: boolean;
      reason?:
        | 'http-ready'
        | 'port-listening-only'
        | 'unavailable'
        | 'failed'
        | null;
    } | null;
  }): {
    status: TaskPreviewStatus;
    url?: string | null;
    partial?: boolean;
    reason?: 'http-ready' | 'port-listening-only' | 'unavailable' | 'failed' | null;
  } {
    if (params.runtimePreview) {
      return {
        status: params.runtimePreview.status,
        url: params.runtimePreview.url ?? null,
        partial: params.runtimePreview.partial ?? false,
        reason: params.runtimePreview.reason ?? null,
      }
    }

    if (!params.previewEnabled) {
      return {
        status: TaskPreviewStatus.unavailable,
        url: null,
        partial: false,
        reason: 'unavailable',
      };
    }

    const previewUrl = params.previewUrl?.trim() || null;
    if (previewUrl) {
      return {
        status: TaskPreviewStatus.ready,
        url: previewUrl,
        partial: false,
        reason: 'http-ready',
      };
    }

    if (
      params.environmentStatus === TaskEnvironmentStatus.starting ||
      params.environmentStatus === TaskEnvironmentStatus.ready
    ) {
      return {
        status: TaskPreviewStatus.provisioning,
        url: null,
        partial: false,
        reason: null,
      };
    }

    if (params.environmentStatus === TaskEnvironmentStatus.failed) {
      return {
        status: TaskPreviewStatus.failed,
        url: null,
        partial: false,
        reason: 'failed',
      };
    }

    return {
      status: TaskPreviewStatus.unavailable,
      url: null,
      partial: false,
      reason: 'unavailable',
    };
  }

  private async resolvePreviewConfig(task: Task, project: Project) {
    try {
      return await this.containerOrchestration.resolvePreviewConfigForTask({
        task,
        project,
        allowDefaultFallback: true,
        suppressUnavailableError: true,
      });
    } catch {
      return null;
    }
  }

  private extractLatestStartupFailureSnapshot(
    logs: TaskLog[],
  ): TaskEnvironmentStartupFailureDto | null {
    for (const log of logs) {
      const payload = this.readEnvironmentPayload(log);
      const snapshot = this.normalizeStartupFailureSnapshot(
        payload?.startupFailureSnapshot ?? null,
        log.message,
      );
      if (snapshot) {
        return snapshot;
      }
    }
    return null;
  }

  private extractStartupFailureSnapshot(
    error: unknown,
  ): TaskEnvironmentStartupFailureDto | null {
    const snapshot = (error as { runnerStartupFailureSnapshot?: unknown })
      ?.runnerStartupFailureSnapshot;
    const statusSnapshot = (error as { containerStatusSnapshot?: unknown })
      ?.containerStatusSnapshot;
    return (
      this.normalizeStartupFailureSnapshot(
        snapshot ?? statusSnapshot ?? null,
      ) ?? null
    );
  }

  private normalizeStartupFailureSnapshot(
    value: unknown,
    fallbackMessage?: string | null,
  ): TaskEnvironmentStartupFailureDto | null {
    const rawServices = Array.isArray(value)
      ? value
      : value &&
          typeof value === 'object' &&
          Array.isArray((value as { services?: unknown }).services)
        ? (value as { services: unknown[] }).services
        : null;
    if (!rawServices || rawServices.length === 0) {
      return null;
    }
    const services = rawServices
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const raw = item as Record<string, unknown>;
        const name =
          typeof raw.name === 'string' && raw.name.trim()
            ? raw.name.trim()
            : '';
        if (!name) {
          return null;
        }
        return {
          name,
          port: null,
          phase: this.normalizeFailurePhase(raw.phase),
          message: typeof raw.message === 'string' ? raw.message : null,
          exitCode: typeof raw.exitCode === 'number' ? raw.exitCode : null,
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
          isPrimaryPreview: false,
        } as TaskEnvironmentServiceStatusDto;
      })
      .filter(Boolean) as TaskEnvironmentServiceStatusDto[];
    if (services.length === 0) {
      return null;
    }
    return {
      services,
      lastError: fallbackMessage ?? null,
    };
  }

  private normalizeFailurePhase(value: unknown): TaskEnvironmentServicePhase {
    switch (value) {
      case TaskEnvironmentServicePhase.installing:
      case TaskEnvironmentServicePhase.starting:
      case TaskEnvironmentServicePhase.listening:
      case TaskEnvironmentServicePhase.failed:
      case TaskEnvironmentServicePhase.pending:
        return value;
      default:
        return TaskEnvironmentServicePhase.unknown;
    }
  }

  private readWorkspaceState(
    task: Task,
    project: Project,
  ): {
    status: TaskWorkspaceStatus;
    error?: string;
    stage?: string;
    message?: string;
    snapshotStatus?: TaskWorkspaceSnapshotStatus;
    snapshotError?: string;
    snapshotPushedAt?: string;
  } | null {
    if (!isWorkspaceNativeEnabled(project)) {
      return null;
    }
    const config = task.configJson;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return null;
    }
    const raw = config as Record<string, unknown>;
    const status =
      raw.workspaceStatus === TaskWorkspaceStatus.provisioning ||
      raw.workspaceStatus === TaskWorkspaceStatus.ready ||
      raw.workspaceStatus === TaskWorkspaceStatus.failed
        ? raw.workspaceStatus
        : null;
    if (!status) {
      return null;
    }
    const error =
      typeof raw.workspaceError === 'string' && raw.workspaceError.trim()
        ? raw.workspaceError.trim()
        : undefined;
    const stage =
      typeof raw.workspaceStage === 'string' && raw.workspaceStage.trim()
        ? raw.workspaceStage.trim()
        : undefined;
    const message =
      typeof raw.workspaceMessage === 'string' && raw.workspaceMessage.trim()
        ? raw.workspaceMessage.trim()
        : undefined;
    const snapshotStatus =
      raw.workspaceSnapshotStatus === TaskWorkspaceSnapshotStatus.pending ||
      raw.workspaceSnapshotStatus === TaskWorkspaceSnapshotStatus.pushing ||
      raw.workspaceSnapshotStatus === TaskWorkspaceSnapshotStatus.pushed ||
      raw.workspaceSnapshotStatus === TaskWorkspaceSnapshotStatus.failed
        ? raw.workspaceSnapshotStatus
        : undefined;
    const snapshotError =
      typeof raw.workspaceSnapshotError === 'string' &&
      raw.workspaceSnapshotError.trim()
        ? raw.workspaceSnapshotError.trim()
        : undefined;
    const snapshotPushedAt =
      typeof raw.workspaceSnapshotPushedAt === 'string' &&
      raw.workspaceSnapshotPushedAt.trim()
        ? raw.workspaceSnapshotPushedAt.trim()
        : undefined;
    return {
      status,
      error,
      stage,
      message,
      snapshotStatus,
      snapshotError,
      snapshotPushedAt,
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
      startupFailureSnapshot?: TaskEnvironmentStartupFailureDto | null;
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
        startupFailureSnapshot: input.startupFailureSnapshot ?? null,
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

  private readWorkspaceProvisioningStatus(task: Task): string | undefined {
    const cfg = task.configJson as Record<string, unknown> | undefined;
    const status = cfg?.workspaceStatus;
    return typeof status === 'string' ? status : undefined;
  }

  private async awaitWorkspaceNativeProvisioning(
    taskId: string,
  ): Promise<Task> {
    const deadline = Date.now() + WS_NATIVE_PROVISION_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      const refreshed = await this.taskRepository.findById(taskId);
      if (!refreshed) {
        throw new NotFoundException('未找到任务');
      }

      const status = this.readWorkspaceProvisioningStatus(refreshed);
      if (status === 'ready') {
        return refreshed;
      }
      if (status === 'failed') {
        const cfg = (refreshed.configJson ?? {}) as Record<string, unknown>;
        const msg =
          typeof cfg.workspaceError === 'string'
            ? cfg.workspaceError.trim()
            : '';

        throw new ConflictException(
          msg
            ? `工作区初始化失败：${msg}`
            : '工作区初始化失败，请稍后重试或联系管理员',
        );
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, WS_NATIVE_PROVISION_POLL_MS);
      });
    }

    throw new ConflictException(
      '等待工作区初始化超时，请稍后重试「启动执行环境」',
    );
  }
}
