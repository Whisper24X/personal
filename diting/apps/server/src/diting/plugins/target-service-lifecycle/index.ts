import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PreparedWorkspace, RunningService, ServiceStartupServiceConfig } from "@diting/plugin-api";
import {
  getServiceExitProbe,
  ServiceProcessExit,
  spawnServicesInDependencyOrder
} from "./spawn-service";
import { waitForServiceHealth } from "./health-probe";
import { stopServices } from "./stop-services";
import { tryReuseRunningServices } from "./reuse";
import {
  buildServiceStartupDiagnostics,
  readServiceStartupDiagnostics,
  selectObservedHealthUrl
} from "./service-diagnostics";
import { EnvironmentPreparationError } from "../shared";

export async function startTargetServices(input: {
  workspace: PreparedWorkspace;
  services: ServiceStartupServiceConfig[];
  artifactsPath: string;
  configSource: "task" | "file" | "inferred";
  spawnFn?: (
    bin: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
      stdio: ["ignore", "pipe", "pipe"];
    }
  ) => {
    pid?: number;
    stdout?: NodeJS.ReadableStream | null;
    stderr?: NodeJS.ReadableStream | null;
  };
  beforeCommand?: (command: string[]) => Promise<void>;
  allowReuse?: boolean;
  httpGet?: (url: string) => Promise<number>;
  isPidAlive?: (pid: number) => boolean;
  killFn?: (pid: number, signal: NodeJS.Signals) => void;
  waitForExit?: (pid: number, timeoutMs: number) => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}): Promise<RunningService[]> {
  if (input.allowReuse !== false) {
    const reused = await tryReuseRunningServices({
      workspace: input.workspace,
      services: input.services,
      artifactsPath: input.artifactsPath,
      httpGet: input.httpGet,
      isPidAlive: input.isPidAlive,
      now: input.now
    });
    if (reused) {
      await writeServicesSnapshot({
        artifactsPath: input.artifactsPath,
        configSource: input.configSource,
        services: reused
      });
      return reused;
    }
  }

  const now = input.now ?? (() => new Date());
  const started = await spawnServicesInDependencyOrder({
    workspace: input.workspace,
    services: input.services,
    artifactsPath: input.artifactsPath,
    beforeCommand: input.beforeCommand,
    spawnFn: input.spawnFn,
    now
  });

  const byId = new Map(input.services.map((service) => [service.id, service]));
  const ready: RunningService[] = [];
  try {
    for (const service of started) {
      const config = byId.get(service.id);
      const probeInput = {
        timeoutMs: config?.startupTimeoutMs ?? 120_000,
        intervalMs: config?.healthIntervalMs ?? 2_000,
        httpGet: input.httpGet,
        diagnose: () => buildServiceStartupDiagnostics({
          artifactsPath: input.artifactsPath,
          serviceId: service.id
        }),
        sleep: input.sleep,
        now
      };
      const readyService = await waitForServiceOrExit({
        service,
        artifactsPath: input.artifactsPath,
        probeInput
      }).catch(async (error: unknown) => {
        const reconciled = await tryReconcileObservedHealthUrl({
          error,
          service,
          artifactsPath: input.artifactsPath,
          probeInput
        });
        if (reconciled) {
          return reconciled;
        }
        throw error;
      });
      ready.push(readyService);
    }
  } catch (error) {
    await stopServices({
      services: started,
      artifactsPath: input.artifactsPath,
      stopTimeoutMs: resolveStartupFailureStopTimeout(input.services),
      killFn: input.killFn,
      waitForExit: input.waitForExit,
      now
    });
    throw error;
  }

  await writeServicesSnapshot({
    artifactsPath: input.artifactsPath,
    configSource: input.configSource,
    services: ready
  });
  return ready;
}

export async function stopTargetServices(input: {
  services: RunningService[];
  artifactsPath: string;
  stopTimeoutMs: number;
  killFn?: (pid: number, signal: NodeJS.Signals) => void;
  waitForExit?: (pid: number, timeoutMs: number) => Promise<boolean>;
  now?: () => Date;
}) {
  return stopServices({
    services: input.services,
    artifactsPath: input.artifactsPath,
    stopTimeoutMs: input.stopTimeoutMs,
    killFn: input.killFn,
    waitForExit: input.waitForExit,
    now: input.now
  });
}

async function writeServicesSnapshot(input: {
  artifactsPath: string;
  configSource: "task" | "file" | "inferred";
  services: RunningService[];
}) {
  await mkdir(input.artifactsPath, { recursive: true });
  await writeFile(
    join(input.artifactsPath, "services.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        configSource: input.configSource,
        running: input.services
      },
      null,
      2
    )}\n`
  );
}

function resolveStartupFailureStopTimeout(services: ServiceStartupServiceConfig[]): number {
  const configured = services
    .map((service) => service.stopTimeoutMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  return configured.length > 0 ? Math.max(...configured) : 15_000;
}

async function tryReconcileObservedHealthUrl(input: {
  error: unknown;
  service: RunningService;
  artifactsPath: string;
  probeInput: Parameters<typeof waitForServiceHealth>[1];
}): Promise<RunningService | null> {
  if (!(input.error instanceof EnvironmentPreparationError) || input.error.stage !== "service_startup") {
    return null;
  }

  const diagnostics = await readServiceStartupDiagnostics({
    artifactsPath: input.artifactsPath,
    serviceId: input.service.id
  });
  const reconciledHealthUrl = selectObservedHealthUrl(input.service.healthUrl, diagnostics.observedUrls);
  if (!reconciledHealthUrl) {
    return null;
  }

  const reconciledService = {
    ...input.service,
    healthUrl: reconciledHealthUrl
  };
  try {
    return await waitForServiceHealth(reconciledService, {
      ...input.probeInput,
      diagnose: () => Promise.resolve(diagnostics.detail)
    });
  } catch {
    return null;
  }
}

async function waitForServiceOrExit(input: {
  service: RunningService;
  artifactsPath: string;
  probeInput: Parameters<typeof waitForServiceHealth>[1];
}): Promise<RunningService> {
  const exitProbe = getServiceExitProbe(input.service);
  if (!exitProbe) {
    return waitForServiceHealth(input.service, input.probeInput);
  }
  if (exitProbe.exit) {
    return buildServiceExitError({
      service: input.service,
      artifactsPath: input.artifactsPath,
      exit: exitProbe.exit
    });
  }

  return Promise.race([
    waitForServiceHealth(input.service, input.probeInput),
    exitProbe.promise.then((exit) => buildServiceExitError({
      service: input.service,
      artifactsPath: input.artifactsPath,
      exit
    }))
  ]);
}

async function buildServiceExitError(input: {
  service: RunningService;
  artifactsPath: string;
  exit: ServiceProcessExit;
}): Promise<never> {
  const diagnostics = await buildServiceStartupDiagnostics({
    artifactsPath: input.artifactsPath,
    serviceId: input.service.id
  });
  const exitDetail = formatExitDetail(input.exit);
  const commandDetail = `command=${JSON.stringify(input.service.command)}`;
  const detail = [commandDetail, exitDetail, diagnostics].filter(Boolean).join(" ");
  throw new EnvironmentPreparationError(
    "service_startup",
    `Service ${input.service.id} exited before becoming healthy`,
    detail,
    false
  );
}

function formatExitDetail(exit: ServiceProcessExit): string {
  if (typeof exit.code === "number") {
    return `exitCode=${exit.code}`;
  }
  if (exit.signal) {
    return `signal=${exit.signal}`;
  }
  return "exitCode=null";
}
