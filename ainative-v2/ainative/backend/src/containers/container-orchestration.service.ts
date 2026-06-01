import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createServer } from 'net';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { DatabaseIsolationService } from './database-isolation.service';
import {
  IsolatedRunnerContainerService,
  RunnerManagedVolumeMount,
} from './isolated-runner-container.service';
import { SlotAccessMetadata } from './domain/project-execution-slot';
import { ProjectExecutionSlotRepository } from './infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { buildPreviewUrl } from './preview-url';
import { ProjectRunnerImageService } from './project-runner-image.service';
import { RunnerOrchestrationService } from './runner-orchestration.service';
import { DatabaseIsolationConfig } from './types/database-isolation.types';

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
    const previewConfig = this.resolvePreviewConfig(project);
    const runtimeExposure = this.resolveRuntimeExposure(
      project,
      Boolean(previewConfig),
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
            previewConfig,
            publishedPort: this.selectPublishedPort(
              existing.publishedPorts,
              runtimeExposure,
            ),
          });
          const existingAccessMetadata =
            derivedAccessMetadata ??
            (previewConfig ? (existingSlot?.accessMetadata ?? null) : null);
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
            if (previewConfig) {
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
      await this.isolatedRunner.remove(containerName);
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
        await this.isolatedRunner.remove(containerName);
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
          previewConfig,
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
  }): Promise<{
    containerId: string;
    running: boolean;
    paused: boolean;
    accessMetadata: SlotAccessMetadata | null;
  } | null> {
    const inspection = await this.isolatedRunner.inspect(
      this.config.resolveContainerName(params.task),
    );
    if (!inspection) {
      const slot = await this.slotRepository.findByTaskId(params.task.id);
      if (!slot?.containerId) {
        return null;
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
      return null;
    }

    const previewConfig = this.resolvePreviewConfig(params.project);
    const runtimeExposure = this.resolveRuntimeExposure(
      params.project,
      Boolean(previewConfig),
    );

    return {
      containerId: inspection.id,
      running: inspection.running,
      paused: inspection.paused,
      accessMetadata: this.buildAccessMetadata({
        project: params.project,
        runtimeExposure,
        previewConfig,
        publishedPort: this.selectPublishedPort(
          inspection.publishedPorts,
          runtimeExposure,
        ),
      }),
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
    await this.isolatedRunner.remove(containerName);
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
        await this.isolatedRunner.remove(name);
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
        await this.isolatedRunner.remove(containerName);
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
          await this.isolatedRunner.remove(
            this.config.resolveContainerName(task),
          );
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
    previewConfig: {
      service: string;
      path?: string;
    } | null;
  }): Promise<{
    containerId: string;
    accessMetadata: SlotAccessMetadata | null;
  }> {
    const retries = params.runtimeExposure ? this.maxPortAllocationAttempts : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      const publishedPorts =
        params.runtimeExposure &&
        this.config.getRunnerNetworkMode(params.project) === 'bridge' &&
        this.config.shouldExposeSandboxPort(params.project)
          ? [
              {
                hostIp: params.runtimeExposure.bindHostIp,
                hostPort: await this.allocatePublishedPort(
                  params.runtimeExposure.bindHostIp,
                ),
                containerPort: params.runtimeExposure.containerPort,
              },
            ]
          : [];

      try {
        const runnerConfig =
          this.runnerOrchestration?.buildProjectRunnerConfigFile(
            params.project,
          ) ?? null;
        const managedVolumeTargets =
          this.runnerOrchestration?.buildManagedVolumeTargets(
            this.config.getRunnerWorkspace(),
            params.project,
          ) ??
          this.config.getRunnerManagedVolumeTargets(
            this.config.getRunnerWorkspace(),
            params.project,
          );
        const previewBridgeUrl = this.config.getPreviewBridgeScriptUrl();
        const containerEnv = {
          ...this.config.getRunnerBootstrapEnv(),
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
        const dbIsolation = (
          params.project.configJson as Record<string, unknown>
        )?.databaseIsolation as DatabaseIsolationConfig | undefined;
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
        const result = await this.isolatedRunner.run({
          containerName: params.containerName,
          image: params.runnerImage,
          worktreePath: params.worktreePath,
          workspaceMount: this.config.getRunnerWorkspace(),
          command: this.config.usesSandboxEntrypoint(params.project)
            ? ['/usr/local/bin/ainative-runner-entrypoint']
            : ['sleep', 'infinity'],
          sharedVolumeMounts: this.mergeSharedVolumeMounts([
            ...(runnerConfig?.runtime.sharedVolumes ?? []),
            ...this.buildProjectOAuthCredentialVolumeMounts(params.project.id),
          ]),
          managedVolumeMounts: this.buildManagedVolumeMounts({
            task: params.task,
            containerName: params.containerName,
            targets: managedVolumeTargets,
          }),
          readOnlyBindMounts: [],
          env: containerEnv,
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
          repositoryGitPath,
        });
        const mapping = result.publishedPorts[0];
        return {
          containerId: result.containerId,
          accessMetadata: this.buildAccessMetadata({
            project: params.project,
            runtimeExposure: params.runtimeExposure,
            previewConfig: params.previewConfig,
            publishedPort: mapping,
          }),
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

  private buildManagedVolumeMounts(params: {
    task: Task;
    containerName: string;
    targets: string[];
  }): RunnerManagedVolumeMount[] {
    return params.targets.map((target) => ({
      name: this.buildManagedVolumeName(params.containerName, target),
      target,
      labels: {
        'ainative.runner-managed': 'true',
        'ainative.container-name': params.containerName,
        'ainative.project-id': params.task.projectId,
        'ainative.task-id': params.task.id,
        'ainative.mount-target': target,
      },
    }));
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

  private resolvePreviewConfig(project: Project) {
    return this.runnerOrchestration?.resolvePreviewConfig(project) ?? null;
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
