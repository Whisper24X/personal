import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { networkInterfaces } from 'os';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';

export type SandboxProfile = 'runner-only' | 'preview-web' | 'full-dev-sandbox';
export type RunnerNetworkMode = 'host' | 'bridge';
export type ProjectContainerRuntimeConfig = {
  sandboxProfile?: SandboxProfile;
  networkMode?: RunnerNetworkMode;
  exposeLocal?: boolean;
  exposeHostIp?: string;
  exposeContainerPort?: number;
  startTimeoutMs?: number;
  resourceLimits?: {
    memoryMb?: number;
    pidsLimit?: number;
  };
  env?: Record<string, string>;
};

@Injectable()
export class ContainerExecutionConfigService {
  constructor(private readonly configService: ConfigService) {}

  isDockerMode(): boolean {
    const mode = this.configService
      .get<string>('AINATIVE_TASK_EXECUTION_MODE', { infer: true })
      ?.trim()
      .toLowerCase();
    return mode === 'docker';
  }

  isStrictMode(): boolean {
    const raw = this.configService.get<string>(
      'AINATIVE_DOCKER_STRICT_EXECUTION',
      { infer: true },
    );
    return raw === 'true' || raw === '1';
  }

  getIsolationScope(): 'task' | 'workflow_run' {
    const scope = this.configService
      .get<string>('AINATIVE_TASK_ISOLATION_SCOPE', { infer: true })
      ?.trim()
      .toLowerCase();
    return scope === 'workflow_run' ? 'workflow_run' : 'task';
  }

  getRunnerImage(): string {
    return (
      this.configService
        .get<string>('AINATIVE_RUNNER_IMAGE', {
          infer: true,
        })
        ?.trim() || 'ainative/runner:latest'
    );
  }

  getRunnerWorkspace(): string {
    return (
      this.configService
        .get<string>('AINATIVE_RUNNER_WORKSPACE', {
          infer: true,
        })
        ?.trim() || '/workspace'
    );
  }

  getSandboxProfile(project?: Project | null): SandboxProfile {
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (projectConfig?.sandboxProfile) {
      return projectConfig.sandboxProfile;
    }

    const profile = this.configService
      .get<string>('AINATIVE_TASK_SANDBOX_PROFILE', { infer: true })
      ?.trim()
      .toLowerCase();
    if (profile === 'preview-web' || profile === 'full-dev-sandbox') {
      return profile;
    }
    return 'runner-only';
  }

  usesSandboxEntrypoint(project?: Project | null): boolean {
    return this.getSandboxProfile(project) !== 'runner-only';
  }

  getRunnerStartTimeoutMs(project?: Project | null): number {
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (projectConfig?.startTimeoutMs) {
      return projectConfig.startTimeoutMs;
    }

    const defaultTimeoutMs =
      this.getSandboxProfile(project) === 'runner-only' ? 30_000 : 300_000;
    return this.readPositiveNumberFromEnv(
      'AINATIVE_RUNNER_START_TIMEOUT_MS',
      defaultTimeoutMs,
    );
  }

  getRunnerReadinessProbeUrl(project?: Project | null): string | null {
    if (!this.usesSandboxEntrypoint(project)) {
      return null;
    }
    return (
      this.configService
        .get<string>('AINATIVE_RUNNER_READINESS_URL', { infer: true })
        ?.trim() || 'http://127.0.0.1:8080/health'
    );
  }

  getRunnerAnonymousVolumeMounts(
    workspaceMount: string,
    project?: Project | null,
  ): string[] {
    if (!this.usesSandboxEntrypoint(project)) {
      return [];
    }

    return [
      `${workspaceMount}/backend/node_modules`,
      `${workspaceMount}/frontend/node_modules`,
      `${workspaceMount}/logs`,
    ];
  }

  getRunnerNetworkMode(project?: Project | null): RunnerNetworkMode {
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (projectConfig?.networkMode) {
      return projectConfig.networkMode;
    }

    const mode = this.configService
      .get<string>('AINATIVE_RUNNER_NETWORK_MODE', { infer: true })
      ?.trim()
      .toLowerCase();
    if (mode === 'host' || mode === 'bridge') {
      return mode;
    }
    return this.usesSandboxEntrypoint(project) ? 'bridge' : 'host';
  }

  shouldExposeSandboxPort(project?: Project | null): boolean {
    if (!this.usesSandboxEntrypoint(project)) {
      return false;
    }
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (typeof projectConfig?.exposeLocal === 'boolean') {
      return projectConfig.exposeLocal;
    }

    const raw = this.configService
      .get<string>('AINATIVE_RUNNER_EXPOSE_LOCAL', { infer: true })
      ?.trim()
      .toLowerCase();
    if (raw === 'false' || raw === '0') {
      return false;
    }
    return true;
  }

  getRunnerExposeHostIp(project?: Project | null): string {
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (projectConfig?.exposeHostIp) {
      return projectConfig.exposeHostIp;
    }

    const configured = this.configService
      .get<string>('AINATIVE_RUNNER_EXPOSE_HOST_IP', { infer: true })
      ?.trim();
    if (configured) {
      return configured;
    }
    return this.detectHostLanIp() ?? '127.0.0.1';
  }

  getRunnerExposeContainerPort(project?: Project | null): number {
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (projectConfig?.exposeContainerPort) {
      return projectConfig.exposeContainerPort;
    }

    return this.readPositiveNumberFromEnv(
      'AINATIVE_RUNNER_EXPOSE_CONTAINER_PORT',
      8080,
    );
  }

  getRunnerExposePortRange(): { start: number; end: number } {
    const start = this.readPositiveNumberFromEnv(
      'AINATIVE_RUNNER_EXPOSE_PORT_RANGE_START',
      38080,
    );
    const end = this.readPositiveNumberFromEnv(
      'AINATIVE_RUNNER_EXPOSE_PORT_RANGE_END',
      38999,
    );
    if (start > end) {
      return { start: end, end: start };
    }
    return { start, end };
  }

  getSlotTtlMs(): number {
    return this.readPositiveNumberFromEnv('AINATIVE_SLOT_TTL_MS', 300_000);
  }

  getSlotHeartbeatMs(): number {
    return this.readPositiveNumberFromEnv('AINATIVE_SLOT_HEARTBEAT_MS', 30_000);
  }

  resolveContainerName(task: Task): string {
    const scope = this.getIsolationScope();
    if (scope === 'workflow_run') {
      const workflowRunId = this.readWorkflowRunId(task);
      if (workflowRunId) {
        return this.sanitizeContainerName(`ainative-run-${workflowRunId}`);
      }
    }
    return this.sanitizeContainerName(`ainative-task-${task.id}`);
  }

  readWorkflowRunId(task: Task): string | null {
    const cfg = task.configJson;
    if (!cfg || typeof cfg !== 'object') {
      return null;
    }
    const raw = (cfg as Record<string, unknown>).workflowRunId;
    if (typeof raw !== 'string' || !raw.trim()) {
      return null;
    }
    return raw.trim();
  }

  resourceLimitsForProfile(project?: Project | null): {
    memoryMb?: number;
    pidsLimit?: number;
  } {
    const profile = this.getSandboxProfile(project);
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    const defaultLimits =
      profile === 'full-dev-sandbox'
        ? { memoryMb: 4096, pidsLimit: 512 }
        : profile === 'preview-web'
          ? { memoryMb: 2048, pidsLimit: 256 }
          : {};

    return {
      ...defaultLimits,
      ...(projectConfig?.resourceLimits ?? {}),
    };
  }

  getRunnerEnv(project?: Project | null): Record<string, string> {
    return this.readProjectContainerRuntimeConfig(project)?.env ?? {};
  }

  private sanitizeContainerName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 120);
  }

  private detectHostLanIp(): string | null {
    const interfaces = networkInterfaces();
    for (const values of Object.values(interfaces)) {
      for (const item of values ?? []) {
        if (item.family !== 'IPv4' || item.internal) {
          continue;
        }
        const address = item.address?.trim();
        if (!address) {
          continue;
        }
        return address;
      }
    }
    return null;
  }

  private readProjectContainerRuntimeConfig(
    project?: Project | null,
  ): ProjectContainerRuntimeConfig | null {
    if (!project?.configJson || typeof project.configJson !== 'object') {
      return null;
    }

    const projectConfig = project.configJson as Record<string, unknown>;
    const rawConfig = this.toObjectRecord(projectConfig.containerRuntime);
    if (!rawConfig) {
      return null;
    }

    const sandboxProfile = this.resolveSandboxProfile(rawConfig.sandboxProfile);
    const networkMode = this.resolveRunnerNetworkMode(rawConfig.networkMode);
    const exposeLocal =
      typeof rawConfig.exposeLocal === 'boolean'
        ? rawConfig.exposeLocal
        : undefined;
    const exposeHostIp =
      typeof rawConfig.exposeHostIp === 'string' &&
      rawConfig.exposeHostIp.trim()
        ? rawConfig.exposeHostIp.trim()
        : undefined;
    const exposeContainerPort = this.readPositiveNumberFromUnknown(
      rawConfig.exposeContainerPort,
    );
    const startTimeoutMs = this.readPositiveNumberFromUnknown(
      rawConfig.startTimeoutMs,
    );
    const resourceLimitsSource = this.toObjectRecord(rawConfig.resourceLimits);
    const env = this.resolveStringEnv(this.toObjectRecord(rawConfig.env));

    return {
      ...(sandboxProfile ? { sandboxProfile } : {}),
      ...(networkMode ? { networkMode } : {}),
      ...(exposeLocal !== undefined ? { exposeLocal } : {}),
      ...(exposeHostIp ? { exposeHostIp } : {}),
      ...(exposeContainerPort ? { exposeContainerPort } : {}),
      ...(startTimeoutMs ? { startTimeoutMs } : {}),
      ...(resourceLimitsSource
        ? {
            resourceLimits: {
              ...(this.readPositiveNumberFromUnknown(
                resourceLimitsSource.memoryMb,
              )
                ? {
                    memoryMb: this.readPositiveNumberFromUnknown(
                      resourceLimitsSource.memoryMb,
                    ),
                  }
                : {}),
              ...(this.readPositiveNumberFromUnknown(
                resourceLimitsSource.pidsLimit,
              )
                ? {
                    pidsLimit: this.readPositiveNumberFromUnknown(
                      resourceLimitsSource.pidsLimit,
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(Object.keys(env).length ? { env } : {}),
    };
  }

  private toObjectRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private resolveSandboxProfile(value: unknown): SandboxProfile | null {
    if (
      value === 'runner-only' ||
      value === 'preview-web' ||
      value === 'full-dev-sandbox'
    ) {
      return value;
    }
    return null;
  }

  private resolveRunnerNetworkMode(value: unknown): RunnerNetworkMode | null {
    if (value === 'host' || value === 'bridge') {
      return value;
    }
    return null;
  }

  private resolveStringEnv(
    input: Record<string, unknown> | null,
  ): Record<string, string> {
    if (!input) {
      return {};
    }

    return Object.entries(input).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          result[key] = value;
        }
        return result;
      },
      {},
    );
  }

  private readPositiveNumberFromUnknown(value: unknown): number | undefined {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }
    return Math.floor(parsed);
  }

  private readPositiveNumberFromEnv(key: string, defaultValue: number): number {
    const rawValue = this.configService.get<string>(key, { infer: true });
    if (!rawValue) {
      return defaultValue;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return defaultValue;
    }
    return Math.floor(parsed);
  }
}
