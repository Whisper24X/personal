import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Task } from '../tasks/domain/task';

export type SandboxProfile = 'runner-only' | 'preview-web' | 'full-dev-sandbox';

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

  getSandboxProfile(): SandboxProfile {
    const profile = this.configService
      .get<string>('AINATIVE_TASK_SANDBOX_PROFILE', { infer: true })
      ?.trim()
      .toLowerCase();
    if (profile === 'preview-web' || profile === 'full-dev-sandbox') {
      return profile;
    }
    return 'runner-only';
  }

  usesSandboxEntrypoint(): boolean {
    return this.getSandboxProfile() !== 'runner-only';
  }

  getRunnerStartTimeoutMs(): number {
    const defaultTimeoutMs =
      this.getSandboxProfile() === 'runner-only' ? 30_000 : 300_000;
    return this.readPositiveNumberFromEnv(
      'AINATIVE_RUNNER_START_TIMEOUT_MS',
      defaultTimeoutMs,
    );
  }

  getRunnerReadinessProbeUrl(): string | null {
    if (!this.usesSandboxEntrypoint()) {
      return null;
    }
    return (
      this.configService
        .get<string>('AINATIVE_RUNNER_READINESS_URL', { infer: true })
        ?.trim() || 'http://127.0.0.1:8080/health'
    );
  }

  getRunnerAnonymousVolumeMounts(workspaceMount: string): string[] {
    if (!this.usesSandboxEntrypoint()) {
      return [];
    }

    return [
      `${workspaceMount}/backend/node_modules`,
      `${workspaceMount}/frontend/node_modules`,
      `${workspaceMount}/logs`,
    ];
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

  resourceLimitsForProfile(): { memoryMb?: number; pidsLimit?: number } {
    const profile = this.getSandboxProfile();
    if (profile === 'full-dev-sandbox') {
      return { memoryMb: 4096, pidsLimit: 512 };
    }
    if (profile === 'preview-web') {
      return { memoryMb: 2048, pidsLimit: 256 };
    }
    return {};
  }

  private sanitizeContainerName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 120);
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
