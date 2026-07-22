import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { PreparedWorkspace, ServiceStartupServiceConfig } from "@diting/plugin-api";
import { startTargetServices, stopTargetServices } from "./index";

describe("target-service-lifecycle integration", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "diting-tsl-"));
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it("runs start -> health -> stop with mock HTTP server", async () => {
    const repoPath = join(sandbox, "repo");
    const artifactsPath = join(sandbox, "artifacts");
    const workspace = createWorkspace(repoPath, artifactsPath);
    const healthServer = await startHealthServer();
    const calls: Array<{ pid: number; signal: NodeJS.Signals }> = [];

    try {
      const services: ServiceStartupServiceConfig[] = [
        {
          id: "backend",
          cwd: ".",
          command: ["npm", "run", "start:dev"],
          healthUrl: `${healthServer.url}/health`,
          startupTimeoutMs: 3_000,
          healthIntervalMs: 100
        }
      ];

      const ready = await startTargetServices({
        workspace,
        services,
        artifactsPath,
        configSource: "task",
        spawnFn: () => ({ pid: 3001 }),
        sleep: async () => undefined,
        now: () => new Date("2026-06-22T04:00:00.000Z")
      });

      expect(ready).toEqual([
        expect.objectContaining({
          id: "backend",
          pid: 3001,
          status: "ready",
          readyAt: "2026-06-22T04:00:00.000Z"
        })
      ]);

      const stopped = await stopTargetServices({
        services: ready,
        artifactsPath,
        stopTimeoutMs: 500,
        killFn: (pid, signal) => calls.push({ pid, signal }),
        waitForExit: async () => true,
        now: () => new Date("2026-06-22T04:01:00.000Z")
      });

      expect(stopped[0]?.status).toBe("stopped");
      expect(calls).toEqual([{ pid: 3001, signal: "SIGTERM" }]);

      const snapshot = JSON.parse(await readFile(join(artifactsPath, "services.json"), "utf8")) as {
        running: Array<{ id: string; status: string }>;
      };
      expect(snapshot.running).toEqual([expect.objectContaining({ id: "backend", status: "stopped" })]);
    } finally {
      await healthServer.close();
    }
  });

  it("reuses existing running services when round is not executed", async () => {
    const repoPath = join(sandbox, "repo");
    const artifactsPath = join(sandbox, "artifacts");
    const workspace = createWorkspace(repoPath, artifactsPath);
    workspace.services = {
      schemaVersion: 1,
      configSource: "file",
      running: [
        {
          id: "backend",
          pid: 3001,
          cwd: repoPath,
          command: ["npm", "run", "start:dev"],
          healthUrl: "http://127.0.0.1:3000/health",
          startedAt: "2026-06-22T03:59:00.000Z",
          readyAt: "2026-06-22T03:59:05.000Z",
          status: "ready"
        }
      ]
    };
    const services: ServiceStartupServiceConfig[] = [
      {
        id: "backend",
        cwd: ".",
        command: ["npm", "run", "start:dev"],
        healthUrl: "http://127.0.0.1:3000/health"
      }
    ];
    const spawnCommands: string[] = [];

    const reused = await startTargetServices({
      workspace,
      services,
      artifactsPath,
      configSource: "file",
      allowReuse: true,
      isPidAlive: () => true,
      httpGet: async () => 200,
      spawnFn: (bin) => {
        spawnCommands.push(bin);
        return { pid: 4001 };
      }
    });

    expect(spawnCommands).toEqual([]);
    expect(reused).toEqual([
      expect.objectContaining({
        id: "backend",
        pid: 3001,
        status: "ready"
      })
    ]);
  });

  it("stops already spawned services when health probing fails", async () => {
    const repoPath = join(sandbox, "repo");
    const artifactsPath = join(sandbox, "artifacts");
    const workspace = createWorkspace(repoPath, artifactsPath);
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let nowTick = 0;

    await expect(
      startTargetServices({
        workspace,
        artifactsPath,
        configSource: "task",
        services: [
          {
            id: "backend",
            cwd: ".",
            command: ["npm", "run", "start:dev"],
            healthUrl: "http://127.0.0.1:3000/health",
            startupTimeoutMs: 1,
            healthIntervalMs: 1
          }
        ],
        spawnFn: () => ({ pid: 3001 }),
        httpGet: async () => 503,
        sleep: async () => undefined,
        killFn: (pid, signal) => signals.push({ pid, signal }),
        waitForExit: async () => true,
        now: () => new Date(Date.UTC(2026, 5, 22, 4, 0, 0, nowTick++))
      })
    ).rejects.toThrow("Service backend health probe timed out");

    expect(signals).toEqual([{ pid: 3001, signal: "SIGTERM" }]);
  });

  it("reports a startup command failure when the service process exits before health is ready", async () => {
    const repoPath = join(sandbox, "repo");
    const artifactsPath = join(sandbox, "artifacts");
    const workspace = createWorkspace(repoPath, artifactsPath);
    const stderr = new PassThrough();
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdout: PassThrough;
      stderr: PassThrough;
    };
    child.pid = 3004;
    child.stdout = new PassThrough();
    child.stderr = stderr;
    let nowTick = 0;
    let exited = false;

    const startup = startTargetServices({
      workspace,
      artifactsPath,
      configSource: "task",
      services: [
        {
          id: "yanxue",
          cwd: ".",
          command: ["make", "run", "development"],
          healthUrl: "http://127.0.0.1:8000/",
          startupTimeoutMs: 1000,
          healthIntervalMs: 1
        }
      ],
      spawnFn: () => child,
      httpGet: async () => {
        if (!exited) {
          exited = true;
          stderr.end("/bin/sh: kratos: command not found\nmake: *** [run] Error 127\n");
          child.emit("exit", 127, null);
        }
        throw new Error("connection refused");
      },
      sleep: () => new Promise((resolve) => setImmediate(resolve)),
      killFn: () => undefined,
      waitForExit: async () => true,
      now: () => new Date(Date.UTC(2026, 5, 22, 4, 0, 0, nowTick++))
    });

    await expect(startup).rejects.toThrow("Service yanxue exited before becoming healthy");
    await expect(startup).rejects.toMatchObject({
      detail: expect.stringContaining("kratos: command not found"),
      retryable: false
    });
  });

  it("includes service logs and observed URLs in health timeout errors", async () => {
    const repoPath = join(sandbox, "repo");
    const artifactsPath = join(sandbox, "artifacts");
    const workspace = createWorkspace(repoPath, artifactsPath);
    let nowTick = 0;
    await mkdir(join(artifactsPath, "target-services"), { recursive: true });
    await writeFile(
      join(artifactsPath, "target-services", "trip-miniprogram-h5.stdout.log"),
      "Local:   http://localhost:10086/\n"
    );

    await expect(
      startTargetServices({
        workspace,
        artifactsPath,
        configSource: "task",
        services: [
          {
            id: "trip-miniprogram-h5",
            cwd: ".",
            command: ["npm", "run", "dev:h5"],
            healthUrl: "http://127.0.0.1:8200/",
            startupTimeoutMs: 1,
            healthIntervalMs: 1
          }
        ],
        spawnFn: () => ({ pid: 3002 }),
        httpGet: async () => {
          throw new Error("connection refused");
        },
        sleep: async () => undefined,
        killFn: () => undefined,
        waitForExit: async () => true,
        now: () => new Date(Date.UTC(2026, 5, 22, 4, 0, 0, nowTick++))
      })
    ).rejects.toThrow(/observedUrls=http:\/\/localhost:10086\/.*stdoutTail=.*Local:/s);
  });

  it("reconciles healthUrl from observed service URL when the observed URL is healthy", async () => {
    const repoPath = join(sandbox, "repo");
    const artifactsPath = join(sandbox, "artifacts");
    const workspace = createWorkspace(repoPath, artifactsPath);
    const probedUrls: string[] = [];
    let nowTick = 0;
    await mkdir(join(artifactsPath, "target-services"), { recursive: true });
    await writeFile(
      join(artifactsPath, "target-services", "trip-miniprogram-h5.stdout.log"),
      "Local:   http://localhost:10086/\n"
    );

    const ready = await startTargetServices({
      workspace,
      artifactsPath,
      configSource: "task",
      services: [
        {
          id: "trip-miniprogram-h5",
          cwd: ".",
          command: ["npm", "run", "dev:h5"],
          healthUrl: "http://127.0.0.1:8200/",
          startupTimeoutMs: 1,
          healthIntervalMs: 1
        }
      ],
      spawnFn: () => ({ pid: 3003 }),
      httpGet: async (url) => {
        probedUrls.push(url);
        if (url === "http://localhost:10086/") {
          return 200;
        }
        throw new Error("connection refused");
      },
      sleep: async () => undefined,
      now: () => new Date(Date.UTC(2026, 5, 22, 4, 0, 0, nowTick++))
    });

    expect(probedUrls).toContain("http://127.0.0.1:8200/");
    expect(probedUrls).toContain("http://localhost:10086/");
    expect(ready[0]).toEqual(expect.objectContaining({
      id: "trip-miniprogram-h5",
      healthUrl: "http://localhost:10086/",
      status: "ready"
    }));
    const snapshot = JSON.parse(await readFile(join(artifactsPath, "services.json"), "utf8")) as {
      running: Array<{ id: string; healthUrl: string; status: string }>;
    };
    expect(snapshot.running[0]).toEqual(expect.objectContaining({
      healthUrl: "http://localhost:10086/",
      status: "ready"
    }));
  });
});

function createWorkspace(repoPath: string, artifactsPath: string): PreparedWorkspace {
  return {
    workspacePath: repoPath,
    repoPath,
    repos: [
      {
        key: "Repo1",
        url: "git@example.com:repo1.git",
        path: repoPath,
        cachePath: join(repoPath, ".cache")
      }
    ],
    specRootPath: join(repoPath, "openspec"),
    branch: "feature/test",
    cachePath: join(repoPath, ".cache"),
    artifactsPath,
    env: {}
  };
}

async function startHealthServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.end("not-found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start health server");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}
