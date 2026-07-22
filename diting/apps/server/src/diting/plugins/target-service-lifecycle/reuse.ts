import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PreparedWorkspace, RunningService, ServiceStartupServiceConfig } from "@diting/plugin-api";

export async function tryReuseRunningServices(input: {
  workspace: PreparedWorkspace;
  services: ServiceStartupServiceConfig[];
  artifactsPath: string;
  httpGet?: (url: string) => Promise<number>;
  isPidAlive?: (pid: number) => boolean;
  now?: () => Date;
}): Promise<RunningService[] | null> {
  const expectedIds = new Set(input.services.map((service) => service.id));
  const candidates = input.workspace.services?.running?.length
    ? input.workspace.services.running
    : await readServicesSnapshot(input.artifactsPath);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const scoped = candidates.filter((service) => expectedIds.has(service.id));
  if (scoped.length !== expectedIds.size) {
    return null;
  }

  const isPidAlive = input.isPidAlive ?? defaultIsPidAlive;
  const httpGet = input.httpGet ?? defaultHttpGet;
  const now = input.now ?? (() => new Date());
  const reused: RunningService[] = [];

  for (const service of scoped) {
    if (!isPidAlive(service.pid)) {
      return null;
    }
    try {
      const statusCode = await httpGet(service.healthUrl);
      if (statusCode < 200 || statusCode >= 300) {
        return null;
      }
    } catch {
      return null;
    }
    reused.push({
      ...service,
      status: "ready",
      readyAt: service.readyAt ?? now().toISOString()
    });
  }

  return reused;
}

async function readServicesSnapshot(artifactsPath: string): Promise<RunningService[] | null> {
  try {
    const raw = await readFile(join(artifactsPath, "services.json"), "utf8");
    const parsed = JSON.parse(raw) as { running?: RunningService[] };
    if (!Array.isArray(parsed.running)) {
      return null;
    }
    return parsed.running;
  } catch {
    return null;
  }
}

function defaultIsPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function defaultHttpGet(url: string): Promise<number> {
  const response = await fetch(url);
  return response.status;
}
