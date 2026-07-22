import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunningService } from "@diting/plugin-api";
import { stopServices } from "./stop-services";

describe("stopServices", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "diting-stop-services-"));
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it("stops services in reverse order with SIGTERM", async () => {
    const calls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const stopped = await stopServices({
      services: createRunningServices(),
      artifactsPath: join(sandbox, "artifacts"),
      stopTimeoutMs: 500,
      killFn: (pid, signal) => {
        calls.push({ pid, signal });
      },
      waitForExit: async () => true,
      now: () => new Date("2026-06-22T03:00:00.000Z")
    });

    expect(calls).toEqual([
      { pid: 2002, signal: "SIGTERM" },
      { pid: 2001, signal: "SIGTERM" }
    ]);
    expect(stopped.map((service) => service.status)).toEqual(["stopped", "stopped"]);
  });

  it("escalates to SIGKILL when process does not exit in time", async () => {
    const calls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    await stopServices({
      services: createRunningServices(),
      artifactsPath: join(sandbox, "artifacts"),
      stopTimeoutMs: 100,
      killFn: (pid, signal) => {
        calls.push({ pid, signal });
      },
      waitForExit: async () => false
    });

    expect(calls).toEqual([
      { pid: 2002, signal: "SIGTERM" },
      { pid: 2002, signal: "SIGKILL" },
      { pid: 2001, signal: "SIGTERM" },
      { pid: 2001, signal: "SIGKILL" }
    ]);
  });

  it("treats ESRCH during SIGTERM as already stopped", async () => {
    const calls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const stopped = await stopServices({
      services: createRunningServices().slice(0, 1),
      artifactsPath: join(sandbox, "artifacts"),
      stopTimeoutMs: 100,
      killFn: (pid, signal) => {
        calls.push({ pid, signal });
        throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
      },
      waitForExit: async () => {
        throw new Error("waitForExit should not be called after ESRCH");
      }
    });

    expect(calls).toEqual([{ pid: 2001, signal: "SIGTERM" }]);
    expect(stopped[0]?.status).toBe("stopped");
  });

  it("ignores ESRCH during SIGKILL escalation", async () => {
    const calls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const stopped = await stopServices({
      services: createRunningServices().slice(0, 1),
      artifactsPath: join(sandbox, "artifacts"),
      stopTimeoutMs: 100,
      killFn: (pid, signal) => {
        calls.push({ pid, signal });
        if (signal === "SIGKILL") {
          throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
        }
      },
      waitForExit: async () => false
    });

    expect(calls).toEqual([
      { pid: 2001, signal: "SIGTERM" },
      { pid: 2001, signal: "SIGKILL" }
    ]);
    expect(stopped[0]?.status).toBe("stopped");
  });

  it("writes artifacts/services.json with stopped status", async () => {
    await stopServices({
      services: createRunningServices(),
      artifactsPath: join(sandbox, "artifacts"),
      stopTimeoutMs: 200,
      killFn: () => undefined,
      waitForExit: async () => true,
      now: () => new Date("2026-06-22T03:01:00.000Z")
    });

    const raw = await readFile(join(sandbox, "artifacts", "services.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      schemaVersion: number;
      configSource: string;
      running: Array<{ id: string; status: string; stoppedAt?: string }>;
    };

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.configSource).toBe("inferred");
    expect(parsed.running).toEqual([
      expect.objectContaining({
        id: "backend",
        status: "stopped",
        stoppedAt: "2026-06-22T03:01:00.000Z"
      }),
      expect.objectContaining({
        id: "frontend",
        status: "stopped",
        stoppedAt: "2026-06-22T03:01:00.000Z"
      })
    ]);
  });
});

function createRunningServices(): RunningService[] {
  return [
    {
      id: "backend",
      pid: 2001,
      cwd: "/tmp/repo/apps/server",
      command: ["npm", "run", "start:dev"],
      healthUrl: "http://127.0.0.1:3000/health",
      startedAt: "2026-06-22T02:50:00.000Z",
      readyAt: "2026-06-22T02:50:30.000Z",
      status: "ready"
    },
    {
      id: "frontend",
      pid: 2002,
      cwd: "/tmp/repo/apps/web",
      command: ["npm", "run", "dev"],
      healthUrl: "http://127.0.0.1:5173",
      startedAt: "2026-06-22T02:50:00.000Z",
      readyAt: "2026-06-22T02:50:40.000Z",
      status: "ready"
    }
  ];
}
