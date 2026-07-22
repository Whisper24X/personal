import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { ProjectRunnerImageService } from '../containers/project-runner-image.service';
import type {
  RunnerOrchestrationConfig,
  RunnerRouteConfig,
  RunnerServiceConfig,
} from '../containers/runner-orchestration.types';

export type RunnerGenerationProbeMode = 'off' | 'warn' | 'required';
export type RunnerConfigProbeStatus = 'passed' | 'failed' | 'skipped';
export type RunnerConfigProbeFailureKind =
  | 'config-render'
  | 'service-timeout'
  | 'preview-unreachable'
  | 'route-http-status'
  | 'route-unreachable'
  | 'service-startup'
  | 'docker'
  | 'unknown';

export type RunnerRouteProbeStatus = 'passed' | 'failed' | 'skipped';

export interface RunnerRouteProbeResult {
  path: string;
  service?: string;
  port?: number;
  status: RunnerRouteProbeStatus;
  statusCode?: number;
  failureKind?: RunnerConfigProbeFailureKind;
  error?: string;
}

export interface RunnerConfigProbeResult {
  status: RunnerConfigProbeStatus;
  mode: RunnerGenerationProbeMode;
  durationMs: number;
  failureKind?: RunnerConfigProbeFailureKind;
  error?: string;
  logsPreview?: string;
  routeResults?: RunnerRouteProbeResult[];
  repaired?: boolean;
  repairSummary?: string;
  repairedOrchestration?: RunnerOrchestrationConfig;
}

export interface RunnerConfigProbeParams {
  orchestration: RunnerOrchestrationConfig;
  workspacePath: string;
  fingerprint: string;
}

const DEFAULT_PROBE_TIMEOUT_MS = 60_000;
const RUNNER_WORKSPACE = '/workspace';
const ROUTE_PROBE_CURL_TIMEOUT_SECONDS = 3;

@Injectable()
export class RunnerConfigProbeService {
  private readonly logger = new Logger(RunnerConfigProbeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly containerConfig: ContainerExecutionConfigService,
    private readonly isolatedRunner: IsolatedRunnerContainerService,
    private readonly projectRunnerImageService: ProjectRunnerImageService,
  ) {}

  resolveProbeMode(): RunnerGenerationProbeMode {
    const raw = this.configService
      .get<string>('AINATIVE_RUNNER_GENERATION_PROBE_MODE', { infer: true })
      ?.trim()
      .toLowerCase();
    if (raw === 'off' || raw === 'required' || raw === 'warn') return raw;
    return 'warn';
  }

  async probe(
    params: RunnerConfigProbeParams,
  ): Promise<RunnerConfigProbeResult> {
    const mode = this.resolveProbeMode();
    const startedAt = Date.now();
    if (mode === 'off') {
      return { status: 'skipped', mode, durationMs: 0 };
    }

    if (!params.orchestration.preview && !params.orchestration.routes?.length) {
      return {
        status: 'skipped',
        mode,
        durationMs: Date.now() - startedAt,
        error: 'No preview config to probe',
      };
    }

    const listenPort = this.containerConfig.getRunnerExposeContainerPort();
    const containerName = sanitizeContainerName(
      `ainative-runner-probe-${params.fingerprint}`,
    );

    try {
      const firstProbe = await this.probeOnce({
        orchestration: params.orchestration,
        workspacePath: params.workspacePath,
        containerName,
        listenPort,
      });
      if (firstProbe.status === 'passed' || !firstProbe.repairedOrchestration) {
        return {
          ...firstProbe,
          durationMs: Date.now() - startedAt,
        };
      }

      const retryContainerName = sanitizeContainerName(
        `${containerName}-repair`,
      );
      const repairedProbe = await this.probeOnce({
        orchestration: firstProbe.repairedOrchestration,
        workspacePath: params.workspacePath,
        containerName: retryContainerName,
        listenPort,
      });

      return {
        ...repairedProbe,
        durationMs: Date.now() - startedAt,
        repaired: repairedProbe.status === 'passed',
        repairSummary: firstProbe.repairSummary,
        repairedOrchestration:
          repairedProbe.status === 'passed'
            ? firstProbe.repairedOrchestration
            : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 'failed',
        mode,
        durationMs: Date.now() - startedAt,
        failureKind: classifyProbeFailure(message),
        error: message.slice(0, 1000),
        logsPreview: extractLogsPreview(error),
      };
    }
  }

  private async probeOnce(params: {
    orchestration: RunnerOrchestrationConfig;
    workspacePath: string;
    containerName: string;
    listenPort: number;
  }): Promise<RunnerConfigProbeResult> {
    const mode = this.resolveProbeMode();
    const startedAt = Date.now();
    const image = await this.projectRunnerImageService.resolveRunnerImage(null);
    const probeRoutes = collectProbeRoutes(params.orchestration);
    let containerId = '';

    if (probeRoutes.length === 0) {
      return {
        status: 'skipped',
        mode,
        durationMs: 0,
        error: 'No HTTP preview routes to probe',
      };
    }

    try {
      const result = await this.isolatedRunner.run({
        containerName: params.containerName,
        image,
        worktreePath: params.workspacePath,
        workspaceMount: RUNNER_WORKSPACE,
        env: {
          ...this.containerConfig.getRunnerEnv(null),
          AINATIVE_RUNNER_WORKSPACE: RUNNER_WORKSPACE,
          AINATIVE_RUNNER_LISTEN_PORT: String(params.listenPort),
          AINATIVE_RUNNER_CONFIG_JSON: JSON.stringify(params.orchestration),
        },
        useImageDefaultCommand: true,
        startTimeoutMs: this.resolveProbeTimeoutMs(),
        platform: this.containerConfig.getRunnerPlatform(null),
        networkMode: 'bridge',
        addHostDockerInternalGateway:
          this.containerConfig.shouldAddHostDockerInternalGateway(null),
        cpuLimit: this.containerConfig.getRunnerCpuLimit(null),
        resourceLimits: this.containerConfig.resourceLimitsForProfile(null),
      });
      containerId = result.containerId;

      const routeResults = await this.waitForRouteResults(
        containerId,
        params.listenPort,
        probeRoutes,
        this.resolveProbeTimeoutMs(),
      );
      const failedRoutes = routeResults.filter(
        (route) => route.status === 'failed',
      );

      if (failedRoutes.length === 0) {
        return {
          status: 'passed',
          mode,
          durationMs: Date.now() - startedAt,
          routeResults,
        };
      }

      const repaired = await this.buildRepairedOrchestration(
        containerId,
        params.orchestration,
        failedRoutes,
        params.listenPort,
      );

      return {
        status: 'failed',
        mode,
        durationMs: Date.now() - startedAt,
        failureKind: summarizeRouteFailure(failedRoutes),
        error: summarizeRouteErrors(failedRoutes),
        routeResults,
        logsPreview: await this.readLogsPreview(containerId),
        repairedOrchestration: repaired.orchestration,
        repairSummary: repaired.summary,
      };
    } finally {
      await this.isolatedRunner.remove(params.containerName).catch((error) => {
        this.logger.warn(
          `runner probe cleanup failed ${containerId || params.containerName}: ${error instanceof Error ? error.message : error}`,
        );
      });
    }
  }

  private async waitForRouteResults(
    containerId: string,
    listenPort: number,
    routes: ProbeRoute[],
    timeoutMs: number,
  ): Promise<RunnerRouteProbeResult[]> {
    const deadline = Date.now() + timeoutMs;
    let latest: RunnerRouteProbeResult[] = routes.map((route) => ({
      path: route.path,
      service: route.service?.name,
      port: route.service?.port ?? route.route.targetPort,
      status: 'skipped',
      error: 'route probe not started',
    }));

    while (Date.now() < deadline) {
      latest = [];
      for (const route of routes) {
        latest.push(await this.probeRoute(containerId, listenPort, route));
      }
      if (latest.every((route) => route.status === 'passed')) {
        return latest;
      }
      if (Date.now() + 1000 >= deadline) {
        break;
      }
      await this.delay(1000);
    }

    return latest;
  }

  private async probeRoute(
    containerId: string,
    listenPort: number,
    probeRoute: ProbeRoute,
  ): Promise<RunnerRouteProbeResult> {
    const path = normalizePreviewPath(probeRoute.path);
    const url = `http://127.0.0.1:${listenPort}${path}`;
    const port = probeRoute.service?.port ?? probeRoute.route.targetPort;
    const output = await this.execShell(
      containerId,
      `set +e; out=$(curl -sS -o /dev/null -w 'HTTP:%{http_code}' --max-time ${ROUTE_PROBE_CURL_TIMEOUT_SECONDS} ${shellEscape(url)} 2>&1); rc=$?; if [ "$rc" -ne 0 ]; then printf 'ERR:%s:%s' "$rc" "$out"; else printf '%s' "$out"; fi`,
    );
    const parsed = parseCurlProbeOutput(output);

    if (
      parsed.statusCode &&
      parsed.statusCode >= 200 &&
      parsed.statusCode < 400
    ) {
      return {
        path,
        service: probeRoute.service?.name,
        port,
        status: 'passed',
        statusCode: parsed.statusCode,
      };
    }

    if (parsed.statusCode) {
      return {
        path,
        service: probeRoute.service?.name,
        port,
        status: 'failed',
        statusCode: parsed.statusCode,
        failureKind: 'route-http-status',
        error: `HTTP ${parsed.statusCode}`,
      };
    }

    return {
      path,
      service: probeRoute.service?.name,
      port,
      status: 'failed',
      failureKind: 'route-unreachable',
      error: parsed.error || 'curl failed',
    };
  }

  private async buildRepairedOrchestration(
    containerId: string,
    orchestration: RunnerOrchestrationConfig,
    failedRoutes: RunnerRouteProbeResult[],
    listenPort: number,
  ): Promise<{
    orchestration?: RunnerOrchestrationConfig;
    summary?: string;
  }> {
    const serviceNames = [
      ...new Set(
        failedRoutes
          .map((route) => route.service)
          .filter((service): service is string => Boolean(service)),
      ),
    ];
    if (serviceNames.length === 0) return {};

    const next = cloneOrchestration(orchestration);
    const repairs: string[] = [];
    const listeningPorts = await this.listListeningPorts(containerId);

    for (const serviceName of serviceNames) {
      const service = next.services.find((item) => item.name === serviceName);
      if (!service) continue;
      const candidatePorts = await this.collectRepairPorts(
        containerId,
        service,
        listeningPorts,
        listenPort,
      );
      for (const port of candidatePorts) {
        if (await this.probeDirectHttpPort(containerId, port)) {
          if (service.port !== port) {
            repairs.push(
              `${service.name}: ${service.port ?? 'none'} -> ${port}`,
            );
            service.port = port;
          }
          break;
        }
      }
    }

    if (repairs.length === 0) return {};
    return {
      orchestration: next,
      summary: repairs.join('; '),
    };
  }

  private async collectRepairPorts(
    containerId: string,
    service: RunnerServiceConfig,
    listeningPorts: number[],
    listenPort: number,
  ): Promise<number[]> {
    const logPorts = await this.readServiceLogPorts(containerId, service.name);
    return [
      ...new Set(
        [...logPorts, ...listeningPorts].filter(
          (port) => port !== listenPort && port !== service.port,
        ),
      ),
    ];
  }

  private async probeDirectHttpPort(
    containerId: string,
    port: number,
  ): Promise<boolean> {
    const url = `http://127.0.0.1:${port}/`;
    const output = await this.execShell(
      containerId,
      `set +e; out=$(curl -sS -o /dev/null -w 'HTTP:%{http_code}' --max-time 2 ${shellEscape(url)} 2>&1); rc=$?; if [ "$rc" -ne 0 ]; then printf 'ERR:%s:%s' "$rc" "$out"; else printf '%s' "$out"; fi`,
    );
    const parsed = parseCurlProbeOutput(output);
    return Boolean(
      parsed.statusCode && parsed.statusCode >= 200 && parsed.statusCode < 500,
    );
  }

  private async listListeningPorts(containerId: string): Promise<number[]> {
    const output = await this.execShell(
      containerId,
      'if command -v ss >/dev/null 2>&1; then ss -ltnp; elif command -v netstat >/dev/null 2>&1; then netstat -ltnp; else true; fi',
    );
    return extractPorts(output);
  }

  private async readServiceLogPorts(
    containerId: string,
    serviceName: string,
  ): Promise<number[]> {
    const safeName = serviceName.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const output = await this.execShell(
      containerId,
      `if [ -f ${shellEscape(`${RUNNER_WORKSPACE}/logs/${safeName}.log`)} ]; then tail -n 200 ${shellEscape(`${RUNNER_WORKSPACE}/logs/${safeName}.log`)}; fi`,
    );
    return extractPorts(output);
  }

  private async readLogsPreview(
    containerId: string,
  ): Promise<string | undefined> {
    const output = await this.execShell(
      containerId,
      `if [ -d ${shellEscape(`${RUNNER_WORKSPACE}/logs`)} ]; then for f in ${shellEscape(`${RUNNER_WORKSPACE}/logs`)}/*.log; do [ -f "$f" ] && echo "== $f ==" && tail -n 40 "$f"; done; fi`,
    );
    return output.trim().slice(-2000) || undefined;
  }

  private async execShell(
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

  private resolveProbeTimeoutMs(): number {
    const raw = this.configService.get<string>(
      'AINATIVE_RUNNER_GENERATION_PROBE_TIMEOUT_MS',
      { infer: true },
    );
    const parsed = raw ? Number(raw) : DEFAULT_PROBE_TIMEOUT_MS;
    return Number.isInteger(parsed) && parsed > 0
      ? Math.min(parsed, 180_000)
      : DEFAULT_PROBE_TIMEOUT_MS;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface ProbeRoute {
  path: string;
  route: RunnerRouteConfig;
  service?: RunnerServiceConfig;
}

function collectProbeRoutes(
  orchestration: RunnerOrchestrationConfig,
): ProbeRoute[] {
  const servicesByName = new Map(
    orchestration.services.map((service) => [service.name, service]),
  );
  const routes = orchestration.routes ?? [];
  const paths = new Set<string>();

  for (const link of orchestration.homepage?.links ?? []) {
    paths.add(normalizePreviewPath(link.path));
  }
  if (orchestration.preview?.path) {
    paths.add(normalizePreviewPath(orchestration.preview.path));
  }
  if (paths.size === 0 && orchestration.preview?.service) {
    paths.add('/');
  }

  const result: ProbeRoute[] = [];
  for (const path of paths) {
    const route = findRouteForPath(
      routes,
      path,
      orchestration.preview?.service,
    );
    if (!route || route.action === 'redirect') continue;
    result.push({
      path,
      route,
      service: route.service ? servicesByName.get(route.service) : undefined,
    });
  }
  return result;
}

function findRouteForPath(
  routes: RunnerRouteConfig[],
  targetPath: string,
  previewService?: string,
): RunnerRouteConfig | undefined {
  const normalizedTarget = normalizePreviewPath(targetPath);
  const exact = routes.find(
    (route) => normalizePreviewPath(route.path) === normalizedTarget,
  );
  if (exact) return exact;

  const prefix = [...routes]
    .filter((route) => {
      const routePath = normalizePreviewPath(route.path);
      return (
        (route.match ?? 'prefix') === 'prefix' &&
        normalizedTarget.startsWith(routePath)
      );
    })
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (prefix) return prefix;

  if (normalizedTarget === '/' && previewService) {
    return {
      path: '/',
      action: 'proxy',
      match: 'prefix',
      service: previewService,
    };
  }
  return undefined;
}

function normalizePreviewPath(path: string | undefined): string {
  const trimmed = path?.trim() || '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function classifyProbeFailure(message: string): RunnerConfigProbeFailureKind {
  const lower = message.toLowerCase();
  if (
    lower.includes('render') ||
    lower.includes('nginx') ||
    lower.includes('runner orchestration config')
  ) {
    return 'config-render';
  }
  if (lower.includes('readiness probe') || lower.includes('curl')) {
    return 'preview-unreachable';
  }
  if (lower.includes('http 5')) return 'route-http-status';
  if (lower.includes('timeout') || lower.includes('did not reach running')) {
    return 'service-timeout';
  }
  if (lower.includes('docker')) return 'docker';
  return 'unknown';
}

function summarizeRouteFailure(
  routes: RunnerRouteProbeResult[],
): RunnerConfigProbeFailureKind {
  if (routes.some((route) => route.failureKind === 'route-http-status')) {
    return 'route-http-status';
  }
  if (routes.some((route) => route.failureKind === 'route-unreachable')) {
    return 'route-unreachable';
  }
  return 'unknown';
}

function summarizeRouteErrors(routes: RunnerRouteProbeResult[]): string {
  return routes
    .map((route) => {
      const service = route.service ? ` service=${route.service}` : '';
      const port = route.port ? ` port=${route.port}` : '';
      return `${route.path}${service}${port}: ${route.error ?? route.failureKind ?? 'failed'}`;
    })
    .join('; ')
    .slice(0, 1000);
}

function parseCurlProbeOutput(output: string): {
  statusCode?: number;
  error?: string;
} {
  const statusMatch = output.match(/HTTP:(\d{3})/);
  if (statusMatch) {
    return { statusCode: Number(statusMatch[1]) };
  }
  const errorMatch = output.match(/ERR:\d+:(.*)$/s);
  return { error: (errorMatch?.[1] ?? output).trim().slice(0, 500) };
}

function extractPorts(output: string): number[] {
  const ports = new Set<number>();
  const patterns = [
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[^\]]+\]|[^:\s/]+):(\d{2,5})/gi,
    /\b(?:addr|address|listen|listening|http|server)[^\n]{0,100}:(\d{2,5})/gi,
    /(?:^|\s)(?:127\.0\.0\.1|0\.0\.0\.0|\*|\[::\]|::):(\d{2,5})\b/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(output);
    while (match) {
      const port = Number(match[1]);
      if (Number.isInteger(port) && port > 0 && port <= 65535) {
        ports.add(port);
      }
      match = pattern.exec(output);
    }
  }
  return [...ports];
}

function cloneOrchestration(
  orchestration: RunnerOrchestrationConfig,
): RunnerOrchestrationConfig {
  return JSON.parse(JSON.stringify(orchestration)) as RunnerOrchestrationConfig;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sanitizeContainerName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function extractLogsPreview(error: unknown): string | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'containerLogsPreview' in error &&
    typeof (error as { containerLogsPreview?: unknown })
      .containerLogsPreview === 'string'
  ) {
    return (error as { containerLogsPreview: string }).containerLogsPreview;
  }
  return undefined;
}
