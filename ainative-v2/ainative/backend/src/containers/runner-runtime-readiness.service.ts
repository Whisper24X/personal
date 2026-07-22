import { Injectable } from '@nestjs/common';
import {
  TaskEnvironmentCoreMode,
  TaskEnvironmentDiagnosticStatus,
  TaskPreviewStatus,
  TaskEnvironmentPreviewDto,
  TaskEnvironmentRouteDiagnosticDto,
  TaskEnvironmentServicePhase,
  TaskEnvironmentServiceStatusDto,
} from '../tasks/dto/task-environment.dto';
import type {
  RunnerOrchestrationConfig,
  RunnerPreviewConfig,
} from './runner-orchestration.types';
import { ContainerExecutionConfigService } from './container-execution-config.service';
import { IsolatedRunnerContainerService } from './isolated-runner-container.service';

const STATUS_DIR = '/run/ainative-runner/status';
const CURL_TIMEOUT_SECONDS = 2;

export type RunnerRuntimeReadinessAssessment = {
  preview: TaskEnvironmentPreviewDto;
  serviceStatuses: TaskEnvironmentServiceStatusDto[];
  routeDiagnostics: TaskEnvironmentRouteDiagnosticDto[];
};

type RunnerServiceStatusFile = {
  phase?: string;
  message?: string | null;
  exitCode?: number | null;
  updatedAt?: string | null;
};

@Injectable()
export class RunnerRuntimeReadinessService {
  constructor(
    private readonly isolatedRunner: IsolatedRunnerContainerService,
    private readonly containerConfig: ContainerExecutionConfigService,
  ) {}

  async assess(params: {
    containerId: string;
    orchestration: RunnerOrchestrationConfig | null;
    previewConfig: RunnerPreviewConfig | null;
    previewUrl?: string | null;
    coreMode: TaskEnvironmentCoreMode;
    previewConfigured: boolean;
    previewFallbackUsed?: boolean;
    skipSecondaryDiagnostics?: boolean;
  }): Promise<RunnerRuntimeReadinessAssessment> {
    const serviceStatuses = await this.readServiceStatuses(
      params.containerId,
      params.orchestration,
      params.previewConfig,
    );

    if (
      params.coreMode === TaskEnvironmentCoreMode.coreOnly ||
      !params.previewConfigured ||
      !params.previewConfig ||
      !params.orchestration
    ) {
      return {
        preview: {
          status:
            params.previewConfigured && params.previewFallbackUsed
              ? TaskPreviewStatus.failed
              : TaskPreviewStatus.unavailable,
          url: null,
          partial: false,
          reason:
            params.previewConfigured && params.previewFallbackUsed
              ? 'failed'
              : 'unavailable',
        },
        serviceStatuses,
        routeDiagnostics: [],
      };
    }

    const previewService = params.orchestration.services.find(
      (service) => service.name === params.previewConfig?.service,
    );
    if (!previewService?.port) {
      return {
        preview: {
          status: TaskPreviewStatus.unavailable,
          url: null,
          partial: false,
          reason: 'unavailable',
        },
        serviceStatuses,
        routeDiagnostics: [],
      };
    }

    const nginxReady = await this.checkInternalHttp(
      params.containerId,
      this.containerConfig.getRunnerExposeContainerPort(),
      '/health',
    );
    if (!nginxReady.ok) {
      return {
        preview: {
          status: this.resolveFailedOrProvisioning(
            serviceStatuses,
            previewService.name,
          ),
          url: null,
          partial: false,
          reason: null,
        },
        serviceStatuses,
        routeDiagnostics: [],
      };
    }

    const portListening = await this.isPortListening(
      params.containerId,
      previewService.port,
    );
    if (!portListening) {
      return {
        preview: {
          status: this.resolveFailedOrProvisioning(
            serviceStatuses,
            previewService.name,
          ),
          url: null,
          partial: false,
          reason: null,
        },
        serviceStatuses,
        routeDiagnostics: [],
      };
    }

    const readinessPath =
      previewService.readinessPath?.trim() ||
      this.deriveReadinessPath(params.orchestration, params.previewConfig) ||
      null;
    if (readinessPath) {
      const previewProbe = await this.checkInternalHttp(
        params.containerId,
        previewService.port,
        readinessPath,
      );
      if (!previewProbe.ok) {
        return {
          preview: {
            status: this.resolveFailedOrProvisioning(
              serviceStatuses,
              previewService.name,
            ),
            url: null,
            partial: false,
            reason: null,
          },
          serviceStatuses,
          routeDiagnostics: [],
        };
      }
    }

    let routeDiagnostics: TaskEnvironmentRouteDiagnosticDto[] = [];
    let partial = false;
    if (!params.skipSecondaryDiagnostics) {
      routeDiagnostics = await this.collectSecondaryRouteDiagnostics(
        params.containerId,
        params.orchestration,
        params.previewConfig,
      );
      partial = routeDiagnostics.some(
        (item) => item.status === TaskEnvironmentDiagnosticStatus.failed,
      );
    }

    return {
      preview: {
        status: TaskPreviewStatus.ready,
        url: params.previewUrl?.trim() || null,
        partial,
        reason: readinessPath ? 'http-ready' : 'port-listening-only',
      },
      serviceStatuses,
      routeDiagnostics,
    };
  }

  async readStartupFailureSnapshot(params: {
    containerId: string;
    orchestration: RunnerOrchestrationConfig | null;
    previewConfig: RunnerPreviewConfig | null;
  }): Promise<TaskEnvironmentServiceStatusDto[]> {
    return this.readServiceStatuses(
      params.containerId,
      params.orchestration,
      params.previewConfig,
    );
  }

  private async readServiceStatuses(
    containerId: string,
    orchestration: RunnerOrchestrationConfig | null,
    previewConfig: RunnerPreviewConfig | null,
  ): Promise<TaskEnvironmentServiceStatusDto[]> {
    const files = await this.readStatusFiles(containerId);
    const listeningPorts = await this.readListeningPorts(containerId);
    const services = orchestration?.services ?? [];

    return services.map((service) => {
      const key = service.name;
      const fromFile = files.get(key);
      const basePhase = this.normalizePhase(fromFile?.phase);
      const listening =
        typeof service.port === 'number' && listeningPorts.has(service.port);
      const phase =
        listening && basePhase !== TaskEnvironmentServicePhase.failed
          ? TaskEnvironmentServicePhase.listening
          : basePhase;

      return {
        name: service.name,
        port: service.port ?? null,
        phase,
        message: fromFile?.message ?? null,
        exitCode:
          typeof fromFile?.exitCode === 'number' ? fromFile.exitCode : null,
        updatedAt:
          typeof fromFile?.updatedAt === 'string' ? fromFile.updatedAt : null,
        isPrimaryPreview: previewConfig?.service === service.name,
      };
    });
  }

  private async collectSecondaryRouteDiagnostics(
    containerId: string,
    orchestration: RunnerOrchestrationConfig,
    previewConfig: RunnerPreviewConfig,
  ): Promise<TaskEnvironmentRouteDiagnosticDto[]> {
    const listenPort = this.containerConfig.getRunnerExposeContainerPort();
    const diagnostics: TaskEnvironmentRouteDiagnosticDto[] = [];
    for (const route of orchestration.routes ?? []) {
      if (route.action === 'redirect') {
        continue;
      }
      if (route.match === 'regex') {
        diagnostics.push({
          path: route.path,
          service: route.service ?? null,
          port:
            route.targetPort ??
            this.findServicePort(orchestration, route.service),
          status: TaskEnvironmentDiagnosticStatus.skipped,
          statusCode: null,
          error: 'regex route diagnostics skipped',
        });
        continue;
      }
      if (
        route.service === previewConfig.service &&
        route.path === (previewConfig.path ?? '/')
      ) {
        continue;
      }
      const probe = await this.checkInternalHttp(
        containerId,
        listenPort,
        route.path,
      );
      diagnostics.push({
        path: route.path,
        service: route.service ?? null,
        port:
          route.targetPort ??
          this.findServicePort(orchestration, route.service),
        status: probe.ok
          ? TaskEnvironmentDiagnosticStatus.passed
          : TaskEnvironmentDiagnosticStatus.failed,
        statusCode: probe.statusCode ?? null,
        error: probe.ok ? null : (probe.error ?? null),
      });
    }
    return diagnostics;
  }

  private deriveReadinessPath(
    orchestration: RunnerOrchestrationConfig,
    previewConfig: RunnerPreviewConfig,
  ): string | null {
    const normalizedPreviewPath = previewConfig.path?.trim() || '/';
    const matchingRoute = [...(orchestration.routes ?? [])]
      .filter(
        (route) =>
          route.action !== 'redirect' &&
          route.service === previewConfig.service &&
          normalizedPreviewPath.startsWith(route.path),
      )
      .sort((left, right) => right.path.length - left.path.length)[0];
    if (!matchingRoute?.upstreamPath) {
      return null;
    }
    const path = matchingRoute.upstreamPath.trim();
    if (!path.startsWith('/')) {
      return null;
    }
    return path;
  }

  private findServicePort(
    orchestration: RunnerOrchestrationConfig,
    serviceName?: string,
  ): number | null {
    if (!serviceName) {
      return null;
    }
    return (
      orchestration.services.find((service) => service.name === serviceName)
        ?.port ?? null
    );
  }

  private resolveFailedOrProvisioning(
    serviceStatuses: TaskEnvironmentServiceStatusDto[],
    serviceName: string,
  ): TaskPreviewStatus.failed | TaskPreviewStatus.provisioning {
    const target = serviceStatuses.find((item) => item.name === serviceName);
    return target?.phase === TaskEnvironmentServicePhase.failed
      ? TaskPreviewStatus.failed
      : TaskPreviewStatus.provisioning;
  }

  private normalizePhase(
    value: string | undefined,
  ): TaskEnvironmentServicePhase {
    switch (value) {
      case TaskEnvironmentServicePhase.installing:
      case TaskEnvironmentServicePhase.starting:
      case TaskEnvironmentServicePhase.failed:
      case TaskEnvironmentServicePhase.listening:
      case TaskEnvironmentServicePhase.pending:
        return value;
      default:
        return TaskEnvironmentServicePhase.unknown;
    }
  }

  private async readStatusFiles(
    containerId: string,
  ): Promise<Map<string, RunnerServiceStatusFile>> {
    const output = await this.safeExec(
      containerId,
      `if [ -d ${this.shellEscape(STATUS_DIR)} ]; then for f in ${this.shellEscape(
        STATUS_DIR,
      )}/*.json; do [ -f "$f" ] && printf '%s\\t' "$(basename "$f" .json)" && cat "$f" && printf '\\n'; done; fi`,
    );
    const result = new Map<string, RunnerServiceStatusFile>();
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const tabIndex = trimmed.indexOf('\t');
      if (tabIndex <= 0) {
        continue;
      }
      const name = trimmed.slice(0, tabIndex).trim();
      const raw = trimmed.slice(tabIndex + 1).trim();
      if (!name || !raw) {
        continue;
      }
      try {
        result.set(name, JSON.parse(raw) as RunnerServiceStatusFile);
      } catch {
        // Ignore malformed status file payloads.
      }
    }
    return result;
  }

  private async readListeningPorts(containerId: string): Promise<Set<number>> {
    const output = await this.safeExec(
      containerId,
      'if command -v ss >/dev/null 2>&1; then ss -lnt; elif command -v netstat >/dev/null 2>&1; then netstat -lnt; else true; fi',
    );
    const ports = new Set<number>();
    for (const match of output.matchAll(/:(\d+)\s/g)) {
      const value = Number.parseInt(match[1] ?? '', 10);
      if (Number.isFinite(value) && value > 0) {
        ports.add(value);
      }
    }
    return ports;
  }

  private async isPortListening(
    containerId: string,
    port: number,
  ): Promise<boolean> {
    const ports = await this.readListeningPorts(containerId);
    return ports.has(port);
  }

  private async checkInternalHttp(
    containerId: string,
    port: number,
    path: string,
  ): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const output = await this.safeExec(
      containerId,
      `set +e; out=$(curl -sS -o /dev/null -w 'HTTP:%{http_code}' --max-time ${CURL_TIMEOUT_SECONDS} ${this.shellEscape(
        `http://127.0.0.1:${port}${normalizedPath}`,
      )} 2>&1); rc=$?; if [ "$rc" -ne 0 ]; then printf 'ERR:%s:%s' "$rc" "$out"; else printf '%s' "$out"; fi`,
    );
    if (output.startsWith('HTTP:')) {
      const statusCode = Number.parseInt(output.slice('HTTP:'.length), 10);
      return {
        ok:
          Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 400,
        statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
      };
    }
    return {
      ok: false,
      error: output || 'curl failed',
    };
  }

  private async safeExec(
    containerId: string,
    command: string,
  ): Promise<string> {
    try {
      return await this.isolatedRunner.execInContainer(containerId, [
        'sh',
        '-lc',
        command,
      ]);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}
