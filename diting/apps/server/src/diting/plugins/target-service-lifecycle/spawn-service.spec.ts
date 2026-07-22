import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { PreparedWorkspace, ServiceStartupServiceConfig } from "@diting/plugin-api";
import { getServiceExitProbe, spawnServicesInDependencyOrder } from "./spawn-service";

describe("spawnServicesInDependencyOrder", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "diting-spawn-services-"));
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it("spawns services in dependsOn topological order", async () => {
    const workspace = createWorkspace("/tmp/repo1");
    const calls: Array<{ bin: string; args: string[]; options: { cwd?: string } }> = [];
    const services: ServiceStartupServiceConfig[] = [
      {
        id: "frontend",
        cwd: "apps/web",
        command: ["npm", "run", "dev"],
        healthUrl: "http://127.0.0.1:5173",
        dependsOn: ["backend"]
      },
      {
        id: "backend",
        cwd: "apps/server",
        command: ["npm", "run", "start:dev"],
        healthUrl: "http://127.0.0.1:3000/health"
      }
    ];

    const running = await spawnServicesInDependencyOrder({
      workspace,
      services,
      spawnFn: (bin, args, options) => {
        calls.push({ bin, args, options: { cwd: options.cwd } });
        return { pid: calls.length + 1000 };
      },
      now: () => new Date("2026-06-22T01:02:03.000Z")
    });

    expect(calls.map((call) => call.options.cwd)).toEqual([
      join("/tmp/repo1", "apps/server"),
      join("/tmp/repo1", "apps/web")
    ]);
    expect(running.map((service) => service.id)).toEqual(["backend", "frontend"]);
    expect(running.map((service) => service.pid)).toEqual([1001, 1002]);
  });

  it("passes command/cwd/env to spawn", async () => {
    const workspace = createWorkspace("/tmp/repo1");
    const services: ServiceStartupServiceConfig[] = [
      {
        id: "backend",
        repoKey: "Repo1",
        cwd: "apps/server",
        command: ["npm", "run", "start:dev"],
        healthUrl: "http://127.0.0.1:3000/health",
        env: {
          NODE_ENV: "test"
        }
      }
    ];

    const calls: Array<{ bin: string; args: string[]; options: { cwd?: string; env?: Record<string, string | undefined> } }> = [];

    await spawnServicesInDependencyOrder({
      workspace,
      services,
      spawnFn: (bin, args, options) => {
        calls.push({ bin, args, options: { cwd: options.cwd, env: options.env } });
        return { pid: 2001 };
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      bin: "npm",
      args: ["run", "start:dev"],
      options: {
        cwd: join("/tmp/repo1", "apps/server"),
        env: expect.objectContaining({
          BASE_ENV: "base",
          NODE_ENV: "test"
        })
      }
    });
  });

  it("runs governance beforeCommand check before spawn", async () => {
    const workspace = createWorkspace("/tmp/repo1");
    const services: ServiceStartupServiceConfig[] = [
      {
        id: "backend",
        cwd: "apps/server",
        command: ["npm", "run", "start:dev"],
        healthUrl: "http://127.0.0.1:3000/health"
      }
    ];
    const checked: string[] = [];
    const spawned: string[] = [];

    await spawnServicesInDependencyOrder({
      workspace,
      services,
      beforeCommand: async (command) => {
        checked.push(command.join(" "));
      },
      spawnFn: (bin) => {
        spawned.push(bin);
        return { pid: 3001 };
      }
    });

    expect(checked).toEqual(["npm run start:dev"]);
    expect(spawned).toEqual(["npm"]);
  });

  it("writes service stdout and stderr to artifacts logs", async () => {
    const workspace = createWorkspace("/tmp/repo1");
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const services: ServiceStartupServiceConfig[] = [
      {
        id: "trip-miniprogram-h5",
        cwd: ".",
        command: ["npm", "run", "dev:h5"],
        healthUrl: "http://127.0.0.1:8200/"
      }
    ];

    await spawnServicesInDependencyOrder({
      workspace,
      services,
      artifactsPath: sandbox,
      spawnFn: () => ({ pid: 4001, stdout, stderr })
    });

    stdout.end("h5 stdout\n");
    stderr.end("h5 stderr\n");

    await expectEventually(async () => {
      await expect(readFile(join(sandbox, "target-services", "trip-miniprogram-h5.stdout.log"), "utf8"))
        .resolves.toBe("h5 stdout\n");
      await expect(readFile(join(sandbox, "target-services", "trip-miniprogram-h5.stderr.log"), "utf8"))
        .resolves.toBe("h5 stderr\n");
    });
  });

  it("attaches an internal exit probe before service health checks", async () => {
    const workspace = createWorkspace("/tmp/repo1");
    const child = new EventEmitter() as EventEmitter & { pid: number };
    child.pid = 5001;
    const services: ServiceStartupServiceConfig[] = [
      {
        id: "yanxue",
        cwd: ".",
        command: ["make", "run", "development"],
        healthUrl: "http://127.0.0.1:8000/"
      }
    ];

    const [service] = await spawnServicesInDependencyOrder({
      workspace,
      services,
      spawnFn: () => child
    });
    const exitProbe = getServiceExitProbe(service);

    expect(exitProbe).toBeDefined();
    child.emit("exit", 127, null);
    expect(exitProbe?.exit).toEqual({ code: 127, signal: null });
    await expect(exitProbe?.promise).resolves.toEqual({ code: 127, signal: null });
  });
});

function createWorkspace(repoPath: string): PreparedWorkspace {
  return {
    workspacePath: "/tmp/workspace-1",
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
    artifactsPath: join(repoPath, "artifacts"),
    env: {
      BASE_ENV: "base"
    }
  };
}

async function expectEventually(assertion: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError;
}
