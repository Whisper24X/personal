import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  PreparedWorkspace,
  RunningService,
  ServiceStartupServiceConfig
} from "@diting/plugin-api";

type SpawnOptions = {
  cwd: string;
  env: Record<string, string | undefined>;
  stdio: ["ignore", "pipe", "pipe"];
};

type SpawnedServiceProcess = {
  pid?: number;
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
  once?: (event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void) => unknown;
};

type SpawnFn = (
  bin: string,
  args: string[],
  options: SpawnOptions
) => SpawnedServiceProcess;

export type ServiceProcessExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

export type ServiceExitProbe = {
  exit?: ServiceProcessExit;
  promise: Promise<ServiceProcessExit>;
};

const SERVICE_EXIT_PROMISE = Symbol("diting.serviceExitPromise");

type RunningServiceWithExitProbe = RunningService & {
  [SERVICE_EXIT_PROMISE]?: ServiceExitProbe;
};

export async function spawnServicesInDependencyOrder(input: {
  workspace: PreparedWorkspace;
  services: ServiceStartupServiceConfig[];
  artifactsPath?: string;
  spawnFn?: SpawnFn;
  beforeCommand?: (command: string[]) => Promise<void>;
  now?: () => Date;
}): Promise<RunningService[]> {
  const now = input.now ?? (() => new Date());
  const spawnFn = input.spawnFn ?? ((bin, args, options) => spawn(bin, args, options));
  const ordered = orderServicesByDependencies(input.services);
  const running: RunningService[] = [];

  for (const service of ordered) {
    const repoPath = resolveRepoPath(input.workspace, service.repoKey);
    const cwd = join(repoPath, service.cwd);
    await input.beforeCommand?.(service.command);
    const command = normalizeCommand(service.command, service.id);
    const child = spawnFn(command.bin, command.args, {
      cwd,
      env: {
        ...process.env,
        ...input.workspace.env,
        ...service.env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (typeof child.pid !== "number") {
      throw new Error(`service ${service.id} failed to spawn: missing pid`);
    }
    const runningService: RunningServiceWithExitProbe = {
      id: service.id,
      pid: child.pid,
      cwd,
      command: service.command,
      healthUrl: service.healthUrl,
      startedAt: now().toISOString(),
      readyAt: null,
      status: "starting"
    };
    attachExitProbe(runningService, child);
    await attachServiceLogs({
      child,
      artifactsPath: input.artifactsPath,
      serviceId: service.id
    });
    running.push(runningService);
  }

  return running;
}

export function getServiceExitProbe(service: RunningService): ServiceExitProbe | undefined {
  return (service as RunningServiceWithExitProbe)[SERVICE_EXIT_PROMISE];
}

function attachExitProbe(service: RunningServiceWithExitProbe, child: SpawnedServiceProcess): void {
  if (typeof child.once !== "function") {
    return;
  }

  const probe: ServiceExitProbe = {
    promise: Promise.resolve({ code: null, signal: null })
  };
  const exitPromise = new Promise<ServiceProcessExit>((resolve) => {
    child.once?.("exit", (code, signal) => {
      probe.exit = { code, signal };
      setImmediate(() => resolve(probe.exit ?? { code, signal }));
    });
  });
  probe.promise = exitPromise;
  Object.defineProperty(service, SERVICE_EXIT_PROMISE, {
    value: probe,
    enumerable: false
  });
}

async function attachServiceLogs(input: {
  child: SpawnedServiceProcess;
  artifactsPath: string | undefined;
  serviceId: string;
}): Promise<void> {
  if (!input.artifactsPath) {
    input.child.stdout?.resume();
    input.child.stderr?.resume();
    return;
  }

  const logsDir = join(input.artifactsPath, "target-services");
  await mkdir(logsDir, { recursive: true });
  const serviceId = sanitizeLogFilePart(input.serviceId);
  input.child.stdout?.pipe(createWriteStream(join(logsDir, `${serviceId}.stdout.log`), { flags: "a" }));
  input.child.stderr?.pipe(createWriteStream(join(logsDir, `${serviceId}.stderr.log`), { flags: "a" }));
}

function sanitizeLogFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveRepoPath(workspace: PreparedWorkspace, repoKey: string | undefined): string {
  if (repoKey) {
    const match = workspace.repos.find((repo) => repo.key === repoKey);
    if (!match) {
      throw new Error(`repoKey ${repoKey} not found in workspace`);
    }
    return match.path;
  }
  return workspace.repos[0]?.path ?? workspace.repoPath;
}

function normalizeCommand(command: string[], serviceId: string): { bin: string; args: string[] } {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error(`service ${serviceId} command must be a non-empty array`);
  }
  const [bin, ...args] = command;
  if (!bin || bin.trim().length === 0) {
    throw new Error(`service ${serviceId} command[0] must be non-empty`);
  }
  return { bin, args };
}

function orderServicesByDependencies(services: ServiceStartupServiceConfig[]): ServiceStartupServiceConfig[] {
  const byId = new Map(services.map((service) => [service.id, service]));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const service of services) {
    indegree.set(service.id, 0);
    outgoing.set(service.id, []);
  }

  for (const service of services) {
    for (const dependencyId of service.dependsOn ?? []) {
      if (!byId.has(dependencyId)) {
        throw new Error(`service ${service.id} dependsOn unknown service ${dependencyId}`);
      }
      indegree.set(service.id, (indegree.get(service.id) ?? 0) + 1);
      outgoing.get(dependencyId)?.push(service.id);
    }
  }

  const queue = services
    .filter((service) => (indegree.get(service.id) ?? 0) === 0)
    .map((service) => service.id);
  const ordered: ServiceStartupServiceConfig[] = [];

  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId) {
      break;
    }
    const next = byId.get(nextId);
    if (!next) {
      continue;
    }
    ordered.push(next);
    for (const childId of outgoing.get(nextId) ?? []) {
      const newDegree = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, newDegree);
      if (newDegree === 0) {
        queue.push(childId);
      }
    }
  }

  if (ordered.length !== services.length) {
    throw new Error("service dependency graph contains a cycle");
  }

  return ordered;
}
