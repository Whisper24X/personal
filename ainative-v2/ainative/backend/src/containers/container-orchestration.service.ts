import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createServer } from 'net';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';
import {
  TaskEnvironmentCoreMode,
  TaskPreviewStatus,
} from '../tasks/dto/task-environment.dto';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { DatabaseIsolationService } from './database-isolation.service';
import {
  IsolatedRunnerContainerService,
  RunnerManagedVolumeMount,
} from './isolated-runner-container.service';
import {
  RunnerRuntimeReadinessAssessment,
  RunnerRuntimeReadinessService,
} from './runner-runtime-readiness.service';
import { SlotAccessMetadata } from './domain/project-execution-slot';
import { ProjectExecutionSlotRepository } from './infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { buildPreviewUrl } from './preview-url';
import { ProjectRunnerImageService } from './project-runner-image.service';
import { RunnerOrchestrationService } from './runner-orchestration.service';
import { RunnerOrchestrationConfig } from './runner-orchestration.types';
import { DatabaseIsolationConfig } from './types/database-isolation.types';
import { isWorkspaceNativeEnabled } from '../git/snapshot-sync.types';
import {
  BusinessLineWorkspaceConfig,
  RunnerConfigCacheMeta,
} from '../git/workspace-native.types';
import { assessRunnerSnapshotFreshness } from '../business-lines/runner-snapshot-freshness';
import { resolveSubRepoConfigs } from '../git/sub-repo.types';

type RunnerOrchestrationSource =
  | 'taskSnapshot'
  | 'projectConfig'
  | 'businessLineCache'
  | 'default'
  | 'coreOnly';

type ResolvedRunnerOrchestrationResult = {
  orchestration: RunnerOrchestrationConfig | null;
  source: RunnerOrchestrationSource;
  previewConfig: {
    service: string;
    path?: string;
  } | null;
  previewEnabled: boolean;
  coreMode: TaskEnvironmentCoreMode;
  warnings: string[];
};

type ManagedVolumeDescriptor = {
  name: string;
  target: string;
  labels: Record<string, string>;
  preserveOnCleanup?: boolean;
};

type StartupManagedVolumePlan = {
  taskScopedTargets: string[];
  mounts: ManagedVolumeDescriptor[];
};

export type InspectTaskContainerResult =
  | {
      kind: 'running';
      containerId: string;
      accessMetadata: SlotAccessMetadata | null;
    }
  | {
      kind: 'missing';
      slotState: 'none' | 'released-stale';
    };

export type TaskContainerRuntimeState =
  | {
      kind: 'running';
      containerId: string;
      accessMetadata: SlotAccessMetadata | null;
      runtimeReadiness: RunnerRuntimeReadinessAssessment;
    }
  | {
      kind: 'missing';
      slotState: 'none' | 'released-stale';
    };

@Injectable()
export class ContainerOrchestrationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContainerOrchestrationService.name);
  private readonly slotHeartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly maxPortAllocationAttempts = 8;
  private previewBaseUrlMissingWarned = false;
  private previewBaseUrlInvalidWarned = false;
  private previewBaseUrlIgnoredPathWarned = false;
  private destroyed = false;

  constructor(
    private readonly config: ContainerExecutionConfigService,
    private readonly projectRunnerImageService: ProjectRunnerImageService,
    private readonly isolatedRunner: IsolatedRunnerContainerService,
    private readonly slotRepository: ProjectExecutionSlotRepository,
    private readonly taskRepository: TaskRepository,
    private readonly dbIsolationService: DatabaseIsolationService,
    private readonly runnerOrchestration?: RunnerOrchestrationService,
    private readonly businessLineRepository?: BusinessLineRepository,
    private readonly runnerRuntimeReadiness?: RunnerRuntimeReadinessService,
  ) {}

  onModuleInit(): void {
    void this.resumeActiveSlotsOnStartup()
      .then(() => this.recoverOrphanContainers())
      .catch((error) => {
        this.logger.warn(
          `container orchestration startup recovery failed: ${error instanceof Error ? error.message : error}`,
        );
      });
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const timer of this.slotHeartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.slotHeartbeatTimers.clear();
  }

  /**
   * Ensure a long-running runner container exists for the task; returns docker id/name ref for exec.
   */
  async ensureContainer(params: {
    task: Task;
    project: Project;
    worktreePath: string;
    trackProjectSlot?: boolean;
  }): Promise<{ containerId: string }> {
    const { task, project, worktreePath } = params;
    const trackProjectSlot = params.trackProjectSlot !== false;
    const containerName = this.config.resolveContainerName(task);
    const resolvedOrchestration = await this.resolveRunnerOrchestrationForTask({
      task,
      project,
      allowDefaultFallback: true,
    });
    const runtimeExposure = this.resolveRuntimeExposure(
      project,
      resolvedOrchestration.previewEnabled,
    );
    const sandboxProfile = this.config.getSandboxProfile(project);
    const runnerPlatform = this.config.getRunnerPlatform(project);
    const readinessProbeUrl = this.config.getRunnerReadinessProbeUrl(project);
    const startTimeoutMs = this.config.getRunnerStartTimeoutMs(project);
    const runnerImage =
      await this.projectRunnerImageService.resolveRunnerImage(project);
    let existing = await this.isolatedRunner.inspect(containerName);
    if (existing?.paused) {
      this.logger.log(
        `runner_container_unpause ${JSON.stringify({
          taskId: task.id,
          projectId: task.projectId,
          containerName,
          containerId: existing.id,
        })}`,
      );
      await this.isolatedRunner.unpause(containerName);
      existing = await this.isolatedRunner.inspect(containerName);
    }
    this.logger.log(
      `ensure_runner_container ${JSON.stringify({
        taskId: task.id,
        projectId: task.projectId,
        containerName,
        image: runnerImage,
        worktreePath,
        sandboxProfile,
        platform: runnerPlatform,
        networkMode: this.config.getRunnerNetworkMode(project),
        runtimeExposure: runtimeExposure ?? null,
        existing: existing ?? null,
      })}`,
    );

    if (existing?.running) {
      if (
        existing.image === runnerImage &&
        this.platformMatches(runnerPlatform, existing.platform)
      ) {
        if (trackProjectSlot) {
          const existingSlot = await this.slotRepository.findByTaskId(task.id);
          const derivedAccessMetadata = this.buildAccessMetadata({
            project,
            runtimeExposure,
            previewConfig: resolvedOrchestration.previewConfig,
            publishedPort: this.selectPublishedPort(
              existing.publishedPorts,
              runtimeExposure,
            ),
          });
          const existingAccessMetadata =
            derivedAccessMetadata ??
            (resolvedOrchestration.previewEnabled
              ? (existingSlot?.accessMetadata ?? null)
              : null);
          if (existingAccessMetadata) {
            await this.slotRepository.updateContainerRuntimeByTaskId(task.id, {
              containerId: existing.id,
              accessMetadata: existingAccessMetadata,
            });
            this.logger.log(
              `reuse_runner_container_runtime_metadata ${JSON.stringify({
                taskId: task.id,
                projectId: task.projectId,
                containerName,
                containerId: existing.id,
                accessMetadata: existingAccessMetadata,
                source: derivedAccessMetadata
                  ? 'container_inspect'
                  : existingSlot?.accessMetadata
                    ? 'slot'
                    : 'container_inspect',
              })}`,
            );
          } else {
            await this.slotRepository.updateContainerIdByTaskId(
              task.id,
              existing.id,
            );
            if (resolvedOrchestration.previewEnabled) {
              this.logger.warn(
                `reuse_runner_container_metadata_missing ${JSON.stringify({
                  taskId: task.id,
                  projectId: task.projectId,
                  containerName,
                  containerId: existing.id,
                  runtimeExposure: runtimeExposure ?? null,
                  publishedPorts: existing.publishedPorts,
                })}`,
              );
            }
          }
          this.ensureSlotHeartbeat(task.id);
        }
        this.logger.log(
          `reuse_runner_container ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            containerName,
            containerId: existing.id,
            image: runnerImage,
          })}`,
        );
        return { containerId: existing.id };
      }

      if (existing.image !== runnerImage) {
        this.logger.warn(
          `runner_container_image_mismatch ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            containerName,
            currentImage: existing.image ?? null,
            desiredImage: runnerImage,
            currentPlatform: existing.platform ?? null,
            desiredPlatform: runnerPlatform,
          })}`,
        );
      } else {
        this.logger.warn(
          `runner_container_platform_mismatch ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            containerName,
            image: runnerImage,
            currentPlatform: existing.platform ?? null,
            desiredPlatform: runnerPlatform,
          })}`,
        );
      }
      await this.isolatedRunner.remove(containerName, {
        preserveManagedVolumeTargets: this.preserveManagedVolumeTarget,
      });
    }

    try {
      if (existing && !existing.running) {
        this.logger.warn(
          `runner_container_not_running ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            containerName,
            existing,
            action: 'remove_before_recreate',
          })}`,
        );
        await this.isolatedRunner.remove(containerName, {
          preserveManagedVolumeTargets: this.preserveManagedVolumeTarget,
        });
        existing = null;
      } else if (existing?.running) {
        this.logger.warn(
          `runner_container_replaced ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            containerName,
            previousContainerId: existing.id,
            previousImage: existing.image ?? null,
            image: runnerImage,
          })}`,
        );
      }
      const { containerId, accessMetadata } = await this.startRunnerWithRetries(
        {
          task,
          containerName,
          runnerImage,
          project,
          worktreePath,
          runtimeExposure,
          previewConfig: resolvedOrchestration.previewConfig,
          orchestration: resolvedOrchestration.orchestration,
          coreMode: resolvedOrchestration.coreMode,
        },
      );
      if (trackProjectSlot) {
        if (accessMetadata) {
          await this.slotRepository.updateContainerRuntimeByTaskId(task.id, {
            containerId,
            accessMetadata,
          });
        } else {
          await this.slotRepository.updateContainerIdByTaskId(
            task.id,
            containerId,
          );
        }
        this.ensureSlotHeartbeat(task.id);
      }
      this.logger.log(
        `runner_container_ready ${JSON.stringify({
          taskId: task.id,
          projectId: task.projectId,
          containerName,
          containerId,
          accessMetadata: accessMetadata ?? null,
          trackProjectSlot,
        })}`,
      );
      return { containerId };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start runner container';
      if (trackProjectSlot) {
        await this.releaseSlotAndStopHeartbeat(task.id);
      }
      this.logger.error(
        `runner_container_start_failed ${JSON.stringify({
          taskId: task.id,
          projectId: task.projectId,
          containerName,
          image: runnerImage,
          worktreePath,
          sandboxProfile,
          readinessProbeUrl,
          startTimeoutMs,
          errorMessage: message,
          platform: runnerPlatform,
          trackProjectSlot,
        })}`,
      );
      throw new Error(message);
    }
  }

  async inspectTaskContainer(params: {
    task: Task;
    project: Project;
  }): Promise<InspectTaskContainerResult> {
    const inspection = await this.isolatedRunner.inspect(
      this.config.resolveContainerName(params.task),
    );
    if (!inspection) {
      const slot = await this.slotRepository.findByTaskId(params.task.id);
      if (!slot?.containerId) {
        return {
          kind: 'missing',
          slotState: 'none',
        };
      }

      this.logger.warn(
        `stale_runner_slot_detected ${JSON.stringify({
          taskId: params.task.id,
          projectId: params.task.projectId,
          containerId: slot.containerId,
          action: 'release_slot',
        })}`,
      );
      await this.releaseSlotAndStopHeartbeat(params.task.id);
      return {
        kind: 'missing',
        slotState: 'released-stale',
      };
    }

    if (!inspection.running) {
      const slot = await this.slotRepository.findByTaskId(params.task.id);
      if (slot?.containerId) {
        this.logger.warn(
          `runner_container_not_running_release_slot ${JSON.stringify({
            taskId: params.task.id,
            projectId: params.task.projectId,
            containerId: inspection.id,
            action: 'release_slot',
          })}`,
        );
        await this.releaseSlotAndStopHeartbeat(params.task.id);
        return {
          kind: 'missing',
          slotState: 'released-stale',
        };
      }

      return {
        kind: 'missing',
        slotState: 'none',
      };
    }

    const resolvedOrchestration = await this.resolveRunnerOrchestrationForTask(
      {
        task: params.task,
        project: params.project,
        allowDefaultFallback: true,
      },
      { suppressUnavailableError: true },
    );
    const runtimeExposure = this.resolveRuntimeExposure(
      params.project,
      resolvedOrchestration.previewEnabled,
    );
    const slot = await this.slotRepository.findByTaskId(params.task.id);
    const derivedAccessMetadata = this.buildAccessMetadata({
      project: params.project,
      runtimeExposure,
      previewConfig: resolvedOrchestration.previewConfig,
      publishedPort: this.selectPublishedPort(
        inspection.publishedPorts,
        runtimeExposure,
      ),
    });

    return {
      kind: 'running',
      containerId: inspection.id,
      accessMetadata: derivedAccessMetadata
        ? {
            ...(slot?.accessMetadata ?? {}),
            ...derivedAccessMetadata,
          }
        : (slot?.accessMetadata ?? null),
    };
  }

  async inspectTaskContainerRuntimeState(params: {
    task: Task;
    project: Project;
  }): Promise<TaskContainerRuntimeState> {
    const container = await this.inspectTaskContainer(params);
    if (container.kind !== 'running') {
      return container;
    }

    const resolved = await this.resolveRunnerOrchestrationForTask(
      {
        task: params.task,
        project: params.project,
        allowDefaultFallback: true,
      },
      { suppressUnavailableError: true },
    );

    const runtimeCoreMode =
      container.accessMetadata?.coreMode === TaskEnvironmentCoreMode.coreOnly
        ? TaskEnvironmentCoreMode.coreOnly
        : resolved.coreMode;
    const runtimePreviewConfigured = Boolean(
      container.accessMetadata?.previewConfigured ?? resolved.previewEnabled,
    );
    const runtimePreviewFallbackUsed =
      container.accessMetadata?.previewFallbackUsed ?? false;

    const runtimeReadiness = this.runnerRuntimeReadiness
      ? await this.runnerRuntimeReadiness.assess({
          containerId: container.containerId,
          orchestration: resolved.orchestration,
          previewConfig: resolved.previewConfig,
          previewUrl: container.accessMetadata?.previewUrl ?? null,
          coreMode: runtimeCoreMode,
          previewConfigured: runtimePreviewConfigured,
          previewFallbackUsed: runtimePreviewFallbackUsed,
        })
      : {
          preview: {
            status:
              runtimeCoreMode === TaskEnvironmentCoreMode.coreOnly ||
              !runtimePreviewConfigured ||
              !resolved.previewConfig ||
              !resolved.orchestration
                ? runtimePreviewFallbackUsed
                  ? TaskPreviewStatus.failed
                  : TaskPreviewStatus.unavailable
                : container.accessMetadata?.previewUrl
                  ? TaskPreviewStatus.ready
                  : TaskPreviewStatus.provisioning,
            url: container.accessMetadata?.previewUrl ?? null,
            partial: false,
            reason:
              container.accessMetadata?.previewUrl &&
              runtimeCoreMode !== TaskEnvironmentCoreMode.coreOnly
                ? ('http-ready' as const)
                : runtimePreviewFallbackUsed
                  ? ('failed' as const)
                  : runtimeCoreMode === TaskEnvironmentCoreMode.coreOnly
                    ? ('unavailable' as const)
                    : null,
          },
          serviceStatuses: [],
          routeDiagnostics: [],
        };

    return {
      kind: 'running',
      containerId: container.containerId,
      accessMetadata: container.accessMetadata,
      runtimeReadiness,
    };
  }

  async removeContainerForTask(
    taskId: string,
    projectId: string,
  ): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      this.logger.log(
        `remove_runner_container_task_missing ${JSON.stringify({
          taskId,
          projectId,
          action: 'release_slot_only',
        })}`,
      );
      await this.releaseSlotAndStopHeartbeat(taskId);
      return;
    }

    const containerName = this.config.resolveContainerName(task);
    this.logger.log(
      `remove_runner_container ${JSON.stringify({
        taskId,
        projectId,
        containerName,
      })}`,
    );
    await this.isolatedRunner.remove(containerName, {
      preserveManagedVolumeTargets: this.preserveManagedVolumeTarget,
    });
    await this.releaseSlotAndStopHeartbeat(taskId);
    this.logger.log(
      `remove_runner_container_done ${JSON.stringify({
        taskId,
        projectId,
        containerName,
        slotReleased: true,
      })}`,
    );
  }

  async recoverOrphanContainers(): Promise<void> {
    const allTasks = await this.taskRepository.findAllWithPagination({
      paginationOptions: {
        page: 1,
        limit: 5000,
      },
    });
    const validTaskIds = new Set(
      allTasks
        .filter((task) => task.status !== TaskStatus.done)
        .map((task) => task.id),
    );

    const containers = await this.isolatedRunner.listAinativeContainers();
    const uuidRe =
      /^ainative-task-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

    for (const { name } of containers) {
      const match = uuidRe.exec(name);
      if (!match) {
        continue;
      }
      const taskId = match[1];
      if (!validTaskIds.has(taskId)) {
        this.logger.warn(`Removing orphan runner container ${name}`);
        await this.isolatedRunner.remove(name, {
          preserveManagedVolumeTargets: this.preserveManagedVolumeTarget,
        });
      }
    }
  }

  async recoverExpiredSlots(
    onRecovered?: (slot: {
      taskId: string;
      projectId: string;
    }) => Promise<void>,
  ): Promise<void> {
    const now = new Date();
    const expired = await this.slotRepository.findExpiredSlots(now);
    for (const slot of expired) {
      const task = await this.taskRepository.findById(slot.taskId);
      if (task) {
        const containerName = this.config.resolveContainerName(task);
        await this.isolatedRunner.remove(containerName, {
          preserveManagedVolumeTargets: this.preserveManagedVolumeTarget,
        });
      }
      await this.slotRepository.releaseSlotByTaskId(slot.taskId);
      this.stopSlotHeartbeat(slot.taskId);
      await onRecovered?.({ taskId: slot.taskId, projectId: slot.projectId });
    }
  }

  async resumeActiveSlotsOnStartup(): Promise<void> {
    const now = new Date();
    const slots = await this.slotRepository.findAll();

    for (const slot of slots) {
      const task = await this.taskRepository.findById(slot.taskId);
      if (!task || task.status === TaskStatus.done || slot.expiresAt < now) {
        if (task) {
          await this.isolatedRunner.remove(this.config.resolveContainerName(task), {
            preserveManagedVolumeTargets: this.preserveManagedVolumeTarget,
          });
        }
        await this.releaseSlotAndStopHeartbeat(slot.taskId);
        continue;
      }

      this.ensureSlotHeartbeat(slot.taskId);
      this.logger.log(
        `resume_runner_slot_heartbeat ${JSON.stringify({
          projectId: slot.projectId,
          taskId: slot.taskId,
          expiresAt: slot.expiresAt.toISOString(),
          containerId: slot.containerId ?? null,
        })}`,
      );
    }
  }

  private ensureSlotHeartbeat(taskId: string): void {
    if (this.destroyed) {
      return;
    }
    if (this.slotHeartbeatTimers.has(taskId)) {
      return;
    }

    const intervalMs = this.config.getSlotHeartbeatMs();
    const ttlMs = this.config.getSlotTtlMs();
    const timer = setInterval(() => {
      void this.slotRepository.renewSlotByTaskId(taskId, ttlMs).catch((err) => {
        this.logger.warn(
          `Slot heartbeat failed for task ${taskId}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }, intervalMs);
    timer.unref?.();
    this.slotHeartbeatTimers.set(taskId, timer);
  }

  private stopSlotHeartbeat(taskId: string): void {
    const timer = this.slotHeartbeatTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.slotHeartbeatTimers.delete(taskId);
    }
  }

  private async releaseSlotAndStopHeartbeat(taskId: string): Promise<void> {
    this.stopSlotHeartbeat(taskId);
    await this.slotRepository.releaseSlotByTaskId(taskId);
  }

  private async startRunnerWithRetries(params: {
    task: Task;
    containerName: string;
    runnerImage: string;
    project: Project;
    worktreePath: string;
    runtimeExposure: RuntimeExposure;
    orchestration: RunnerOrchestrationConfig | null;
    coreMode: TaskEnvironmentCoreMode;
    previewConfig: {
      service: string;
      path?: string;
    } | null;
  }): Promise<{
    containerId: string;
    accessMetadata: SlotAccessMetadata | null;
  }> {
    const startupContext = await this.buildRunnerStartupContext(params);
    return this.startRunnerModeWithRetries(params, startupContext, {
      coreMode: params.coreMode,
      runtimeExposure:
        params.coreMode === TaskEnvironmentCoreMode.preview
          ? params.runtimeExposure
          : null,
    });
  }

  private async buildRunnerStartupContext(params: {
    task: Task;
    containerName: string;
    runnerImage: string;
    project: Project;
    worktreePath: string;
    runtimeExposure: RuntimeExposure;
    previewConfig: {
      service: string;
      path?: string;
    } | null;
    orchestration: RunnerOrchestrationConfig | null;
  }): Promise<{
    runnerConfig: ReturnType<
      RunnerOrchestrationService['buildProjectRunnerConfigFile']
    > | null;
    managedVolumePlan: StartupManagedVolumePlan;
    containerEnv: Record<string, string>;
    repositoryGitPath?: string;
  }> {
    const dependencyCacheEnv =
      typeof this.config.getRunnerDependencyCacheEnv === 'function'
        ? this.config.getRunnerDependencyCacheEnv(params.project)
        : {
            PNPM_STORE_DIR: '/var/lib/ainative-runner-cache/pnpm-store',
            npm_config_cache: '/var/lib/ainative-runner-cache/npm-cache',
            YARN_CACHE_FOLDER: '/var/lib/ainative-runner-cache/yarn-cache',
          };
    let runnerConfig =
      this.runnerOrchestration && params.orchestration
        ? this.runnerOrchestration.buildProjectRunnerConfigFileFromOrchestration(
            params.project,
            params.orchestration,
          )
        : null;
    if (runnerConfig) {
      runnerConfig = {
        ...runnerConfig,
        runtime: {
          ...runnerConfig.runtime,
          env: {
            ...(runnerConfig.runtime.env ?? {}),
            ...dependencyCacheEnv,
          },
        },
      };
    }

    const managedVolumeTargets =
      this.runnerOrchestration?.buildManagedVolumeTargetsFromOrchestration(
        this.config.getRunnerWorkspace(),
        params.orchestration,
      ) ??
      this.config.getRunnerManagedVolumeTargets(
        this.config.getRunnerWorkspace(),
        params.project,
      );
    const managedVolumePlan = await this.buildManagedVolumePlan({
      task: params.task,
      project: params.project,
      containerName: params.containerName,
      worktreePath: params.worktreePath,
      targets: managedVolumeTargets,
      orchestration: params.orchestration,
    });
    const previewBridgeUrl = this.config.getPreviewBridgeScriptUrl();
    const containerEnv: Record<string, string> = {
      ...this.config.getRunnerBootstrapEnv(),
      ...dependencyCacheEnv,
      ...this.config.getRunnerEnv(params.project),
      AINATIVE_RUNNER_LISTEN_PORT: String(
        this.config.getRunnerExposeContainerPort(params.project),
      ),
      ...(previewBridgeUrl
        ? { AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL: previewBridgeUrl }
        : {}),
      ...(runnerConfig
        ? {
            AINATIVE_RUNNER_CONFIG_JSON: JSON.stringify(runnerConfig),
          }
        : {}),
    };
    const dbIsolation = (params.project.configJson as Record<string, unknown>)
      ?.databaseIsolation as DatabaseIsolationConfig | undefined;
    if (dbIsolation?.enabled) {
      const taskDbName = `task_${params.task.id}_${dbIsolation.postgres.sourceDatabase}`;
      const adminPassword = (
        params.project.configJson as Record<string, unknown>
      )?.dbIsolationAdminPassword as string;
      await this.dbIsolationService.ensureTaskDatabase(
        dbIsolation,
        adminPassword,
        taskDbName,
        dbIsolation.dataImport?.tables ?? [],
      );
      containerEnv[dbIsolation.envVar] = taskDbName;
    }

    const repositoryGitPath = await this.resolveRepositoryGitPath(
      params.worktreePath,
    );
    return {
      runnerConfig,
      managedVolumePlan,
      containerEnv,
      repositoryGitPath,
    };
  }

  private async startRunnerModeWithRetries(
    params: {
      task: Task;
      containerName: string;
      runnerImage: string;
      project: Project;
      worktreePath: string;
      runtimeExposure: RuntimeExposure;
      previewConfig: {
        service: string;
        path?: string;
      } | null;
    },
    startupContext: {
      runnerConfig: ReturnType<
        RunnerOrchestrationService['buildProjectRunnerConfigFile']
      > | null;
      managedVolumePlan: StartupManagedVolumePlan;
      containerEnv: Record<string, string>;
      repositoryGitPath?: string;
    },
    mode: {
      coreMode: TaskEnvironmentCoreMode;
      runtimeExposure: RuntimeExposure;
    },
  ): Promise<{
    containerId: string;
    accessMetadata: SlotAccessMetadata | null;
  }> {
    const retries = mode.runtimeExposure ? this.maxPortAllocationAttempts : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      const publishedPorts =
        mode.runtimeExposure &&
        this.config.getRunnerNetworkMode(params.project) === 'bridge' &&
        this.config.shouldExposeSandboxPort(params.project)
          ? [
              {
                hostIp: mode.runtimeExposure.bindHostIp,
                hostPort: await this.allocatePublishedPort(
                  mode.runtimeExposure.bindHostIp,
                ),
                containerPort: mode.runtimeExposure.containerPort,
              },
            ]
          : [];

      try {
        const result = await this.isolatedRunner.run({
          containerName: params.containerName,
          image: params.runnerImage,
          worktreePath: params.worktreePath,
          workspaceMount: this.config.getRunnerWorkspace(),
          command:
            this.config.usesSandboxEntrypoint(params.project)
              ? ['/usr/local/bin/ainative-runner-entrypoint']
              : ['sleep', 'infinity'],
          sharedVolumeMounts: this.mergeSharedVolumeMounts([
            ...(startupContext.runnerConfig?.runtime.sharedVolumes ?? []),
            ...this.buildProjectOAuthCredentialVolumeMounts(params.project.id),
          ]),
          managedVolumeMounts: startupContext.managedVolumePlan.mounts,
          readOnlyBindMounts: [],
          env: startupContext.containerEnv,
          cpuLimit: this.config.getRunnerCpuLimit(params.project),
          resourceLimits: this.config.resourceLimitsForProfile(params.project),
          readinessProbeUrl: this.config.getRunnerReadinessProbeUrl(
            params.project,
          ),
          startTimeoutMs: this.config.getRunnerStartTimeoutMs(params.project),
          platform: this.config.getRunnerPlatform(params.project),
          networkMode: this.config.getRunnerNetworkMode(params.project),
          publishedPorts,
          addHostDockerInternalGateway:
            this.config.shouldAddHostDockerInternalGateway(params.project),
          repositoryGitPath: startupContext.repositoryGitPath,
        });

        const mapping = result.publishedPorts[0];
        const baseAccessMetadata =
          mode.coreMode === TaskEnvironmentCoreMode.preview
            ? this.buildAccessMetadata({
                project: params.project,
                runtimeExposure: mode.runtimeExposure,
                previewConfig: params.previewConfig,
                publishedPort: mapping,
              })
            : null;
        return {
          containerId: result.containerId,
          accessMetadata: {
            ...(baseAccessMetadata ?? {}),
            coreMode: mode.coreMode,
            previewConfigured: Boolean(params.previewConfig),
            previewFallbackUsed: false,
          },
        };
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (!this.isPortAllocationError(message) || attempt >= retries - 1) {
          throw error;
        }
        this.logger.warn(
          `runner_container_port_conflict retrying start for ${params.containerName}: ${message}`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to start runner container');
  }

  private async buildManagedVolumePlan(params: {
    task: Task;
    project: Project;
    containerName: string;
    worktreePath: string;
    targets: string[];
    orchestration: RunnerOrchestrationConfig | null;
  }): Promise<StartupManagedVolumePlan> {
    const mounts: ManagedVolumeDescriptor[] = [];
    const taskScopedTargets: string[] = [];
    const sharedNodeModulesEnabled =
      isWorkspaceNativeEnabled(params.project) &&
      this.config.getSandboxProfile(params.project) === 'preview-web' &&
      Boolean(params.orchestration);

    for (const target of params.targets) {
      const sharedRunnerCache = this.buildSharedRunnerCacheVolumeMount({
        task: params.task,
        project: params.project,
        target,
      });
      if (sharedRunnerCache) {
        mounts.push(sharedRunnerCache);
        continue;
      }
      const sharedDescriptor = sharedNodeModulesEnabled
        ? await this.buildSharedNodeModulesVolumeMount({
            task: params.task,
            project: params.project,
            worktreePath: params.worktreePath,
            target,
            orchestration: params.orchestration,
          })
        : null;
      if (sharedDescriptor) {
        mounts.push(sharedDescriptor);
        continue;
      }
      taskScopedTargets.push(target);
      mounts.push(
        this.buildTaskScopedManagedVolumeMount(
          params.task,
          params.containerName,
          target,
        ),
      );
    }

    return { mounts, taskScopedTargets };
  }

  private buildSharedRunnerCacheVolumeMount(params: {
    task: Task;
    project: Project;
    target: string;
  }): ManagedVolumeDescriptor | null {
    if (params.target !== '/var/lib/ainative-runner-cache') {
      return null;
    }
    const runtimePlatform =
      this.config.getRunnerPlatform(params.project)?.trim() || 'default';
    const digest = createHash('sha1')
      .update(params.task.projectId)
      .update('\0')
      .update(runtimePlatform)
      .digest('hex')
      .slice(0, 24);
    return {
      name: `ainative-runner-cache-${digest}`,
      target: params.target,
      preserveOnCleanup: true,
      labels: {
        'ainative.runner-managed': 'true',
        'ainative.cache-kind': 'runner-cache',
        'ainative.project-id': params.task.projectId,
        'ainative.task-id': params.task.id,
        'ainative.mount-target': params.target,
        'ainative.runtime-platform': runtimePlatform,
      },
    };
  }

  private buildTaskScopedManagedVolumeMount(
    task: Task,
    containerName: string,
    target: string,
  ): ManagedVolumeDescriptor {
    return {
      name: this.buildManagedVolumeName(containerName, target),
      target,
      labels: {
        'ainative.runner-managed': 'true',
        'ainative.container-name': containerName,
        'ainative.project-id': task.projectId,
        'ainative.task-id': task.id,
        'ainative.mount-target': target,
      },
    };
  }

  private async buildSharedNodeModulesVolumeMount(params: {
    task: Task;
    project: Project;
    worktreePath: string;
    target: string;
    orchestration: RunnerOrchestrationConfig | null;
  }): Promise<ManagedVolumeDescriptor | null> {
    if (!params.target.endsWith('/node_modules') || !params.orchestration) {
      return null;
    }

    const workspaceMount = this.config.getRunnerWorkspace().replace(/\/+$/, '');
    const relativeTarget = params.target
      .replace(new RegExp(`^${workspaceMount}`), '')
      .replace(/^\/+/, '')
      .replace(/\/node_modules$/, '');
    if (!relativeTarget) {
      return null;
    }

    const service = params.orchestration.services.find((item) => {
      const workdir = item.workdir.replace(/^\/+/, '').replace(/\/+$/, '');
      return (
        workdir === relativeTarget &&
        this.isNodeInstallCommand(item.installCommand ?? '')
      );
    });
    if (!service) {
      return null;
    }

    const lockfileInfo = await this.resolveNodeDependencyCacheKey({
      worktreePath: params.worktreePath,
      serviceWorkdir: service.workdir,
    });
    if (!lockfileInfo) {
      return null;
    }

    const runtimePlatform =
      this.config.getRunnerPlatform(params.project)?.trim() || 'default';
    const repoPrefix = this.extractRepoPrefixFromWorkdir(service.workdir);
    const digest = createHash('sha1')
      .update(params.task.projectId)
      .update('\0')
      .update(repoPrefix)
      .update('\0')
      .update(lockfileInfo.packageManager)
      .update('\0')
      .update(lockfileInfo.lockfileDigest)
      .update('\0')
      .update(runtimePlatform)
      .digest('hex')
      .slice(0, 24);

    return {
      name: `ainative-deps-${digest}`,
      target: params.target,
      preserveOnCleanup: true,
      labels: {
        'ainative.runner-managed': 'true',
        'ainative.cache-kind': 'node_modules',
        'ainative.project-id': params.task.projectId,
        'ainative.task-id': params.task.id,
        'ainative.mount-target': params.target,
        'ainative.repo-prefix': repoPrefix,
        'ainative.lockfile-digest': lockfileInfo.lockfileDigest,
        'ainative.runtime-platform': runtimePlatform,
        'ainative.package-manager': lockfileInfo.packageManager,
      },
    };
  }

  private async resolveNodeDependencyCacheKey(params: {
    worktreePath: string;
    serviceWorkdir: string;
  }): Promise<
    | {
        packageManager: 'pnpm' | 'yarn' | 'npm';
        lockfileDigest: string;
      }
    | null
  > {
    const workdir = path.join(
      params.worktreePath,
      params.serviceWorkdir.replace(/^\/+/, ''),
    );
    const candidates: Array<{
      fileName: string;
      packageManager: 'pnpm' | 'yarn' | 'npm';
    }> = [
      { fileName: 'pnpm-lock.yaml', packageManager: 'pnpm' },
      { fileName: 'yarn.lock', packageManager: 'yarn' },
      { fileName: 'package-lock.json', packageManager: 'npm' },
    ];
    for (const candidate of candidates) {
      try {
        const content = await fs.readFile(
          path.join(workdir, candidate.fileName),
          'utf-8',
        );
        const lockfileDigest = createHash('sha1')
          .update(content)
          .digest('hex')
          .slice(0, 24);
        return {
          packageManager: candidate.packageManager,
          lockfileDigest,
        };
      } catch {
        continue;
      }
    }
    return null;
  }

  private isNodeInstallCommand(command: string): boolean {
    const normalized = command.trim().toLowerCase();
    return (
      normalized.startsWith('pnpm ') ||
      normalized.startsWith('npm ') ||
      normalized.startsWith('yarn ')
    );
  }

  private extractRepoPrefixFromWorkdir(workdir: string): string {
    return (
      workdir
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean)[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-') || 'workspace'
    );
  }

  private buildProjectOAuthCredentialVolumeMounts(projectId: string): {
    name: string;
    target: string;
  }[] {
    return [
      {
        name: this.buildProjectOAuthCredentialVolumeName(projectId),
        target: '/root',
      },
    ];
  }

  private mergeSharedVolumeMounts<T extends { name: string; target: string }>(
    mounts: T[],
  ): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const mount of mounts) {
      const key = `${mount.name}:${mount.target}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(mount);
    }
    return result;
  }

  private buildProjectOAuthCredentialVolumeName(projectId: string): string {
    const digest = createHash('sha1')
      .update(projectId)
      .digest('hex')
      .slice(0, 24);
    return `ainative-oauth-mcp-${digest}`;
  }

  private buildManagedVolumeName(
    containerName: string,
    target: string,
  ): string {
    const normalizedTarget =
      target
        .trim()
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) =>
          segment
            .toLowerCase()
            .replace(/[^a-z0-9_.-]+/g, '-')
            .replace(/^-+|-+$/g, ''),
        )
        .filter(Boolean)
        .join('-') || 'workspace';

    return `${containerName}-${normalizedTarget}`;
  }

  private preserveManagedVolumeTarget = (
    target: string,
    _labels?: Record<string, string> | null,
  ): boolean => {
    return (
      target.endsWith('/node_modules') ||
      target === '/var/lib/ainative-runner-cache'
    );
  };

  private resolveRuntimeExposure(
    project: Project,
    previewEnabled: boolean,
  ): RuntimeExposure {
    if (!previewEnabled || !this.config.shouldExposeSandboxPort(project)) {
      return null;
    }
    return {
      bindHostIp:
        this.config.getRunnerNetworkMode(project) === 'bridge'
          ? '0.0.0.0'
          : this.config.getRunnerExposeHostIp(project),
      advertisedHostIp: this.config.getRunnerExposeHostIp(project),
      containerPort: this.config.getRunnerExposeContainerPort(project),
    };
  }

  private platformMatches(
    desiredPlatform: string | null,
    actualPlatform: string | null,
  ): boolean {
    if (!desiredPlatform) {
      return true;
    }

    const desired = desiredPlatform.trim().toLowerCase();
    const actual = actualPlatform?.trim().toLowerCase() ?? '';
    if (!actual) {
      return false;
    }

    return actual === desired || actual.startsWith(`${desired}/`);
  }

  private buildAccessMetadata(params: {
    project: Project;
    runtimeExposure: RuntimeExposure;
    previewConfig: {
      service: string;
      path?: string;
    } | null;
    publishedPort?: {
      hostIp: string;
      hostPort: number;
      containerPort: number;
    };
  }): SlotAccessMetadata | null {
    if (!params.runtimeExposure || !params.previewConfig) {
      return null;
    }

    const networkMode = this.config.getRunnerNetworkMode(params.project);
    const hostIp =
      params.runtimeExposure.advertisedHostIp ||
      params.publishedPort?.hostIp ||
      null;
    const hostPort =
      networkMode === 'host'
        ? params.runtimeExposure.containerPort
        : (params.publishedPort?.hostPort ?? null);
    const containerPort =
      networkMode === 'host'
        ? params.runtimeExposure.containerPort
        : (params.publishedPort?.containerPort ??
          params.runtimeExposure.containerPort);

    if (!hostIp || !hostIp.trim()) {
      return null;
    }
    if (!hostPort || !Number.isFinite(hostPort) || hostPort <= 0) {
      return null;
    }
    if (
      !containerPort ||
      !Number.isFinite(containerPort) ||
      containerPort <= 0
    ) {
      return null;
    }

    const normalizedHostIp = hostIp.trim();
    const normalizedHostPort = Math.floor(hostPort);
    const normalizedContainerPort = Math.floor(containerPort);
    const previewBaseUrl = this.config.getPreviewBaseUrl?.() ?? null;
    const previewUrl = buildPreviewUrl({
      previewBaseUrl,
      hostIp: normalizedHostIp,
      hostPort: normalizedHostPort,
      previewPath: params.previewConfig.path,
    });
    if (!previewUrl) {
      return null;
    }

    this.logPreviewUrlFallback(previewBaseUrl, previewUrl);

    return {
      hostIp: normalizedHostIp,
      hostPort: normalizedHostPort,
      containerPort: normalizedContainerPort,
      previewUrl: previewUrl.previewUrl,
      networkMode,
    };
  }

  private logPreviewUrlFallback(
    previewBaseUrl: string | null,
    previewUrl: ReturnType<typeof buildPreviewUrl>,
  ): void {
    if (!previewUrl) {
      return;
    }

    if (previewUrl.ignoredPath && !this.previewBaseUrlIgnoredPathWarned) {
      this.previewBaseUrlIgnoredPathWarned = true;
      this.logger.warn(
        `preview_base_url_path_ignored ${JSON.stringify({
          previewBaseUrl,
        })}`,
      );
    }

    if (previewUrl.source !== 'host-ip') {
      return;
    }

    if (previewBaseUrl?.trim()) {
      if (!this.previewBaseUrlInvalidWarned) {
        this.previewBaseUrlInvalidWarned = true;
        this.logger.warn(
          `preview_base_url_invalid ${JSON.stringify({
            previewBaseUrl,
          })}`,
        );
      }
      return;
    }

    if (!this.previewBaseUrlMissingWarned) {
      this.previewBaseUrlMissingWarned = true;
      this.logger.warn('preview_base_url_missing using hostIp fallback');
    }
  }

  private selectPublishedPort(
    publishedPorts: Array<{
      hostIp: string;
      hostPort: number;
      containerPort: number;
    }> = [],
    runtimeExposure: RuntimeExposure,
  ):
    | {
        hostIp: string;
        hostPort: number;
        containerPort: number;
      }
    | undefined {
    if (!publishedPorts.length) {
      return undefined;
    }

    const expectedContainerPort = runtimeExposure?.containerPort ?? null;
    if (!expectedContainerPort) {
      return publishedPorts[0];
    }

    return (
      publishedPorts.find(
        (mapping) => mapping.containerPort === expectedContainerPort,
      ) ?? publishedPorts[0]
    );
  }

  private async allocatePublishedPort(hostIp: string): Promise<number> {
    const range = this.config.getRunnerExposePortRange();
    const size = range.end - range.start + 1;
    if (size <= 0) {
      throw new Error(
        `Invalid runner expose port range: ${range.start}-${range.end}`,
      );
    }

    const startOffset = Math.floor(Math.random() * size);
    for (let index = 0; index < size; index += 1) {
      const port = range.start + ((startOffset + index) % size);
      const available = await this.isPortAvailable(hostIp, port);
      if (available) {
        return port;
      }
    }
    throw new Error(
      `No available host port in range ${range.start}-${range.end}`,
    );
  }

  private async isPortAvailable(
    hostIp: string,
    port: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.once('error', () => resolve(false));
      server.listen(port, hostIp, () => {
        server.close(() => resolve(true));
      });
    });
  }

  private isPortAllocationError(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
      normalized.includes('port is already allocated') ||
      normalized.includes('address already in use')
    );
  }

  async resolvePreviewConfigForTask(params: {
    task: Task;
    project: Project;
    allowDefaultFallback?: boolean;
    suppressUnavailableError?: boolean;
  }): Promise<{
    service: string;
    path?: string;
  } | null> {
    const resolved = await this.resolveRunnerOrchestrationForTask({
      ...params,
      allowDefaultFallback: params.allowDefaultFallback ?? true,
    }, {
      suppressUnavailableError: params.suppressUnavailableError,
    });
    return resolved.previewConfig;
  }

  private async resolveRunnerOrchestrationForTask(params: {
    task: Task;
    project: Project;
    allowDefaultFallback: boolean;
  }, options?: {
    suppressUnavailableError?: boolean;
  }): Promise<ResolvedRunnerOrchestrationResult> {
    if (!this.runnerOrchestration) {
      return {
        orchestration: null,
        source: 'default',
        previewConfig: null,
        previewEnabled: false,
        coreMode: TaskEnvironmentCoreMode.coreOnly,
        warnings: [],
      };
    }

    if (!isWorkspaceNativeEnabled(params.project)) {
      const orchestration = params.allowDefaultFallback
        ? this.runnerOrchestration.buildEffectiveOrchestration(params.project)
        : this.runnerOrchestration.readConfiguredOrchestration(params.project);
      return this.buildResolvedOrchestrationResult({
        orchestration,
        source: 'default',
      });
    }

    const warnings: string[] = [];
    const taskSnapshot = this.readTaskRunnerSnapshot(params.task, params.project);
    if (taskSnapshot) {
      return this.buildResolvedOrchestrationResult({
        orchestration: taskSnapshot,
        source: 'taskSnapshot',
        warnings,
      });
    }

    const projectSnapshot = this.readProjectRunnerSnapshot(
      params.project,
      warnings,
    );
    if (projectSnapshot) {
      this.logger.warn(
        `workspace_native_runner_using_project_config ${JSON.stringify({
          taskId: params.task.id,
          projectId: params.project.id,
        })}`,
      );
      return this.buildResolvedOrchestrationResult({
        orchestration: projectSnapshot,
        source: 'projectConfig',
        warnings,
      });
    }

    const businessLineSnapshot = await this.readBusinessLineRunnerSnapshot(
      params.project.businessLineId,
      params.project,
      warnings,
    );
    if (businessLineSnapshot) {
      this.logger.warn(
        `workspace_native_runner_using_business_line_cache ${JSON.stringify({
          taskId: params.task.id,
          projectId: params.project.id,
          businessLineId: params.project.businessLineId,
        })}`,
      );
      return this.buildResolvedOrchestrationResult({
        orchestration: businessLineSnapshot,
        source: 'businessLineCache',
        warnings,
      });
    }

    const coreOnly = this.buildCoreOnlyOrchestration();
    const fallbackReason =
      this.describeWorkspaceRunnerUnavailableReason(params.project) ??
      'Workspace-native preview orchestration unavailable; falling back to core-only runner mode.';
    warnings.push(fallbackReason);
    this.logger.warn(
      `workspace_native_runner_fallback_core_only ${JSON.stringify({
        taskId: params.task.id,
        projectId: params.project.id,
        reason: fallbackReason,
      })}`,
    );
    if (!options?.suppressUnavailableError) {
      return this.buildResolvedOrchestrationResult({
        orchestration: coreOnly,
        source: 'coreOnly',
        warnings,
      });
    }
    return this.buildResolvedOrchestrationResult({
      orchestration: coreOnly,
      source: 'coreOnly',
      warnings,
    });
  }

  private readTaskRunnerSnapshot(
    task: Task,
    project: Project,
  ): RunnerOrchestrationConfig | null {
    const runnerState = this.toObjectRecord(
      (task.configJson as Record<string, unknown> | null | undefined)?.runner,
    );
    if (runnerState?.status !== 'ready') {
      return null;
    }

    const snapshot =
      this.runnerOrchestration?.normalizeConfigSnapshot(
        this.toObjectRecord(runnerState.configSnapshot),
      ) ?? null;
    if (!snapshot) {
      return null;
    }
    if (
      this.isRunnablePreviewOrchestration(
        snapshot as Record<string, unknown>,
        project,
      )
    ) {
      return snapshot;
    }
    const freshness = assessRunnerSnapshotFreshness({
      runnerOrchestration: snapshot as Record<string, unknown>,
      subRepos: resolveSubRepoConfigs(project.configJson),
    });
    this.logger.warn(
      `workspace_native_task_runner_snapshot_stale ${JSON.stringify({
        taskId: task.id,
        projectId: project.id,
        reasons: freshness.reasons,
      })}`,
    );
    return null;
  }

  private readProjectRunnerSnapshot(
    project: Project,
    warnings?: string[],
  ): RunnerOrchestrationConfig | null {
    if (!this.runnerOrchestration) {
      return null;
    }
    const projectConfig = (project.configJson ?? {}) as Record<string, unknown>;
    const containerRuntime = this.toObjectRecord(projectConfig.containerRuntime);
    const orchestration = this.toObjectRecord(containerRuntime?.runnerOrchestration);
    if (!orchestration) {
      return null;
    }
    const snapshot = this.runnerOrchestration.normalizeConfigSnapshot(orchestration);
    if (!snapshot) {
      return null;
    }
    if (
      !this.isRunnablePreviewOrchestration(
        snapshot as Record<string, unknown>,
        project,
      )
    ) {
      const freshness = assessRunnerSnapshotFreshness({
        runnerOrchestration: snapshot as Record<string, unknown>,
        subRepos: resolveSubRepoConfigs(project.configJson),
      });
      warnings?.push(
        `projectConfig stale: ${freshness.reasons.join(', ') || 'unknown'}`,
      );
      this.logger.warn(
        `workspace_native_project_runner_snapshot_stale ${JSON.stringify({
          projectId: project.id,
          reasons: freshness.reasons,
        })}`,
      );
      return null;
    }
    return snapshot;
  }

  private readTaskRunnerFingerprint(task: Task): string | null {
    const runnerState = this.toObjectRecord(
      (task.configJson as Record<string, unknown> | null | undefined)?.runner,
    );
    const fingerprint = runnerState?.fingerprint;
    return typeof fingerprint === 'string' && fingerprint.trim()
      ? fingerprint.trim()
      : null;
  }

  private async readBusinessLineRunnerSnapshot(
    businessLineId: string,
    project?: Project,
    warnings?: string[],
  ): Promise<RunnerOrchestrationConfig | null> {
    if (!this.businessLineRepository || !this.runnerOrchestration) {
      return null;
    }

    const businessLine =
      await this.businessLineRepository.findById(businessLineId);
    const config = (businessLine?.configJson ??
      {}) as Partial<BusinessLineWorkspaceConfig>;
    const status = config.runnerConfigStatus ?? '';
    if (status !== 'ready') {
      warnings?.push(`businessLineCache status=${status || 'unknown'}`);
      return null;
    }
    const meta = this.toObjectRecord(
      config.runnerConfigCacheMeta,
    ) as RunnerConfigCacheMeta | null;
    const snapshot = this.runnerOrchestration.normalizeConfigSnapshot(
      this.toObjectRecord(config.runnerConfigCache),
    );
    if (!snapshot || !project) {
      return snapshot;
    }
    if (
      !this.isRunnablePreviewOrchestration(
        {
          ...(snapshot as Record<string, unknown>),
          generatedMeta: {
            ...(this.readGeneratedMeta(snapshot as Record<string, unknown>) ?? {}),
            ...(meta ?? {}),
          },
        },
        project,
      )
    ) {
      const freshness = assessRunnerSnapshotFreshness({
        runnerOrchestration: snapshot as Record<string, unknown>,
        subRepos: resolveSubRepoConfigs(project.configJson),
      });
      warnings?.push(
        `businessLineCache stale: ${freshness.reasons.join(', ') || 'unknown'}`,
      );
      return null;
    }
    if (meta?.verificationStatus && meta.verificationStatus !== 'passed') {
      warnings?.push(`businessLineCache verification=${meta.verificationStatus}`);
    }
    if (meta?.coverageStatus && meta.coverageStatus !== 'valid') {
      warnings?.push(`businessLineCache coverage=${meta.coverageStatus}`);
    }
    return snapshot;
  }

  private describeWorkspaceRunnerUnavailableReason(
    project: Project,
  ): string | null {
    const projectConfig = (project.configJson ?? {}) as Record<string, unknown>;
    const containerRuntime = this.toObjectRecord(projectConfig.containerRuntime);
    const orchestration = this.toObjectRecord(containerRuntime?.runnerOrchestration);
    if (orchestration) {
      const freshness = assessRunnerSnapshotFreshness({
        runnerOrchestration: orchestration,
        subRepos: resolveSubRepoConfigs(project.configJson),
      });
      const meta = this.readGeneratedMeta(orchestration);
      if (freshness.state !== 'usable') {
        if (meta?.verificationStatus && meta.verificationStatus !== 'passed') {
          return 'Runner 配置未通过验证，将以 core-only 模式启动；可通过重置配置恢复预览编排。';
        }
        if (meta?.coverageStatus && meta.coverageStatus !== 'valid') {
          return 'Runner 配置覆盖不完整，将以 core-only 模式启动；可通过重置配置恢复预览编排。';
        }
        return '任务 Runner 配置结构已过期，将以 core-only 模式启动；可通过重置配置恢复预览编排。';
      }
    }
    return '任务创建时未生成可用预览编排，将以 core-only 模式启动；可通过重置配置恢复预览编排。';
  }

  private buildResolvedOrchestrationResult(params: {
    orchestration: RunnerOrchestrationConfig | null;
    source: RunnerOrchestrationSource;
    warnings?: string[];
  }): ResolvedRunnerOrchestrationResult {
    const previewConfig =
      this.runnerOrchestration?.resolvePreviewConfigFromOrchestration(
        params.orchestration,
      ) ?? null;
    const previewEnabled = Boolean(
      params.orchestration?.services?.length && previewConfig,
    );
    return {
      orchestration: params.orchestration,
      source: params.source,
      previewConfig: previewEnabled ? previewConfig : null,
      previewEnabled,
      coreMode: previewEnabled
        ? TaskEnvironmentCoreMode.preview
        : TaskEnvironmentCoreMode.coreOnly,
      warnings: params.warnings ?? [],
    };
  }

  private buildCoreOnlyOrchestration(): RunnerOrchestrationConfig {
    return {
      services: [],
      routes: [],
    };
  }

  private isRunnablePreviewOrchestration(
    orchestration: Record<string, unknown>,
    project: Project,
  ): boolean {
    if (orchestration.manuallyLocked === true) {
      return Array.isArray(orchestration.services) && orchestration.services.length > 0;
    }
    const freshness = assessRunnerSnapshotFreshness({
      runnerOrchestration: orchestration,
      subRepos: resolveSubRepoConfigs(project.configJson),
    });
    return (
      Array.isArray(orchestration.services) &&
      orchestration.services.length > 0 &&
      !freshness.reasons.includes('subrepo-fingerprint-mismatch')
    );
  }

  private readGeneratedMeta(
    orchestration: Record<string, unknown>,
  ): RunnerConfigCacheMeta | null {
    return this.toObjectRecord(orchestration.generatedMeta) as
      | RunnerConfigCacheMeta
      | null;
  }

  private toObjectRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private async resolveRepositoryGitPath(
    worktreePath: string,
  ): Promise<string | undefined> {
    try {
      const content = await fs.readFile(
        path.join(worktreePath, '.git'),
        'utf-8',
      );
      const match = content.match(/^gitdir:\s*(.+)$/m);
      if (!match) return undefined;
      // gitdir points to e.g. /repo/.git/worktrees/wk-xxx
      // Go up two levels to get the main .git directory: /repo/.git
      return path.dirname(path.dirname(match[1].trim()));
    } catch {
      // .git is a directory (this is the main repo, not a worktree) or unreadable
      return undefined;
    }
  }
}

type RuntimeExposure = {
  bindHostIp: string;
  advertisedHostIp: string;
  containerPort: number;
} | null;
