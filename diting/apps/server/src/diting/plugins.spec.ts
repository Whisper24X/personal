import { access, chmod, mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  CodexExecutionPlugin,
  CursorExecutionPlugin,
  DefaultOpenSpecCompletionGatePlugin,
  DefaultObservabilityGovernancePlugin,
  DefaultQualityPlugin,
  EnvironmentPreparationError,
  GitLabCliIntegrationPlugin,
  MeegleTaskIntegrationPlugin,
  LocalWorktreeEnvironmentPlugin,
  ProductCodexExecutionPlugin,
  QualityCodexExecutionPlugin,
  createBuiltinPluginGroups,
  parseOpenSpecReviewReply,
  RootLogsPlugin
} from "./plugins";
import { ServerConfig } from "./config";
import { FileExecutionLogRepository } from "./log-adapters";
import {
  extractFeishuFileTokenFromDownloadUrl,
  extractSpecAttachmentsFromRow,
  extractMoqlSearchFieldBag,
  extractWorkitemFieldsBag,
  isFeishuProjectDownloadUrl,
  mergeMeegleFieldsIntoRow,
  mapMeegleTask,
  normalizeRepoUrl,
  detectDefaultBaseBranch,
  parseMultiRepoDescriptionBlock,
  runCommand,
  extractJsonSessionId,
  extractTaskDetailPayload,
  mergeMeegleTaskRecords,
  hashRepo
} from "./plugins/shared";
import { downloadSpecToDirectory, materializeSpecDocuments } from "./plugins/spec-documents";
import { installWorkspaceTooling, REQUIRED_SUPERPOWERS_SKILL_IDS } from "./plugins/workspace-tooling";
import { runTaskPreflight } from "./plugins/task-preflight";
import { buildServiceStartupToolchainEnv } from "./plugins/environment";
import {
  buildPullRequestCreateCommand,
  createPullRequestsForTask,
  detectPullRequestProvider
} from "./plugins/pull-request";
import { getExternalPluginPackageName } from "./external-plugins";
import { AgentPlugin, TitingTask } from "@diting/plugin-api";

const execFileAsync = promisify(execFile);

describe("runCommand", () => {
  it("closes child stdin so CLI commands do not wait for additional input", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-run-command-"));
    try {
      const scriptPath = join(sandbox, "wait-for-stdin.js");
      await writeFile(scriptPath, [
        "process.stdin.resume();",
        "process.stdin.on('data', () => {});",
        "process.stdin.on('end', () => {",
        "  process.stdout.write('stdin closed');",
        "});"
      ].join("\n"));

      const result = await runCommand(process.execPath, [scriptPath], sandbox, 5_000);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("stdin closed");
      expect(result.timedOut).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("built-in plugin assembly", () => {
  it("registers quality orchestrator agent plugins", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-plugin-assembly-"));
    try {
      const groups = await createBuiltinPluginGroups(createConfig(sandbox));
      const qualityAgents = groups.agent.filter(isQualityOrchestratorAgent);

      expect([...new Set(qualityAgents.map((plugin) => plugin.id))].sort()).toEqual([
        "quality-orchestrator-codex",
        "quality-orchestrator-cursor"
      ]);
      expect(new QualityCodexExecutionPlugin("codex", 60_000)).toEqual(expect.objectContaining({
        agentKind: "quality",
        driverId: "quality-orchestrator",
        capabilities: expect.arrayContaining(["quality", "review", "codex"])
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("detectDefaultBaseBranch", () => {
  it("detects master on bare mirror cache with only refs/heads", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-detect-base-"));
    try {
      const sourceRepo = join(sandbox, "source");
      const bareMirror = join(sandbox, "mirror.git");
      await createGitRepo(sourceRepo, { "README.md": "# demo\n" }, "master");
      await git(["clone", "--mirror", sourceRepo, bareMirror], sandbox);

      const branch = await detectDefaultBaseBranch(bareMirror, 30_000, { bareGitDir: true });
      expect(branch).toBe("master");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("ignores stale bare HEAD when the pointed branch does not exist", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-detect-base-"));
    try {
      const sourceRepo = join(sandbox, "source");
      const bareMirror = join(sandbox, "mirror.git");
      await createGitRepo(sourceRepo, { "README.md": "# demo\n" }, "master");
      await git(["clone", "--mirror", sourceRepo, bareMirror], sandbox);
      await git(["--git-dir", bareMirror, "symbolic-ref", "HEAD", "refs/heads/main"], sandbox);

      const branch = await detectDefaultBaseBranch(bareMirror, 30_000, { bareGitDir: true });
      expect(branch).toBe("master");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("normalizeRepoUrl", () => {
  it("unwraps markdown mailto-wrapped ssh repo with trailing path", () => {
    expect(
      normalizeRepoUrl("[git@gitlab.yc345.tv](mailto:git@gitlab.yc345.tv):frontend/yanxue-main.git")
    ).toBe("git@gitlab.yc345.tv:frontend/yanxue-main.git");
  });

  it("passes through plain ssh and https urls", () => {
    expect(normalizeRepoUrl("git@example.com:grp/repo.git")).toBe("git@example.com:grp/repo.git");
    expect(normalizeRepoUrl("https://example.com/a/b.git")).toBe("https://example.com/a/b.git");
  });

  it("uses https href from markdown link", () => {
    expect(normalizeRepoUrl("[repo](https://gitlab.com/foo/bar.git)")).toBe("https://gitlab.com/foo/bar.git");
  });
});

describe("pull request provider command selection", () => {
  it("uses gh for GitHub repository URLs", () => {
    expect(detectPullRequestProvider("https://github.com/acme/repo.git")).toBe("github");
    expect(detectPullRequestProvider("git@github.com:acme/repo.git")).toBe("github");

    expect(buildPullRequestCreateCommand({
      provider: "github",
      branch: "feature/demo",
      base: "main",
      title: "Demo task",
      body: "Implement demo"
    })).toEqual({
      bin: "gh",
      args: [
        "pr",
        "create",
        "--head",
        "feature/demo",
        "--base",
        "main",
        "--title",
        "Demo task",
        "--body",
        "Implement demo"
      ],
      failureDetail: "gh pr create failed",
      successDetail: "PR created"
    });
  });

  it("uses glab for GitLab repository URLs", () => {
    expect(detectPullRequestProvider("https://gitlab.com/acme/repo.git")).toBe("gitlab");
    expect(detectPullRequestProvider("git@gitlab.yc345.tv:frontend/repo.git")).toBe("gitlab");

    expect(buildPullRequestCreateCommand({
      provider: "gitlab",
      branch: "feature/demo",
      base: "master",
      title: "Demo task",
      body: "Implement demo",
      gitlabBin: "/opt/bin/glab"
    })).toEqual({
      bin: "/opt/bin/glab",
      args: [
        "mr",
        "create",
        "--source-branch",
        "feature/demo",
        "--target-branch",
        "master",
        "--title",
        "Demo task",
        "--description",
        "Implement demo"
      ],
      failureDetail: "glab mr create failed",
      successDetail: "MR created"
    });
  });

  it("does not build a CLI command for unknown repository hosts", () => {
    expect(detectPullRequestProvider("ssh://git@example.com/acme/repo.git")).toBe("unknown");
    expect(buildPullRequestCreateCommand({
      provider: "unknown",
      branch: "feature/demo",
      base: "main",
      title: "Demo task",
      body: "Implement demo"
    })).toBeNull();
  });
});

describe("createPullRequestsForTask", () => {
  it("commits local changes, pushes through repository URL, and creates a GitLab MR", async () => {
    const sandbox = await mkdtemp(join(process.cwd(), ".tmp-diting-pr-flow-"));
    try {
      const remotePath = join(sandbox, "remote.git");
      const repoPath = join(sandbox, "repo");
      const binPath = join(sandbox, "bin");
      const glabLogPath = join(sandbox, "glab.log");
      const gitConfigPath = join(sandbox, "gitconfig");
      const artifactsPath = join(sandbox, "artifacts");
      const repoUrl = "git@gitlab.yc345.tv:group/demo.git";

      await mkdir(binPath, { recursive: true });
      await mkdir(artifactsPath, { recursive: true });
      await git(["init", "--bare", remotePath], sandbox);
      await createGitRepo(repoPath, { "README.md": "# demo\n" }, "main");
      await git(["remote", "add", "origin", remotePath], repoPath);
      await git(["push", "-u", "origin", "main"], repoPath);
      await git(["checkout", "-B", "develop"], repoPath);
      await git(["push", "origin", "develop"], repoPath);
      await git(["checkout", "-B", "feature/task-1"], repoPath);
      await git(["config", "remote.origin.mirror", "true"], repoPath);
      await writeFile(join(repoPath, "feature.txt"), "new work\n");
      await writeFile(gitConfigPath, [
        `[url "file://${remotePath}"]`,
        `  insteadOf = ${repoUrl}`
      ].join("\n"));
      await writeFakeGlab(join(binPath, "glab"), glabLogPath);

      const task = {
        ...createTask(repoUrl),
        id: "task-commit-1",
        title: "Implement PR flow",
        instruction: "Add the automated pull request submission flow after agent execution.",
        branch: "feature/task-1"
      };
      const workspace = {
        ...createWorkspace(sandbox, repoPath),
        artifactsPath,
        branch: "feature/task-1",
        repos: [
          {
            key: "Repo1",
            url: repoUrl,
            path: repoPath,
            cachePath: join(sandbox, "cache.git")
          }
        ],
        env: {
          PATH: `${binPath}:${process.env.PATH ?? ""}`,
          GIT_CONFIG_GLOBAL: gitConfigPath
        }
      };

      const records = await createPullRequestsForTask(task, workspace, createConfig(sandbox));

      expect(records).toEqual([
        expect.objectContaining({
          repoKey: "Repo1",
          provider: "gitlab",
          prUrl: "https://gitlab.yc345.tv/group/demo/-/merge_requests/1",
          branch: "feature/task-1",
          base: "develop",
          skipped: false,
          detail: "MR created",
          commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
          pushDetail: expect.stringContaining("feature/task-1"),
          prDetail: "MR created"
        })
      ]);
      await expect(git(["rev-parse", "--verify", "refs/heads/feature/task-1"], remotePath)).resolves.toBeUndefined();
      const pushedFeature = await gitOutput(["rev-parse", "feature/task-1"], remotePath);
      expect(pushedFeature.trim()).toBe(records[0]?.commitSha);
      const commitMessage = await gitOutput(["log", "-1", "--pretty=%B"], repoPath);
      expect(commitMessage).toContain("feat: implement pr flow");
      expect(commitMessage).toContain("- Change: add the automated pull request submission flow after agent execution");
      expect(commitMessage).toContain("Task: Implement PR flow");
      expect(commitMessage).toContain("Task ID: task-commit-1");
      expect(commitMessage).toContain("Branch: feature/task-1");
      expect(await readFile(glabLogPath, "utf8")).toContain("--source-branch feature/task-1");
      expect(await readFile(glabLogPath, "utf8")).toContain("--target-branch develop");
      const artifact = JSON.parse(await readFile(join(artifactsPath, "prs.json"), "utf8"));
      expect(artifact[0]).toEqual(expect.objectContaining({
        commitSha: records[0]?.commitSha,
        prUrl: records[0]?.prUrl
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("includes quality risk details in the pull request description", async () => {
    const sandbox = await mkdtemp(join(process.cwd(), ".tmp-diting-pr-quality-risk-"));
    try {
      const remotePath = join(sandbox, "remote.git");
      const repoPath = join(sandbox, "repo");
      const binPath = join(sandbox, "bin");
      const glabLogPath = join(sandbox, "glab.log");
      const gitConfigPath = join(sandbox, "gitconfig");
      const artifactsPath = join(sandbox, "artifacts");
      const repoUrl = "git@gitlab.yc345.tv:group/risky-demo.git";

      await mkdir(binPath, { recursive: true });
      await mkdir(artifactsPath, { recursive: true });
      await git(["init", "--bare", remotePath], sandbox);
      await createGitRepo(repoPath, { "README.md": "# demo\n" }, "main");
      await git(["remote", "add", "origin", remotePath], repoPath);
      await git(["push", "-u", "origin", "main"], repoPath);
      await git(["checkout", "-B", "develop"], repoPath);
      await git(["push", "origin", "develop"], repoPath);
      await git(["checkout", "-B", "feature/risk-report"], repoPath);
      await git(["config", "remote.origin.mirror", "true"], repoPath);
      await writeFile(join(repoPath, "feature.txt"), "new work\n");
      await writeFile(gitConfigPath, [
        `[url "file://${remotePath}"]`,
        `  insteadOf = ${repoUrl}`
      ].join("\n"));
      await writeFakeGlab(join(binPath, "glab"), glabLogPath);

      const task = {
        ...createTask(repoUrl),
        id: "task-risk-report",
        title: "Report quality risk in PR",
        instruction: "Add risk reporting to pull request details.",
        branch: "feature/risk-report",
        metadata: {
          quality: {
            riskLevel: "high",
            score: 85,
            checks: [
              { name: "diff-risk", passed: true, detail: "files=24, insertions=410, deletions=0, risk=high" }
            ]
          }
        }
      };
      const workspace = {
        ...createWorkspace(sandbox, repoPath),
        artifactsPath,
        branch: "feature/risk-report",
        repos: [
          {
            key: "Repo1",
            url: repoUrl,
            path: repoPath,
            cachePath: join(sandbox, "cache.git")
          }
        ],
        env: {
          PATH: `${binPath}:${process.env.PATH ?? ""}`,
          GIT_CONFIG_GLOBAL: gitConfigPath
        }
      };

      await createPullRequestsForTask(task, workspace, createConfig(sandbox));

      const glabLog = await readFile(glabLogPath, "utf8");
      expect(glabLog).toContain("Quality Risk");
      expect(glabLog).toContain("riskLevel: high");
      expect(glabLog).toContain("diff-risk: passed - files=24, insertions=410, deletions=0, risk=high");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("uses the configured agent to generate the PR commit message", async () => {
    const sandbox = await mkdtemp(join(process.cwd(), ".tmp-diting-pr-agent-commit-"));
    try {
      const remotePath = join(sandbox, "remote.git");
      const repoPath = join(sandbox, "repo");
      const binPath = join(sandbox, "bin");
      const agentLogPath = join(sandbox, "agent.log");
      const glabLogPath = join(sandbox, "glab.log");
      const gitConfigPath = join(sandbox, "gitconfig");
      const artifactsPath = join(sandbox, "artifacts");
      const repoUrl = "git@gitlab.yc345.tv:group/agent-demo.git";

      await mkdir(binPath, { recursive: true });
      await mkdir(artifactsPath, { recursive: true });
      await git(["init", "--bare", remotePath], sandbox);
      await createGitRepo(repoPath, { "README.md": "# demo\n" }, "main");
      await git(["remote", "add", "origin", remotePath], repoPath);
      await git(["push", "-u", "origin", "main"], repoPath);
      await git(["checkout", "-B", "develop"], repoPath);
      await git(["push", "origin", "develop"], repoPath);
      await git(["checkout", "-B", "feature/agent-commit"], repoPath);
      await git(["config", "remote.origin.mirror", "true"], repoPath);
      await writeFile(join(repoPath, "feature.txt"), "new work\n");
      await writeFile(gitConfigPath, [
        `[url "file://${remotePath}"]`,
        `  insteadOf = ${repoUrl}`
      ].join("\n"));
      await writeFakeCommitAgent(join(binPath, "agent"), agentLogPath, {
        subject: "feat(server): add agent generated commit message",
        body: [
          "- Change: summarize staged implementation with the coding agent",
          "- Task: Generate commit message with agent",
          "- Task ID: task-agent-commit",
          "- Branch: feature/agent-commit"
        ].join("\\n")
      });
      await writeFakeGlab(join(binPath, "glab"), glabLogPath);

      const task = {
        ...createTask(repoUrl),
        id: "task-agent-commit",
        title: "Generate commit message with agent",
        instruction: "Use the coding agent to summarize staged implementation changes.",
        branch: "feature/agent-commit",
        executor: "cursor"
      };
      const workspace = {
        ...createWorkspace(sandbox, repoPath),
        artifactsPath,
        branch: "feature/agent-commit",
        repos: [
          {
            key: "Repo1",
            url: repoUrl,
            path: repoPath,
            cachePath: join(sandbox, "cache.git")
          }
        ],
        env: {
          PATH: `${binPath}:${process.env.PATH ?? ""}`,
          GIT_CONFIG_GLOBAL: gitConfigPath
        }
      };
      const config = {
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          execution: {
            ...createConfig(sandbox).plugins.execution,
            commitMessageAgent: "cursor" as const,
            cursorBin: "agent"
          }
        }
      };

      await createPullRequestsForTask(task, workspace, config);

      const commitMessage = await gitOutput(["log", "-1", "--pretty=%B"], repoPath);
      expect(commitMessage).toContain("feat(server): add agent generated commit message");
      expect(commitMessage).toContain("- Change: summarize staged implementation with the coding agent");
      expect(await readFile(agentLogPath, "utf8")).toContain("Use the coding agent to summarize staged implementation changes.");
      expect(await readFile(agentLogPath, "utf8")).toContain("feature.txt");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("pushes the task branch and reports a missing merge branch when develop and test do not exist", async () => {
    const sandbox = await mkdtemp(join(process.cwd(), ".tmp-diting-pr-missing-base-"));
    try {
      const remotePath = join(sandbox, "remote.git");
      const repoPath = join(sandbox, "repo");
      const binPath = join(sandbox, "bin");
      const glabLogPath = join(sandbox, "glab.log");
      const gitConfigPath = join(sandbox, "gitconfig");
      const artifactsPath = join(sandbox, "artifacts");
      const repoUrl = "git@gitlab.yc345.tv:group/no-base.git";

      await mkdir(binPath, { recursive: true });
      await mkdir(artifactsPath, { recursive: true });
      await git(["init", "--bare", remotePath], sandbox);
      await createGitRepo(repoPath, { "README.md": "# demo\n" }, "main");
      await git(["remote", "add", "origin", remotePath], repoPath);
      await git(["push", "-u", "origin", "main"], repoPath);
      await git(["checkout", "-B", "feature/no-base"], repoPath);
      await git(["config", "remote.origin.mirror", "true"], repoPath);
      await writeFile(join(repoPath, "feature.txt"), "new work\n");
      await writeFile(gitConfigPath, [
        `[url "file://${remotePath}"]`,
        `  insteadOf = ${repoUrl}`
      ].join("\n"));
      await writeFakeGlab(join(binPath, "glab"), glabLogPath);

      const task = {
        ...createTask(repoUrl),
        id: "task-no-base",
        title: "Implement no base flow",
        branch: "feature/no-base"
      };
      const workspace = {
        ...createWorkspace(sandbox, repoPath),
        artifactsPath,
        branch: "feature/no-base",
        repos: [
          {
            key: "Repo1",
            url: repoUrl,
            path: repoPath,
            cachePath: join(sandbox, "cache.git")
          }
        ],
        env: {
          PATH: `${binPath}:${process.env.PATH ?? ""}`,
          GIT_CONFIG_GLOBAL: gitConfigPath
        }
      };

      const records = await createPullRequestsForTask(task, workspace, createConfig(sandbox));

      expect(records).toEqual([
        expect.objectContaining({
          repoKey: "Repo1",
          provider: "gitlab",
          prUrl: null,
          branch: "feature/no-base",
          base: "",
          skipped: false,
          detail: "Merge branch missing: develop or test",
          commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
          pushDetail: expect.stringContaining("feature/no-base"),
          prDetail: "Merge branch missing: develop or test"
        })
      ]);
      await expect(git(["rev-parse", "--verify", "refs/heads/feature/no-base"], remotePath)).resolves.toBeUndefined();
      await expect(exists(glabLogPath)).resolves.toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("pushes OpenSpec documents from every repo in multi-repo workspaces", async () => {
    const sandbox = await mkdtemp(join(process.cwd(), ".tmp-diting-pr-multi-openspec-"));
    try {
      const remoteAPath = join(sandbox, "remote-a.git");
      const remoteBPath = join(sandbox, "remote-b.git");
      const repoAPath = join(sandbox, "repo-a");
      const repoBPath = join(sandbox, "repo-b");
      const binPath = join(sandbox, "bin");
      const glabLogPath = join(sandbox, "glab.log");
      const gitConfigPath = join(sandbox, "gitconfig");
      const artifactsPath = join(sandbox, "artifacts");
      const repoAUrl = "git@gitlab.yc345.tv:group/repo-a.git";
      const repoBUrl = "git@gitlab.yc345.tv:group/repo-b.git";

      await mkdir(binPath, { recursive: true });
      await mkdir(artifactsPath, { recursive: true });
      await git(["init", "--bare", remoteAPath], sandbox);
      await git(["init", "--bare", remoteBPath], sandbox);
      await createGitRepo(repoAPath, { "README.md": "# repo-a\n" }, "main");
      await createGitRepo(repoBPath, { "README.md": "# repo-b\n" }, "main");
      await git(["remote", "add", "origin", remoteAPath], repoAPath);
      await git(["remote", "add", "origin", remoteBPath], repoBPath);
      await git(["push", "-u", "origin", "main"], repoAPath);
      await git(["push", "-u", "origin", "main"], repoBPath);
      await git(["checkout", "-B", "develop"], repoAPath);
      await git(["checkout", "-B", "develop"], repoBPath);
      await git(["push", "origin", "develop"], repoAPath);
      await git(["push", "origin", "develop"], repoBPath);
      await git(["checkout", "-B", "feature/task-1"], repoAPath);
      await git(["checkout", "-B", "feature/task-1"], repoBPath);
      await git(["config", "remote.origin.mirror", "true"], repoAPath);
      await git(["config", "remote.origin.mirror", "true"], repoBPath);
      await mkdir(join(repoAPath, "openspec", "changes", "repo-a-change"), { recursive: true });
      await mkdir(join(repoBPath, "openspec", "changes", "repo-b-change"), { recursive: true });
      await writeFile(join(repoAPath, "openspec", "changes", "repo-a-change", "tasks.md"), "- [x] repo-a done\n");
      await writeFile(join(repoBPath, "openspec", "changes", "repo-b-change", "tasks.md"), "- [x] repo-b done\n");
      await writeFile(gitConfigPath, [
        `[url "file://${remoteAPath}"]`,
        `  insteadOf = ${repoAUrl}`,
        `[url "file://${remoteBPath}"]`,
        `  insteadOf = ${repoBUrl}`
      ].join("\n"));
      await writeFakeGlab(join(binPath, "glab"), glabLogPath);

      const task = {
        ...createTask(repoAUrl),
        id: "task-multi-openspec",
        title: "Implement multi repo OpenSpec flow",
        branch: "feature/task-1"
      };
      const workspace = {
        ...createWorkspace(sandbox, repoAPath),
        artifactsPath,
        branch: "feature/task-1",
        repos: [
          {
            key: "Repo1",
            url: repoAUrl,
            path: repoAPath,
            cachePath: join(sandbox, "cache-a.git")
          },
          {
            key: "Repo2",
            url: repoBUrl,
            path: repoBPath,
            cachePath: join(sandbox, "cache-b.git")
          }
        ],
        env: {
          PATH: `${binPath}:${process.env.PATH ?? ""}`,
          GIT_CONFIG_GLOBAL: gitConfigPath
        }
      };

      const records = await createPullRequestsForTask(task, workspace, createConfig(sandbox));

      expect(records).toEqual([
        expect.objectContaining({ repoKey: "Repo1", skipped: false, prUrl: "https://gitlab.yc345.tv/group/demo/-/merge_requests/1" }),
        expect.objectContaining({ repoKey: "Repo2", skipped: false, prUrl: "https://gitlab.yc345.tv/group/demo/-/merge_requests/1" })
      ]);
      const pushedTreeA = await gitOutput(["ls-tree", "-r", "feature/task-1", "--name-only"], remoteAPath);
      const pushedTreeB = await gitOutput(["ls-tree", "-r", "feature/task-1", "--name-only"], remoteBPath);
      expect(pushedTreeA).toContain("openspec/changes/repo-a-change/tasks.md");
      expect(pushedTreeB).toContain("openspec/changes/repo-b-change/tasks.md");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("GitLabCliIntegrationPlugin", () => {
  it("reports auth status and completes device authorization by polling glab auth status", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-gitlab-cli-auth-"));
    const previousAuthState = process.env.GITLAB_TEST_AUTH_STATE;
    try {
      const bin = join(sandbox, "fake-glab");
      await writeFakeGitLabCli(bin);
      process.env.GITLAB_TEST_AUTH_STATE = "unauthenticated";
      const plugin = new GitLabCliIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          gitlab: {
            cliBin: bin,
            host: "gitlab.yc345.tv"
          }
        }
      });

      await expect(plugin.health()).resolves.toEqual({
        healthy: false,
        message: expect.stringContaining("glab auth login --hostname gitlab.yc345.tv --device")
      });
      await expect(plugin.getAuthStatus()).resolves.toEqual({
        status: "unauthenticated",
        authenticated: false,
        host: "gitlab.yc345.tv",
        message: expect.stringContaining("not logged in")
      });
      await expect(plugin.startAuth()).resolves.toEqual({
        status: "pending",
        authenticated: false,
        authorizationUrl: "https://gitlab.yc345.tv/oauth/device",
        userCode: "ABCD-EFGH",
        host: "gitlab.yc345.tv",
        intervalSeconds: 5,
        message: "Open the authorization URL and enter the GitLab device code"
      });
      await expect(plugin.pollAuth()).resolves.toEqual({
        status: "pending",
        authenticated: false,
        host: "gitlab.yc345.tv",
        message: expect.stringContaining("not logged in")
      });

      process.env.GITLAB_TEST_AUTH_STATE = "authenticated";
      await expect(plugin.pollAuth()).resolves.toEqual({
        status: "authenticated",
        authenticated: true,
        host: "gitlab.yc345.tv",
        message: "GitLab CLI is authenticated"
      });
      await expect(plugin.logoutAuth()).resolves.toEqual({
        ok: true,
        message: "GitLab CLI logged out"
      });
    } finally {
      process.env.GITLAB_TEST_AUTH_STATE = previousAuthState;
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("mapMeegleTask", () => {
  it("normalizes markdown ssh repo field", () => {
    const task = mapMeegleTask({
      id: "6983788716",
      title: "Test",
      instruction: "Do work",
      repo: "[git@gitlab.yc345.tv](mailto:git@gitlab.yc345.tv):frontend/yanxue-main.git",
      branch: "main"
    }, 0);
    expect(task.repo).toBe("git@gitlab.yc345.tv:frontend/yanxue-main.git");
  });

  it("uses the configured default runtime when an explicit Meegle task requests programming", () => {
    const task = mapMeegleTask({
      id: "6983788716",
      title: "Test",
      instruction: "Do work",
      repo: "https://example.com/repo.git",
      branch: "main",
      agentKind: "programming"
    }, 0, "cursor");

    expect(task).toEqual(expect.objectContaining({
      executor: "programming",
      agentKind: "programming",
      preferredRuntime: "cursor"
    }));
  });

  it("routes Meegle tasks with an OpenSpec package directly to programming", () => {
    const task = mapMeegleTask({
      id: "6983788716",
      title: "Test",
      instruction: "Do work",
      repo: "https://example.com/repo.git",
      branch: "main",
      fields: {
        "spec文档": [{ file_token: "tok-openspec", file_name: "openspec.zip" }]
      }
    }, 0);

    expect(task).toEqual(expect.objectContaining({
      executor: "programming",
      agentKind: "programming",
      preferredDriver: "coding",
      driverId: "coding"
    }));
    expect(task.metadata.agentRequest).toEqual(expect.objectContaining({
      agentKind: "programming",
      preferredDriver: "coding"
    }));
  });

  it("routes allowed spec package archives from spec fields directly to programming", () => {
    const task = mapMeegleTask({
      id: "6983788717",
      title: "Test bundle",
      instruction: "Do work",
      repo: "https://example.com/repo.git",
      branch: "main",
      fields: {
        "spec文档": [{ file_token: "tok-bundle", file_name: "bundle.zip" }]
      }
    }, 0);

    expect(task).toEqual(expect.objectContaining({
      executor: "programming",
      agentKind: "programming",
      driverId: "coding"
    }));
  });

  it("routes Meegle tasks without an OpenSpec package to the product agent", () => {
    const task = mapMeegleTask({
      id: "6983788716",
      title: "Test",
      instruction: "Do work",
      repo: "https://example.com/repo.git",
      branch: "main"
    }, 0);

    expect(task).toEqual(expect.objectContaining({
      executor: "product",
      agentKind: "product",
      preferredDriver: "openspec-product",
      preferredRuntime: "codex",
      driverId: "openspec-product",
      runtimeProviderId: "codex"
    }));
    expect(task.metadata).toEqual(expect.objectContaining({
      workflowRole: "product_spec",
      openspecSourceState: "none",
      agentRequest: expect.objectContaining({
        agentKind: "product",
        preferredDriver: "openspec-product",
        preferredRuntime: "codex"
      })
    }));
  });

  it("does not override explicit Meegle agent requests during automatic routing", () => {
    const task = mapMeegleTask({
      id: "6983788716",
      title: "Test",
      instruction: "Do work",
      repo: "https://example.com/repo.git",
      branch: "main",
      agentKind: "programming",
      preferredRuntime: "cursor"
    }, 0);

    expect(task).toEqual(expect.objectContaining({
      executor: "programming",
      agentKind: "programming",
      preferredDriver: "coding",
      preferredRuntime: "cursor",
      driverId: "coding",
      runtimeProviderId: "cursor"
    }));
    expect(task.metadata.agentRequest).toEqual(expect.objectContaining({
      agentKind: "programming",
      preferredDriver: "coding",
      preferredRuntime: "cursor"
    }));
  });

  it("does not fall back to main when the payload omits branch", () => {
    const task = mapMeegleTask({
      id: "6983788716",
      title: "Test",
      instruction: "Do work",
      repo: "https://example.com/repo.git"
    }, 0, "cursor");

    expect(task.branch).toBe("");
  });
});

describe("extractSpecAttachmentsFromRow", () => {
  it("reads spec attachments from nested Meegle fields bag", () => {
    const attachments = extractSpecAttachmentsFromRow({
      fields: {
        "spec文档": [
          { file_token: "tok-abc", file_name: "WORKFLOW_PROMPTS.md" }
        ]
      }
    });
    expect(attachments).toEqual([
      { name: "WORKFLOW_PROMPTS.md", token: "tok-abc" }
    ]);
  });

  it("reads spec attachments promoted to top-level keys", () => {
    const attachments = extractSpecAttachmentsFromRow({
      "spec文档": {
        file_list: [{ file_token: "tok-zip", name: "bundle.zip" }]
      }
    });
    expect(attachments).toEqual([
      { name: "bundle.zip", token: "tok-zip" }
    ]);
  });

  it("reads spec attachments indexed by internal field key and display name", () => {
    const attachments = extractSpecAttachmentsFromRow({
      fields: {
        field_7abc123: {
          file_list: [{ file_token: "tok-internal", file_name: "WORKFLOW_PROMPTS.md" }]
        },
        "spec文档": {
          file_list: [{ file_token: "tok-internal", file_name: "WORKFLOW_PROMPTS.md" }]
        }
      }
    });
    expect(attachments.length).toBeGreaterThan(0);
    expect(attachments[0]?.token).toBe("tok-internal");
  });

  it("infers .zip for spec field attachments without file extension (Feishu default)", () => {
    const attachments = extractSpecAttachmentsFromRow({
      fields: {
        "spec文档": [{ file_token: "tok-zip", name: "多仓工作流spec包" }]
      }
    });
    expect(attachments).toEqual([
      { name: "多仓工作流spec包.zip", token: "tok-zip" }
    ]);
  });

  it("infers .zip from mime_type when filename lacks extension", () => {
    const attachments = extractSpecAttachmentsFromRow({
      "spec文档": {
        file_token: "tok-zip",
        file_name: "bundle",
        mime_type: "application/zip"
      }
    });
    expect(attachments[0]?.name).toBe("bundle.zip");
  });

  it("reads spec from work_item_fields with nested field_value", () => {
    const attachments = extractSpecAttachmentsFromRow({
      work_item_fields: [
        {
          key: "spec文档",
          field_type_key: "file",
          field_value: [{ file_token: "tok-nested", name: "spec-bundle.zip" }]
        }
      ]
    });
    expect(attachments).toEqual([
      { name: "spec-bundle.zip", token: "tok-nested" }
    ]);
  });

  it("reads spec from MQL key_label_value_list download URLs", () => {
    const bag = extractMoqlSearchFieldBag({
      data: {
        data: {
          "1": [
            {
              moql_field_list: [
                {
                  key: "field_5fffe2",
                  name: "spec文档",
                  value: {
                    key_label_value_list: [
                      {
                        key: "https://project.feishu.cn/goapi/v5/platform/file/stream/download/example",
                        label: "spec.zip"
                      }
                    ]
                  },
                  value_type: "key_label_value_list"
                }
              ]
            }
          ]
        }
      }
    });
    const attachments = extractSpecAttachmentsFromRow({
      id: "7007351748",
      fields: bag
    });
    expect(attachments).toEqual([
      {
        name: "spec.zip",
        url: "https://project.feishu.cn/goapi/v5/platform/file/stream/download/example",
        token: "example"
      }
    ]);
  });

  it("extracts file token from Feishu project download URLs", () => {
    const url =
      "https://project.feishu.cn/goapi/v5/platform/file/stream/download/XIyx0_5lSlSx265lqlZ9enRQj8S1qqvq800qstN5O1UGG7gvAYYZZNg87RDKhY_jLlQa7sjapKpJHmhdUmZJrBMQlNuwyJXZcLQ9Y6_JMdw8QWyRJ57HxhC91ABgEckWYotk_5Q9mgyuljfq_oi5Cg==";
    expect(extractFeishuFileTokenFromDownloadUrl(url)).toBe(
      "XIyx0_5lSlSx265lqlZ9enRQj8S1qqvq800qstN5O1UGG7gvAYYZZNg87RDKhY_jLlQa7sjapKpJHmhdUmZJrBMQlNuwyJXZcLQ9Y6_JMdw8QWyRJ57HxhC91ABgEckWYotk_5Q9mgyuljfq_oi5Cg=="
    );
    expect(isFeishuProjectDownloadUrl(url)).toBe(true);
  });

  it("recognizes Feishu TOS object download URLs without a stream token", () => {
    const url =
      "https://project.feishu.cn/goapi/v1/tos/file/meego-business/checklist/57d7ae9d-a9d5-4fc9-b6ca-a2a5cc274727.zip?isSaas=1";
    expect(isFeishuProjectDownloadUrl(url)).toBe(true);
    expect(extractFeishuFileTokenFromDownloadUrl(url)).toBeUndefined();
  });

  it("downloads Feishu spec URLs through the current Meegle attachment command", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-spec-download-"));
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      const targetDir = join(sandbox, "spec");
      await writeFakeMeegleCli(bin);
      process.env.MEEGLE_TEST_LOG = logPath;

      await downloadSpecToDirectory(
        [
          {
            name: "WORKFLOW_PROMPTS.md",
            url: "https://project.feishu.cn/goapi/v5/platform/file/stream/download/example",
            token: "example"
          }
        ],
        targetDir,
        {
          ...createConfig(sandbox),
          plugins: {
            ...createConfig(sandbox).plugins,
            meegle: {
              ...createConfig(sandbox).plugins.meegle,
              cliBin: bin,
              authProfile: "ci-profile",
              projectKey: "PROJ"
            }
          }
        },
        { workItemId: "MEEGLE-1" }
      );

      await expect(readFile(join(targetDir, "WORKFLOW_PROMPTS.md"), "utf8")).resolves.toBe("downloaded spec");
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      expect(logLines).toContainEqual([
        "attachment",
        "+download",
        "https://project.feishu.cn/goapi/v5/platform/file/stream/download/example",
        "--output",
        expect.stringContaining(".spec-download-"),
        "--overwrite",
        "--project-key",
        "PROJ",
        "--work-item-id",
        "MEEGLE-1",
        "--profile",
        "ci-profile"
      ]);
    } finally {
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("downloads Feishu TOS object spec URLs through the Meegle attachment command", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-spec-download-tos-"));
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      const targetDir = join(sandbox, "spec");
      await writeFakeMeegleCli(bin);
      process.env.MEEGLE_TEST_LOG = logPath;

      const tosUrl =
        "https://project.feishu.cn/goapi/v1/tos/file/meego-business/checklist/57d7ae9d-a9d5-4fc9-b6ca-a2a5cc274727.zip?isSaas=1";

      await downloadSpecToDirectory(
        [{ name: "WORKFLOW_PROMPTS.md", url: tosUrl }],
        targetDir,
        {
          ...createConfig(sandbox),
          plugins: {
            ...createConfig(sandbox).plugins,
            meegle: {
              ...createConfig(sandbox).plugins.meegle,
              cliBin: bin,
              authProfile: "ci-profile",
              projectKey: "PROJ"
            }
          }
        },
        { workItemId: "MEEGLE-1" }
      );

      await expect(readFile(join(targetDir, "WORKFLOW_PROMPTS.md"), "utf8")).resolves.toBe("downloaded spec");
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      expect(logLines).toContainEqual([
        "attachment",
        "+download",
        tosUrl,
        "--output",
        expect.stringContaining(".spec-download-"),
        "--overwrite",
        "--project-key",
        "PROJ",
        "--work-item-id",
        "MEEGLE-1",
        "--profile",
        "ci-profile"
      ]);
    } finally {
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reads spec from flat fields bag with fileToken JSON string (non-envelope workitem get)", () => {
    const bag = extractWorkitemFieldsBag({
      fields: {
        "spec文档": "[{\"name\":\"spec.zip\",\"type\":\"zip\",\"size\":\"808000\",\"fileToken\":\"tok-flat\"}]"
      }
    });
    const row = mergeMeegleFieldsIntoRow({ id: "7007351748" }, bag);
    const attachments = extractSpecAttachmentsFromRow(row);
    expect(attachments[0]?.token).toBe("tok-flat");
    expect(attachments[0]?.name).toBe("spec.zip");
  });

  it("matches spec文档 by display name when internal field key differs", () => {
    const attachments = extractSpecAttachmentsFromRow({
      work_item_fields: [
        {
          key: "field_spec_001",
          name: "spec文档",
          field_type_key: "file",
          value: [{ fileToken: "tok-by-name", name: "spec.zip" }]
        }
      ]
    });
    expect(attachments).toEqual([
      { name: "spec.zip", token: "tok-by-name" }
    ]);
  });

  it("reads file_token from uid on spec field entries", () => {
    const attachments = extractSpecAttachmentsFromRow({
      fields: {
        "spec文档": [{ uid: "tok-uid", file_name: "WORKFLOW_PROMPTS.md" }]
      }
    });
    expect(attachments[0]?.token).toBe("tok-uid");
  });

  it("does not treat description text as a spec attachment", () => {
    const description = [
      "Repo1: git@gitlab.yc345.tv:frontend/studyspace-mobile.git",
      "Repo2: git@gitlab.yc345.tv:frontend/studyspace-shadow.git",
      "---",
      "请在后台管理项目中完成首页的功能"
    ].join("\n");
    const attachments = extractSpecAttachmentsFromRow({
      fields: {
        description,
        "spec文档": [{ file_token: "tok-zip", file_name: "spec-bundle.zip" }]
      }
    });
    expect(attachments).toEqual([
      { name: "spec-bundle.zip", token: "tok-zip" }
    ]);
  });
});

describe("parseMultiRepoDescriptionBlock", () => {
  it("parses multiple repos in the header before the instruction separator", () => {
    const parsed = parseMultiRepoDescriptionBlock(
      "Repo1: https://example.com/a.git\nRepo2: git@example.com:b/c.git\nBranch: feature/x\n---\nDo the work"
    );
    expect(parsed.repos).toEqual([
      { key: "Repo1", url: "https://example.com/a.git" },
      { key: "Repo2", url: "git@example.com:b/c.git" }
    ]);
    expect(parsed.branch).toBe("feature/x");
    expect(parsed.instruction).toContain("Do the work");
  });

  it("maps legacy single Repo: to Repo1", () => {
    const parsed = parseMultiRepoDescriptionBlock(
      "Repo: https://example.com/legacy.git\nBranch: main\n---\nFix bug"
    );
    expect(parsed.repos).toEqual([{ key: "Repo1", url: "https://example.com/legacy.git" }]);
    expect(parsed.branch).toBe("main");
  });
});

describe("mapMeegleTask multi-repo", () => {
  it("keeps all repos from description when Meegle also provides repo and instruction fields", () => {
    const task = mapMeegleTask(
      {
        id: "7007351748",
        title: "Multi repo demand",
        repo: "https://example.com/mobile.git",
        instruction: "请在后台完成首页",
        description: [
          "Repo1: https://example.com/mobile.git",
          "Repo2: git@example.com:frontend/shadow.git",
          "Branch: feature/demo",
          "---",
          "请在后台完成首页"
        ].join("\n")
      },
      0
    );
    expect(task.metadata.repos).toEqual([
      { key: "Repo1", url: "https://example.com/mobile.git" },
      { key: "Repo2", url: "git@example.com:frontend/shadow.git" }
    ]);
    expect(task.repo).toBe("https://example.com/mobile.git");
    expect(task.branch).toBe("feature/demo");
  });

  it("parses repo and branch from rich text Meegle descriptions", () => {
    const task = mapMeegleTask(
      {
        id: "7006146880",
        title: "Rich text demand",
        description: [
          "<span style=\"font-size: 14px\"><span style=\"color: rgb(0, 0, 0)\">Repo1: </span></span>[https://gitlab.example.com/frontend/studyspace-crm.git](https://gitlab.example.com/frontend/studyspace-crm.git)",
          "",
          "<span style=\"font-size: 14px\"><span style=\"color: rgb(0, 0, 0)\">Branch: feature/diting-spec</span></span>",
          "",
          "<span style=\"font-size: 14px\"><span style=\"color: rgb(0, 0, 0)\">---</span></span>",
          "",
          "<span style=\"font-size: 14px\"><span style=\"color: rgb(0, 0, 0)\">需求背景：</span></span>"
        ].join("\n")
      },
      0
    );

    expect(task.metadata.repos).toEqual([
      { key: "Repo1", url: "https://gitlab.example.com/frontend/studyspace-crm.git" }
    ]);
    expect(task.repo).toBe("https://gitlab.example.com/frontend/studyspace-crm.git");
    expect(task.branch).toBe("feature/diting-spec");
    expect(task.instruction).toContain("需求背景");
  });
});

describe("LocalWorktreeEnvironmentPlugin", () => {
  it("builds service startup PATH from local Go toolchain discovery", () => {
    const env = buildServiceStartupToolchainEnv({
      basePath: "/usr/bin:/bin",
      shellPath: "/Users/me/.gvm/pkgsets/go1.23.0/global/bin:/usr/bin:/bin",
      kratosPath: "/Users/me/.gvm/pkgsets/go1.23.0/global/bin/kratos",
      goPath: "/Users/me/.gvm/pkgsets/go1.23.0/global",
      goBin: "/Users/me/custom-go-bin"
    });

    expect(env).toEqual({
      GOBIN: "/Users/me/custom-go-bin",
      GOPATH: "/Users/me/.gvm/pkgsets/go1.23.0/global",
      PATH: [
        "/Users/me/.gvm/pkgsets/go1.23.0/global/bin",
        "/Users/me/custom-go-bin",
        "/usr/bin",
        "/bin"
      ].join(":")
    });
  });

  it("installs OpenSpec when missing and initializes the workspace", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-openspec-tooling-"));
    const previousPath = process.env.PATH;
    const previousHome = process.env.HOME;
    try {
      const binDir = join(sandbox, "bin");
      process.env.HOME = join(sandbox, "home");
      const workspacePath = join(sandbox, "workspace");
      const logPath = join(sandbox, "tooling-log.jsonl");
      await mkdir(binDir, { recursive: true });
      await mkdir(join(workspacePath, "openspec"), { recursive: true });
      await writeFile(
        join(binDir, "openspec"),
        [
          "#!/bin/sh",
          "exit 1",
          ""
        ].join("\n")
      );
      await chmod(join(binDir, "openspec"), 0o755);
      await writeFile(
        join(binDir, "npm"),
        [
          "#!/bin/sh",
          `printf 'npm:%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
          `cat > ${JSON.stringify(join(binDir, "openspec"))} <<'EOS'`,
          "#!/bin/sh",
          `printf 'openspec:%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
          "exit 0",
          "EOS",
          `chmod +x ${JSON.stringify(join(binDir, "openspec"))}`,
          "exit 0",
          ""
        ].join("\n")
      );
      await writeFakeSuperpowersInstaller(join(binDir, "npx"), logPath);
      await chmod(join(binDir, "npm"), 0o755);
      process.env.PATH = `${binDir}:${previousPath ?? ""}`;

      await installWorkspaceTooling(workspacePath, {
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          openspecInit: true,
          superpowersInstallCmd: `${JSON.stringify(join(binDir, "npx"))} -y skills add obra/superpowers --agent cursor --yes`
        }
      }, { loaded: [], skipped: [], conflicts: [] });

      const logLines = (await readFile(logPath, "utf8")).trim().split("\n");
      expect(logLines).toEqual([
        "npm:install -g @fission-ai/openspec@latest --registry=https://registry.npmjs.org",
        "openspec:--version",
        "openspec:init --tools cursor --force",
        "npx:-y skills add obra/superpowers --agent cursor --yes"
      ]);
    } finally {
      process.env.PATH = previousPath;
      process.env.HOME = previousHome;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("does not reinstall Superpowers when required skills exist globally", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-superpowers-global-"));
    const previousPath = process.env.PATH;
    const previousHome = process.env.HOME;
    try {
      const binDir = join(sandbox, "bin");
      const workspacePath = join(sandbox, "workspace");
      const logPath = join(sandbox, "tooling-log.jsonl");
      process.env.HOME = join(sandbox, "home");
      await mkdir(join(workspacePath, "openspec"), { recursive: true });
      await writeGlobalSuperpowerSkills(process.env.HOME);
      await mkdir(binDir, { recursive: true });
      await writeFile(
        join(binDir, "openspec"),
        [
          "#!/bin/sh",
          `printf 'openspec:%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
          "exit 0",
          ""
        ].join("\n")
      );
      await chmod(join(binDir, "openspec"), 0o755);
      await writeFakeSuperpowersInstaller(join(binDir, "npx"), logPath);
      process.env.PATH = `${binDir}:${previousPath ?? ""}`;

      await installWorkspaceTooling(workspacePath, {
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          openspecInit: true,
          superpowersInstallCmd: `${JSON.stringify(join(binDir, "npx"))} -y skills add obra/superpowers --agent cursor --yes`
        }
      }, { loaded: [], skipped: [], conflicts: [] });

      const logLines = (await readFile(logPath, "utf8")).trim().split("\n");
      expect(logLines).toEqual([
        "openspec:--version",
        "openspec:init --tools cursor --force"
      ]);
    } finally {
      process.env.PATH = previousPath;
      process.env.HOME = previousHome;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("does not reinstall Superpowers when required skills already exist", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-superpowers-present-"));
    const previousPath = process.env.PATH;
    try {
      const binDir = join(sandbox, "bin");
      const workspacePath = join(sandbox, "workspace");
      const logPath = join(sandbox, "tooling-log.jsonl");
      await mkdir(join(workspacePath, "openspec"), { recursive: true });
      await writeRequiredSuperpowerSkills(workspacePath);
      await mkdir(binDir, { recursive: true });
      await writeFile(
        join(binDir, "openspec"),
        [
          "#!/bin/sh",
          `printf 'openspec:%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
          "exit 0",
          ""
        ].join("\n")
      );
      await chmod(join(binDir, "openspec"), 0o755);
      await writeFakeSuperpowersInstaller(join(binDir, "npx"), logPath);
      process.env.PATH = `${binDir}:${previousPath ?? ""}`;

      await installWorkspaceTooling(workspacePath, {
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          openspecInit: true
        }
      }, { loaded: [], skipped: [], conflicts: [] });

      const logLines = (await readFile(logPath, "utf8")).trim().split("\n");
      expect(logLines).toEqual([
        "openspec:--version",
        "openspec:init --tools cursor --force"
      ]);
    } finally {
      process.env.PATH = previousPath;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("fails when the built-in Superpowers installer does not provide required skills", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-superpowers-fail-"));
    const previousPath = process.env.PATH;
    const previousHome = process.env.HOME;
    try {
      const binDir = join(sandbox, "bin");
      const workspacePath = join(sandbox, "workspace");
      const logPath = join(sandbox, "tooling-log.jsonl");
      process.env.HOME = join(sandbox, "home");
      await mkdir(join(workspacePath, "openspec"), { recursive: true });
      await mkdir(binDir, { recursive: true });
      await writeFile(
        join(binDir, "openspec"),
        [
          "#!/bin/sh",
          `printf 'openspec:%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
          "exit 0",
          ""
        ].join("\n")
      );
      await chmod(join(binDir, "openspec"), 0o755);
      await writeFile(
        join(binDir, "npx"),
        [
          "#!/bin/sh",
          `printf 'npx:%s\\n' "$*" >> ${JSON.stringify(logPath)}`,
          "exit 0",
          ""
        ].join("\n")
      );
      await chmod(join(binDir, "npx"), 0o755);
      process.env.PATH = `${binDir}:${previousPath ?? ""}`;

      await expect(installWorkspaceTooling(workspacePath, {
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          openspecInit: true,
          superpowersInstallCmd: `${JSON.stringify(join(binDir, "npx"))} -y skills add obra/superpowers --agent cursor --yes`
        }
      }, { loaded: [], skipped: [], conflicts: [] })).rejects.toThrow("Superpowers skills are unavailable");
    } finally {
      process.env.PATH = previousPath;
      process.env.HOME = previousHome;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("prepares worktrees for every repo in metadata.repos", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-multi-"));
    try {
      const repoA = join(sandbox, "repo-a");
      const repoB = join(sandbox, "repo-b");
      await createGitRepo(repoA, { "README.md": "# repo-a\n" });
      await createGitRepo(repoB, { "README.md": "# repo-b\n" });

      const specDir = join(sandbox, "spec-fixtures");
      await mkdir(specDir, { recursive: true });
      const workflowPath = join(specDir, "WORKFLOW_PROMPTS.md");
      await writeFile(workflowPath, buildWorkflowPrompts(["Plan"]));

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task: TitingTask = {
        ...createTask(repoA),
        metadata: {
          preflight: { passed: true, checkedAt: new Date().toISOString(), checks: [] },
          repos: [
            { key: "Repo1", url: repoA },
            { key: "Repo2", url: repoB }
          ],
          specAttachments: [{ name: "WORKFLOW_PROMPTS.md", localPath: workflowPath }]
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      expect(workspace.repos).toHaveLength(2);
      const readmeA = await readFile(join(workspace.repos[0].path, "README.md"), "utf8");
      const readmeB = await readFile(join(workspace.repos[1].path, "README.md"), "utf8");
      expect(readmeA).toContain("repo-a");
      expect(readmeB).toContain("repo-b");
      expect(workspace.repos[0].path).toBe(join(workspace.workspacePath, "repo-a"));
      expect(workspace.repos[1].path).toBe(join(workspace.workspacePath, "repo-b"));
      expect(workspace.repoPath).toBe(workspace.repos[0].path);
      expect(await exists(join(workspace.workspacePath, "repos"))).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("keeps OpenSpec visible to git in single-repo workspaces", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-single-openspec-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, { "README.md": "# demo\n" });

      const archiveSource = join(sandbox, "archive-source");
      await mkdir(join(archiveSource, "openspec", "changes", "demo-change"), { recursive: true });
      await mkdir(join(archiveSource, "openspec", "node_modules", "demo-package"), { recursive: true });
      await mkdir(join(archiveSource, "openspec", ".next", "cache"), { recursive: true });
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      await writeFile(join(archiveSource, "openspec", "changes", "demo-change", "tasks.md"), "- [x] 1.1 Done\n");
      await writeFile(join(archiveSource, "openspec", "node_modules", "demo-package", "index.js"), "module.exports = {}\n");
      await writeFile(join(archiveSource, "openspec", ".next", "cache", "build.bin"), "cache\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "openspec"], { cwd: archiveSource });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task: TitingTask = {
        ...createTask(sourceRepo),
        metadata: {
          preflight: { passed: true, checkedAt: new Date().toISOString(), checks: [] },
          repos: [{ key: "Repo1", url: sourceRepo }],
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      const excludePath = (await gitOutput(["rev-parse", "--git-path", "info/exclude"], workspace.repoPath)).trim();
      const exclude = await readFile(isAbsolute(excludePath) ? excludePath : join(workspace.repoPath, excludePath), "utf8");
      const status = await gitOutput(["status", "--porcelain"], workspace.repoPath);
      const ignoredNodeModules = await runCommand(
        "git",
        ["-C", workspace.repoPath, "check-ignore", "openspec/node_modules/demo-package/index.js"],
        workspace.repoPath,
        30_000
      );
      const ignoredNext = await runCommand(
        "git",
        ["-C", workspace.repoPath, "check-ignore", "openspec/.next/cache/build.bin"],
        workspace.repoPath,
        30_000
      );

      expect(exclude.split(/\r?\n/)).not.toContain("/openspec/");
      expect(ignoredNodeModules.exitCode).toBe(0);
      expect(ignoredNext.exitCode).toBe(0);
      expect(status).toContain("?? openspec/");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("removes spec skills source after loading them in single-repo workspaces", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-single-skills-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, { "README.md": "# demo\n" });

      const archiveSource = join(sandbox, "archive-source");
      await mkdir(join(archiveSource, "openspec"), { recursive: true });
      await mkdir(join(archiveSource, "skills", "demo"), { recursive: true });
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      await writeFile(join(archiveSource, "skills", "demo", "SKILL.md"), "# Demo skill\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "openspec", "skills"], { cwd: archiveSource });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task: TitingTask = {
        ...createTask(sourceRepo),
        metadata: {
          preflight: { passed: true, checkedAt: new Date().toISOString(), checks: [] },
          repos: [{ key: "Repo1", url: sourceRepo }],
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      const status = await gitOutput(["status", "--porcelain"], workspace.repoPath);
      const ignoredLoadedSkill = await runCommand(
        "git",
        ["-C", workspace.repoPath, "check-ignore", ".cursor/skills/demo/SKILL.md"],
        workspace.repoPath,
        30_000
      );

      await expect(readFile(join(workspace.repoPath, ".cursor", "skills", "demo", "SKILL.md"), "utf8")).resolves.toBe("# Demo skill\n");
      await expect(exists(join(workspace.repoPath, "skills"))).resolves.toBe(false);
      expect(status).not.toContain("?? skills/");
      expect(ignoredLoadedSkill.exitCode).toBe(0);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("keeps OpenSpec only at the workspace root for multi-repo workspaces", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-multi-openspec-"));
    try {
      const repoA = join(sandbox, "repo-a");
      const repoB = join(sandbox, "repo-b");
      await createGitRepo(repoA, { "README.md": "# repo-a\n" });
      await createGitRepo(repoB, { "README.md": "# repo-b\n" });

      const archiveSource = join(sandbox, "archive-source");
      await mkdir(join(archiveSource, "openspec", "changes", "demo-change"), { recursive: true });
      await mkdir(join(archiveSource, "openspec", "node_modules", "demo-package"), { recursive: true });
      await mkdir(join(archiveSource, "openspec", ".next", "cache"), { recursive: true });
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      await writeFile(join(archiveSource, "openspec", "changes", "demo-change", "tasks.md"), "- [x] 1.1 Done\n");
      await writeFile(join(archiveSource, "openspec", "node_modules", "demo-package", "index.js"), "module.exports = {}\n");
      await writeFile(join(archiveSource, "openspec", ".next", "cache", "build.bin"), "cache\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "openspec"], { cwd: archiveSource });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task: TitingTask = {
        ...createTask(repoA),
        metadata: {
          preflight: { passed: true, checkedAt: new Date().toISOString(), checks: [] },
          repos: [
            { key: "Repo1", url: repoA },
            { key: "Repo2", url: repoB }
          ],
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      };

      const workspace = await plugin.prepareWorkspace(task);

      await expect(readFile(join(workspace.workspacePath, "openspec", "config.yaml"), "utf8")).resolves.toBe("project: demo\n");
      await expect(readFile(join(workspace.workspacePath, "openspec", "changes", "demo-change", "tasks.md"), "utf8")).resolves.toContain("Done");
      await expect(exists(join(workspace.repos[0].path, "openspec"))).resolves.toBe(false);
      await expect(exists(join(workspace.repos[1].path, "openspec"))).resolves.toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("syncs programming workspace changes into the quality workspace during handoff", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-quality-sync-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "src/keep.ts": "export const value = 'base';\n",
        "src/remove.ts": "export const remove = true;\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const programmingTask: TitingTask = {
        ...baseTask,
        id: "task-sync",
        executor: "programming",
        agentKind: "programming"
      };
      const programmingWorkspace = await plugin.prepareWorkspace(programmingTask);
      await writeFile(join(programmingWorkspace.repoPath, "src", "keep.ts"), "export const value = 'implemented';\n");
      await rm(join(programmingWorkspace.repoPath, "src", "remove.ts"));
      await writeFile(join(programmingWorkspace.repoPath, "src", "new.ts"), "export const added = true;\n");
      await mkdir(join(programmingWorkspace.repoPath, "node_modules", "cache"), { recursive: true });
      await writeFile(join(programmingWorkspace.repoPath, "node_modules", "cache", "local.txt"), "cache\n");
      await mkdir(join(programmingWorkspace.workspacePath, "openspec", "changes", "demo-change"), { recursive: true });
      await writeFile(
        join(programmingWorkspace.workspacePath, "openspec", "changes", "demo-change", "tasks.md"),
        "- [x] implementation complete\n"
      );
      await writeFile(
        join(programmingWorkspace.workspacePath, "openspec", "changes", "demo-change", "workflow-state.md"),
        "- [x] phase-2-implementation\n"
      );
      await writeFile(join(programmingWorkspace.artifactsPath, "implementation-handoff.json"), "{}\n");

      const qualityTask: TitingTask = {
        ...programmingTask,
        executor: "quality",
        agentKind: "quality",
        driverId: "quality-orchestrator",
        metadata: {
          ...programmingTask.metadata,
          implementationHandoff: {
            schemaVersion: "2026-07-03",
            workspaceId: programmingWorkspace.workspacePath,
            openspecChangeId: "demo-change",
            openspecRevision: "rev-1",
            openspecPath: join(programmingWorkspace.workspacePath, "openspec", "changes", "demo-change"),
            sourceProgrammingTaskId: programmingTask.id,
            baseSha: programmingWorkspace.repos[0].commit ?? "head",
            headSha: programmingWorkspace.repos[0].commit ?? "head",
            summary: "implementation complete",
            repos: programmingWorkspace.repos.map((repo) => ({
              key: repo.key,
              url: repo.url,
              path: repo.path,
              baseSha: repo.commit ?? "head",
              headSha: repo.commit ?? "head"
            })),
            changedFiles: ["src/keep.ts", "src/remove.ts", "src/new.ts"],
            artifactPaths: {
              implementationHandoff: join(programmingWorkspace.artifactsPath, "implementation-handoff.json")
            }
          }
        }
      };

      const qualityWorkspace = await plugin.prepareWorkspace(qualityTask);

      await expect(readFile(join(qualityWorkspace.repoPath, "src", "keep.ts"), "utf8"))
        .resolves.toBe("export const value = 'implemented';\n");
      await expect(readFile(join(qualityWorkspace.repoPath, "src", "new.ts"), "utf8"))
        .resolves.toBe("export const added = true;\n");
      await expect(exists(join(qualityWorkspace.repoPath, "src", "remove.ts"))).resolves.toBe(false);
      await expect(exists(join(qualityWorkspace.repoPath, "node_modules", "cache", "local.txt"))).resolves.toBe(false);
      await expect(readFile(join(qualityWorkspace.workspacePath, "openspec", "changes", "demo-change", "tasks.md"), "utf8"))
        .resolves.toContain("[x] implementation complete");
      await expect(readFile(join(qualityWorkspace.workspacePath, "openspec", "changes", "demo-change", "workflow-state.md"), "utf8"))
        .resolves.toContain("phase-2-implementation");
      await expect(readFile(join(qualityWorkspace.artifactsPath, "implementation-handoff.json"), "utf8"))
        .resolves.toBe("{}\n");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("syncs quality repair artifacts back into the programming repair workspace", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-repair-sync-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "src/app.ts": "export const state = 'base';\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const programmingTask: TitingTask = {
        ...baseTask,
        id: "task-repair-sync",
        executor: "programming",
        agentKind: "programming"
      };
      const programmingWorkspace = await plugin.prepareWorkspace(programmingTask);
      await writeFile(join(programmingWorkspace.repoPath, "src", "app.ts"), "export const state = 'implemented';\n");

      const qualityTask: TitingTask = {
        ...programmingTask,
        executor: "quality",
        agentKind: "quality",
        driverId: "quality-orchestrator",
        metadata: {
          ...programmingTask.metadata,
          implementationHandoff: {
            schemaVersion: "2026-07-03",
            workspaceId: programmingWorkspace.workspacePath,
            openspecChangeId: "demo-change",
            openspecRevision: "rev-1",
            openspecPath: join(programmingWorkspace.workspacePath, "openspec", "changes", "demo-change"),
            sourceProgrammingTaskId: programmingTask.id,
            baseSha: programmingWorkspace.repos[0].commit ?? "head",
            headSha: programmingWorkspace.repos[0].commit ?? "head",
            summary: "implementation complete",
            repos: programmingWorkspace.repos.map((repo) => ({
              key: repo.key,
              url: repo.url,
              path: repo.path,
              baseSha: repo.commit ?? "head",
              headSha: repo.commit ?? "head"
            })),
            changedFiles: ["src/app.ts"],
            artifactPaths: {}
          }
        }
      };
      const qualityWorkspace = await plugin.prepareWorkspace(qualityTask);
      await mkdir(join(qualityWorkspace.workspacePath, "openspec", "changes", "demo-change"), { recursive: true });
      await writeFile(
        join(qualityWorkspace.workspacePath, "openspec", "changes", "demo-change", "workflow-state.md"),
        "- [x] phase-3-verification-review\n"
      );
      await writeFile(join(qualityWorkspace.artifactsPath, "quality-report.json"), "{\"passed\":false}\n");
      await writeFile(join(qualityWorkspace.artifactsPath, "quality-repair-handoff.json"), "{\"failedChecks\":[\"lint\"]}\n");

      const repairTask: TitingTask = {
        ...qualityTask,
        executor: "programming",
        agentKind: "programming",
        driverId: "coding",
        metadata: {
          ...qualityTask.metadata,
          qualityWorkspaceId: qualityWorkspace.workspacePath,
          workspaceSync: {
            sourceWorkspaceId: qualityWorkspace.workspacePath,
            handoff: "quality_to_programming",
            targetAgentKind: "programming"
          }
        }
      };
      const repairWorkspace = await plugin.prepareWorkspace(repairTask);

      await expect(readFile(join(repairWorkspace.repoPath, "src", "app.ts"), "utf8"))
        .resolves.toBe("export const state = 'implemented';\n");
      await expect(readFile(join(repairWorkspace.artifactsPath, "quality-report.json"), "utf8"))
        .resolves.toContain("\"passed\":false");
      await expect(readFile(join(repairWorkspace.artifactsPath, "quality-repair-handoff.json"), "utf8"))
        .resolves.toContain("\"lint\"");
      await expect(readFile(join(repairWorkspace.workspacePath, "openspec", "changes", "demo-change", "workflow-state.md"), "utf8"))
        .resolves.toContain("phase-3-verification-review");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("removes spec archives and __MACOSX metadata after extraction", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-spec-clean-"));
    try {
      const archiveSource = join(sandbox, "archive-source");
      const workspacePath = join(sandbox, "workspace");
      await mkdir(join(archiveSource, "__MACOSX"), { recursive: true });
      await mkdir(join(archiveSource, "openspec"), { recursive: true });
      await writeFile(join(archiveSource, "WORKFLOW_PROMPTS.md"), buildWorkflowPrompts(["Plan"]));
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      await writeFile(join(archiveSource, "__MACOSX", "._WORKFLOW_PROMPTS.md"), "metadata");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "WORKFLOW_PROMPTS.md", "openspec", "__MACOSX"], { cwd: archiveSource });

      const result = await materializeSpecDocuments({
        ...createTask("https://example.com/repo.git"),
        metadata: {
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      }, workspacePath, createConfig(sandbox));

      expect(await exists(join(workspacePath, "WORKFLOW_PROMPTS.md"))).toBe(true);
      expect(await exists(join(workspacePath, "spec-bundle.zip"))).toBe(false);
      expect(await exists(join(workspacePath, "__MACOSX"))).toBe(false);
      expect(result.documents).not.toContainEqual(expect.objectContaining({
        localPath: join(workspacePath, "spec-bundle.zip")
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("accepts spec archives with openspec and optional WORKFLOW_PROMPTS", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-spec-openspec-"));
    try {
      const archiveSource = join(sandbox, "archive-source");
      const workspacePath = join(sandbox, "workspace");
      await mkdir(join(archiveSource, "openspec"), { recursive: true });
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "openspec"], { cwd: archiveSource });

      const result = await materializeSpecDocuments({
        ...createTask("https://example.com/repo.git"),
        metadata: {
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      }, workspacePath, createConfig(sandbox));

      expect(await exists(join(workspacePath, "openspec"))).toBe(true);
      expect(result.workflowPromptsPath).toBeUndefined();
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("rejects spec archives without openspec", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-spec-missing-openspec-"));
    try {
      const archiveSource = join(sandbox, "archive-source");
      const workspacePath = join(sandbox, "workspace");
      await mkdir(archiveSource, { recursive: true });
      await writeFile(join(archiveSource, "WORKFLOW_PROMPTS.md"), buildWorkflowPrompts(["Plan"]));
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "WORKFLOW_PROMPTS.md"], { cwd: archiveSource });

      await expect(materializeSpecDocuments({
        ...createTask("https://example.com/repo.git"),
        metadata: {
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      }, workspacePath, createConfig(sandbox))).rejects.toThrow("Spec package must include openspec/");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("passes deep preflight when openspec exists and WORKFLOW_PROMPTS is omitted", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-preflight-openspec-"));
    try {
      const archiveSource = join(sandbox, "archive-source");
      await mkdir(join(archiveSource, "openspec"), { recursive: true });
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "openspec"], { cwd: archiveSource });
      const task = {
        ...createTask("https://example.com/repo.git"),
        metadata: {
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      };

      const result = await runTaskPreflight(task, {
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          preflightDeep: true
        }
      });

      expect(result.passed).toBe(true);
      expect(result.checks).toContainEqual(expect.objectContaining({
        name: "workflow-prompts",
        passed: true
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("allows product preflight without spec attachments and blocks product-handoff programming without approval", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-preflight-"));
    try {
      const config = createConfig(sandbox);
      const productTask: TitingTask = {
        ...createTask("https://example.com/repo.git"),
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex",
        metadata: {
          repos: [{ key: "Repo1", url: "https://example.com/repo.git" }],
          openspecSourceState: "none",
          workflowRole: "product_spec"
        }
      };
      const programmingTask: TitingTask = {
        ...createTask("https://example.com/repo.git"),
        executor: "programming",
        agentKind: "programming",
        metadata: {
          repos: [{ key: "Repo1", url: "https://example.com/repo.git" }],
          sourceProductTaskId: "task-product-1",
          workflowRole: "programming_from_product"
        }
      };

      await expect(runTaskPreflight(productTask, config)).resolves.toEqual(expect.objectContaining({
        passed: true,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "openspec-source", passed: true })
        ])
      }));
      await expect(runTaskPreflight(programmingTask, config)).resolves.toEqual(expect.objectContaining({
        passed: false,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "approved-openspec", passed: false })
        ])
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("adds required dependency check failures to approved programming handoff preflight", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-dependency-preflight-"));
    try {
      const config = createConfig(sandbox);
      const task: TitingTask = {
        ...createTask("https://example.com/repo.git"),
        executor: "programming",
        agentKind: "programming",
        metadata: {
          repos: [{ key: "Repo1", url: "https://example.com/repo.git" }],
          sourceProductTaskId: "task-product-1",
          workspaceId: "workspace-1",
          openspecChangeId: "unify-dependency-checks",
          approvedOpenSpec: true,
          workflowRole: "programming_from_product"
        }
      };
      const dependencyChecks = {
        async list() {
          return {
            ready: 0,
            total: 1,
            degraded: true,
            checks: [
              {
                id: "codex-runtime",
                category: "coding-agent" as const,
                label: "Codex CLI",
                description: "Codex coding runtime",
                status: "unverified" as const,
                required: true,
                requiredFor: ["programming"],
                items: [{ id: "signed-in", label: "Signed in", status: "unverified" as const, detail: "Run codex once" }]
              }
            ]
          };
        }
      };

      const result = await runTaskPreflight(task, config, dependencyChecks);

      expect(result.passed).toBe(false);
      expect(result.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "dependency:codex-runtime", passed: false })
      ]));
      expect(result.error).toContain("Codex CLI");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("passes programming dependency preflight when any coding runtime is ready", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-dependency-alternative-"));
    try {
      const config = createConfig(sandbox);
      const task: TitingTask = {
        ...createTask("https://example.com/repo.git"),
        executor: "programming",
        agentKind: "programming",
        metadata: {
          repos: [{ key: "Repo1", url: "https://example.com/repo.git" }],
          sourceProductTaskId: "task-product-1",
          workspaceId: "workspace-1",
          openspecChangeId: "unify-dependency-checks",
          approvedOpenSpec: true,
          workflowRole: "programming_from_product"
        }
      };
      const dependencyChecks = {
        async list() {
          return {
            ready: 1,
            total: 2,
            degraded: false,
            checks: [
              {
                id: "codex-runtime",
                category: "coding-agent" as const,
                label: "Codex CLI",
                description: "Codex coding runtime",
                status: "blocked" as const,
                required: true,
                requiredFor: ["programming"],
                items: [{ id: "cli", label: "CLI available", status: "blocked" as const, detail: "Codex CLI is unavailable" }]
              },
              {
                id: "cursor-runtime",
                category: "coding-agent" as const,
                label: "Cursor CLI",
                description: "Cursor coding runtime",
                status: "ready" as const,
                required: true,
                requiredFor: ["programming"],
                items: [{ id: "cli", label: "CLI available", status: "ready" as const, detail: "Cursor CLI is available" }]
              }
            ]
          };
        }
      };

      const result = await runTaskPreflight(task, config, dependencyChecks);

      expect(result.passed).toBe(true);
      expect(result.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "dependency:coding-runtime", passed: true })
      ]));
      expect(result.checks).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "dependency:codex-runtime", passed: false })
      ]));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("clones a repo into cache, prepares a worktree, and preserves failed workspace by default", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n",
        "package.json": JSON.stringify({ scripts: { test: "echo ok" } }, null, 2)
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = await prepareEnvTask(sandbox, sourceRepo);

      const workspace = await plugin.prepareWorkspace(task);
      const readme = await readFile(join(workspace.repoPath, "README.md"), "utf8");
      const packageJson = await readFile(join(workspace.workspacePath, "package.json"), "utf8");

      expect(readme).toContain("demo");
      expect(JSON.parse(packageJson)).toMatchObject({ scripts: { test: "echo ok" } });
      expect(workspace.repos).toHaveLength(1);
      expect(workspace.repoPath).toBe(workspace.workspacePath);
      expect(workspace.repos[0].path).toBe(workspace.workspacePath);
      expect(workspace.cachePath).toContain(".diting-repos");
      expect(await exists(join(workspace.workspacePath, ".git"))).toBe(true);
      expect(await exists(join(workspace.artifactsPath, "workspace.json"))).toBe(true);
      expect(await exists(join(workspace.repoPath, ".diting", "services.yaml"))).toBe(true);
      const status = await execFileAsync("git", ["status", "--porcelain"], { cwd: workspace.repoPath });
      expect(status.stdout).toContain("?? .diting/");

      await plugin.cleanupWorkspace({ ...task, status: "failed" }, workspace);

      expect(await exists(workspace.workspacePath)).toBe(true);
      expect(await exists(workspace.repoPath)).toBe(true);
      expect(await exists(join(workspace.repoPath, "README.md"))).toBe(true);
      expect(await exists(join(workspace.workspacePath, "source", "README.md"))).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("injects task serviceStartup.servicesYaml into the prepared single-repo workspace", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-yaml-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const servicesYaml = [
        "schemaVersion: 1",
        "services:",
        "  - id: backend",
        "    cwd: .",
        "    command: [\"npm\", \"run\", \"start:dev\"]",
        "    healthUrl: http://127.0.0.1:3000/health",
        ""
      ].join("\n");
      const workspace = await plugin.prepareWorkspace({
        ...baseTask,
        metadata: {
          ...baseTask.metadata,
          serviceStartup: {
            servicesYaml
          }
        }
      });

      const injectedPath = join(workspace.repoPath, ".diting", "services.yaml");
      await expect(readFile(injectedPath, "utf8")).resolves.toBe(servicesYaml);
      const workspaceJson = JSON.parse(await readFile(join(workspace.artifactsPath, "workspace.json"), "utf8"));
      expect(workspaceJson.serviceStartupInjectedPath).toBe(injectedPath);

      const excludePath = (await gitOutput(["rev-parse", "--git-path", "info/exclude"], workspace.repoPath)).trim();
      const exclude = await readFile(isAbsolute(excludePath) ? excludePath : join(workspace.repoPath, excludePath), "utf8");
      expect(exclude).toContain("/.diting/services.yaml");
      expect(await gitOutput(["status", "--porcelain"], workspace.repoPath)).not.toContain(".diting/services.yaml");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("scaffolds a tracked .diting/services.yaml when no task service startup override exists", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-scaffold-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "package.json": JSON.stringify({ scripts: { "start:dev": "node server.js" } }, null, 2),
        "server.js": "console.log('demo');\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const workspace = await plugin.prepareWorkspace(baseTask);

      const scaffoldPath = join(workspace.repoPath, ".diting", "services.yaml");
      const scaffold = await readFile(scaffoldPath, "utf8");
      expect(scaffold).toContain("schemaVersion: 1");
      expect(scaffold).toContain("repoKey");
      expect(scaffold).toContain("TODO");

      const workspaceJson = JSON.parse(await readFile(join(workspace.artifactsPath, "workspace.json"), "utf8"));
      expect(workspaceJson.serviceStartupScaffoldPaths).toEqual([scaffoldPath]);

      const excludePath = (await gitOutput(["rev-parse", "--git-path", "info/exclude"], workspace.repoPath)).trim();
      const exclude = await readFile(isAbsolute(excludePath) ? excludePath : join(workspace.repoPath, excludePath), "utf8");
      expect(exclude).not.toContain("/.diting/services.yaml");
      expect(await gitOutput(["status", "--porcelain"], workspace.repoPath)).toContain("?? .diting/");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("does not overwrite an existing target repo .diting/services.yaml scaffold", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-existing-"));
    try {
      const sourceRepo = join(sandbox, "source");
      const existingServicesYaml = [
        "schemaVersion: 1",
        "services:",
        "  - id: existing",
        "    cwd: .",
        "    command: [\"npm\", \"run\", \"start\"]",
        "    healthUrl: http://127.0.0.1:4000/health",
        ""
      ].join("\n");
      await createGitRepo(sourceRepo, {
        ".diting/services.yaml": existingServicesYaml,
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const workspace = await plugin.prepareWorkspace(baseTask);

      await expect(readFile(join(workspace.repoPath, ".diting", "services.yaml"), "utf8")).resolves.toBe(existingServicesYaml);
      const workspaceJson = JSON.parse(await readFile(join(workspace.artifactsPath, "workspace.json"), "utf8"));
      expect(workspaceJson.serviceStartupScaffoldPaths).toEqual([]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("scaffolds services.yaml in every repo for multi-repo workspaces", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-multi-scaffold-"));
    try {
      const repoA = join(sandbox, "repo-a");
      const repoB = join(sandbox, "repo-b");
      await createGitRepo(repoA, { "README.md": "# repo a\n" });
      await createGitRepo(repoB, { "README.md": "# repo b\n" });
      const specDir = join(sandbox, "spec-fixtures");
      await mkdir(specDir, { recursive: true });
      const workflowPath = join(specDir, "WORKFLOW_PROMPTS.md");
      await writeFile(workflowPath, buildWorkflowPrompts(["Plan"]));

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = {
        ...createTask(repoA),
        metadata: {
          preflight: {
            passed: true,
            checkedAt: new Date().toISOString(),
            checks: []
          },
          repos: [
            { key: "RepoA", url: repoA },
            { key: "RepoB", url: repoB }
          ],
          specAttachments: [{ name: "WORKFLOW_PROMPTS.md", localPath: workflowPath }]
        }
      };
      const workspace = await plugin.prepareWorkspace(task);

      const primaryServicesPath = join(workspace.repos[0].path, ".diting", "services.yaml");
      const secondaryServicesPath = join(workspace.repos[1].path, ".diting", "services.yaml");
      const primaryScaffold = await readFile(primaryServicesPath, "utf8");
      const secondaryScaffold = await readFile(secondaryServicesPath, "utf8");
      expect(primaryScaffold).toContain("repoKey: RepoA");
      expect(primaryScaffold).toContain("id: repo-a");
      expect(primaryScaffold).not.toContain("repoKey: RepoB");
      expect(secondaryScaffold).toContain("repoKey: RepoB");
      expect(secondaryScaffold).toContain("id: repo-b");
      expect(secondaryScaffold).not.toContain("repoKey: RepoA");
      const workspaceJson = JSON.parse(await readFile(join(workspace.artifactsPath, "workspace.json"), "utf8"));
      expect(workspaceJson.serviceStartupScaffoldPaths).toEqual([primaryServicesPath, secondaryServicesPath]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("honors serviceStartup.configPath when injecting servicesYaml", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-config-path-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const servicesYaml = [
        "schemaVersion: 1",
        "services:",
        "  - id: web",
        "    cwd: .",
        "    command: [\"npm\", \"run\", \"dev\"]",
        "    healthUrl: http://127.0.0.1:5180",
        ""
      ].join("\n");
      const workspace = await plugin.prepareWorkspace({
        ...baseTask,
        metadata: {
          ...baseTask.metadata,
          serviceStartup: {
            configPath: ".diting/generated/services.yaml",
            servicesYaml
          }
        }
      });

      await expect(readFile(join(workspace.repoPath, ".diting", "generated", "services.yaml"), "utf8")).resolves.toBe(servicesYaml);
      await expect(exists(join(workspace.repoPath, ".diting", "services.yaml"))).resolves.toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("does not inject servicesYaml when structured services or explicit disable are present", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-priority-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const servicesYaml = [
        "schemaVersion: 1",
        "services:",
        "  - id: backend",
        "    cwd: .",
        "    command: [\"npm\", \"run\", \"start:dev\"]",
        "    healthUrl: http://127.0.0.1:3000/health",
        ""
      ].join("\n");

      const structuredWorkspace = await plugin.prepareWorkspace({
        ...baseTask,
        metadata: {
          ...baseTask.metadata,
          serviceStartup: {
            servicesYaml,
            services: [{
              id: "task-backend",
              cwd: ".",
              command: ["npm", "run", "start:dev"],
              healthUrl: "http://127.0.0.1:3001/health"
            }]
          }
        }
      });
      await expect(exists(join(structuredWorkspace.repoPath, ".diting", "services.yaml"))).resolves.toBe(false);

      const disabledWorkspace = await plugin.prepareWorkspace({
        ...baseTask,
        metadata: {
          ...baseTask.metadata,
          serviceStartup: {
            enabled: false,
            servicesYaml
          }
        }
      });
      await expect(exists(join(disabledWorkspace.repoPath, ".diting", "services.yaml"))).resolves.toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("rejects invalid injected servicesYaml during workspace preparation", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-services-invalid-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);

      await expect(plugin.prepareWorkspace({
        ...baseTask,
        metadata: {
          ...baseTask.metadata,
          serviceStartup: {
            servicesYaml: "schemaVersion: 1\nservices: []\n"
          }
        }
      })).rejects.toThrow("service_startup_config");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("bootstraps a product workspace without requiring an existing spec package", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const task: TitingTask = {
        ...baseTask,
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex",
        metadata: {
          preflight: {
            passed: true,
            checkedAt: new Date().toISOString(),
            checks: []
          },
          repos: [{ key: "Repo1", url: sourceRepo }],
          openspecSourceState: "none",
          workflowRole: "product_spec"
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      const branch = await execFileAsync("git", ["branch", "--show-current"], { cwd: workspace.repoPath });
      const head = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: workspace.repoPath });
      const workspaceJson = JSON.parse(await readFile(join(workspace.artifactsPath, "workspace.json"), "utf8"));

      expect(workspace.repoPath).toBe(workspace.workspacePath);
      expect(await exists(join(workspace.workspacePath, ".git"))).toBe(true);
      await expect(readFile(join(workspace.workspacePath, "README.md"), "utf8")).resolves.toContain("demo");
      expect(branch.stdout.trim()).toBe(task.branch);
      expect(await exists(join(workspace.workspacePath, "task.md"))).toBe(true);
      expect(await exists(join(workspace.workspacePath, "openspec"))).toBe(true);
      expect(await exists(join(workspace.artifactsPath, "workspace.json"))).toBe(true);
      expect(workspaceJson).toEqual(expect.objectContaining({
        repoPath: workspace.repoPath,
        git: expect.objectContaining({
          isGitWorktree: true,
          branch: task.branch,
          commit: head.stdout.trim()
        }),
        repos: [expect.objectContaining({
          key: "Repo1",
          path: workspace.repoPath,
          isGitWorktree: true,
          branch: task.branch,
          commit: head.stdout.trim()
        })]
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("materializes spec attachment contents for product workspaces without requiring openspec", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-env-spec-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });
      const archiveSource = join(sandbox, "archive-source");
      await mkdir(archiveSource, { recursive: true });
      await writeFile(join(archiveSource, "requirements.md"), "# 用户补充需求\n\n需要人工整理为 OpenSpec。\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "requirements.md"], { cwd: archiveSource });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const task: TitingTask = {
        ...baseTask,
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex",
        metadata: {
          preflight: {
            passed: true,
            checkedAt: new Date().toISOString(),
            checks: []
          },
          repos: [{ key: "Repo1", url: sourceRepo }],
          openspecSourceState: "none",
          workflowRole: "product_spec",
          specAttachments: [{ name: "spec-bundle.zip", localPath: archivePath }]
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      const workspaceJson = JSON.parse(await readFile(join(workspace.artifactsPath, "workspace.json"), "utf8"));

      await expect(readFile(join(workspace.workspacePath, "requirements.md"), "utf8")).resolves.toContain("用户补充需求");
      await expect(readFile(join(workspace.workspacePath, "task.md"), "utf8")).resolves.toContain(task.instruction);
      expect(await exists(join(workspace.workspacePath, "openspec"))).toBe(true);
      expect(workspaceJson.specDocuments).toEqual([]);
      await expect(gitOutput(["status", "--porcelain"], workspace.repoPath)).resolves.not.toContain("task.md");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reuses an existing retry workspace without clearing local changes", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-reuse-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const workspace = await plugin.prepareWorkspace(task);
      await writeFile(join(workspace.repoPath, "retry-notes.txt"), "keep this local work\n");

      const retriedWorkspace = await plugin.prepareWorkspace({ ...task, retryCount: 1 });
      const preserved = await readFile(join(retriedWorkspace.repoPath, "retry-notes.txt"), "utf8");
      const status = await execFileAsync("git", ["status", "--porcelain"], { cwd: retriedWorkspace.repoPath });

      expect(retriedWorkspace.workspacePath).toBe(workspace.workspacePath);
      expect(retriedWorkspace.repoPath).toBe(workspace.repoPath);
      expect(preserved).toBe("keep this local work\n");
      expect(status.stdout).toContain("?? retry-notes.txt");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("fetches an existing mirror cache when the task branch is checked out in another workspace", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-fetch-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });
      const branch = "feature/retry-fetch";
      await git(["checkout", "-b", branch], sourceRepo);
      await writeFile(join(sourceRepo, "feature.txt"), "first\n");
      await git(["add", "feature.txt"], sourceRepo);
      await git(["commit", "-m", "feature"], sourceRepo);

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const firstTask = { ...baseTask, branch };
      const firstWorkspace = await plugin.prepareWorkspace(firstTask);

      await writeFile(join(sourceRepo, "feature.txt"), "second\n");
      await git(["add", "feature.txt"], sourceRepo);
      await git(["commit", "-m", "advance feature"], sourceRepo);

      const secondWorkspace = await plugin.prepareWorkspace({ ...firstTask, id: "task-2" });
      const refreshed = await readFile(join(secondWorkspace.repoPath, "feature.txt"), "utf8");
      const fetchRefspecs = await gitOutput(["--git-dir", firstWorkspace.cachePath, "config", "--get-all", "remote.origin.fetch"], sandbox);
      const mirror = await gitOutput(["--git-dir", firstWorkspace.cachePath, "config", "--get", "remote.origin.mirror"], sandbox);

      expect(refreshed).toBe("second\n");
      expect(fetchRefspecs.trim().split("\n")).toEqual([
        "+refs/heads/*:refs/remotes/origin/*",
        "+refs/tags/*:refs/tags/*"
      ]);
      expect(mirror.trim()).toBe("false");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("rebuilds a stale workspace when the workspace directory exists but the repository path is missing", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-stale-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const staleWorkspacePath = join(sandbox, `${task.id}-${task.executor}`);
      await mkdir(staleWorkspacePath, { recursive: true });
      await writeFile(join(staleWorkspacePath, "stale.txt"), "stale\n");

      const workspace = await plugin.prepareWorkspace(task);
      const readme = await readFile(join(workspace.repoPath, "README.md"), "utf8");

      expect(readme).toContain("demo");
      expect(await exists(join(workspace.workspacePath, "stale.txt"))).toBe(false);
      expect(await exists(join(workspace.repoPath, ".git"))).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("rebuilds a stale mirror cache when the cache path exists but is not a bare repository", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-cache-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const repoCacheRoot = join(sandbox, ".diting-repos");
      const cachePath = join(repoCacheRoot, hashRepo(sourceRepo));
      await mkdir(cachePath, { recursive: true });
      await writeFile(join(cachePath, "stale.txt"), "stale\n");

      const workspace = await plugin.prepareWorkspace(task);
      const readme = await readFile(join(workspace.repoPath, "README.md"), "utf8");

      expect(readme).toContain("demo");
      expect(await exists(join(cachePath, "stale.txt"))).toBe(false);
      expect(await exists(join(cachePath, "HEAD"))).toBe(true);
      expect(workspace.cachePath).toContain(".diting-repos");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("preserves successful workspaces when cleanup-on-success is disabled", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin({
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          cleanupOnSuccess: false
        }
      });
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const workspace = await plugin.prepareWorkspace(task);

      await plugin.cleanupWorkspace({ ...task, status: "succeeded" }, workspace);

      expect(await exists(workspace.workspacePath)).toBe(true);
      expect(await exists(workspace.repoPath)).toBe(true);
      expect(await exists(join(workspace.repoPath, "README.md"))).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("preserves non-done workspaces even when cleanup-on-failure is enabled", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin({
        ...createConfig(sandbox),
        workspace: {
          ...createConfig(sandbox).workspace,
          cleanupOnFailure: true
        }
      });
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const workspace = await plugin.prepareWorkspace(task);

      await plugin.cleanupWorkspace({ ...task, status: "failed" }, workspace);

      expect(await exists(workspace.workspacePath)).toBe(true);
      expect(await exists(join(workspace.repoPath, "README.md"))).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("removes successful workspaces when cleanup-on-success is enabled", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const workspace = await plugin.prepareWorkspace(task);

      await plugin.cleanupWorkspace({ ...task, status: "succeeded" }, workspace);

      expect(await exists(workspace.workspacePath)).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("classifies missing branches as non-retryable environment failures", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = { ...(await prepareEnvTask(sandbox, sourceRepo)), branch: "missing-branch" };

      await expect(plugin.prepareWorkspace(task)).rejects.toMatchObject({
        name: "EnvironmentPreparationError",
        stage: "checkout",
        retryable: false
      } satisfies Partial<EnvironmentPreparationError>);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("creates auto-generated task branches from origin/main", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const task = {
        ...baseTask,
        branch: "feature/20260511010203-task1234",
        metadata: {
          ...baseTask.metadata,
          diting: {
            branch: {
              autoGenerated: true
            }
          }
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      const { stdout } = await execFileAsync("git", ["branch", "--show-current"], { cwd: workspace.repoPath });
      const readme = await readFile(join(workspace.repoPath, "README.md"), "utf8");

      expect(stdout.trim()).toBe(task.branch);
      expect(readme).toContain("demo");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("creates auto-generated task branches from origin/master", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(
        sourceRepo,
        {
          "README.md": "# demo\n"
        },
        "master"
      );

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const baseTask = await prepareEnvTask(sandbox, sourceRepo);
      const task = {
        ...baseTask,
        branch: "feature/20260604121438-1eee0245",
        metadata: {
          ...baseTask.metadata,
          diting: {
            branch: {
              autoGenerated: true
            }
          }
        }
      };

      const workspace = await plugin.prepareWorkspace(task);
      const { stdout } = await execFileAsync("git", ["branch", "--show-current"], { cwd: workspace.repoPath });

      expect(stdout.trim()).toBe(task.branch);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("emits runtime events for environment preparation stages", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-env-"));
    try {
      const sourceRepo = join(sandbox, "source");
      await createGitRepo(sourceRepo, {
        "README.md": "# demo\n"
      });

      const plugin = new LocalWorktreeEnvironmentPlugin(createConfig(sandbox));
      const task = await prepareEnvTask(sandbox, sourceRepo);
      const runtimeEvents: Array<{ type: string; stage: string }> = [];

      await plugin.prepareWorkspace(task, {
        runtimeLogger: async (event) => {
          runtimeEvents.push({ type: event.type, stage: event.stage });
        }
      });

      expect(runtimeEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "command_start", stage: "clone" }),
        expect.objectContaining({ type: "result", stage: "clone" }),
        expect.objectContaining({ type: "command_start", stage: "worktree" }),
        expect.objectContaining({ type: "result", stage: "checkout" })
      ]));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("DefaultQualityPlugin", () => {
  it("reports layered quality checks and scores existing automation reports", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-quality-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeFile(
        join(repoPath, "package.json"),
        JSON.stringify(
          {
            name: "quality-repo",
            private: true,
            scripts: {
              "type-check": "node -e \"process.exit(0)\"",
              "test:unit": "node -e \"process.exit(0)\"",
              build: "node -e \"process.exit(0)\""
            }
          },
          null,
          2
        )
      );
      await writeFile(join(repoPath, "README.md"), "one\n");
      await git(["init"], repoPath);
      await git(["config", "user.email", "test@example.com"], repoPath);
      await git(["config", "user.name", "Test User"], repoPath);
      await git(["add", "."], repoPath);
      await git(["commit", "-m", "init"], repoPath);
      await writeFile(join(repoPath, "README.md"), "one\ntwo\n");
      await writeAutomationReports(repoPath, "demo-change", {
        apiScore: 92,
        uiGateStatus: "passed"
      });

      const plugin = new DefaultQualityPlugin(60_000);
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        execution: {
          exitCode: 0,
          stdout: "",
          stderr: "",
          summary: "ok",
          sessionId: "session-1",
          timedOut: false,
          errorCategory: "none",
          timeoutCategory: "none",
          metadata: {}
        },
        workspace: createWorkspace(sandbox, repoPath)
      });

      expect(result.passed).toBe(true);
      expect(result.riskLevel).toBe("low");
      expect(result.checks.find((check) => check.name === "static/lint")?.detail).toContain("Skipped");
      expect(result.checks.find((check) => check.name === "unit/unit-test")?.passed).toBe(true);
      expect(result.checks.find((check) => check.name === "startup/build")?.passed).toBe(true);
      expect(result.checks.find((check) => check.name === "automation-report/api")?.detail).toContain("score=92");
      expect(result.checks.find((check) => check.name === "automation-report/ui")?.detail).toContain("status=passed");
      expect((result.report.layers as Array<{ id: string }>).map((layer) => layer.id)).toEqual([
        "static",
        "unit",
        "startup",
        "automation-report"
      ]);
      expect(result.report.automationReports).toEqual(expect.objectContaining({
        api: expect.objectContaining({ score: 92, passed: true }),
        ui: expect.objectContaining({ status: "passed", passed: true })
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("scores automation reports from the prepared workspace root", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-quality-workspace-report-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeFile(
        join(repoPath, "package.json"),
        JSON.stringify(
          {
            name: "quality-workspace-report-repo",
            private: true,
            scripts: {
              test: "node -e \"process.exit(0)\""
            }
          },
          null,
          2
        )
      );
      await writeFile(join(repoPath, "README.md"), "one\n");
      await git(["init"], repoPath);
      await git(["config", "user.email", "test@example.com"], repoPath);
      await git(["config", "user.name", "Test User"], repoPath);
      await git(["add", "."], repoPath);
      await git(["commit", "-m", "init"], repoPath);
      await writeAutomationReports(sandbox, "demo-change", {
        apiScore: 96,
        uiGateStatus: "passed"
      });

      const plugin = new DefaultQualityPlugin(60_000);
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        execution: createExecutionResult(),
        workspace: createWorkspace(sandbox, repoPath)
      });

      expect(result.passed).toBe(true);
      expect(result.checks.find((check) => check.name === "automation-report/api")).toEqual(expect.objectContaining({
        passed: true,
        detail: expect.stringContaining("score=96")
      }));
      expect(result.checks.find((check) => check.name === "automation-report/ui")).toEqual(expect.objectContaining({
        passed: true,
        detail: expect.stringContaining("status=passed")
      }));
      expect(result.report.automationReports).toEqual(expect.objectContaining({
        api: expect.objectContaining({ skipped: false, path: join(sandbox, "tmp", "api-test-reports", "demo-change", "metrics.json") }),
        ui: expect.objectContaining({ skipped: false, path: join(sandbox, "uiAutomationMetrics.json") })
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("fails quality when automation reports contain failing metrics", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-quality-report-fail-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeFile(
        join(repoPath, "package.json"),
        JSON.stringify(
          {
            name: "quality-report-fail-repo",
            private: true,
            scripts: {
              "type-check": "node -e \"process.exit(0)\"",
              "test:unit": "node -e \"process.exit(0)\"",
              build: "node -e \"process.exit(0)\""
            }
          },
          null,
          2
        )
      );
      await writeFile(join(repoPath, "README.md"), "one\n");
      await git(["init"], repoPath);
      await git(["config", "user.email", "test@example.com"], repoPath);
      await git(["config", "user.name", "Test User"], repoPath);
      await git(["add", "."], repoPath);
      await git(["commit", "-m", "init"], repoPath);
      await writeAutomationReports(repoPath, "demo-change", {
        apiScore: 68,
        uiGateStatus: "blocked"
      });

      const plugin = new DefaultQualityPlugin(60_000);
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        execution: createExecutionResult(),
        workspace: createWorkspace(sandbox, repoPath)
      });

      expect(result.passed).toBe(false);
      expect(result.riskLevel).toBe("high");
      expect(result.checks.find((check) => check.name === "automation-report/api")).toEqual(expect.objectContaining({
        passed: false,
        detail: expect.stringContaining("score=68")
      }));
      expect(result.checks.find((check) => check.name === "automation-report/ui")).toEqual(expect.objectContaining({
        passed: false,
        detail: expect.stringContaining("status=blocked")
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("skips automation report scoring when no reports are available", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-quality-no-report-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeFile(
        join(repoPath, "package.json"),
        JSON.stringify(
          {
            name: "quality-no-report-repo",
            private: true,
            scripts: {
              "type-check": "node -e \"process.exit(0)\"",
              "test:unit": "node -e \"process.exit(0)\"",
              build: "node -e \"process.exit(0)\""
            }
          },
          null,
          2
        )
      );
      await writeFile(join(repoPath, "README.md"), "one\n");
      await git(["init"], repoPath);
      await git(["config", "user.email", "test@example.com"], repoPath);
      await git(["config", "user.name", "Test User"], repoPath);
      await git(["add", "."], repoPath);
      await git(["commit", "-m", "init"], repoPath);

      const plugin = new DefaultQualityPlugin(60_000);
      const result = await plugin.evaluate({
        task: createTask(repoPath),
        execution: createExecutionResult(),
        workspace: createWorkspace(sandbox, repoPath)
      });

      expect(result.passed).toBe(true);
      expect(result.checks.find((check) => check.name === "automation-report/api")?.detail).toContain("Skipped");
      expect(result.checks.find((check) => check.name === "automation-report/ui")?.detail).toContain("Skipped");
      expect(result.report.automationReports).toEqual(expect.objectContaining({
        api: expect.objectContaining({ skipped: true, passed: true }),
        ui: expect.objectContaining({ skipped: true, passed: true })
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reports high diff risk without failing quality when automation passes", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-quality-high-diff-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeFile(
        join(repoPath, "package.json"),
        JSON.stringify(
          {
            name: "quality-high-diff-repo",
            private: true,
            scripts: {
              test: "node -e \"process.exit(0)\""
            }
          },
          null,
          2
        )
      );
      await writeFile(join(repoPath, "README.md"), "one\n");
      await git(["init"], repoPath);
      await git(["config", "user.email", "test@example.com"], repoPath);
      await git(["config", "user.name", "Test User"], repoPath);
      await git(["add", "."], repoPath);
      await git(["commit", "-m", "init"], repoPath);
      for (let index = 0; index < 21; index += 1) {
        await writeFile(join(repoPath, `file-${index}.txt`), "new work\n");
      }

      const plugin = new DefaultQualityPlugin(60_000);
      const result = await plugin.evaluate({
        task: createTask(repoPath),
        execution: createExecutionResult(),
        workspace: createWorkspace(sandbox, repoPath)
      });

      expect(result.riskLevel).toBe("high");
      expect(result.passed).toBe(true);
      expect(result.checks.find((check) => check.name === "diff-risk")).toEqual(expect.objectContaining({
        passed: true,
        detail: expect.stringContaining("risk=high")
      }));
      expect(result.checks.find((check) => check.name === "acceptance-criteria")?.passed).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("completion gate DefaultOpenSpecCompletionGatePlugin", () => {
  it("passes when all autonomous OpenSpec tasks are checked", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-completion-gate-"));
    try {
      const repoPath = join(sandbox, "repo");
      await writeOpenSpecTasks(repoPath, "demo-change", [
        "# Tasks",
        "",
        "- [x] 1. 扩展插件契约",
        "- [ ] 2. 用户在终端执行 openspec validate",
        "- [ ] 3. manual: 等待用户确认"
      ].join("\n"));
      const plugin = new DefaultOpenSpecCompletionGatePlugin();
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        workspace: createWorkspace(sandbox, repoPath),
        execution: createExecutionResult(),
        repairGoal: null
      });

      expect(result.passed).toBe(true);
      expect(result.incompleteTasks).toEqual([]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("fails with repair objective when an autonomous task is unchecked", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-completion-gate-"));
    try {
      const repoPath = join(sandbox, "repo");
      await writeOpenSpecTasks(repoPath, "demo-change", [
        "# Tasks",
        "",
        "- [x] 1. 已完成实现",
        "- [ ] 2. 未完成自动化实现"
      ].join("\n"));
      const plugin = new DefaultOpenSpecCompletionGatePlugin();
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        workspace: createWorkspace(sandbox, repoPath),
        execution: createExecutionResult(),
        repairGoal: null
      });

      const tasksPath = join(repoPath, "openspec", "changes", "demo-change", "tasks.md");
      expect(result.passed).toBe(false);
      expect(result.incompleteTasks).toEqual([tasksPath]);
      expect(result.repairObjective).toContain(tasksPath);
      expect(result.repairObjective).not.toContain("未完成自动化实现");
      expect(result.repairDoneWhen).toEqual([tasksPath]);
      expect(result.metadata).toEqual(expect.objectContaining({
        incompleteTaskCount: 1
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("ignores explicit human/manual gate tasks", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-completion-gate-"));
    try {
      const repoPath = join(sandbox, "repo");
      await writeOpenSpecTasks(repoPath, "demo-change", [
        "# Tasks",
        "",
        "- [ ] 1. manual: 等待用户确认",
        "- [ ] 2. 需要人工确认 OpenSpec 制品",
        "- [ ] 3. User Review Gate"
      ].join("\n"));
      const plugin = new DefaultOpenSpecCompletionGatePlugin();
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        workspace: createWorkspace(sandbox, repoPath),
        execution: createExecutionResult(),
        repairGoal: null
      });

      expect(result.passed).toBe(true);
      expect(result.incompleteTasks).toEqual([]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("inherits manual exemption from parent checkbox tasks", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-completion-gate-"));
    try {
      const repoPath = join(sandbox, "repo");
      await writeOpenSpecTasks(repoPath, "demo-change", [
        "# Tasks",
        "",
        "- [ ] 1. manual: 用户验收",
        "  - [ ] 1.1 打开页面确认文案",
        "  - [ ] 1.2 在终端粘贴验证结果",
        "- [x] 2. 自动化实现已完成"
      ].join("\n"));
      const plugin = new DefaultOpenSpecCompletionGatePlugin();
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        workspace: createWorkspace(sandbox, repoPath),
        execution: createExecutionResult(),
        repairGoal: null
      });

      expect(result.passed).toBe(true);
      expect(result.incompleteTasks).toEqual([]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("does not treat agent-run openspec validate as manual unless user-terminal or manual is present", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-completion-gate-"));
    try {
      const repoPath = join(sandbox, "repo");
      await writeOpenSpecTasks(repoPath, "demo-change", [
        "# Tasks",
        "",
        "- [ ] 1. 修复 openspec validate 失败"
      ].join("\n"));
      const plugin = new DefaultOpenSpecCompletionGatePlugin();
      const result = await plugin.evaluate({
        task: { ...createTask(repoPath), metadata: { openspecChangeId: "demo-change" } },
        workspace: createWorkspace(sandbox, repoPath),
        execution: createExecutionResult(),
        repairGoal: null
      });

      expect(result.passed).toBe(false);
      expect(result.incompleteTasks).toEqual([join(repoPath, "openspec", "changes", "demo-change", "tasks.md")]);
      expect(result.repairObjective).not.toContain("修复 openspec validate 失败");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("checks all active changes when no openspecChangeId is available", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-completion-gate-"));
    try {
      const repoPath = join(sandbox, "repo");
      await writeOpenSpecTasks(repoPath, "change-a", "- [x] done\n");
      await writeOpenSpecTasks(repoPath, "change-b", "- [ ] implement b\n");
      await writeOpenSpecTasks(repoPath, "change-c", "- [ ] manual: user accepts\n- [ ] implement c\n");
      const plugin = new DefaultOpenSpecCompletionGatePlugin();
      const result = await plugin.evaluate({
        task: createTask(repoPath),
        workspace: createWorkspace(sandbox, repoPath),
        execution: createExecutionResult(),
        repairGoal: null
      });

      expect(result.passed).toBe(false);
      expect(result.incompleteTasks).toEqual([
        join(repoPath, "openspec", "changes", "change-b", "tasks.md"),
        join(repoPath, "openspec", "changes", "change-c", "tasks.md")
      ]);
      expect(result.repairObjective).not.toContain("implement b");
      expect(result.repairObjective).not.toContain("implement c");
      expect(result.metadata).toEqual(expect.objectContaining({
        changeIds: ["change-a", "change-b", "change-c"],
        reason: "all-active-changes",
        incompleteTaskCount: 2
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("Execution plugins", () => {
  it("extracts session_id or thread_id from diverse Codex json stdout formats", () => {
    const stdoutWithThreadId = `
      some other output
      {"type":"thread.started","thread_id":"019ea674-2581-78d0-8caf-c4985717f9f3"}
    `;
    const stdoutWithSessionId = `
      {"session_id":"11111111-1111-4111-8111-111111111111"}
    `;
    const stdoutWithId = `
      {"id":"22222222-2222-4222-8222-222222222222"}
    `;

    expect(extractJsonSessionId(stdoutWithThreadId)).toBe("019ea674-2581-78d0-8caf-c4985717f9f3");
    expect(extractJsonSessionId(stdoutWithSessionId)).toBe("11111111-1111-4111-8111-111111111111");
    expect(extractJsonSessionId(stdoutWithId)).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("captures structured Codex execution results and supports resume", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-codex-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Implement"])
      });
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], args.includes("resume") ? "resumed summary" : "first summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const first = await plugin.execute(createTask(repoPath), workspace, null);
      const resumed = await plugin.continueSession?.(first.sessionId ?? "", createTask(repoPath), workspace, {
        id: "goal-1",
        taskId: "task-1",
        objective: "repair",
        constraints: [],
        doneWhen: ["pass build"],
        status: "repairing",
        currentIteration: 1,
        maxIterations: 3,
        lastFailureHash: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      expect(first.sessionId).toBe("codex:11111111-1111-4111-8111-111111111111");
      expect(first.errorCategory).toBe("none");
      expect(first.summary).toBe("first summary");
      expect(resumed?.summary).toBe("resumed summary");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reads workflow prompts from the workspace root and executes all workflow nodes", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-codex-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Plan", "Implement"])
      });
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
const node = prompt.includes("Implement") ? "implement" : "plan";
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], node + " summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workflowPath = join(sandbox, "WORKFLOW_PROMPTS.md");
      const workspace = createWorkspace(sandbox, repoPath, workflowPath);
      const result = await plugin.execute(createTask(repoPath), workspace, null);

      expect(result.exitCode).toBe(0);
      expect(result.summary).toContain("Plan: plan summary");
      expect(result.summary).toContain("Implement: implement summary");
      expect(result.metadata).toEqual(expect.objectContaining({
        workflowPromptsPath: workflowPath,
        workflowNodeNames: ["Plan", "Implement"]
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("scopes OpenSpec workflow nodes to programming agents", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-codex-programming-scope-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["PreflightAndSpec", "Implement", "VerifyAndReview", "Archive"])
      });
      const promptLog = join(sandbox, "prompts.txt");
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.appendFileSync(${JSON.stringify(promptLog)}, prompt + "\\n---\\n");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], prompt.split(" for ")[0] + " summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        agentKind: "programming",
        metadata: { workflowRole: "programming_from_spec" }
      };
      const result = await plugin.execute(task, workspace, null);

      expect(result.exitCode).toBe(0);
      expect(result.metadata).toEqual(expect.objectContaining({
        workflowNodeNames: ["PreflightAndSpec", "Implement"],
        skippedWorkflowNodeNames: ["VerifyAndReview", "Archive"]
      }));
      const prompts = await readFile(promptLog, "utf8");
      expect(prompts).toContain("PreflightAndSpec for demo");
      expect(prompts).toContain("Implement for demo");
      expect(prompts).not.toContain("VerifyAndReview for demo");
      expect(prompts).not.toContain("Archive for demo");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("scopes OpenSpec workflow nodes to quality agents and reads quality report metadata", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-codex-quality-scope-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["PreflightAndSpec", "Implement", "VerifyAndReview", "Archive"])
      });
      const promptLog = join(sandbox, "prompts.txt");
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.appendFileSync(${JSON.stringify(promptLog)}, prompt + "\\n---\\n");
if (outputIndex >= 0) {
  const outputPath = args[outputIndex + 1];
  fs.writeFileSync(outputPath, "quality summary");
  fs.writeFileSync(path.join(path.dirname(outputPath), "code-review-report.json"), JSON.stringify({
    schemaVersion: "diting.codeReviewReport.v1",
    passed: true,
    summary: "quality passed",
    findings: [],
    checks: [{ name: "code-review", status: "passed", summary: "ok" }]
  }));
}
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new QualityCodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        executor: "quality",
        agentKind: "quality",
        driverId: "quality-orchestrator"
      };
      const result = await plugin.execute(task, workspace, null);

      expect(result.exitCode).toBe(0);
      expect(result.metadata).toEqual(expect.objectContaining({
        workflowNodeNames: ["VerifyAndReview"],
        skippedWorkflowNodeNames: ["PreflightAndSpec", "Implement", "Archive"],
        nodeExecutions: [
          expect.objectContaining({ node: "VerifyAndReview", iteration: 1, loopCount: 1 })
        ],
        reviewArtifactId: join(workspace.artifactsPath, "code-review-report.json"),
        codeReviewReport: expect.objectContaining({
          passed: true,
          summary: "quality passed"
        })
      }));
      const prompts = await readFile(promptLog, "utf8");
      expect(prompts).toContain("VerifyAndReview for demo");
      expect(prompts).not.toContain("PreflightAndSpec for demo");
      expect(prompts).not.toContain("Implement for demo");
      expect(prompts).not.toContain("Archive for demo");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("appends target services guidance to custom workflow prompts", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-codex-services-guidance-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Implement"])
      });
      const promptPath = join(sandbox, "captured-prompt.txt");
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.writeFileSync(${JSON.stringify(promptPath)}, prompt);
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "done");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const repoBPath = join(sandbox, "repo-b");
      await mkdir(repoBPath, { recursive: true });
      const workspace = {
        ...createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md")),
        repos: [
          {
            key: "RepoA",
            url: "https://example.com/repo-a.git",
            path: repoPath,
            cachePath: join(sandbox, ".cache-a")
          },
          {
            key: "RepoB",
            url: "https://example.com/repo-b.git",
            path: repoBPath,
            cachePath: join(sandbox, ".cache-b")
          }
        ]
      };
      const result = await plugin.execute(createTask(repoPath), workspace, null);

      expect(result.exitCode).toBe(0);
      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Target service startup configuration");
      expect(prompt).toContain(".diting/services.yaml");
      expect(prompt).toContain("inspect each repository's `.diting/services.yaml`");
      expect(prompt).toContain("repoKey: RepoA");
      expect(prompt).toContain("repoKey: RepoB");
      expect(prompt).toContain("healthUrl");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("writes product OpenSpec validation and review artifacts", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-codex-"));
    try {
      const repoPath = join(sandbox, "repo");
      const changePath = join(sandbox, "openspec", "changes", "add-demo");
      await mkdir(repoPath, { recursive: true });
      await mkdir(join(changePath, "specs", "demo"), { recursive: true });
      await writeFile(join(changePath, "proposal.md"), "# Proposal\n");
      await writeFile(join(changePath, "design.md"), "# Design\n");
      await writeFile(join(changePath, "tasks.md"), "- [x] Draft\n");
      await writeFile(join(changePath, "workflow-state.md"), [
        "# Workflow State",
        "",
        "- [x] phase-1-brainstorming",
        "- [ ] phase-2-openspec-artifacts",
        "- [ ] phase-2.4-user-confirmation",
        "- [ ] phase-3-implementation",
        ""
      ].join("\n"));
      await writeFile(join(changePath, "specs", "demo", "spec.md"), [
        "## ADDED Requirements",
        "",
        "### Requirement: Demo",
        "",
        "#### Scenario: Ready",
        "- **WHEN** product review is ready",
        "- **THEN** validation artifact exists",
        ""
      ].join("\n"));
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Plan"])
      });
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "product summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new ProductCodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      };

      const result = await plugin.execute(task, workspace, null);

      expect(result.exitCode).toBe(0);
      expect(result.metadata).toEqual(expect.objectContaining({
        openspecChangeId: "add-demo",
        productReview: expect.objectContaining({
          reviewPackagePath: join(sandbox, "artifacts", "product-review.md")
        }),
        openspecValidation: expect.objectContaining({ passed: true })
      }));
      const validation = JSON.parse(await readFile(join(sandbox, "artifacts", "openspec-validation.json"), "utf8"));
      expect(validation).toEqual(expect.objectContaining({
        changeId: "add-demo",
        passed: true,
        mode: "internal"
      }));
      await expect(readFile(join(sandbox, "artifacts", "product-review.md"), "utf8")).resolves.toContain("OpenSpec change add-demo is ready for review");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("selects the newest active OpenSpec change when multiple change directories exist", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-codex-multi-"));
    try {
      const repoPath = join(sandbox, "repo");
      const olderChange = join(sandbox, "openspec", "changes", "add-failure-repair-orchestration");
      const newerChange = join(sandbox, "openspec", "changes", "add-task-diagnostics-recovery-assistant");
      const archiveChange = join(sandbox, "openspec", "changes", "archive");
      const oldAt = new Date("2026-06-13T00:00:00.000Z");
      const newAt = new Date("2026-06-13T00:10:00.000Z");
      const archiveAt = new Date("2026-06-13T00:20:00.000Z");

      await mkdir(repoPath, { recursive: true });
      for (const changePath of [olderChange, newerChange, archiveChange]) {
        await mkdir(join(changePath, "specs", "demo"), { recursive: true });
        await writeFile(join(changePath, "proposal.md"), "# Proposal\n");
        await writeFile(join(changePath, "design.md"), "# Design\n");
        await writeFile(join(changePath, "tasks.md"), "- [x] Draft\n");
        await writeFile(join(changePath, "workflow-state.md"), [
          "# Workflow State",
          "",
          "- [x] phase-1-brainstorming",
          "- [ ] phase-2-openspec-artifacts",
          "- [ ] phase-2.4-user-confirmation",
          "- [ ] phase-3-implementation",
          ""
        ].join("\n"));
        await writeFile(join(changePath, "specs", "demo", "spec.md"), [
          "## ADDED Requirements",
          "",
          "### Requirement: Demo",
          "",
          "#### Scenario: Ready",
          "- **WHEN** product review is ready",
          "- **THEN** validation artifact exists",
          ""
        ].join("\n"));
      }
      await utimes(olderChange, oldAt, oldAt);
      await utimes(newerChange, newAt, newAt);
      await utimes(archiveChange, archiveAt, archiveAt);
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Plan"])
      });
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "product summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new ProductCodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      };

      const result = await plugin.execute(task, workspace, null);

      expect(result.metadata).toEqual(expect.objectContaining({
        openspecChangeId: "add-task-diagnostics-recovery-assistant",
        openspecValidation: expect.objectContaining({
          changeId: "add-task-diagnostics-recovery-assistant",
          passed: true
        })
      }));
      const validation = JSON.parse(await readFile(join(sandbox, "artifacts", "openspec-validation.json"), "utf8"));
      expect(validation).toEqual(expect.objectContaining({
        changeId: "add-task-diagnostics-recovery-assistant",
        passed: true
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("fails product OpenSpec validation when workflow-state enters implementation phases", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-state-"));
    try {
      const repoPath = join(sandbox, "repo");
      const changePath = join(sandbox, "openspec", "changes", "add-demo");
      await mkdir(repoPath, { recursive: true });
      await mkdir(join(changePath, "specs", "demo"), { recursive: true });
      await writeFile(join(changePath, "proposal.md"), "# Proposal\n");
      await writeFile(join(changePath, "design.md"), "# Design\n");
      await writeFile(join(changePath, "tasks.md"), "- [x] Draft\n");
      await writeFile(join(changePath, "workflow-state.md"), [
        "# Workflow State",
        "",
        "- [x] phase-1-brainstorming",
        "- [x] phase-2-openspec-artifacts",
        "- [x] phase-3-implementation",
        ""
      ].join("\n"));
      await writeFile(join(changePath, "specs", "demo", "spec.md"), [
        "## ADDED Requirements",
        "",
        "### Requirement: Demo",
        "",
        "#### Scenario: Ready",
        "- **WHEN** product review is ready",
        "- **THEN** validation artifact exists",
        ""
      ].join("\n"));
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Plan"])
      });
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "product summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new ProductCodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      };

      const result = await plugin.execute(task, workspace, null);

      expect(result.metadata?.openspecValidation).toEqual(expect.objectContaining({
        passed: false,
        errors: expect.arrayContaining([expect.stringContaining("phase-3-implementation")])
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("instructs product Codex to stop after product stage one", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-prompt-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: [
          "## Agents 默认执行流程",
          "",
          "- `Plan`",
          "",
          "## 节点 Prompt 模板",
          "",
          "### Plan",
          "",
          "```text",
          "{{taskPrompt}}",
          "```",
          "",
          "- `loopEnabled: false`",
          "- `maxLoops: 1`",
          ""
        ].join("\n")
      });
      const promptLog = join(sandbox, "prompt.txt");
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.writeFileSync(${JSON.stringify(promptLog)}, prompt);
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "product summary");
console.log(JSON.stringify({ session_id: "11111111-1111-4111-8111-111111111111" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new ProductCodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      };

      await plugin.execute(task, workspace, null);

      const prompt = await readFile(promptLog, "utf8");
      expect(prompt).toContain("openspec-superpowers-workflow");
      expect(prompt).toContain("phase-1-brainstorming");
      expect(prompt).toContain("workflow-state.md");
      expect(prompt).toContain("Complete only product stage 1");
      expect(prompt).toContain("Do not enter product stage 2");
      expect(prompt).not.toContain("Target service startup configuration");
      expect(prompt).not.toContain(".diting/services.yaml");
      expect(prompt).not.toContain("phase-2-openspec-artifacts");
      expect(prompt).toContain("Do not modify application source code");
      expect(prompt).toContain("Feishu comments");
      expect(prompt).toContain("【回复】");
      expect(prompt).toContain("Do not create or update OpenSpec artifacts before the first human reply");
      expect(prompt).toContain("Do not mark phase-1-brainstorming or phase-1-report complete before the first human reply");
      expect(prompt).toContain("Do not call `meegle comment add` for review-ready output");
      expect(prompt).toContain("Diting will create the OpenSpec review child task after this executor exits successfully");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("runs only the first workflow node for product Codex tasks", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-product-single-stage-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["PreflightAndSpec", "Implement", "VerifyAndReview"])
      });
      const promptLog = join(sandbox, "prompts.jsonl");
      const bin = join(sandbox, "fake-codex");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.appendFileSync(${JSON.stringify(promptLog)}, JSON.stringify({ prompt }) + "\\n");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "product summary");
console.log(JSON.stringify({ session_id: "33333333-3333-4333-8333-333333333333" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new ProductCodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task: TitingTask = {
        ...createTask(repoPath),
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      };

      const result = await plugin.execute(task, workspace, null);

      const promptLines = (await readFile(promptLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as { prompt: string });
      expect(result.metadata?.workflowNodeNames).toEqual(["PreflightAndSpec"]);
      expect(promptLines).toHaveLength(1);
      expect(promptLines[0]?.prompt).toContain("PreflightAndSpec for");
      expect(promptLines[0]?.prompt).not.toContain("Implement for");
      expect(promptLines[0]?.prompt).not.toContain("VerifyAndReview for");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("falls back to the default Superpowers workflow when WORKFLOW_PROMPTS is omitted", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-codex-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      const bin = join(sandbox, "fake-codex");
      const promptLog = join(sandbox, "prompt.txt");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.writeFileSync(${JSON.stringify(promptLog)}, prompt);
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "default workflow summary");
console.log(JSON.stringify({ session_id: "22222222-2222-4222-8222-222222222222" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath);
      const result = await plugin.execute(createTask(repoPath), workspace, null);

      expect(result.exitCode).toBe(0);
      expect(result.summary).toBe("default workflow summary");
      expect(result.metadata).toEqual(expect.objectContaining({
        workflowStage: "execute",
        workflowPromptsPath: "<default-superpowers-workflow>",
        workflowNodeNames: ["SuperpowersPlanAndImplement"]
      }));
      await expect(readFile(promptLog, "utf8")).resolves.toContain("Superpowers");
      await expect(readFile(promptLog, "utf8")).resolves.toContain("test-driven-development");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("uses repair-only prompts for child repair issue recovery", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-codex-repair-only-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Implement"])
      });
      const bin = join(sandbox, "fake-codex");
      const promptLog = join(sandbox, "prompt.txt");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = args.at(-1) || "";
fs.writeFileSync(${JSON.stringify(promptLog)}, prompt);
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "repair-only summary");
console.log(JSON.stringify({ session_id: "33333333-3333-4333-8333-333333333333" }));
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CodexExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const task = {
        ...createTask(repoPath),
        instruction: "FULL PARENT REQUIREMENT",
        acceptanceCriteria: ["FULL CRITERIA"],
        metadata: {
          humanLoop: {
            executionMode: "repair_only",
            childIssue: {
              solution: "修复 npm test failed"
            }
          }
        }
      };
      await plugin.execute(task, workspace, {
        id: "goal-repair-only",
        taskId: task.id,
        objective: "Only fix npm test",
        constraints: ["Human guidance: 修复 npm test failed"],
        doneWhen: ["npm test passes"],
        status: "repairing",
        currentIteration: 1,
        maxIterations: 3,
        lastFailureHash: "hash-1",
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const prompt = await readFile(promptLog, "utf8");
      expect(prompt).toContain("不要重新实现完整需求");
      expect(prompt).toContain("Only fix npm test");
      expect(prompt).toContain("npm test passes");
      expect(prompt).not.toContain("FULL PARENT REQUIREMENT");
      expect(prompt).not.toContain("FULL CRITERIA");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("creates and reuses Cursor chat sessions", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-cursor-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Implement"])
      });
      const bin = join(sandbox, "fake-cursor");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "create-chat") {
  console.log("chat-123");
  process.exit(0);
}
if (args[0] === "agent") {
  console.log(JSON.stringify({ text: args.includes("--resume") ? "cursor resumed" : "cursor fresh" }));
  process.exit(0);
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CursorExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const runtimeEvents: Array<{ type: string }> = [];
      const first = await plugin.execute(createTask(repoPath), workspace, null, {
        runtimeLogger: async (event) => {
          runtimeEvents.push({ type: event.type });
        }
      });
      const resumed = await plugin.continueSession?.(first.sessionId ?? "", createTask(repoPath), workspace, {
        id: "goal-1",
        taskId: "task-1",
        objective: "repair",
        constraints: [],
        doneWhen: ["pass build"],
        status: "repairing",
        currentIteration: 1,
        maxIterations: 3,
        lastFailureHash: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const runtimeLog = await readFile(join(workspace.artifactsPath, "executor-runtime.jsonl"), "utf8");

      expect(first.sessionId).toBe("cursor:chat-123");
      expect(first.summary).toBe("cursor resumed");
      expect(first.metadata).toEqual(expect.objectContaining({
        runtimeLogPath: join(workspace.artifactsPath, "executor-runtime.jsonl")
      }));
      expect(resumed?.summary).toBe("cursor resumed");
      expect(runtimeEvents.map((item) => item.type)).toEqual(expect.arrayContaining([
        "session_create_start",
        "command_start",
        "spawn",
        "close",
        "result"
      ]));
      expect(runtimeLog).toContain("\"event\":\"create_chat_start\"");
      expect(runtimeLog).toContain("\"event\":\"spawn\"");
      expect(runtimeLog).toContain("\"event\":\"close\"");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("applies workflow node loops within a single Cursor execution", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-cursor-"));
    try {
      const repoPath = join(sandbox, "repo");
      await mkdir(repoPath, { recursive: true });
      await writeWorkflowPrompts(sandbox, {
        root: true,
        content: buildWorkflowPrompts(["Implement"], {
          Implement: { loopEnabled: true, maxLoops: 2 }
        })
      });
      const bin = join(sandbox, "fake-cursor");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "create-chat") {
  console.log("chat-123");
  process.exit(0);
}
if (args[0] === "agent") {
  console.log(JSON.stringify({ text: "cursor resumed" }));
  process.exit(0);
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);

      const plugin = new CursorExecutionPlugin(bin, 60_000);
      await mkdir(join(sandbox, "artifacts"), { recursive: true });
      const workspace = createWorkspace(sandbox, repoPath, join(sandbox, "WORKFLOW_PROMPTS.md"));
      const result = await plugin.execute(createTask(repoPath), workspace, null);
      const runtimeLog = await readFile(join(workspace.artifactsPath, "executor-runtime.jsonl"), "utf8");

      expect(result.exitCode).toBe(0);
      expect(result.metadata).toEqual(expect.objectContaining({
        runtimeLogPath: join(workspace.artifactsPath, "executor-runtime.jsonl"),
        workflowNodeNames: ["Implement"],
        nodeExecutions: [
          expect.objectContaining({ node: "Implement", iteration: 1, loopCount: 2 }),
          expect.objectContaining({ node: "Implement", iteration: 2, loopCount: 2 })
        ]
      }));
      expect(runtimeLog).toContain("\"event\":\"result\"");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("DefaultObservabilityGovernancePlugin", () => {
  it("blocks commands that violate configured policy before execution", async () => {
    const plugin = new DefaultObservabilityGovernancePlugin();
    await plugin.init({
      id: "cfg-gov",
      pluginId: plugin.id,
      kind: "observability-governance",
      enabled: true,
      priority: 100,
      config: {
        allowCommandPrefixes: ["codex"],
        blockCommandPatterns: ["git\\s+push"],
        maxPromptChars: 20
      },
      updatedAt: new Date("2026-05-11T00:00:00.000Z")
    });

    await expect(plugin.beforeCommand?.(["bash", "-lc", "git push origin main"])).rejects.toThrow(
      /allowlist|blocked policy|maxPromptChars/i
    );
    expect(plugin.getRecords?.()[0]).toEqual(expect.objectContaining({
      phase: "before_command",
      outcome: "blocked"
    }));
  });

  it("sanitizes command output, records governance metadata, and flags risky eval results", async () => {
    const plugin = new DefaultObservabilityGovernancePlugin();
    await plugin.init({
      id: "cfg-gov",
      pluginId: plugin.id,
      kind: "observability-governance",
      enabled: true,
      priority: 100,
      config: {
        maxOutputChars: 40,
        maxFilesChanged: 2,
        maxDiffLines: 5
      },
      updatedAt: new Date("2026-05-11T00:00:00.000Z")
    });

    const execution = {
      exitCode: 0,
      stdout: "token sk-12345678901234567890 and more output that should definitely be truncated by governance",
      stderr: "",
      summary: "authorization: bearer demo",
      sessionId: "codex:s1",
      timedOut: false,
      errorCategory: "none" as const,
      timeoutCategory: "none" as const,
      metadata: {}
    };
    await plugin.afterCommand?.(["codex", "exec", "do work"], execution);

    expect(execution.stdout).toContain("[redacted");
    expect(execution.stdout).toContain("[truncated-output]");
    expect((execution.metadata as Record<string, unknown>).governance).toEqual([
      expect.objectContaining({
        phase: "after_command",
        outcome: "flagged"
      })
    ]);

    const evalResult = {
      id: "eval-1",
      taskId: "task-1",
      executionId: "exec-1",
      passed: true,
      score: 100,
      riskLevel: "low" as const,
      report: {
        diff: {
          filesChanged: 3,
          insertions: 4,
          deletions: 3
        },
        note: "api_key=secret-value"
      },
      createdAt: new Date("2026-05-11T00:00:00.000Z")
    };
    await plugin.afterEval?.(evalResult);

    expect(evalResult.passed).toBe(true);
    expect(evalResult.riskLevel).toBe("high");
    expect(evalResult.report.note).toBe("api_key=[redacted-secret]");
    expect((evalResult.report as Record<string, unknown>).governance).toEqual([
      expect.objectContaining({
        phase: "after_eval",
        outcome: "flagged",
        findings: expect.arrayContaining([
          "filesChanged 3 exceeded limit 2",
          "changedLines 7 exceeded limit 5"
        ])
      })
    ]);
  });
});

describe("RootLogsPlugin", () => {
  it("writes task, trace, and executor logs into the root logs directory", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-logs-"));
    const previousCwd = process.cwd();
    try {
      process.chdir(sandbox);
      const plugin = new RootLogsPlugin();
      await plugin.init();

      await plugin.append({
        id: "log-1",
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
        level: "info",
        channel: "execution_log",
        eventType: "executor.completed",
        message: "Execution completed",
        taskId: "task-1",
        traceId: "trace-1",
        executionId: "execution-1",
        data: {
          correlation: { traceId: "trace-1" },
          stdout: "hello stdout",
          stderr: "hello stderr",
          summary: "hello summary"
        }
      });

      const taskLog = await readFile(join(sandbox, "logs", "tasks", "task-1", "task.log"), "utf8");
      const traceLog = await readFile(join(sandbox, "logs", "traces", "trace-1", "trace.log"), "utf8");
      const executionLog = await readFile(join(sandbox, "logs", "tasks", "task-1", "execution-execution-1.log"), "utf8");

      expect(taskLog).toContain("\"eventType\":\"executor.completed\"");
      expect(traceLog).toContain("\"traceId\":\"trace-1\"");
      expect(executionLog).toContain("\"executionId\":\"execution-1\"");
    } finally {
      process.chdir(previousCwd);
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("FileExecutionLogRepository", () => {
  it("mirrors runtime stdout, stderr, and summary events into executor raw logs", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-runtime-log-"));
    const previousCwd = process.cwd();
    try {
      process.chdir(sandbox);
      const plugin = new RootLogsPlugin();
      await plugin.init();
      const repo = new FileExecutionLogRepository(plugin);

      await repo.append({
        id: "runtime-stdout-1",
        taskId: "task-1",
        executionId: "execution-1",
        eventType: "execution.runtime.stdout",
        message: "Executor stdout chunk received",
        data: {
          correlation: { traceId: "trace-1" },
          runtimeEvent: {
            type: "stdout",
            chunk: "hello from stdout\n"
          }
        },
        createdAt: new Date("2026-05-11T00:00:00.000Z")
      });
      await repo.append({
        id: "runtime-stderr-1",
        taskId: "task-1",
        executionId: "execution-1",
        eventType: "execution.runtime.stderr",
        message: "Executor stderr chunk received",
        data: {
          correlation: { traceId: "trace-1" },
          runtimeEvent: {
            type: "stderr",
            chunk: "warning on stderr\n"
          }
        },
        createdAt: new Date("2026-05-11T00:00:01.000Z")
      });
      await repo.append({
        id: "runtime-result-1",
        taskId: "task-1",
        executionId: "execution-1",
        eventType: "execution.runtime.result",
        message: "Executor command finished",
        data: {
          correlation: { traceId: "trace-1" },
          runtimeEvent: {
            type: "result",
            summary: "final runtime summary"
          }
        },
        createdAt: new Date("2026-05-11T00:00:02.000Z")
      });

      const stdoutLog = await readFile(join(sandbox, "logs", "tasks", "task-1", "executor", "execution-1-stdout.log"), "utf8");
      const stderrLog = await readFile(join(sandbox, "logs", "tasks", "task-1", "executor", "execution-1-stderr.log"), "utf8");
      const summaryLog = await readFile(join(sandbox, "logs", "tasks", "task-1", "executor", "execution-1-summary.log"), "utf8");

      expect(stdoutLog).toContain("hello from stdout");
      expect(stderrLog).toContain("warning on stderr");
      expect(summaryLog).toContain("final runtime summary");
    } finally {
      process.chdir(previousCwd);
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("MeegleTaskIntegrationPlugin", () => {
  it("parses OpenSpec review replies only with exact gate prefixes", () => {
    expect(parseOpenSpecReviewReply("【评审通过】同意进入开发")).toEqual({
      ready: true,
      decision: "approved",
      body: "同意进入开发"
    });
    expect(parseOpenSpecReviewReply("【需要修改】补充异常场景")).toEqual({
      ready: true,
      decision: "changes_requested",
      body: "补充异常场景"
    });
    expect(parseOpenSpecReviewReply("【废弃】暂不开发")).toEqual({
      ready: true,
      decision: "dismissed",
      body: "暂不开发"
    });
    expect(parseOpenSpecReviewReply(" 【评审通过】前面有空格")).toEqual({
      ready: false,
      decision: "pending",
      body: " 【评审通过】前面有空格"
    });
  });

  it("preserves role members from Meegle work item detail rows", () => {
    const roleMembers = [
      {
        key: "role_1a1824",
        name: "板子R",
        members: [
          {
            email: "yangdong2@guanghe.tv",
            key: "7174579541036351516",
            name: "杨冬"
          }
        ]
      }
    ];
    const detail = extractTaskDetailPayload({
      data: {
        work_item_attribute: {
          work_item_id: "MEEGLE-LS-BOARD-R",
          work_item_name: "Board R task",
          owned_project: { key: "PROJ" },
          role_members: roleMembers
        },
        work_item_fields: [
          { key: "description", value: "Repo: https://example.com/board-r.git\\nBranch: main\\n---\\nBoard R work" }
        ]
      }
    });

    expect(detail.role_members).toBe(roleMembers);
    expect(mergeMeegleTaskRecords({ id: "MEEGLE-LS-BOARD-R" }, detail).role_members).toBe(roleMembers);
  });

  it("pulls tasks from a configured JSON file and reports results to an output file", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-"));
    try {
      const tasksFile = join(sandbox, "tasks.json");
      const resultsFile = join(sandbox, "results.json");
      await writeFile(tasksFile, JSON.stringify({
        tasks: [
          {
            id: "MEEGLE-1",
            title: "Fix build",
            instruction: "Run build and fix errors",
            repo: "https://example.com/repo.git",
            branch: "main",
            executor: "codex",
            acceptanceCriteria: ["Build passes"]
          }
        ]
      }, null, 2));

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            mode: "polling",
            tasksFile,
            resultsFile,
            webhookSecret: null
          }
        }
      });

      const pulled = await plugin.pullTasks();
      expect(pulled).toHaveLength(1);
      expect(pulled[0]).toEqual(expect.objectContaining({
        source: "meegle",
        externalId: "MEEGLE-1",
        title: "Fix build"
      }));

      await plugin.reportResult(pulled[0], "Completed successfully");
      const results = JSON.parse(await readFile(resultsFile, "utf8")) as Array<Record<string, unknown>>;
      expect(results[0]).toEqual(expect.objectContaining({
        externalId: "MEEGLE-1",
        summary: "Completed successfully"
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("routes local spec archives missing openspec to the product agent before execution", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-invalid-spec-route-"));
    try {
      const archiveSource = join(sandbox, "archive-source");
      await mkdir(archiveSource, { recursive: true });
      await writeFile(join(archiveSource, "WORKFLOW_PROMPTS.md"), buildWorkflowPrompts(["Plan"]));
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "WORKFLOW_PROMPTS.md"], { cwd: archiveSource });
      const tasksFile = join(sandbox, "tasks.json");
      await writeFile(tasksFile, JSON.stringify({
        tasks: [{
          id: "MEEGLE-INVALID-SPEC",
          title: "Generate missing OpenSpec",
          instruction: "Draft product spec",
          repo: "https://example.com/repo.git",
          branch: "main",
          metadata: {
            specDocumentPaths: [archivePath]
          }
        }]
      }, null, 2));

      const baseConfig = createConfig(sandbox);
      const plugin = new MeegleTaskIntegrationPlugin({
        ...baseConfig,
        plugins: {
          ...baseConfig.plugins,
          meegle: {
            ...baseConfig.plugins.meegle,
            mode: "polling",
            tasksFile,
            resultsFile: null,
            webhookSecret: null
          }
        }
      });

      const pulled = await plugin.pullTasks();

      expect(pulled).toHaveLength(1);
      expect(pulled[0]).toEqual(expect.objectContaining({
        executor: "product",
        agentKind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      }));
      expect(pulled[0].metadata).toEqual(expect.objectContaining({
        workflowRole: "product_spec",
        openspecSourceState: "none",
        specPackageInspection: expect.objectContaining({
          state: "missing_openspec"
        }),
        agentRequest: expect.objectContaining({
          agentKind: "product",
          preferredDriver: "openspec-product"
        })
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("routes local spec archives containing openspec directly to programming", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-valid-spec-route-"));
    try {
      const archiveSource = join(sandbox, "archive-source");
      await mkdir(join(archiveSource, "openspec"), { recursive: true });
      await writeFile(join(archiveSource, "openspec", "config.yaml"), "project: demo\n");
      const archivePath = join(sandbox, "spec-bundle.zip");
      await execFileAsync("zip", ["-r", archivePath, "openspec"], { cwd: archiveSource });
      const tasksFile = join(sandbox, "tasks.json");
      await writeFile(tasksFile, JSON.stringify({
        tasks: [{
          id: "MEEGLE-VALID-SPEC",
          title: "Implement from OpenSpec",
          instruction: "Use approved spec",
          repo: "https://example.com/repo.git",
          branch: "main",
          metadata: {
            specDocumentPaths: [archivePath]
          }
        }]
      }, null, 2));

      const baseConfig = createConfig(sandbox);
      const plugin = new MeegleTaskIntegrationPlugin({
        ...baseConfig,
        plugins: {
          ...baseConfig.plugins,
          meegle: {
            ...baseConfig.plugins.meegle,
            mode: "polling",
            tasksFile,
            resultsFile: null,
            webhookSecret: null
          }
        }
      });

      const pulled = await plugin.pullTasks();

      expect(pulled).toHaveLength(1);
      expect(pulled[0]).toEqual(expect.objectContaining({
        executor: "programming",
        agentKind: "programming",
        driverId: "coding"
      }));
      expect(pulled[0].metadata).toEqual(expect.objectContaining({
        workflowRole: "programming_from_spec",
        openspecSourceState: "provided",
        specPackageInspection: expect.objectContaining({
          state: "valid"
        })
      }));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("uses the legacy Meegle task CLI flow when available", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      process.env.MEEGLE_TEST_LEGACY = "1";
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });

      const pulled = await plugin.pullTasks();
      expect(pulled).toEqual([
        expect.objectContaining({
          source: "meegle",
          externalId: "MEEGLE-LEGACY-1",
          repo: "https://example.com/legacy.git",
          branch: "main",
          instruction: "Legacy fix",
          priority: "high"
        })
      ]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("falls back to workitem CLI queries and reports results back to Meegle comments", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            queryMql: "SELECT * FROM backlog",
            detailFields: ["repo", "branch", "instruction", "priority"]
          }
        }
      });

      const pulled = await plugin.pullTasks();
      expect(pulled).toEqual([
        expect.objectContaining({
          externalId: "MEEGLE-MQL-1",
          title: "Query task",
          repo: "https://example.com/query.git",
          branch: "feature/query",
          instruction: "Implement query flow",
          priority: "high"
        })
      ]);

      await plugin.reportResult({ ...pulled[0], status: "succeeded" }, "Completed successfully");
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      expect(logLines).toContainEqual(expect.arrayContaining(["comment", "add", "--work-item-id", "MEEGLE-MQL-1"]));
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("passes the configured auth profile to Meegle workitem and comment commands", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            authProfile: "ci-profile",
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            queryMql: "SELECT * FROM backlog",
            detailFields: ["repo", "branch", "instruction", "priority"]
          }
        }
      });

      const pulled = await plugin.pullTasks();
      await plugin.reportResult({ ...pulled[0], status: "succeeded" }, "Completed successfully");

      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      expect(logLines.filter((args) => args[0] === "workitem" || args[0] === "comment")).toEqual(
        expect.arrayContaining([
          expect.arrayContaining(["workitem", "query", "--profile", "ci-profile"]),
          expect.arrayContaining(["workitem", "get", "--profile", "ci-profile"]),
          expect.arrayContaining(["comment", "add", "--profile", "ci-profile"])
        ])
      );
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reports needs_human comments and reads human replies from Meegle comments", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });

      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-human-1",
        source: "meegle",
        externalId: "MEEGLE-MQL-1",
        traceId: "trace-human-1",
        metadata: {
          humanLoop: {
            requestId: "request-1",
            requestedAt: "2026-05-11T00:00:00.000Z",
            seenReplyIds: []
          }
        }
      };

      await plugin.reportNeedsHuman?.(task, {
        reason: "High-risk modification detected",
        stopReason: "high_risk",
        summary: "The diff touches too many files",
        requestId: "request-1",
        requestedAt: "2026-05-11T00:00:00.000Z"
      });
      const replies = await plugin.pullHumanReplies?.([task]);
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);

      expect(logLines).toContainEqual(expect.arrayContaining(["comment", "add", "--work-item-id", "MEEGLE-MQL-1"]));
      expect(logLines).toContainEqual(expect.arrayContaining(["comment", "list", "--work-item-id", "MEEGLE-MQL-1"]));
      expect(replies).toEqual([
        expect.objectContaining({
          taskId: "task-human-1",
          externalId: "MEEGLE-MQL-1",
          replyId: "comment-user-1",
          body: "Please retry with the latest requirements",
          author: "alice"
        })
      ]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reads only tagged reply comments for product agent tasks", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-product-reply-"));
    try {
      const bin = join(sandbox, "fake-meegle");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "comment" && args[1] === "list") {
  console.log(JSON.stringify({
    comments: [
      {
        id: "comment-question",
        content: "请补充边界场景",
        author: "agent",
        createdAt: "2026-05-11T00:01:00.000Z"
      },
      {
        id: "comment-untagged",
        content: "普通讨论不应触发恢复",
        author: "bob",
        createdAt: "2026-05-11T00:02:00.000Z"
      },
      {
        id: "comment-reply-1",
        content: "【回复】需要覆盖会员过期后的召回上限",
        author: "alice",
        createdAt: "2026-05-11T00:03:00.000Z"
      }
    ]
  }));
  process.exit(0);
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);
      const config = createConfig(sandbox);
      const plugin = new MeegleTaskIntegrationPlugin({
        ...config,
        plugins: {
          ...config.plugins,
          meegle: {
            ...config.plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/product.git"),
        id: "task-product-reply",
        source: "meegle",
        externalId: "MEEGLE-PRODUCT-REPLY",
        agentKind: "product" as const,
        driverId: "openspec-product",
        metadata: {
          humanLoop: {
            requestId: "request-product",
            requestedAt: "2026-05-11T00:00:00.000Z",
            seenReplyIds: []
          }
        }
      };

      const replies = await plugin.pullHumanReplies?.([task]);

      expect(replies).toEqual([
        expect.objectContaining({
          taskId: "task-product-reply",
          replyId: "comment-reply-1",
          body: "需要覆盖会员过期后的召回上限",
          author: "alice"
        })
      ]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("creates and reads child repair issues through the Meegle CLI", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "titing-meegle-child-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            nodeName: "开发中",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-child-cli-1",
        source: "meegle",
        externalId: "MEEGLE-MQL-1",
        traceId: "trace-child-cli-1",
        metadata: {
          humanLoop: {
            childIssue: {
              externalId: "CHILD-1",
              failureHash: "failure-hash"
            }
          }
        }
      };

      const child = await plugin.openHumanRepairIssue?.(task, {
        requestId: "request-child-1",
        idempotencyKey: "diting-child-repair:abc",
        failureHash: JSON.stringify({
          errorCategory: "command_failed",
          timeoutCategory: "none",
          summary: "Execution failed",
          failedChecks: ["acceptance-criteria", "diff-risk", "executor-exit-code"]
        }),
        failureSummary: "Execution failed",
        failedChecks: ["executor-exit-code", "diff-risk", "acceptance-criteria"],
        executionId: "execution-1",
        evalResultId: "eval-1",
        stopReason: null,
        requestedAt: "2026-06-09T00:00:00.000Z"
      });
      const replies = await plugin.pullHumanRepairIssues?.([task]);
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      const createArgs = logLines.find((line) => line[0] === "subtask" && line[1] === "update");
      const fieldValues = (createArgs ?? [])
        .flatMap((arg, index, args) => arg === "--fields" && args[index + 1] ? [args[index + 1]] : [])
        .map((value) => JSON.parse(value) as { field_key?: string; field_value?: string });
      const descriptionField = fieldValues.find((field) => field.field_key === "field_child_desc");

      expect(child).toEqual(expect.objectContaining({
        externalId: "CHILD-1",
        idempotencyKey: "diting-child-repair:abc",
        reused: false
      }));
      expect(replies).toEqual([
        expect.objectContaining({
          taskId: "task-child-cli-1",
          parentExternalId: "MEEGLE-MQL-1",
          childExternalId: "CHILD-1",
          ready: true,
          body: "修复 npm test failed"
        })
      ]);
      expect(logLines).toContainEqual(expect.arrayContaining(["workflow", "get-node", "--work-item-id", "MEEGLE-MQL-1"]));
      expect(logLines).toContainEqual(expect.arrayContaining(["subtask", "update", "--action", "create", "--work-item-id", "MEEGLE-MQL-1"]));
      expect(logLines).toContainEqual(expect.arrayContaining(["workitem", "get", "--work-item-id", "CHILD-1"]));
      expect(createArgs).toBeDefined();
      expect(fieldValues).toContainEqual(expect.objectContaining({
        field_key: "name",
        field_value: expect.stringContaining("【diting修复方案】")
      }));
      expect(descriptionField).toEqual(expect.objectContaining({
        field_key: "field_child_desc",
        field_value: expect.stringContaining('failure={"errorCategory":"command_failed"')
      }));
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("creates and reads OpenSpec review child issues through the Meegle CLI", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-openspec-review-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            nodeName: "开发中",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-openspec-review-cli-1",
        source: "meegle",
        externalId: "MEEGLE-MQL-1",
        traceId: "trace-openspec-review-cli-1",
        metadata: {}
      };

      const openspecPath = join(sandbox, "openspec", "changes", "add-demo");
      const child = await plugin.openOpenSpecReviewIssue?.(task, {
        requestId: "request-openspec-review-1",
        idempotencyKey: "diting-openspec-review:abc",
        changeId: "add-demo",
        revision: "rev-1",
        workspaceId: sandbox,
        openspecPath,
        summary: "OpenSpec ready for review",
        requestedAt: "2026-06-13T00:00:00.000Z"
      });
      const replies = await plugin.pullOpenSpecReviewIssues?.([{
        ...task,
        metadata: {
          openSpecReview: {
            externalId: child?.externalId,
            requestedAt: "2026-06-13T00:00:00.000Z",
            seenReplyIds: []
          }
        }
      }]);
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);

      expect(child).toEqual(expect.objectContaining({
        externalId: "REVIEW-1",
        idempotencyKey: "diting-openspec-review:abc",
        reused: false
      }));
      expect(replies).toEqual([
        expect.objectContaining({
          taskId: "task-openspec-review-cli-1",
          parentExternalId: "MEEGLE-MQL-1",
          reviewExternalId: "REVIEW-1",
          ready: true,
          decision: "approved",
          body: "同意进入开发"
        })
      ]);
      expect(logLines).toContainEqual(expect.arrayContaining(["workflow", "get-node", "--work-item-id", "MEEGLE-MQL-1"]));
      expect(logLines).toContainEqual(expect.arrayContaining(["subtask", "update", "--action", "create", "--work-item-id", "MEEGLE-MQL-1"]));
      expect(logLines.find((args) => args[0] === "subtask" && args[1] === "update")?.join(" ")).toContain(openspecPath);
      expect(logLines).toContainEqual(expect.arrayContaining(["workitem", "get", "--work-item-id", "REVIEW-1"]));
      expect(logLines).not.toContainEqual(expect.arrayContaining(["comment", "add", "--work-item-id", "MEEGLE-MQL-1"]));
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reads OpenSpec review child ids from work_item_attribute in Meegle create responses", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-openspec-create-attribute-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFile(bin, [
        "#!/usr/bin/env node",
        "const fs = require('fs');",
        "const args = process.argv.slice(2);",
        "const logPath = process.env.MEEGLE_TEST_LOG;",
        "if (logPath) fs.appendFileSync(logPath, JSON.stringify(args) + '\\n');",
        "const print = (value) => process.stdout.write(JSON.stringify(value));",
        "if (args[0] === 'project' && args[1] === 'search') { print({ items: [{ key: 'PROJ' }] }); process.exit(0); }",
        "if (args[0] === 'workflow' && args[1] === 'get-node') { print({ data: { list: [{ basic: { name: '开发中', node_key: 'NODE-DEV-1' }, sub_tasks: [] }] } }); process.exit(0); }",
        "if (args[0] === 'subtask' && args[1] === 'update') { print({ data: { work_item_attribute: { work_item_id: 'REVIEW-ATTRIBUTE', work_item_name: 'OpenSpec review idempotency=diting-openspec-review:attribute', updated_at: '2026-06-13T00:05:00.000Z', owned_project: { key: 'PROJ' } } } }); process.exit(0); }",
        "if (args[0] === 'workitem' && args[1] === 'get') {",
        "  const taskId = args[args.indexOf('--work-item-id') + 1];",
        "  if (taskId === 'REVIEW-ATTRIBUTE') {",
        "    print({ data: { work_item_attribute: { work_item_id: taskId, work_item_name: 'OpenSpec review idempotency=diting-openspec-review:attribute', updated_at: '2026-06-13T00:05:00.000Z', owned_project: { key: 'PROJ' } }, work_item_fields: [{ key: 'field_child_desc', name: '子任务描述', value: '【评审通过】同意进入开发' }] } });",
        "    process.exit(0);",
        "  }",
        "}",
        "process.exit(1);"
      ].join("\n"));
      await execFileAsync("chmod", ["+x", bin]);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            nodeName: "开发中",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-openspec-review-attribute",
        source: "meegle",
        externalId: "MEEGLE-MQL-ATTRIBUTE",
        traceId: "trace-openspec-review-attribute",
        metadata: {}
      };

      const child = await plugin.openOpenSpecReviewIssue?.(task, {
        requestId: "request-openspec-review-attribute",
        idempotencyKey: "diting-openspec-review:attribute",
        changeId: "add-demo",
        revision: "rev-1",
        workspaceId: sandbox,
        summary: "OpenSpec ready for review",
        requestedAt: "2026-06-13T00:00:00.000Z"
      });
      expect(child).toEqual(expect.objectContaining({
        externalId: "REVIEW-ATTRIBUTE",
        reused: false
      }));
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reads OpenSpec review child ids from nested Meegle create responses", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-openspec-create-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const logPath = process.env.MEEGLE_TEST_LOG;
if (logPath) {
  fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");
}
const print = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === "project" && args[1] === "search") {
  print({ items: [{ key: "PROJ" }] });
  process.exit(0);
}
if (args[0] === "workflow" && args[1] === "get-node") {
  print({
    data: {
      list: [
        {
          basic: {
            name: "开发中",
            node_key: "NODE-DEV-1"
          },
          sub_tasks: []
        }
      ]
    }
  });
  process.exit(0);
}
if (args[0] === "subtask" && args[1] === "update") {
  print({
    data: {
      work_item_attribute: {
        work_item_id: "REVIEW-NESTED",
        work_item_name: "OpenSpec review idempotency=diting-openspec-review:nested",
        updated_at: "2026-06-13T00:05:00.000Z",
        owned_project: { key: "PROJ" }
      },
      work_item: {
        work_item_id: "REVIEW-NESTED"
      }
    }
  });
  process.exit(0);
}
if (args[0] === "workitem" && args[1] === "get") {
  const taskId = args[args.indexOf("--work-item-id") + 1];
  if (taskId === "REVIEW-NESTED") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "OpenSpec review idempotency=diting-openspec-review:nested",
          updated_at: "2026-06-13T00:05:00.000Z",
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          {
            key: "field_child_desc",
            name: "子任务描述",
            value: "【评审通过】同意进入开发"
          }
        ]
      }
    });
    process.exit(0);
  }
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            nodeName: "开发中",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-openspec-review-cli-nested",
        source: "meegle",
        externalId: "MEEGLE-MQL-NESTED",
        traceId: "trace-openspec-review-cli-nested",
        metadata: {}
      };

      const child = await plugin.openOpenSpecReviewIssue?.(task, {
        requestId: "request-openspec-review-nested",
        idempotencyKey: "diting-openspec-review:nested",
        changeId: "add-demo",
        revision: "rev-1",
        workspaceId: sandbox,
        summary: "OpenSpec ready for review",
        requestedAt: "2026-06-13T00:00:00.000Z"
      });
      const replies = await plugin.pullOpenSpecReviewIssues?.([{
        ...task,
        metadata: {
          openSpecReview: {
            externalId: child?.externalId,
            requestedAt: "2026-06-13T00:00:00.000Z",
            seenReplyIds: []
          }
        }
      }]);
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);

      expect(child).toEqual(expect.objectContaining({
        externalId: "REVIEW-NESTED",
        reused: false
      }));
      expect(replies).toEqual([
        expect.objectContaining({
          taskId: "task-openspec-review-cli-nested",
          parentExternalId: "MEEGLE-MQL-NESTED",
          reviewExternalId: "REVIEW-NESTED",
          ready: true,
          decision: "approved"
        })
      ]);
      expect(logLines).toContainEqual(expect.arrayContaining(["subtask", "update", "--action", "create", "--work-item-id", "MEEGLE-MQL-NESTED"]));
      expect(logLines).toContainEqual(expect.arrayContaining(["workitem", "get", "--work-item-id", "REVIEW-NESTED"]));
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("reads OpenSpec review replies when Meegle details use update_time", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-openspec-update-time-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    try {
      const bin = join(sandbox, "fake-meegle");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
const print = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === "workitem" && args[1] === "get") {
  const taskId = args[args.indexOf("--work-item-id") + 1];
  if (taskId === "REVIEW-UPDATE-TIME") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "OpenSpec review",
          update_time: "2026-06-13T00:05:00.000Z",
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          {
            key: "field_child_desc",
            name: "子任务描述",
            value: "【评审通过】"
          }
        ]
      }
    });
    process.exit(0);
  }
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);
      delete process.env.MEEGLE_TEST_LEGACY;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-openspec-review-update-time",
        source: "meegle",
        externalId: "MEEGLE-MQL-UPDATE-TIME",
        traceId: "trace-openspec-review-update-time",
        metadata: {
          openSpecReview: {
            externalId: "REVIEW-UPDATE-TIME",
            requestedAt: "2026-06-13T00:00:00.000Z",
            seenReplyIds: []
          }
        }
      };

      const replies = await plugin.pullOpenSpecReviewIssues?.([task]);

      expect(replies).toEqual([
        expect.objectContaining({
          taskId: "task-openspec-review-update-time",
          parentExternalId: "MEEGLE-MQL-UPDATE-TIME",
          reviewExternalId: "REVIEW-UPDATE-TIME",
          ready: true,
          decision: "approved",
          updatedAt: "2026-06-13T00:05:00.000Z"
        })
      ]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("retries workflow polling when a created OpenSpec review child appears late", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-openspec-poll-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    const previousState = process.env.MEEGLE_TEST_STATE_PATH;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      const statePath = join(sandbox, "cli-state.json");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const logPath = process.env.MEEGLE_TEST_LOG;
const statePath = process.env.MEEGLE_TEST_STATE_PATH;
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { workflowCalls: 0 };
  }
};
const writeState = (state) => {
  if (statePath) {
    fs.writeFileSync(statePath, JSON.stringify(state));
  }
};
if (logPath) {
  fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");
}
const print = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === "project" && args[1] === "search") {
  print({ items: [{ key: "PROJ" }] });
  process.exit(0);
}
if (args[0] === "workflow" && args[1] === "get-node") {
  const state = readState();
  state.workflowCalls += 1;
  writeState(state);
  print({
    data: {
      list: [
        {
          basic: {
            name: "开发中",
            node_key: "NODE-DEV-1"
          },
          sub_tasks: state.workflowCalls < 2
            ? []
            : [
                {
                  sub_task_id: "REVIEW-POLLED",
                  name: "OpenSpec review idempotency=diting-openspec-review:poll",
                  url: "https://project.feishu.cn/child/REVIEW-POLLED",
                  updated_at: "2026-06-13T00:05:00.000Z"
                }
              ]
        }
      ]
    }
  });
  process.exit(0);
}
if (args[0] === "subtask" && args[1] === "update") {
  print({ data: { ok: true } });
  process.exit(0);
}
if (args[0] === "workitem" && args[1] === "get") {
  const taskId = args[args.indexOf("--work-item-id") + 1];
  if (taskId === "REVIEW-POLLED") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "OpenSpec review idempotency=diting-openspec-review:poll",
          updated_at: "2026-06-13T00:05:00.000Z",
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          {
            key: "field_child_desc",
            name: "子任务描述",
            value: "【评审通过】同意进入开发"
          }
        ]
      }
    });
    process.exit(0);
  }
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;
      process.env.MEEGLE_TEST_STATE_PATH = statePath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            nodeName: "开发中",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-openspec-review-cli-poll",
        source: "meegle",
        externalId: "MEEGLE-MQL-POLL",
        traceId: "trace-openspec-review-cli-poll",
        metadata: {}
      };
      const request = {
        requestId: "request-openspec-review-poll",
        idempotencyKey: "diting-openspec-review:poll",
        changeId: "add-demo",
        revision: "rev-1",
        workspaceId: sandbox,
        summary: "OpenSpec ready for review",
        requestedAt: "2026-06-13T00:00:00.000Z"
      };

      const child = await plugin.openOpenSpecReviewIssue?.(task, request);
      const reused = await plugin.openOpenSpecReviewIssue?.(task, request);
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);

      expect(child).toEqual(expect.objectContaining({
        externalId: "REVIEW-POLLED",
        reused: false
      }));
      expect(reused).toEqual(expect.objectContaining({
        externalId: "REVIEW-POLLED",
        reused: true
      }));
      expect(logLines.filter((line) => line[0] === "workflow" && line[1] === "get-node").length).toBeGreaterThan(1);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      process.env.MEEGLE_TEST_STATE_PATH = previousState;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("does not bind an OpenSpec review to an older child when create output lacks the requested idempotency key", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-openspec-stale-create-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    const previousState = process.env.MEEGLE_TEST_STATE_PATH;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      const statePath = join(sandbox, "cli-state.json");
      await writeFile(
        bin,
        `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const logPath = process.env.MEEGLE_TEST_LOG;
const statePath = process.env.MEEGLE_TEST_STATE_PATH;
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { workflowCalls: 0 };
  }
};
const writeState = (state) => {
  if (statePath) {
    fs.writeFileSync(statePath, JSON.stringify(state));
  }
};
if (logPath) {
  fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");
}
const print = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === "project" && args[1] === "search") {
  print({ items: [{ key: "PROJ" }] });
  process.exit(0);
}
if (args[0] === "workflow" && args[1] === "get-node") {
  const state = readState();
  state.workflowCalls += 1;
  writeState(state);
  print({
    data: {
      list: [
        {
          basic: { name: "开发中", node_key: "NODE-DEV-1" },
          sub_tasks: state.workflowCalls < 3
            ? [
                {
                  sub_task_id: "REVIEW-OLD",
                  name: "OpenSpec review idempotency=diting-openspec-review:abc:attempt-1",
                  url: "https://project.feishu.cn/child/REVIEW-OLD",
                  updated_at: "2026-06-13T00:05:00.000Z"
                }
              ]
            : [
                {
                  sub_task_id: "REVIEW-OLD",
                  name: "OpenSpec review idempotency=diting-openspec-review:abc:attempt-1",
                  url: "https://project.feishu.cn/child/REVIEW-OLD",
                  updated_at: "2026-06-13T00:05:00.000Z"
                },
                {
                  sub_task_id: "REVIEW-NEW",
                  name: "OpenSpec review idempotency=diting-openspec-review:abc:attempt-2",
                  url: "https://project.feishu.cn/child/REVIEW-NEW",
                  updated_at: "2026-06-13T00:10:00.000Z"
                }
              ]
        }
      ]
    }
  });
  process.exit(0);
}
if (args[0] === "subtask" && args[1] === "update") {
  print({
    data: {
      work_item_attribute: {
        work_item_id: "REVIEW-OLD",
        work_item_name: "OpenSpec review idempotency=diting-openspec-review:abc:attempt-1",
        updated_at: "2026-06-13T00:05:00.000Z",
        owned_project: { key: "PROJ" }
      }
    }
  });
  process.exit(0);
}
if (args[0] === "workitem" && args[1] === "get") {
  const taskId = args[args.indexOf("--work-item-id") + 1];
  const attempt = taskId === "REVIEW-NEW" ? "attempt-2" : "attempt-1";
  print({
    data: {
      work_item_attribute: {
        work_item_id: taskId,
        work_item_name: "OpenSpec review idempotency=diting-openspec-review:abc:" + attempt,
        updated_at: "2026-06-13T00:10:00.000Z",
        owned_project: { key: "PROJ" }
      },
      work_item_fields: [
        {
          key: "field_child_desc",
          name: "子任务描述",
          value: "diting:openspec-review=diting-openspec-review:abc:" + attempt
        }
      ]
    }
  });
  process.exit(0);
}
process.exit(1);
`
      );
      await execFileAsync("chmod", ["+x", bin]);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;
      process.env.MEEGLE_TEST_STATE_PATH = statePath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            nodeName: "开发中",
            childTaskDescriptionFieldKey: "field_child_desc",
            queryMql: "SELECT * FROM backlog"
          }
        }
      });
      const task = {
        ...createTask("https://example.com/query.git"),
        id: "task-openspec-review-stale-create",
        source: "meegle",
        externalId: "MEEGLE-MQL-STALE-CREATE",
        traceId: "trace-openspec-review-stale-create",
        metadata: {}
      };

      const child = await plugin.openOpenSpecReviewIssue?.(task, {
        requestId: "request-openspec-review-stale-create",
        idempotencyKey: "diting-openspec-review:abc:attempt-2",
        changeId: "add-demo",
        revision: "rev-1",
        workspaceId: sandbox,
        summary: "OpenSpec ready for review",
        requestedAt: "2026-06-13T00:00:00.000Z"
      });

      expect(child).toEqual(expect.objectContaining({
        externalId: "REVIEW-NEW",
        idempotencyKey: "diting-openspec-review:abc:attempt-2",
        reused: false
      }));
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      process.env.MEEGLE_TEST_STATE_PATH = previousState;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("uses latest sprint CLI detail fallback from description blocks", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            sourceMode: "latest_sprint",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            projectScopeName: "scope",
            sprintTypeName: "Sprint",
            demandTypeName: "Demand",
            sprintLinkField: "规划迭代",
            nodeName: "开发",
            latestSprintDetailFields: ["description"]
          }
        }
      });

      const pulled = await plugin.pullTasks();
      expect(pulled).toContainEqual(
        expect.objectContaining({
          externalId: "MEEGLE-LS-1",
          repo: "https://example.com/latest.git",
          branch: "release/1.2",
          instruction: "Finish latest sprint work",
          metadata: expect.objectContaining({
            latestSprint: expect.objectContaining({
              id: "321"
            })
          })
        })
      );
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("filters latest sprint tasks by board role in MQL", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            sourceMode: "latest_sprint",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            projectScopeName: "scope",
            sprintTypeName: "Sprint",
            demandTypeName: "Demand",
            sprintLinkField: "规划迭代",
            boardValue: "R",
            latestSprintDetailFields: ["description"]
          }
        }
      });

      const pulled = await plugin.pullTasks();
      const logLines = (await readFile(logPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]);
      const demandMql = logLines
        .map((args) => args[args.indexOf("--mql") + 1])
        .find((mql): mql is string => typeof mql === "string" && mql.includes("any_relation_match"));
      expect(demandMql).toContain("any_match(`__板子R`, x -> x in ('R'))");
      expect(pulled).toEqual([
        expect.objectContaining({
          externalId: "MEEGLE-LS-BOARD-R"
        })
      ]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("returns no latest sprint tasks when board filter does not match", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            sourceMode: "latest_sprint",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            projectScopeName: "scope",
            sprintTypeName: "Sprint",
            demandTypeName: "Demand",
            sprintLinkField: "规划迭代",
            boardValue: "NOBODY",
            latestSprintDetailFields: ["description"]
          }
        }
      });

      await expect(plugin.pullTasks()).resolves.toEqual([]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("filters latest sprint tasks by board role member email after detail fetch", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            sourceMode: "latest_sprint",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            projectScopeName: "scope",
            sprintTypeName: "Sprint",
            demandTypeName: "Demand",
            sprintLinkField: "规划迭代",
            boardValue: "R",
            boardUserEmail: "yangdong2@guanghe.tv",
            latestSprintDetailFields: ["description"]
          }
        }
      });

      const pulled = await plugin.pullTasks();
      const logLines = (await readFile(logPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]);
      const demandMql = logLines
        .map((args) => args[args.indexOf("--mql") + 1])
        .find((mql): mql is string => typeof mql === "string" && mql.includes("any_relation_match"));

      expect(demandMql).not.toContain("__板子R");
      expect(pulled).toEqual([
        expect.objectContaining({
          externalId: "MEEGLE-LS-BOARD-R"
        })
      ]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("returns no latest sprint tasks when board role member email does not match", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-cli-"));
    const previousLegacy = process.env.MEEGLE_TEST_LEGACY;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      delete process.env.MEEGLE_TEST_LEGACY;
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            sourceMode: "latest_sprint",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null,
            projectKey: "PROJ",
            projectScopeName: "scope",
            sprintTypeName: "Sprint",
            demandTypeName: "Demand",
            sprintLinkField: "规划迭代",
            boardUserEmail: "nobody@example.com",
            latestSprintDetailFields: ["description"]
          }
        }
      });

      await expect(plugin.pullTasks()).resolves.toEqual([]);
    } finally {
      process.env.MEEGLE_TEST_LEGACY = previousLegacy;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("supports webhook mode health, secret verification, and webhook payload parsing", async () => {
    const plugin = new MeegleTaskIntegrationPlugin({
      ...createConfig("/tmp"),
      plugins: {
        ...createConfig("/tmp").plugins,
        meegle: {
          mode: "webhook",
          tasksFile: null,
          resultsFile: null,
          webhookSecret: "secret-1"
        }
      }
    });

    await expect(plugin.health()).resolves.toEqual({
      healthy: true,
      message: "Meegle webhook integration ready"
    });
    expect(plugin.verifyWebhookSecret("secret-1")).toBe(true);
    expect(plugin.verifyWebhookSecret("wrong")).toBe(false);
    expect(plugin.webhookHealth()).toEqual({
      mode: "webhook",
      healthy: true,
      authMode: "shared-secret",
      tasksFileConfigured: false,
      resultsFileConfigured: false,
      webhookSecretConfigured: true
    });
    await expect(plugin.parseWebhookTasks({
      task: {
        id: "MEEGLE-99",
        title: "Webhook issue",
        instruction: "Do webhook work",
        repo: "https://example.com/repo.git",
        branch: "main"
      }
    })).resolves.toEqual([
      expect.objectContaining({
        source: "meegle",
        externalId: "MEEGLE-99",
        title: "Webhook issue"
      })
    ]);
  });

  it("starts and polls Meegle browser authorization via the CLI device-code flow", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-meegle-auth-"));
    const previousAuthState = process.env.MEEGLE_TEST_AUTH_STATE;
    const previousLog = process.env.MEEGLE_TEST_LOG;
    try {
      const bin = join(sandbox, "fake-meegle");
      const logPath = join(sandbox, "cli-log.jsonl");
      await writeFakeMeegleCli(bin);
      process.env.MEEGLE_TEST_AUTH_STATE = "unauthenticated";
      process.env.MEEGLE_TEST_LOG = logPath;

      const plugin = new MeegleTaskIntegrationPlugin({
        ...createConfig(sandbox),
        plugins: {
          ...createConfig(sandbox).plugins,
          meegle: {
            ...createConfig(sandbox).plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null
          }
        }
      });

      await expect(plugin.getAuthStatus()).resolves.toEqual(expect.objectContaining({
        status: "unauthenticated",
        authenticated: false,
        message: "Meegle authorization required"
      }));

      const started = await plugin.startAuth();
      expect(started).toEqual(expect.objectContaining({
        status: "pending",
        authorizationUrl: "https://project.feishu.cn/auth/device",
        deviceCode: "device-123",
        clientId: "client-123",
        intervalSeconds: 2,
        expiresInSeconds: 600
      }));

      await expect(plugin.pollAuth({
        deviceCode: started.deviceCode,
        clientId: started.clientId,
        intervalSeconds: started.intervalSeconds,
        expiresInSeconds: started.expiresInSeconds
      })).resolves.toEqual(expect.objectContaining({
        status: "pending",
        authenticated: false
      }));

      process.env.MEEGLE_TEST_AUTH_STATE = "authenticated";
      await expect(plugin.pollAuth({
        deviceCode: started.deviceCode,
        clientId: started.clientId,
        intervalSeconds: started.intervalSeconds,
        expiresInSeconds: started.expiresInSeconds
      })).resolves.toEqual(expect.objectContaining({
        status: "authenticated",
        authenticated: true
      }));

      await plugin.logoutAuth();
      const logLines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      expect(logLines).toContainEqual(expect.arrayContaining(["auth", "login", "--device-code", "--phase", "init"]));
      expect(logLines).toContainEqual(expect.arrayContaining(["auth", "login", "--device-code", "--phase", "poll", "--once"]));
      expect(logLines).toContainEqual(["auth", "logout", "--format", "json"]);
    } finally {
      process.env.MEEGLE_TEST_AUTH_STATE = previousAuthState;
      process.env.MEEGLE_TEST_LOG = previousLog;
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

function isQualityOrchestratorAgent(plugin: { kind: string }): plugin is AgentPlugin {
  const candidate = plugin as Partial<AgentPlugin>;
  return plugin.kind === "agent"
    && candidate.agentKind === "quality"
    && candidate.driverId === "quality-orchestrator";
}

function createConfig(root: string): ServerConfig {
  return {
    port: 3000,
    scheduler: {
      intervalMs: 30_000,
      agentCount: 1,
      agentOfflineTimeoutMs: 300_000,
      agentWorkerPollIntervalMs: 1_000,
      agents: {
        programming: {
          count: 1,
          offlineTimeoutMs: 300_000,
          workerPollIntervalMs: 1_000
        },
        product: {
          count: 0,
          offlineTimeoutMs: 300_000,
          workerPollIntervalMs: 1_000
        },
        quality: {
          count: 1,
          offlineTimeoutMs: 300_000,
          workerPollIntervalMs: 1_000
        }
      }
    },
    workspace: {
      root: join(root, ".diting-workspaces"),
      repoCacheRoot: join(root, ".diting-repos"),
      cleanupOnSuccess: true,
      cleanupOnFailure: false,
      preflightDeep: false,
      specMaxBytes: 50 * 1024 * 1024,
      openspecInit: false,
      superpowersInstallCmd: null,
      toolingTimeoutMs: 60_000,
      prBaseBranchFallback: null
    },
    goalRecovery: {
      executionTimeoutMs: 60_000,
      executionIdleTimeoutMs: 60_000,
      qualityTimeoutMs: 60_000,
      environmentRetryLimit: 2,
      executionRetryLimit: 2,
      maxRepairIterations: 3,
      enableNeedsHumanLoop: false
    },
    plugins: {
      taskIntegration: {
        packageName: null
      },
      execution: {
        packageName: null,
        defaultExecutor: "programming",
        codexBin: "codex",
        cursorBin: "agent",
        commitMessageAgent: "heuristic"
      },
      agents: {
        packageName: null,
        defaultKind: "programming",
        defaultRuntime: "codex",
        product: {
          defaultDriver: "openspec-product",
          defaultRuntime: "codex"
        },
        quality: {
          defaultDriver: "quality-orchestrator",
          defaultRuntime: "codex"
        },
        codexBin: "codex",
        cursorBin: "agent",
        commitMessageAgent: "heuristic"
      },
      environment: {
        packageName: null
      },
      completionGate: {
        packageName: null
      },
      quality: {
        packageName: null
      },
      observabilityGovernance: {
        packageName: null
      },
      log: {
        packageName: null
      },
      meegle: {
        mode: "polling",
        tasksFile: null,
        resultsFile: null,
        webhookSecret: null
      },
      gitlab: {
        cliBin: "glab",
        host: "gitlab.yc345.tv"
      }
    },
    openspecReview: {
      gateEnabled: true,
      prefixes: {
        approved: "【评审通过】",
        changesRequested: "【需要修改】",
        dismissed: "【废弃】"
      }
    },
    governance: {
      allowCommandPrefixes: [],
      blockCommandPatterns: [
        "\\bgit\\s+push\\b",
        "\\brm\\s+-rf\\s+/",
        "\\bterraform\\s+destroy\\b",
        "\\baws\\s+iam\\b",
        "\\bssh\\b",
        "\\bscp\\b"
      ],
      maxPromptChars: 16_000,
      maxOutputChars: 12_000,
      maxFilesChanged: 20,
      maxDiffLines: 400
    }
  };
}

function createTask(repo: string): TitingTask {
  const now = new Date("2026-05-11T00:00:00.000Z");
  return {
    id: "task-1",
    source: "manual",
    externalId: null,
    title: "demo",
    instruction: "do work",
    repo,
    branch: "main",
    priority: "medium",
    status: "active",
    executor: "codex",
    traceId: "trace-1",
    constraints: [],
    acceptanceCriteria: [],
    metadata: {},
    retryCount: 0,
    repairCount: 0,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function createExecutionResult() {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    summary: "ok",
    sessionId: "session-1",
    timedOut: false,
    errorCategory: "none" as const,
    timeoutCategory: "none" as const,
    metadata: {}
  };
}

async function writeOpenSpecTasks(repoPath: string, changeId: string, content: string): Promise<void> {
  const changePath = join(repoPath, "openspec", "changes", changeId);
  await mkdir(changePath, { recursive: true });
  await writeFile(join(changePath, "tasks.md"), content);
}

async function writeAutomationReports(
  repoPath: string,
  changeId: string,
  input: { apiScore: number; uiGateStatus: "passed" | "failed" | "blocked" }
): Promise<void> {
  const apiReportPath = join(repoPath, "tmp", "api-test-reports", changeId);
  await mkdir(apiReportPath, { recursive: true });
  await writeFile(
    join(apiReportPath, "metrics.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        featureId: changeId,
        weightedScore: input.apiScore,
        grade: input.apiScore >= 80 ? "B（良好）" : "D（待优化）",
        metrics: {
          casePassRate: { displayValue: input.apiScore >= 80 ? "100.00%" : "80.00%", level: input.apiScore >= 80 ? "优秀" : "待优化" },
          timeoutRate: { displayValue: "0.00%", level: "优秀" },
          agentExecutionSuccessRate: { displayValue: input.apiScore >= 80 ? "100.00%" : "80.00%", level: input.apiScore >= 80 ? "优秀" : "待优化" }
        },
        missingInputs: []
      },
      null,
      2
    )
  );
  await writeFile(join(apiReportPath, "summary.md"), `# API 自动化测试报告 - ${changeId}\n\n- 综合得分: ${input.apiScore}\n`);

  await writeFile(
    join(repoPath, "uiAutomationMetrics.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        summary: {
          executedCases: 2,
          passCount: input.uiGateStatus === "passed" ? 2 : 1,
          failCount: input.uiGateStatus === "passed" ? 0 : 1,
          blockedCount: input.uiGateStatus === "blocked" ? 1 : 0
        },
        p0: {
          executed: 2,
          passed: input.uiGateStatus === "passed" ? 2 : 1,
          passRate: input.uiGateStatus === "passed" ? 1 : 0.5
        },
        executable: { rate: 1 },
        stability: { flakyRate: 0 },
        experience: { usabilityScore: 0.95, operabilityScore: 0.96 },
        warnings: [],
        gate: {
          status: input.uiGateStatus,
          completed: input.uiGateStatus === "passed",
          reason: input.uiGateStatus === "passed" ? "2/2 P0 UI 自动化用例通过，0 FAIL，0 BLOCKED。" : "1/2 P0 UI 自动化用例通过。"
        }
      },
      null,
      2
    )
  );
  await writeFile(
    join(repoPath, "testExecutionResult.md"),
    input.uiGateStatus === "passed" ? "已完成\n2/2 P0 UI 自动化用例通过。\n" : "未完成\n1/2 P0 UI 自动化用例通过。\n"
  );
}

async function writeWorkflowPrompts(
  repoPath: string,
  input: { root: boolean; content: string }
): Promise<void> {
  const target = input.root
    ? join(repoPath, "WORKFLOW_PROMPTS.md")
    : join(repoPath, "knowledge", "WORKFLOW_PROMPTS.md");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, input.content);
}

async function writeRequiredSuperpowerSkills(workspacePath: string): Promise<void> {
  for (const skillId of REQUIRED_SUPERPOWERS_SKILL_IDS) {
    const skillPath = join(workspacePath, ".cursor", "skills", skillId, "SKILL.md");
    await mkdir(dirname(skillPath), { recursive: true });
    await writeFile(skillPath, `# ${skillId}\n`);
  }
}

async function writeGlobalSuperpowerSkills(homePath: string): Promise<void> {
  for (const skillId of REQUIRED_SUPERPOWERS_SKILL_IDS) {
    const skillPath = join(homePath, ".cursor", "plugins", "cache", "cursor-public", "superpowers", "skills", skillId, "SKILL.md");
    await mkdir(dirname(skillPath), { recursive: true });
    await writeFile(skillPath, `# ${skillId}\n`);
  }
}

async function writeFakeSuperpowersInstaller(path: string, logPath: string): Promise<void> {
  await writeFile(
    path,
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, "npx:" + args.join(" ") + "\\n");
const skills = ${JSON.stringify([
  "brainstorming",
  "writing-plans",
  "test-driven-development",
  "verification-before-completion"
])};
for (const skill of skills) {
  const target = path.join(process.env.HOME, ".cursor", "plugins", "cache", "cursor-public", "superpowers", "skills", skill);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "SKILL.md"), "# " + skill + "\\n");
}
process.exit(0);
`
  );
  await chmod(path, 0o755);
}

function buildWorkflowPrompts(
  nodeNames: string[],
  config: Record<string, { loopEnabled?: boolean; maxLoops?: number }> = {}
): string {
  const workflow = nodeNames.map((nodeName) => `- \`${nodeName}\``).join("\n");
  const sections = nodeNames.map((nodeName) => {
    const nodeConfig = config[nodeName] ?? {};
    return `### ${nodeName}

\`\`\`text
${nodeName} for {{taskTitle}}
\`\`\`

- \`loopEnabled: ${nodeConfig.loopEnabled ? "true" : "false"}\`
- \`maxLoops: ${nodeConfig.maxLoops ?? 1}\``;
  }).join("\n\n");
  return `## Agents 默认执行流程

${workflow}

## 节点 Prompt 模板

${sections}
`;
}

async function createGitRepo(
  path: string,
  files: Record<string, string>,
  defaultBranch = "main"
): Promise<void> {
  await mkdir(path, { recursive: true });
  await git(["init"], path);
  await git(["config", "user.email", "test@example.com"], path);
  await git(["config", "user.name", "Test User"], path);
  for (const [filePath, content] of Object.entries(files)) {
    await mkdir(dirname(join(path, filePath)), { recursive: true });
    await writeFile(join(path, filePath), content);
  }
  await git(["add", "."], path);
  await git(["commit", "-m", "init"], path);
  await git(["branch", "-M", defaultBranch], path);
}

async function writeFakeMeegleCli(path: string): Promise<void> {
  await writeFile(
    path,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const logPath = process.env.MEEGLE_TEST_LOG;
if (logPath) {
  fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");
}
const print = (value) => process.stdout.write(JSON.stringify(value));
const parseFieldArg = (value) => {
  if (value.startsWith("{")) {
    return JSON.parse(value);
  }
  if (value.startsWith('"')) {
    if (!value.endsWith('"')) {
      const column = value.length + 1;
      process.stderr.write(\`invalid argument "\${value}" for "--fields" flag: parse error on line 1, column \${column}: bare " in non-quoted-field\`);
      process.exit(1);
    }
    let decoded = "";
    for (let index = 1; index < value.length - 1; index += 1) {
      const char = value[index];
      if (char !== '"') {
        decoded += char;
        continue;
      }
      if (value[index + 1] !== '"') {
        const column = index + 1;
        process.stderr.write(\`invalid argument "\${value}" for "--fields" flag: parse error on line 1, column \${column}: bare " in non-quoted-field\`);
        process.exit(1);
      }
      decoded += '"';
      index += 1;
    }
    return decoded;
  }
  const quoteIndex = value.indexOf('"');
  if (quoteIndex >= 0) {
    const column = quoteIndex + 1;
    process.stderr.write(\`invalid argument "\${value}" for "--fields" flag: parse error on line 1, column \${column}: bare " in non-quoted-field\`);
    process.exit(1);
  }
  return value;
};
if (args[0] === "project" && args[1] === "search") {
  print({ items: [{ key: "PROJ" }] });
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "status") {
  if (process.env.MEEGLE_TEST_AUTH_STATE === "unauthenticated") {
    process.stderr.write("Meegle authorization required");
    process.exit(1);
  }
  print({ authenticated: true, host: "project.feishu.cn" });
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "login" && args.includes("--device-code") && args.includes("--phase") && args.includes("init")) {
  print({
    authorization_url: "https://project.feishu.cn/auth/device",
    device_code: "device-123",
    client_id: "client-123",
    interval: 2,
    expires_in: 600,
    user_code: "ABCD-EFGH"
  });
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "login" && args.includes("--device-code") && args.includes("--phase") && args.includes("poll")) {
  if (process.env.MEEGLE_TEST_AUTH_STATE === "authenticated") {
    print({ authenticated: true, host: "project.feishu.cn" });
    process.exit(0);
  }
  print({ status: "pending", authenticated: false });
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "logout") {
  print({ ok: true });
  process.exit(0);
}
if (args[0] === "attachment" && args[1] === "+download") {
  const output = args[args.indexOf("--output") + 1];
  if (!args.includes("--work-item-id")) {
    process.stderr.write('required flag(s) "work-item-id" not set');
    process.exit(1);
  }
  fs.writeFileSync(output, "downloaded spec");
  print({ ok: true, output });
  process.exit(0);
}
if (args[0] === "task" && args[1] === "list") {
  if (process.env.MEEGLE_TEST_LEGACY === "1") {
    print([{ id: "MEEGLE-LEGACY-1", title: "Legacy task" }]);
    process.exit(0);
  }
  process.stderr.write("unknown command");
  process.exit(1);
}
if (args[0] === "task" && args[1] === "get") {
  print({
    id: args[2],
    repo: "https://example.com/legacy.git",
    branch: "main",
    instruction: "Legacy fix",
    priority: "high"
  });
  process.exit(0);
}
if (args[0] === "workitem" && args[1] === "query") {
  const mql = args[args.indexOf("--mql") + 1] || "";
  if (mql.includes("FROM \`scope\`.\`Sprint\`")) {
    print({
      data: {
        data: {
          "1": [
            {
              moql_field_list: [
                { key: "work_item_id", name: "工作项id", value: { long_value: 321 } },
                { key: "name", name: "名称", value: { string_value: "Sprint 321" } }
              ]
            }
          ]
        },
        list: [{ count: 1 }]
      }
    });
    process.exit(0);
  }
  if (mql.includes("any_relation_match")) {
    if (mql.includes("__板子R") && mql.includes("'R'")) {
      print([{ "工作项id": "MEEGLE-LS-BOARD-R", "名称": "Board R task" }]);
      process.exit(0);
    }
    if (mql.includes("__板子R")) {
      print([]);
      process.exit(0);
    }
    print([
      { "工作项id": "MEEGLE-LS-1", "名称": "Latest sprint task" },
      { "工作项id": "MEEGLE-LS-BOARD-R", "名称": "Board R task" },
      { "工作项id": "MEEGLE-LS-BOARD-OTHER", "名称": "Board other task" }
    ]);
    process.exit(0);
  }
  print([{ work_item_id: "MEEGLE-MQL-1", name: "Query task" }]);
  process.exit(0);
}
if (args[0] === "workflow" && args[1] === "get-node") {
  const hasCreatedSubtask = Boolean(logPath && fs.existsSync(logPath) && fs.readFileSync(logPath, "utf8").includes('["subtask","update"'));
  print({
    data: {
      list: [
        {
          basic: {
            name: "开发中",
            node_key: "NODE-DEV-1",
            node_uuid: "node_waiting_for_android_development_TEST"
          },
          sub_tasks: hasCreatedSubtask
            ? [
                {
                  sub_task_id: "CHILD-1",
                  name: "Child repair idempotency=diting-child-repair:abc",
                  url: "https://project.feishu.cn/child/CHILD-1",
                  updated_at: "2026-06-09T00:00:00.000Z"
                },
                {
                  sub_task_id: "REVIEW-1",
                  name: "OpenSpec review idempotency=diting-openspec-review:abc",
                  url: "https://project.feishu.cn/child/REVIEW-1",
                  updated_at: "2026-06-13T00:05:00.000Z"
                }
              ]
            : []
        }
      ]
    }
  });
  process.exit(0);
}
if (args[0] === "subtask" && args[1] === "update") {
  let name = "Child repair";
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--fields" || !args[index + 1]) {
      continue;
    }
    const assignment = parseFieldArg(args[index + 1]);
    if (assignment && typeof assignment === "object" && assignment.field_key === "name") {
      name = assignment.field_value;
    } else if (typeof assignment === "string" && assignment.startsWith("name=")) {
      name = assignment.slice("name=".length);
    }
  }
  print({ data: { ok: true, name } });
  process.exit(0);
}
if (args[0] === "workitem" && args[1] === "get") {
  const taskId = args[args.indexOf("--work-item-id") + 1];
  if (taskId === "CHILD-1") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "Child repair idempotency=diting-child-repair:abc",
          updated_at: "2026-06-09T00:05:00.000Z",
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          {
            key: "field_child_desc",
            name: "子任务描述",
            value: "【开发中】修复 npm test failed"
          }
        ]
      }
    });
    process.exit(0);
  }
  if (taskId === "REVIEW-1") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "OpenSpec review idempotency=diting-openspec-review:abc",
          updated_at: "2026-06-13T00:05:00.000Z",
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          {
            key: "field_child_desc",
            name: "子任务描述",
            value: "【评审通过】同意进入开发"
          }
        ]
      }
    });
    process.exit(0);
  }
  if (taskId === "MEEGLE-MQL-1") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "Query task",
          work_item_status: { name: "P1" },
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          { key: "repo", value: "https://example.com/query.git" },
          { key: "branch", value: "feature/query" },
          { key: "instruction", value: "Implement query flow" }
        ]
      }
    });
    process.exit(0);
  }
  if (taskId === "MEEGLE-LS-1") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "Latest sprint task",
          work_item_status: { name: "P2" },
          owned_project: { key: "PROJ" }
        },
        work_item_fields: [
          { key: "description", value: "Repo: https://example.com/latest.git\\nBranch: release/1.2\\n---\\nFinish latest sprint work" }
        ]
      }
    });
    process.exit(0);
  }
  if (taskId === "MEEGLE-LS-BOARD-R") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "Board R task",
          owned_project: { key: "PROJ" },
          role_members: [
            {
              key: "role_1a1824",
              name: "板子R",
              members: [
                {
                  email: "yangdong2@guanghe.tv",
                  key: "7174579541036351516",
                  name: "杨冬"
                }
              ]
            }
          ]
        },
        work_item_fields: [
          { key: "field_board_r", value: { name: "R" } },
          { key: "description", value: "Repo: https://example.com/board-r.git\\nBranch: main\\n---\\nBoard R work" }
        ]
      }
    });
    process.exit(0);
  }
  if (taskId === "MEEGLE-LS-BOARD-OTHER") {
    print({
      data: {
        work_item_attribute: {
          work_item_id: taskId,
          work_item_name: "Board other task",
          owned_project: { key: "PROJ" },
          role_members: [
            {
              key: "role_1a1824",
              name: "板子R",
              members: [
                {
                  email: "other@example.com",
                  key: "other-user",
                  name: "Other"
                }
              ]
            }
          ]
        },
        work_item_fields: [
          { key: "field_board_r", value: { name: "OTHER" } }
        ]
      }
    });
    process.exit(0);
  }
}
if (args[0] === "comment" && args[1] === "add") {
  print({ ok: true });
  process.exit(0);
}
if (args[0] === "comment" && args[1] === "list") {
  print({
    comments: [
      {
        id: "comment-system-1",
        content: "[DITING_NEEDS_HUMAN requestId=id-1 taskId=task-1 traceId=trace-task-1]"
      },
      {
        id: "comment-user-1",
        content: "Please retry with the latest requirements",
        author: "alice",
        createdAt: "2026-05-11T00:10:00.000Z"
      }
    ]
  });
  process.exit(0);
}
process.exit(1);
`
  );
  await execFileAsync("chmod", ["+x", path]);
}

async function git(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function gitOutput(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

async function writeFakeGlab(path: string, logPath: string): Promise<void> {
  await writeFile(
    path,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, args.join(" ") + "\\n");
if (args[0] === "mr" && args[1] === "create") {
  process.stdout.write("https://gitlab.yc345.tv/group/demo/-/merge_requests/1\\n");
  process.exit(0);
}
process.stderr.write("unsupported glab command");
process.exit(1);
`
  );
  await chmod(path, 0o755);
}

async function writeFakeGitLabCli(path: string): Promise<void> {
  await writeFile(
    path,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "auth" && args[1] === "status") {
  if (process.env.GITLAB_TEST_AUTH_STATE === "authenticated") {
    process.stdout.write("Logged in to gitlab.yc345.tv as yan\\n");
    process.exit(0);
  }
  process.stderr.write("not logged in to gitlab.yc345.tv\\n");
  process.exit(1);
}
if (args[0] === "auth" && args[1] === "login" && args.includes("--device")) {
  process.stdout.write("Open https://gitlab.yc345.tv/oauth/device and enter code ABCD-EFGH\\n");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "logout") {
  process.stdout.write("Logged out\\n");
  process.exit(0);
}
process.stderr.write("unsupported glab command: " + args.join(" "));
process.exit(1);
`
  );
  await chmod(path, 0o755);
}

async function writeFakeCommitAgent(
  path: string,
  logPath: string,
  output: { subject: string; body: string }
): Promise<void> {
  await writeFile(
    path,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, args.join(" ") + "\\n");
process.stdout.write(JSON.stringify(${JSON.stringify(output)}) + "\\n");
`
  );
  await chmod(path, 0o755);
}

async function prepareEnvTask(sandbox: string, sourceRepo: string): Promise<TitingTask> {
  const specDir = join(sandbox, "spec-fixtures");
  await mkdir(specDir, { recursive: true });
  const workflowPath = join(specDir, "WORKFLOW_PROMPTS.md");
  await writeFile(workflowPath, buildWorkflowPrompts(["Plan"]));
  const repo = sourceRepo;
  return {
    ...createTask(repo),
    metadata: {
      preflight: {
        passed: true,
        checkedAt: new Date().toISOString(),
        checks: []
      },
      repos: [{ key: "Repo1", url: repo }],
      specAttachments: [{ name: "WORKFLOW_PROMPTS.md", localPath: workflowPath }]
    }
  };
}

function createWorkspace(root: string, repoPath: string, workflowPromptsPath?: string) {
  const workflowPath = workflowPromptsPath ?? join(root, "WORKFLOW_PROMPTS.md");
  return {
    workspacePath: root,
    repoPath,
    repos: [
      {
        key: "Repo1",
        url: "https://example.com/repo.git",
        path: repoPath,
        cachePath: join(root, ".cache")
      }
    ],
    branch: "main",
    cachePath: join(root, ".cache"),
    artifactsPath: join(root, "artifacts"),
    specRootPath: root,
    workflowPromptsPath: workflowPath,
    env: {}
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
