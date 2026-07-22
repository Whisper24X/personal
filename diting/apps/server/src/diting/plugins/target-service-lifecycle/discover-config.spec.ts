import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PreparedWorkspace, TitingTask } from "@diting/plugin-api";
import { discoverServiceStartupConfig } from "./discover-config";

describe("discoverServiceStartupConfig", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "diting-service-discovery-"));
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it("prefers task.metadata.serviceStartup.services over .diting/services.yaml", async () => {
    const workspace = await createWorkspaceWithFixture(sandbox);
    const task = createTask(workspace.repoPath, {
      serviceStartup: {
        enabled: true,
        services: [
          {
            id: "task-backend",
            cwd: ".",
            command: ["npm", "run", "start:dev"],
            healthUrl: "http://127.0.0.1:3001/health"
          }
        ]
      }
    });

    const discovered = await discoverServiceStartupConfig(task, workspace);

    expect(discovered).toEqual({
      enabled: true,
      configSource: "task",
      config: expect.objectContaining({
        services: [
          expect.objectContaining({
            id: "task-backend"
          })
        ]
      })
    });
  });

  it("loads .diting/services.yaml when metadata is absent", async () => {
    const workspace = await createWorkspaceWithFixture(sandbox);
    const task = createTask(workspace.repoPath, {});

    const discovered = await discoverServiceStartupConfig(task, workspace);

    expect(discovered).toEqual({
      enabled: true,
      configSource: "file",
      configPath: join(workspace.repoPath, ".diting", "services.yaml"),
      config: expect.objectContaining({
        schemaVersion: 1,
        services: [expect.objectContaining({ id: "backend" })]
      })
    });
  });

  it("merges .diting/services.yaml from every repo in multi-repo workspaces", async () => {
    const repoAPath = join(sandbox, "repo-a");
    const repoBPath = join(sandbox, "repo-b");
    await mkdir(join(repoAPath, ".diting"), { recursive: true });
    await mkdir(join(repoBPath, ".diting"), { recursive: true });
    await writeFile(join(repoAPath, ".diting", "services.yaml"), [
      "schemaVersion: 1",
      "defaults:",
      "  env:",
      "    FROM_REPO_A: \"true\"",
      "services:",
      "  - id: web",
      "    cwd: .",
      "    command: [\"npm\", \"run\", \"dev\"]",
      "    healthUrl: http://127.0.0.1:3000/health",
      ""
    ].join("\n"));
    await writeFile(join(repoBPath, ".diting", "services.yaml"), [
      "schemaVersion: 1",
      "services:",
      "  - id: api",
      "    repoKey: RepoB",
      "    cwd: .",
      "    command: [\"npm\", \"run\", \"start\"]",
      "    healthUrl: http://127.0.0.1:4000/health",
      ""
    ].join("\n"));
    const workspace = createWorkspace(repoAPath, [
      { key: "RepoA", path: repoAPath },
      { key: "RepoB", path: repoBPath }
    ]);
    const task = createTask(repoAPath, {});

    const discovered = await discoverServiceStartupConfig(task, workspace);

    expect(discovered).toEqual({
      enabled: true,
      configSource: "file",
      configPath: join(repoAPath, ".diting", "services.yaml"),
      configPaths: [
        join(repoAPath, ".diting", "services.yaml"),
        join(repoBPath, ".diting", "services.yaml")
      ],
      config: expect.objectContaining({
        schemaVersion: 1,
        services: [
          expect.objectContaining({ id: "web", repoKey: "RepoA" }),
          expect.objectContaining({ id: "api", repoKey: "RepoB" })
        ]
      })
    });
  });

  it("loads the injected servicesYaml file using metadata configPath", async () => {
    const repoPath = join(sandbox, "repo");
    const injectedPath = join(repoPath, ".diting", "generated", "services.yaml");
    await mkdir(join(repoPath, ".diting", "generated"), { recursive: true });
    await writeFile(injectedPath, [
      "schemaVersion: 1",
      "services:",
      "  - id: injected-backend",
      "    cwd: .",
      "    command: [\"npm\", \"run\", \"start:dev\"]",
      "    healthUrl: http://127.0.0.1:3000/health",
      ""
    ].join("\n"));
    const workspace = createWorkspace(repoPath);
    const task = createTask(repoPath, {
      serviceStartup: {
        configPath: ".diting/generated/services.yaml",
        servicesYaml: "schemaVersion: 1\nservices:\n  - id: ignored-inline\n"
      }
    });

    const discovered = await discoverServiceStartupConfig(task, workspace);

    expect(discovered).toEqual({
      enabled: true,
      configSource: "file",
      configPath: injectedPath,
      config: expect.objectContaining({
        services: [expect.objectContaining({ id: "injected-backend" })]
      })
    });
  });

  it("returns disabled when neither metadata nor config file exists", async () => {
    const repoPath = join(sandbox, "repo");
    await mkdir(repoPath, { recursive: true });
    const workspace = createWorkspace(repoPath);
    const task = createTask(repoPath, {});

    const discovered = await discoverServiceStartupConfig(task, workspace);

    expect(discovered).toEqual({
      enabled: false,
      configSource: "disabled"
    });
  });

  it("uses metadata explicit disabled over existing file", async () => {
    const workspace = await createWorkspaceWithFixture(sandbox);
    const task = createTask(workspace.repoPath, {
      serviceStartup: {
        enabled: false
      }
    });

    const discovered = await discoverServiceStartupConfig(task, workspace);

    expect(discovered).toEqual({
      enabled: false,
      configSource: "task"
    });
  });
});

async function createWorkspaceWithFixture(root: string): Promise<PreparedWorkspace> {
  const repoPath = join(root, "repo");
  await mkdir(join(repoPath, ".diting"), { recursive: true });
  const fixturePath = join(__dirname, "fixtures", "services.yaml");
  await writeFile(join(repoPath, ".diting", "services.yaml"), await readFile(fixturePath, "utf8"));
  return createWorkspace(repoPath);
}

function createWorkspace(repoPath: string, repos?: Array<{ key: string; path: string }>): PreparedWorkspace {
  return {
    workspacePath: repoPath,
    repoPath,
    repos: (repos ?? [{ key: "Repo1", path: repoPath }]).map((repo) => ({
      key: repo.key,
      url: `git@example.com:${repo.key}.git`,
      path: repo.path,
      cachePath: join(repo.path, ".cache")
    })),
    specRootPath: join(repoPath, "openspec"),
    branch: "feature/test",
    cachePath: join(repoPath, ".cache"),
    artifactsPath: join(repoPath, "artifacts"),
    env: {}
  };
}

function createTask(repoPath: string, metadata: Record<string, unknown>): TitingTask {
  const now = new Date("2026-06-22T00:00:00.000Z");
  return {
    id: "task-1",
    source: "test",
    externalId: null,
    title: "test",
    instruction: "test",
    repo: repoPath,
    branch: "feature/test",
    priority: "medium",
    status: "ready",
    executor: "codex",
    traceId: "trace-1",
    constraints: [],
    acceptanceCriteria: [],
    metadata,
    retryCount: 0,
    repairCount: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
}
