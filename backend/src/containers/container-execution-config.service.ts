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
  env?: Record<string, string>;
  runnerOrchestration?: Record<string, unknown>;
};

@Injectable()
export class ContainerExecutionConfigService {
  constructor(private readonly configService: ConfigService) {}

  getMaxContainersPerProject(): number {
    return this.readPositiveNumberFromEnv(
      'AINATIVE_PROJECT_MAX_CONTAINERS_PER_PROJECT',
      1,
    );
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

  getRunnerPlatform(project?: Project | null): string | null {
    void project;

    return this.resolveRunnerPlatform(
      this.readFirstTrimmedEnvValue([
        'AINATIVE_RUNNER_RUNTIME_PLATFORM',
        'AINATIVE_RUNNER_PLATFORM',
      ]),
    );
  }

  getSandboxProfile(project?: Project | null): SandboxProfile {
    void project;

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
    void project;

    const defaultTimeoutMs =
      this.getSandboxProfile() === 'runner-only' ? 30_000 : 300_000;
    return this.readPositiveNumberFromEnv(
      'AINATIVE_RUNNER_START_TIMEOUT_MS',
      defaultTimeoutMs,
    );
  }

  getRunnerCpuLimit(project?: Project | null): number | undefined {
    void project;

    return this.readOptionalPositiveFloatFromEnv('AINATIVE_RUNNER_CPUS');
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

  getRunnerManagedVolumeTargets(
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
    void project;

    const memoryMb = this.readOptionalPositiveIntFromEnv(
      'AINATIVE_RUNNER_MEMORY_MB',
    );
    const pidsLimit = this.readOptionalPositiveIntFromEnv(
      'AINATIVE_RUNNER_PIDS_LIMIT',
    );

    return {
      ...(memoryMb ? { memoryMb } : {}),
      ...(pidsLimit ? { pidsLimit } : {}),
    };
  }

  getRunnerEnv(project?: Project | null): Record<string, string> {
    return this.readProjectContainerRuntimeConfig(project)?.env ?? {};
  }

  /**
   * When true (default), bridge-mode task runners get `host.docker.internal` pointing at the
   * Docker host so Agent CLIs can reach host-bound MCP / DB / Redis URLs (see task-container-execution-boundaries.md).
   * Disable with `AINATIVE_RUNNER_ADD_HOST_DOCKER_INTERNAL=false`.
   */
  shouldAddHostDockerInternalGateway(project?: Project | null): boolean {
    void project;
    const v = this.configService
      .get<string>('AINATIVE_RUNNER_ADD_HOST_DOCKER_INTERNAL', { infer: true })
      ?.trim()
      .toLowerCase();
    if (v === '0' || v === 'false' || v === 'no') {
      return false;
    }
    return true;
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

  /**
   * 任务 Runner 内 nginx 对 HTML 注入 `preview-iframe-bridge.js` 时使用的脚本绝对 URL（写入容器
   * 环境 `AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL`）。与 {@link getPreviewBridgeInjectEnabled} 需同时为真才会注入。
   *
   * 优先 `AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL`；未配置时若存在 `app.frontendDomain`（FRONTEND_DOMAIN），
   * 再按 `AINATIVE_FRONTEND_BASE_PATH`（与 Vite `base` 对齐，默认可为 `/`）拼出
   * `{origin}{base}preview-iframe-bridge.js`。
   */
  getPreviewBridgeScriptUrl(): string | null {
    if (!this.getPreviewBridgeInjectEnabled()) {
      return null;
    }
    const explicit = this.configService
      .get<string>('AINATIVE_PREVIEW_BRIDGE_SCRIPT_URL', { infer: true })
      ?.trim();
    if (explicit) {
      try {
        const u = new URL(explicit);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return null;
        }
        return u.href;
      } catch {
        return null;
      }
    }
    const frontend = this.configService
      .get<string>('app.frontendDomain', { infer: true })
      ?.trim();
    if (!frontend) {
      return null;
    }
    const basePath =
      this.configService
        .get<string>('AINATIVE_FRONTEND_BASE_PATH', { infer: true })
        ?.trim() || '/';
    try {
      const root = new URL(frontend);
      if (basePath === '/' || basePath === '') {
        return new URL('preview-iframe-bridge.js', `${root.origin}/`).href;
      }
      const raw = (
        basePath.startsWith('/') ? basePath : `/${basePath}`
      ).replace(/\/$/, '');
      const dir = new URL(`${raw}/`, `${root.origin}/`);
      return new URL('preview-iframe-bridge.js', dir).href;
    } catch {
      return null;
    }
  }

  /**
   * 为 false 时不向 Runner 传递脚本 URL、nginx 不注入。默认 true（仍要求能解析出脚本 URL）。
   * 可设 `AINATIVE_PREVIEW_BRIDGE_NGINX_INJECT=0` 关闭。
   */
  getPreviewBridgeInjectEnabled(): boolean {
    const v = this.configService
      .get<string>('AINATIVE_PREVIEW_BRIDGE_NGINX_INJECT', { infer: true })
      ?.trim()
      .toLowerCase();
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') {
      return false;
    }
    return true;
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

    const env = this.resolveStringEnv(this.toObjectRecord(rawConfig.env));
    const runnerOrchestration = this.toObjectRecord(
      rawConfig.runnerOrchestration,
    );

    return {
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

  private readFirstTrimmedEnvValue(keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<string>(key, {
        infer: true,
      });
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
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

  private readOptionalPositiveIntFromEnv(key: string): number | undefined {
    const rawValue = this.configService.get<string>(key, { infer: true });
    if (!rawValue) {
      return undefined;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return Math.floor(parsed);
  }

  private readOptionalPositiveFloatFromEnv(key: string): number | undefined {
    const rawValue = this.configService.get<string>(key, { infer: true });
    if (!rawValue) {
      return undefined;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  }
}
