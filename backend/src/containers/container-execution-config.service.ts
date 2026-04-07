import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { networkInterfaces } from 'os';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';
import { RunnerNetworkMode } from './runner-orchestration.types';
export type { RunnerNetworkMode } from './runner-orchestration.types';

export type SandboxProfile = 'runner-only' | 'preview-web';
export type RunnerPlatform = string;
export type ProjectContainerRuntimeConfig = {
  sandboxProfile?: SandboxProfile;
  platform?: string;
  startTimeoutMs?: number;
  resourceLimits?: {
    memoryMb?: number;
    pidsLimit?: number;
  };
  env?: Record<string, string>;
  runnerOrchestration?: Record<string, unknown>;
};

@Injectable()
export class ContainerExecutionConfigService {
  constructor(private readonly configService: ConfigService) {}

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

  getRunnerPlatform(project?: Project | null): string | null {
    const projectConfig = this.readProjectContainerRuntimeConfig(project);
    if (projectConfig?.platform) {
      return projectConfig.platform;
    }

    return this.resolveRunnerPlatform(
      this.configService.get<string>('AINATIVE_RUNNER_PLATFORM', {
        infer: true,
      }),
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
    if (profile === 'preview-web') {
      return profile;
    }
    return 'runner-only';
  }

  usesSandboxEntrypoint(project?: Project | null): boolean {
    void project;
    return true;
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
        ?.trim() ||
      `http://127.0.0.1:${this.getRunnerExposeContainerPort(project)}/health`
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
    void project;

    const mode = this.configService
      .get<string>('AINATIVE_RUNNER_NETWORK_MODE', { infer: true })
      ?.trim()
      .toLowerCase();
    if (mode === 'host' || mode === 'bridge') {
      return mode;
    }
    return 'bridge';
  }

  shouldExposeSandboxPort(project?: Project | null): boolean {
    void project;
    return true;
  }

  getRunnerExposeHostIp(project?: Project | null): string {
    void project;

    const configured = this.configService
      .get<string>('AINATIVE_RUNNER_EXPOSE_HOST_IP', { infer: true })
      ?.trim();
    if (configured) {
      return configured;
    }
    return this.detectHostLanIp() ?? '127.0.0.1';
  }

  getPreviewBaseUrl(): string | null {
    const configured = this.configService
      .get<string>('AINATIVE_PREVIEW_BASE_URL', { infer: true })
      ?.trim();

    return configured || null;
  }

  getRunnerExposeContainerPort(project?: Project | null): number {
    void project;

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
      profile === 'preview-web' ? { memoryMb: 2048, pidsLimit: 256 } : {};

    return {
      ...defaultLimits,
      ...(projectConfig?.resourceLimits ?? {}),
    };
  }

  getRunnerEnv(project?: Project | null): Record<string, string> {
    return this.readProjectContainerRuntimeConfig(project)?.env ?? {};
  }

  getRunnerBootstrapEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    const gitlabUsername = this.configService
      .get<string>('GITLAB_USERNAME', { infer: true })
      ?.trim();
    const gitlabToken = this.configService
      .get<string>('GITLAB_TOKEN', { infer: true })
      ?.trim();

    if (gitlabUsername) {
      env.GITLAB_USERNAME = gitlabUsername;
    }
    if (gitlabToken) {
      env.GITLAB_TOKEN = gitlabToken;
    }

    return env;
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
    const platform = this.resolveRunnerPlatform(rawConfig.platform);
    const startTimeoutMs = this.readPositiveNumberFromUnknown(
      rawConfig.startTimeoutMs,
    );
    const resourceLimitsSource = this.toObjectRecord(rawConfig.resourceLimits);
    const env = this.resolveStringEnv(this.toObjectRecord(rawConfig.env));
    const runnerOrchestration = this.toObjectRecord(
      rawConfig.runnerOrchestration,
    );

    return {
      ...(sandboxProfile ? { sandboxProfile } : {}),
      ...(platform ? { platform } : {}),
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
      ...(runnerOrchestration ? { runnerOrchestration } : {}),
    };
  }

  private toObjectRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private resolveSandboxProfile(value: unknown): SandboxProfile | null {
    if (value === 'runner-only' || value === 'preview-web') {
      return value;
    }
    return null;
  }

  private resolveRunnerPlatform(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (
      !normalized ||
      !/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)?$/.test(
        normalized,
      )
    ) {
      return null;
    }

    return normalized;
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
