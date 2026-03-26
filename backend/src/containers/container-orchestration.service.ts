import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createServer } from 'net';
import { Task } from '../tasks/domain/task';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { IsolatedRunnerContainerService } from './isolated-runner-container.service';
import { SlotAccessMetadata } from './domain/project-execution-slot';
import { ProjectExecutionSlotRepository } from './infrastructure/persistence/relational/repositories/project-execution-slot.repository';

@Injectable()
export class ContainerOrchestrationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContainerOrchestrationService.name);
  private readonly slotHeartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly maxPortAllocationAttempts = 8;
  private destroyed = false;

  constructor(
    private readonly config: ContainerExecutionConfigService,
    private readonly isolatedRunner: IsolatedRunnerContainerService,
    private readonly slotRepository: ProjectExecutionSlotRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  onModuleInit(): void {
    if (!this.config.isDockerMode()) {
      return;
    }
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
    worktreePath: string;
  }): Promise<{ containerId: string } | null> {
    if (!this.config.isDockerMode()) {
      return null;
    }

    const { task, worktreePath } = params;
    const containerName = this.config.resolveContainerName(task);
    const runtimeExposure = this.resolveRuntimeExposure();
    const existing = await this.isolatedRunner.inspect(containerName);
    this.logger.log(
      `ensure_runner_container ${JSON.stringify({
        taskId: task.id,
        projectId: task.projectId,
        containerName,
        image: this.config.getRunnerImage(),
        worktreePath,
        sandboxProfile: this.config.getSandboxProfile(),
        existing: existing ?? null,
      })}`,
    );

    if (existing?.running) {
      await this.slotRepository.updateContainerId(task.projectId, existing.id);
      this.ensureSlotHeartbeat(task.projectId);
      this.logger.log(
        `reuse_runner_container ${JSON.stringify({
          taskId: task.id,
          projectId: task.projectId,
          containerName,
          containerId: existing.id,
        })}`,
      );
      return { containerId: existing.id };
    }

    try {
      if (existing && !existing.running) {
        this.logger.warn(
          `runner_container_not_running ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            containerName,
            existing,
          })}`,
        );
      }
      const { containerId, accessMetadata } = await this.startRunnerWithRetries(
        {
          containerName,
          worktreePath,
          runtimeExposure,
        },
      );
      if (accessMetadata) {
        await this.slotRepository.updateContainerRuntime(task.projectId, {
          containerId,
          accessMetadata,
        });
      } else {
        await this.slotRepository.updateContainerId(
          task.projectId,
          containerId,
        );
      }
      this.ensureSlotHeartbeat(task.projectId);
      this.logger.log(
        `runner_container_ready ${JSON.stringify({
          taskId: task.id,
          projectId: task.projectId,
          containerName,
          containerId,
          accessMetadata: accessMetadata ?? null,
        })}`,
      );
      return { containerId };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start runner container';
      await this.releaseSlotAndStopHeartbeat(task.projectId);
      this.logger.error(
        `runner_container_start_failed ${JSON.stringify({
          taskId: task.id,
          projectId: task.projectId,
          containerName,
          image: this.config.getRunnerImage(),
          worktreePath,
          sandboxProfile: this.config.getSandboxProfile(),
          readinessProbeUrl: this.config.getRunnerReadinessProbeUrl(),
          startTimeoutMs: this.config.getRunnerStartTimeoutMs(),
          errorMessage: message,
        })}`,
      );
      if (this.config.isStrictMode()) {
        throw new Error(message);
      }
      this.logger.warn(
        `Docker runner start failed; strict mode off — falling back to host execution: ${message}`,
      );
      return null;
    }
  }

  async removeContainerForTask(
    taskId: string,
    projectId: string,
  ): Promise<void> {
    if (!this.config.isDockerMode()) {
      return;
    }

    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      await this.releaseSlotAndStopHeartbeat(projectId);
      return;
    }

    const containerName = this.config.resolveContainerName(task);
    await this.isolatedRunner.remove(containerName);
    await this.releaseSlotAndStopHeartbeat(projectId);
  }

  async recoverOrphanContainers(): Promise<void> {
    if (!this.config.isDockerMode()) {
      return;
    }

    const slots = await this.slotRepository.findAll();
    const now = new Date();
    const validTaskIds = new Set(
      slots.filter((s) => s.expiresAt >= now).map((s) => s.taskId),
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
    if (!this.config.isDockerMode()) {
      return;
    }

    const now = new Date();
    const expired = await this.slotRepository.findExpiredSlots(now);
    for (const slot of expired) {
      const task = await this.taskRepository.findById(slot.taskId);
      if (task) {
        const containerName = this.config.resolveContainerName(task);
        await this.isolatedRunner.remove(containerName);
      }
      await this.slotRepository.releaseSlot(slot.projectId);
      this.stopSlotHeartbeat(slot.projectId);
      await onRecovered?.({ taskId: slot.taskId, projectId: slot.projectId });
    }
  }

  async resumeActiveSlotsOnStartup(): Promise<void> {
    if (!this.config.isDockerMode()) {
      return;
    }

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
        await this.releaseSlotAndStopHeartbeat(slot.projectId);
        continue;
      }

      this.ensureSlotHeartbeat(slot.projectId);
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

  private ensureSlotHeartbeat(projectId: string): void {
    if (this.destroyed) {
      return;
    }
    if (this.slotHeartbeatTimers.has(projectId)) {
      return;
    }

    const intervalMs = this.config.getSlotHeartbeatMs();
    const ttlMs = this.config.getSlotTtlMs();
    const timer = setInterval(() => {
      void this.slotRepository.renewSlot(projectId, ttlMs).catch((err) => {
        this.logger.warn(
          `Slot heartbeat failed for project ${projectId}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }, intervalMs);
    timer.unref?.();
    this.slotHeartbeatTimers.set(projectId, timer);
  }

  private stopSlotHeartbeat(projectId: string): void {
    const timer = this.slotHeartbeatTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.slotHeartbeatTimers.delete(projectId);
    }
  }

  private async releaseSlotAndStopHeartbeat(projectId: string): Promise<void> {
    this.stopSlotHeartbeat(projectId);
    await this.slotRepository.releaseSlot(projectId);
  }

  private async startRunnerWithRetries(params: {
    containerName: string;
    worktreePath: string;
    runtimeExposure: RuntimeExposure;
  }): Promise<{
    containerId: string;
    accessMetadata: SlotAccessMetadata | null;
  }> {
    const retries = params.runtimeExposure ? this.maxPortAllocationAttempts : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      const publishedPorts =
        params.runtimeExposure &&
        this.config.getRunnerNetworkMode() === 'bridge' &&
        this.config.shouldExposeSandboxPort()
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
        const result = await this.isolatedRunner.run({
          containerName: params.containerName,
          image: this.config.getRunnerImage(),
          worktreePath: params.worktreePath,
          workspaceMount: this.config.getRunnerWorkspace(),
          command: this.config.usesSandboxEntrypoint()
            ? ['/usr/local/bin/ainative-runner-entrypoint']
            : ['sleep', 'infinity'],
          anonymousVolumeMounts: this.config.getRunnerAnonymousVolumeMounts(
            this.config.getRunnerWorkspace(),
          ),
          resourceLimits: this.config.resourceLimitsForProfile(),
          readinessProbeUrl: this.config.getRunnerReadinessProbeUrl(),
          startTimeoutMs: this.config.getRunnerStartTimeoutMs(),
          networkMode: this.config.getRunnerNetworkMode(),
          publishedPorts,
        });
        const mapping = result.publishedPorts[0];
        return {
          containerId: result.containerId,
          accessMetadata: mapping
            ? {
                hostIp:
                  params.runtimeExposure?.advertisedHostIp ?? mapping.hostIp,
                hostPort: mapping.hostPort,
                containerPort: mapping.containerPort,
                previewAddress: `${params.runtimeExposure?.advertisedHostIp ?? mapping.hostIp}:${mapping.hostPort}`,
                baseUrl: `http://${params.runtimeExposure?.advertisedHostIp ?? mapping.hostIp}:${mapping.hostPort}`,
                networkMode: this.config.getRunnerNetworkMode(),
              }
            : null,
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

  private resolveRuntimeExposure(): RuntimeExposure {
    if (!this.config.shouldExposeSandboxPort()) {
      return null;
    }
    if (this.config.getRunnerNetworkMode() !== 'bridge') {
      return null;
    }
    return {
      bindHostIp: '0.0.0.0',
      advertisedHostIp: this.config.getRunnerExposeHostIp(),
      containerPort: this.config.getRunnerExposeContainerPort(),
    };
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
}

type RuntimeExposure = {
  bindHostIp: string;
  advertisedHostIp: string;
  containerPort: number;
} | null;
