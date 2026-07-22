import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RunningService } from "@diting/plugin-api";

type StopServicesInput = {
  services: RunningService[];
  artifactsPath: string;
  stopTimeoutMs: number;
  killFn?: (pid: number, signal: NodeJS.Signals) => void;
  waitForExit?: (pid: number, timeoutMs: number) => Promise<boolean>;
  now?: () => Date;
};

type StoppedService = RunningService & {
  stoppedAt: string;
};

export async function stopServices(input: StopServicesInput): Promise<StoppedService[]> {
  const killFn = input.killFn ?? defaultKill;
  const waitForExit = input.waitForExit ?? defaultWaitForExit;
  const now = input.now ?? (() => new Date());
  const stoppedAt = now().toISOString();

  const reversed = [...input.services].reverse();
  const updates = new Map<string, StoppedService>();

  for (const service of reversed) {
    const signaled = tryKill(killFn, service.pid, "SIGTERM");
    const exited = signaled ? await waitForExit(service.pid, input.stopTimeoutMs) : true;
    if (!exited) {
      tryKill(killFn, service.pid, "SIGKILL");
    }
    updates.set(service.id, {
      ...service,
      status: "stopped",
      stoppedAt
    });
  }

  const stopped = input.services.map((service) => {
    const updated = updates.get(service.id);
    if (!updated) {
      throw new Error(`service ${service.id} stop update missing`);
    }
    return updated;
  });

  await mkdir(input.artifactsPath, { recursive: true });
  await writeFile(
    join(input.artifactsPath, "services.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        configSource: "inferred",
        running: stopped
      },
      null,
      2
    )}\n`
  );

  return stopped;
}

function defaultKill(pid: number, signal: NodeJS.Signals): void {
  process.kill(pid, signal);
}

function tryKill(
  killFn: (pid: number, signal: NodeJS.Signals) => void,
  pid: number,
  signal: NodeJS.Signals
): boolean {
  try {
    killFn(pid, signal);
    return true;
  } catch (error) {
    if (isNoSuchProcessError(error)) {
      return false;
    }
    throw error;
  }
}

function isNoSuchProcessError(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ESRCH"
  );
}

async function defaultWaitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (!isAlive(pid)) {
      return true;
    }
    await sleep(100);
  }
  return !isAlive(pid);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
