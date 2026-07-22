import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, appendFile, readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import {
  AgentKind,
  AgentRequest,
  EnvironmentRuntimeEvent,
  EvalResult,
  ExecutionResult,
  GovernanceRecord,
  NeedsHumanPayload,
  PreparedWorkspace,
  QualityResult,
  TitingTask
} from "@diting/plugin-api";

/**
 * Cross-cutting helpers for built-in plugins: subprocess/git/npm I/O, governance scans, quality heuristics,
 * executor log parsing, and Meegle CLI `--envelope` JSON normalization.
 */

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  summary: string;
  timedOut: boolean;
};

export type QualityScriptResult = {
  name: string;
  script: string;
  passed: boolean;
  detail: string;
  skipped: boolean;
  layer: "static" | "unit" | "startup";
};

export type QualityAutomationReportResult = {
  name: "api" | "ui";
  passed: boolean;
  detail: string;
  skipped: boolean;
  score?: number;
  status?: string;
  path?: string;
  raw?: unknown;
};

export type QualityLayerResult = {
  id: "static" | "unit" | "startup" | "automation-report";
  name: string;
  passed: boolean;
  checks: Array<QualityScriptResult | QualityAutomationReportResult>;
};

/**
 * Node.js reports missing binaries as exitCode 127 with platform-specific
 * ENOENT/not-found text. Keep this shared so CLI integrations fail consistently.
 */
export function isCliBinaryMissing(result: Pick<CommandResult, "exitCode" | "stderr" | "stdout">): boolean {
  if (result.exitCode !== 127) {
    return false;
  }
  const combined = `${result.stderr} ${result.stdout}`.toLowerCase();
  return combined.includes("enoent") || combined.includes("not found") || combined.includes("no such file");
}

export function buildCliNotFoundMessage(cliName: string, bin: string, envName: string): string {
  return (
    `${cliName} CLI not found (tried: "${bin}"). ` +
    `Please install the ${cliName} CLI and make sure it is on your PATH, ` +
    `or set ${envName} to its absolute path in .env.`
  );
}

export type CommandLifecycleEvent =
  | {
      type: "spawn";
      pid: number | undefined;
      command: string[];
      cwd: string;
      occurredAt: string;
    }
  | {
      type: "stdout" | "stderr";
      bytes: number;
      chunk: string;
      occurredAt: string;
    }
  | {
      type: "timeout" | "idle_timeout";
      signal: NodeJS.Signals;
      timeoutMs: number;
      occurredAt: string;
      reason?: "wall_clock" | "idle";
    }
  | {
      type: "error";
      error: string;
      occurredAt: string;
    }
  | {
      type: "close";
      exitCode: number | null;
      stdoutBytes: number;
      stderrBytes: number;
      timedOut: boolean;
      occurredAt: string;
    };

/** Limits applied by governance (command allow/block, prompt/output size, diff caps). */
export type GovernancePolicy = {
  allowCommandPrefixes: string[];
  blockCommandPatterns: string[];
  maxPromptChars: number;
  maxOutputChars: number;
  maxFilesChanged: number;
  maxDiffLines: number;
};

/** Redaction regexes mirrored in governance `redact()` / CLI output scrubbing; keep aligned with {@link scanSecrets}. */
export const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /sk-[A-Za-z0-9]{20,}/g, replacement: "[redacted-secret]" },
  { regex: /ghp_[A-Za-z0-9]{20,}/g, replacement: "[redacted-secret]" },
  { regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g, replacement: "[redacted-secret]" },
  { regex: /(api[_-]?key\s*[=:]\s*)([^\s]+)/gi, replacement: "$1[redacted-secret]" },
  { regex: /(authorization:\s*bearer\s+)([^\s]+)/gi, replacement: "$1[redacted-secret]" }
];

/** Thrown from {@link runCheckedCommand} stages; carries retry hint for transient network/git failures. */
export class EnvironmentPreparationError extends Error {
  constructor(
    readonly stage: string,
    message: string,
    readonly detail: string | null,
    readonly retryable: boolean
  ) {
    super(`${stage}: ${message}${detail ? ` (${detail})` : ""}`);
    this.name = "EnvironmentPreparationError";
  }
}

/**
 * Spawns `bin` under `cwd` with merged env in its own process group.
 * Terminates (`exitCode` 124, `timedOut`) on either the wall-clock `timeoutMs`
 * or, when `idleTimeoutMs` is provided, after that long with no stdout/stderr
 * output (catches hung subprocesses that stop producing output). On timeout the
 * whole process group is signalled SIGTERM and escalated to SIGKILL after a
 * grace period so orphaned grandchildren are reaped too.
 */
export function runCommand(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  envOverrides: Record<string, string> = {},
  onEvent?: (event: CommandLifecycleEvent) => void,
  idleTimeoutMs?: number
): Promise<CommandResult> {
  return new Promise((resolveResult) => {
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let idleTimer: NodeJS.Timeout | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    onEvent?.({
      type: "spawn",
      pid: child.pid,
      command: [bin, ...args],
      cwd,
      occurredAt: new Date().toISOString()
    });

    /** Signal the whole process group (negative pid); fall back to the direct child. */
    const killGroup = (signal: NodeJS.Signals) => {
      const pid = child.pid;
      if (typeof pid !== "number") {
        return;
      }
      try {
        process.kill(-pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          // process already gone
        }
      }
    };

    const triggerTimeout = (reason: "wall_clock" | "idle") => {
      if (settled) {
        return;
      }
      settled = true;
      timedOut = true;
      clearTimeout(timeout);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      onEvent?.({
        type: reason === "idle" ? "idle_timeout" : "timeout",
        signal: "SIGTERM",
        timeoutMs: reason === "idle" ? (idleTimeoutMs ?? 0) : timeoutMs,
        reason,
        occurredAt: new Date().toISOString()
      });
      killGroup("SIGTERM");
      // Escalate to SIGKILL so a process group ignoring SIGTERM is still reaped.
      killTimer = setTimeout(() => killGroup("SIGKILL"), 5_000);
      killTimer.unref();
      resolveResult({
        exitCode: 124,
        stdout,
        stderr,
        summary: reason === "idle" ? "Execution stalled (no output)" : "Execution timed out",
        timedOut: true
      });
    };

    const timeout = setTimeout(() => triggerTimeout("wall_clock"), timeoutMs);

    const resetIdle = () => {
      if (!idleTimeoutMs || idleTimeoutMs <= 0) {
        return;
      }
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => triggerTimeout("idle"), idleTimeoutMs);
    };
    resetIdle();

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      resetIdle();
      onEvent?.({
        type: "stdout",
        bytes: Buffer.byteLength(text),
        chunk: text,
        occurredAt: new Date().toISOString()
      });
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      resetIdle();
      onEvent?.({
        type: "stderr",
        bytes: Buffer.byteLength(text),
        chunk: text,
        occurredAt: new Date().toISOString()
      });
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      onEvent?.({
        type: "error",
        error: error.message,
        occurredAt: new Date().toISOString()
      });
      resolveResult({
        exitCode: 127,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        summary: `Failed to launch ${basename(bin)}`,
        timedOut: false
      });
    });
    child.on("close", (exitCode) => {
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      onEvent?.({
        type: "close",
        exitCode,
        stdoutBytes: Buffer.byteLength(stdout),
        stderrBytes: Buffer.byteLength(stderr),
        timedOut,
        occurredAt: new Date().toISOString()
      });
      resolveResult({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
        summary: exitCode === 0 ? "Execution completed" : "Execution failed",
        timedOut: false
      });
    });
  });
}

/** Wraps {@link runCommand}; non-zero exit → {@link EnvironmentPreparationError} tagged with logical `stage`. */
export async function runCheckedCommand(
  bin: string,
  args: string[],
  cwd: string,
  envOverrides: NodeJS.ProcessEnv,
  timeoutMs: number,
  stage: string,
  onEvent?: (event: EnvironmentRuntimeEvent) => Promise<void> | void
): Promise<void> {
  const command = [bin, ...args];
  const startedAt = new Date().toISOString();
  await onEvent?.({
    type: "command_start",
    stage,
    command,
    cwd,
    occurredAt: startedAt
  });
  const result = await runCommand(bin, args, cwd, timeoutMs, stringifyEnv(envOverrides), (event) => {
    void onEvent?.(mapEnvironmentRuntimeEvent(stage, command, cwd, event));
  });
  await onEvent?.({
    type: "result",
    stage,
    command,
    cwd,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    summary: result.summary,
    stdoutLength: result.stdout.length,
    stderrLength: result.stderr.length,
    occurredAt: new Date().toISOString()
  });
  if (result.exitCode !== 0) {
    throw new EnvironmentPreparationError(
      stage,
      result.summary,
      result.stderr || result.stdout,
      isRetryableEnvironmentStage(stage)
    );
  }
}

function mapEnvironmentRuntimeEvent(
  stage: string,
  command: string[],
  cwd: string,
  event: CommandLifecycleEvent
): EnvironmentRuntimeEvent {
  switch (event.type) {
    case "spawn":
      return { type: "spawn", stage, command, cwd, pid: event.pid, occurredAt: event.occurredAt };
    case "stdout":
    case "stderr":
      return { type: event.type, stage, command, cwd, bytes: event.bytes, chunk: event.chunk, occurredAt: event.occurredAt };
    case "timeout":
    case "idle_timeout":
      return {
        type: event.type,
        stage,
        command,
        cwd,
        signal: event.signal,
        timeoutMs: event.timeoutMs,
        reason: event.reason,
        occurredAt: event.occurredAt
      };
    case "error":
      return { type: "error", stage, command, cwd, error: event.error, occurredAt: event.occurredAt };
    case "close":
      return {
        type: "close",
        stage,
        command,
        cwd,
        exitCode: event.exitCode,
        stdoutBytes: event.stdoutBytes,
        stderrBytes: event.stderrBytes,
        timedOut: event.timedOut,
        occurredAt: event.occurredAt
      };
  }
}

/** Branch ref names to probe when resolving a branch in mirror caches or worktrees. */
const BRANCH_REF_SUFFIXES = (branch: string): string[] => [
  `refs/remotes/origin/${branch}`,
  `refs/heads/${branch}`
];

/** Detects the remote default branch (origin/HEAD, else main or master) for a worktree or bare mirror. */
export async function detectDefaultBaseBranch(
  path: string,
  timeoutMs: number,
  options?: { bareGitDir?: boolean; fallback?: string }
): Promise<string> {
  const gitPrefix = options?.bareGitDir ? ["--git-dir", path] : ["-C", path];
  const symbolic = await runCommand(
    "git",
    [...gitPrefix, "symbolic-ref", "refs/remotes/origin/HEAD"],
    path,
    timeoutMs
  );
  if (symbolic.exitCode === 0) {
    const match = symbolic.stdout.trim().match(/^refs\/remotes\/origin\/(.+)$/);
    if (match?.[1] && await branchExistsWithPrefix(path, match[1], timeoutMs, gitPrefix)) {
      return match[1];
    }
  }
  if (options?.bareGitDir) {
    const head = await runCommand("git", [...gitPrefix, "symbolic-ref", "HEAD"], path, timeoutMs);
    if (head.exitCode === 0) {
      const match = head.stdout.trim().match(/^refs\/heads\/(.+)$/);
      if (match?.[1] && await branchExistsWithPrefix(path, match[1], timeoutMs, gitPrefix)) {
        return match[1];
      }
    }
  }
  for (const candidate of ["main", "master"]) {
    if (await branchExistsWithPrefix(path, candidate, timeoutMs, gitPrefix)) {
      return candidate;
    }
  }
  return options?.fallback ?? "main";
}

async function branchExistsWithPrefix(
  path: string,
  branch: string,
  timeoutMs: number,
  gitPrefix: string[]
): Promise<boolean> {
  for (const ref of BRANCH_REF_SUFFIXES(branch)) {
    if (await gitRefExistsWithPrefix(path, ref, timeoutMs, gitPrefix)) {
      return true;
    }
  }
  return false;
}

/** Resolves a local branch name inside a bare `--git-dir` mirror to origin/HEAD ref when present. */
export async function resolveBranchRef(cachePath: string, branch: string, timeoutMs: number): Promise<string> {
  const remoteRef = `refs/remotes/origin/${branch}`;
  const localRef = `refs/heads/${branch}`;
  if (await gitRefExists(cachePath, remoteRef, timeoutMs)) {
    return remoteRef;
  }
  if (await gitRefExists(cachePath, localRef, timeoutMs)) {
    return localRef;
  }
  throw new EnvironmentPreparationError("checkout", `Branch ${branch} not found`, branch, false);
}

/** Returns true when task metadata marks the branch as generated by the service defaulting logic. */
export function isAutoGeneratedTaskBranch(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const diting = metadata.diting;
  if (!diting || typeof diting !== "object") {
    return false;
  }
  const branch = (diting as Record<string, unknown>).branch;
  if (!branch || typeof branch !== "object") {
    return false;
  }
  return (branch as Record<string, unknown>).autoGenerated === true;
}

/** True when `git show-ref --verify ref` succeeds on the mirror. */
async function gitRefExists(cachePath: string, ref: string, timeoutMs: number): Promise<boolean> {
  return gitRefExistsWithPrefix(cachePath, ref, timeoutMs, ["--git-dir", cachePath]);
}

async function gitRefExistsWithPrefix(
  path: string,
  ref: string,
  timeoutMs: number,
  gitPrefix: string[]
): Promise<boolean> {
  const result = await runCommand(
    "git",
    [...gitPrefix, "show-ref", "--verify", "--quiet", ref],
    path,
    timeoutMs
  );
  return result.exitCode === 0;
}

export type PackageManager = "pnpm" | "npm" | "yarn";

/** Resolves install/run CLI from lockfiles, then `packageManager` in package.json; defaults to pnpm. */
export async function selectPackageManager(repoPath: string): Promise<{
  manager: PackageManager;
  bin: string;
  installArgs: string[];
}> {
  if (await pathExists(join(repoPath, "pnpm-lock.yaml"))) {
    return { manager: "pnpm", bin: "pnpm", installArgs: ["install"] };
  }
  if (await pathExists(join(repoPath, "yarn.lock"))) {
    return { manager: "yarn", bin: "yarn", installArgs: ["install"] };
  }
  if (await pathExists(join(repoPath, "package-lock.json"))) {
    return { manager: "npm", bin: "npm", installArgs: ["install"] };
  }

  const fromPackageJson = await readPackageManagerField(repoPath);
  if (fromPackageJson) {
    return fromPackageJson;
  }

  return { manager: "pnpm", bin: "pnpm", installArgs: ["install"] };
}

async function readPackageManagerField(
  repoPath: string
): Promise<{ manager: PackageManager; bin: string; installArgs: string[] } | null> {
  const packageJsonPath = join(repoPath, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    packageManager?: string;
  };
  const raw = packageJson.packageManager?.trim();
  if (!raw) {
    return null;
  }
  const id = raw.split("@")[0]?.trim();
  if (id === "pnpm" || id === "npm" || id === "yarn") {
    return { manager: id, bin: id, installArgs: ["install"] };
  }
  return null;
}

/** Runs package-manager install when package.json exists; honors workspace env overlays. */
export async function installDependenciesIfNeeded(
  repoPath: string,
  env: Record<string, string>,
  timeoutMs: number,
  onEvent?: (event: EnvironmentRuntimeEvent) => Promise<void> | void
): Promise<void> {
  if (!(await pathExists(join(repoPath, "package.json")))) {
    return;
  }
  const { bin, installArgs } = await selectPackageManager(repoPath);
  await runCheckedCommand(
    bin,
    installArgs,
    repoPath,
    { ...process.env, ...env },
    timeoutMs,
    "install",
    onEvent
  );
}

/**
 * Executes the first three quality layers through package scripts. Missing scripts count as skipped passes.
 */
export async function runQualityScripts(workspace: PreparedWorkspace, timeoutMs: number): Promise<{
  scripts: QualityScriptResult[];
  layers: QualityLayerResult[];
}> {
  const repos = workspace.repos.length > 0
    ? workspace.repos
    : [{ key: "Repo1", url: "", path: workspace.repoPath, cachePath: workspace.cachePath }];
  const results: QualityScriptResult[] = [];
  const scriptPlan: Array<{
    layer: QualityScriptResult["layer"];
    name: string;
    scripts: string[];
  }> = [
    { layer: "static", name: "type-check", scripts: ["type-check", "typecheck"] },
    { layer: "static", name: "lint", scripts: ["lint"] },
    { layer: "unit", name: "unit-test", scripts: ["test:unit", "unit-test", "unit", "test"] },
    { layer: "startup", name: "build", scripts: ["build"] },
    { layer: "startup", name: "startup-test", scripts: ["test:startup", "startup-test", "smoke", "test:smoke"] }
  ];

  for (const repo of repos) {
    const { manager, bin } = await selectPackageManager(repo.path);
    const scripts = await readPackageScripts(repo.path);
    for (const item of scriptPlan) {
      const checkName = repos.length > 1 ? `${repo.key}/${item.name}` : item.name;
      const selectedScript = item.scripts.find((script) => scripts[script]);
      if (!selectedScript) {
        results.push({
          name: checkName,
          script: item.scripts[0],
          passed: true,
          detail: `Skipped: none of scripts "${item.scripts.join(", ")}" defined in ${repo.key}`,
          skipped: true,
          layer: item.layer
        });
        continue;
      }
      const result = await runCommand(bin, ["run", selectedScript], repo.path, timeoutMs, workspace.env);
      results.push({
        name: checkName,
        script: selectedScript,
        passed: result.exitCode === 0,
        detail: result.exitCode === 0
          ? `Passed via ${manager} run ${selectedScript} in ${repo.key}`
          : `Failed via ${manager} run ${selectedScript} in ${repo.key}: ${result.summary}`,
        skipped: false,
        layer: item.layer
      });
    }
  }

  return {
    scripts: results,
    layers: buildQualityLayers(results, [])
  };
}

export async function collectAutomationReportScores(
  workspace: PreparedWorkspace,
  task: TitingTask
): Promise<{
  checks: QualityAutomationReportResult[];
  reports: Record<"api" | "ui", QualityAutomationReportResult>;
  layer: QualityLayerResult;
}> {
  const api = await collectApiAutomationReport(workspace, task);
  const ui = await collectUiAutomationReport(workspace);
  const checks = [api, ui];
  return {
    checks,
    reports: { api, ui },
    layer: {
      id: "automation-report",
      name: "自动化测试报告评分",
      passed: checks.every((check) => check.passed),
      checks
    }
  };
}

export function buildQualityLayers(
  scripts: QualityScriptResult[],
  automationReports: QualityAutomationReportResult[]
): QualityLayerResult[] {
  const layerNames: Record<QualityLayerResult["id"], string> = {
    static: "静态检测",
    unit: "单元测试",
    startup: "启动测试",
    "automation-report": "自动化测试报告评分"
  };
  const layerIds: QualityLayerResult["id"][] = ["static", "unit", "startup", "automation-report"];
  return layerIds.map((id) => {
    const checks = id === "automation-report"
      ? automationReports
      : scripts.filter((script) => script.layer === id);
    return {
      id,
      name: layerNames[id],
      passed: checks.every((check) => check.passed),
      checks
    };
  });
}

async function collectApiAutomationReport(
  workspace: PreparedWorkspace,
  task: TitingTask
): Promise<QualityAutomationReportResult> {
  const roots = qualityReportRoots(workspace);
  const changeId = extractAutomationChangeId(task);
  for (const root of roots) {
    const metricsPath = changeId
      ? join(root.path, "tmp", "api-test-reports", changeId, "metrics.json")
      : await findLatestApiMetricsPath(root.path);
    if (!metricsPath) {
      continue;
    }
    const metrics = await readJsonFile(metricsPath);
    if (!metrics) {
      continue;
    }
    const score = numericField(metrics, "weightedScore");
    const grade = stringField(metrics, "grade");
    const passed = typeof score === "number" ? score >= 70 : false;
    return {
      name: "api",
      passed,
      skipped: false,
      score,
      status: grade,
      path: metricsPath,
      raw: metrics,
      detail: `API automation report ${passed ? "passed" : "failed"}: score=${score ?? "N/A"}, grade=${grade || "N/A"}, path=${metricsPath}`
    };
  }
  return skippedAutomationReport("api", "Skipped: 开发流程未产出适用 API 自动化报告或本任务不适用自动化报告评分");
}

async function collectUiAutomationReport(workspace: PreparedWorkspace): Promise<QualityAutomationReportResult> {
  const roots = qualityReportRoots(workspace);
  const candidateNames = [
    "uiAutomationMetrics.json",
    join("docs", "feature", "uiAutomationMetrics.json"),
    join("artifacts", "uiAutomationMetrics.json")
  ];
  for (const root of roots) {
    for (const candidate of candidateNames) {
      const metricsPath = join(root.path, candidate);
      const metrics = await readJsonFile(metricsPath);
      if (!metrics) {
        continue;
      }
      const gate = objectField(metrics, "gate");
      const status = stringField(gate, "status") || "unknown";
      const passed = status === "passed" || booleanField(gate, "completed") === true;
      const p0 = objectField(metrics, "p0");
      const passRate = numericField(p0, "passRate");
      const score = typeof passRate === "number" ? Math.round(passRate * 100) : undefined;
      return {
        name: "ui",
        passed,
        skipped: false,
        score,
        status,
        path: metricsPath,
        raw: metrics,
        detail: `UI automation report ${passed ? "passed" : "failed"}: status=${status}, p0PassRate=${passRate ?? "N/A"}, path=${metricsPath}`
      };
    }
    const latestMetricsPath = await findLatestUiMetricsPath(root.path);
    if (!latestMetricsPath) {
      continue;
    }
    const metrics = await readJsonFile(latestMetricsPath);
    if (!metrics) {
      continue;
    }
    const gate = objectField(metrics, "gate");
    const status = stringField(gate, "status") || "unknown";
    const passed = status === "passed" || booleanField(gate, "completed") === true;
    const p0 = objectField(metrics, "p0");
    const passRate = numericField(p0, "passRate");
    const score = typeof passRate === "number" ? Math.round(passRate * 100) : undefined;
    return {
      name: "ui",
      passed,
      skipped: false,
      score,
      status,
      path: latestMetricsPath,
      raw: metrics,
      detail: `UI automation report ${passed ? "passed" : "failed"}: status=${status}, p0PassRate=${passRate ?? "N/A"}, path=${latestMetricsPath}`
    };
  }
  return skippedAutomationReport("ui", "Skipped: 开发流程未产出适用 UI 自动化报告或本任务不适用自动化报告评分");
}

function qualityReportRoots(workspace: PreparedWorkspace): Array<{ key: string; path: string }> {
  const roots = [
    { key: "workspace", path: workspace.workspacePath },
    ...qualityRepos(workspace)
  ];
  const seen = new Set<string>();
  return roots.filter((root) => {
    if (seen.has(root.path)) {
      return false;
    }
    seen.add(root.path);
    return true;
  });
}

function qualityRepos(workspace: PreparedWorkspace): Array<{ key: string; path: string }> {
  return workspace.repos.length > 0
    ? workspace.repos.map((repo) => ({ key: repo.key, path: repo.path }))
    : [{ key: "Repo1", path: workspace.repoPath }];
}

function extractAutomationChangeId(task: TitingTask): string | null {
  const metadata = task.metadata ?? {};
  for (const key of ["openspecChangeId", "changeId", "featureId"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function findLatestApiMetricsPath(repoPath: string): Promise<string | null> {
  const reportsRoot = join(repoPath, "tmp", "api-test-reports");
  try {
    const entries = await readdir(reportsRoot, { withFileTypes: true });
    const candidates = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const metricsPath = join(reportsRoot, entry.name, "metrics.json");
        try {
          const stats = await stat(metricsPath);
          return { path: metricsPath, mtimeMs: stats.mtimeMs };
        } catch {
          return null;
        }
      }));
    const latest = candidates
      .filter((candidate): candidate is { path: string; mtimeMs: number } => candidate !== null)
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
    return latest?.path ?? null;
  } catch {
    return null;
  }
}

async function findLatestUiMetricsPath(rootPath: string): Promise<string | null> {
  const docsFeatureRoot = join(rootPath, "docs", "feature");
  try {
    const candidates = await collectNamedFiles(docsFeatureRoot, "uiAutomationMetrics.json");
    const latest = candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
    return latest?.path ?? null;
  } catch {
    return null;
  }
}

async function collectNamedFiles(rootPath: string, fileName: string): Promise<Array<{ path: string; mtimeMs: number }>> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: Array<{ path: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    const path = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectNamedFiles(path, fileName));
      continue;
    }
    if (entry.isFile() && entry.name === fileName) {
      const stats = await stat(path);
      files.push({ path, mtimeMs: stats.mtimeMs });
    }
  }
  return files;
}

function skippedAutomationReport(name: "api" | "ui", detail: string): QualityAutomationReportResult {
  return {
    name,
    passed: true,
    skipped: true,
    detail
  };
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function objectField(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === "object" && !Array.isArray(field)
    ? field as Record<string, unknown>
    : null;
}

function numericField(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

function stringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

function booleanField(value: unknown, key: string): boolean | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "boolean" ? field : undefined;
}

/** Builds diff stat + Porcelain short status count against `HEAD` for churn-aware quality scoring. */
export async function collectDiffRisk(workspace: PreparedWorkspace, timeoutMs: number) {
  const repos = workspace.repos.length > 0
    ? workspace.repos
    : [{ key: "Repo1", url: "", path: workspace.repoPath, cachePath: workspace.cachePath }];
  const perRepo: Record<string, { filesChanged: number; insertions: number; deletions: number; summary: string }> = {};
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;

  for (const repo of repos) {
    const diffStat = await runCommand(
      "git",
      ["-C", repo.path, "diff", "--shortstat", "--find-renames", "HEAD"],
      repo.path,
      timeoutMs,
      workspace.env
    );
    const changedFiles = await runCommand(
      "git",
      ["-C", repo.path, "status", "--short"],
      repo.path,
      timeoutMs,
      workspace.env
    );
    const match = diffStat.stdout.match(/(\d+)\s+files? changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);
    const repoFilesChanged = changedFiles.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
    const repoInsertions = match?.[2] ? Number(match[2]) : 0;
    const repoDeletions = match?.[3] ? Number(match[3]) : 0;
    perRepo[repo.key] = {
      filesChanged: repoFilesChanged,
      insertions: repoInsertions,
      deletions: repoDeletions,
      summary: diffStat.stdout.trim() || "No diff"
    };
    filesChanged += repoFilesChanged;
    insertions += repoInsertions;
    deletions += repoDeletions;
  }

  return {
    filesChanged,
    insertions,
    deletions,
    summary: Object.entries(perRepo).map(([key, value]) => `${key}: ${value.summary}`).join("; ") || "No diff",
    perRepo
  };
}

/** Elevates risk on executor timeout, failed non-skipped checks, file count/churn thresholds. */
export function deriveRiskLevel(
  diffReport: { filesChanged: number; insertions: number; deletions: number },
  checks: Array<{ passed: boolean; skipped: boolean }>,
  timedOut: boolean
): QualityResult["riskLevel"] {
  if (timedOut || checks.some((check) => !check.passed && !check.skipped)) {
    return "high";
  }
  const churn = diffReport.insertions + diffReport.deletions;
  if (diffReport.filesChanged > 20 || churn > 400) {
    return "high";
  }
  if (diffReport.filesChanged > 8 || churn > 120) {
    return "medium";
  }
  return "low";
}

/** Weighted heuristic 0–100 from exit code + per-script passes + {@link deriveRiskLevel} adjustments. */
export function calculateQualityScore(
  exitCodePassed: boolean,
  checks: Array<{ passed: boolean; skipped: boolean }>,
  riskLevel: QualityResult["riskLevel"]
): number {
  let score = exitCodePassed ? 40 : 0;
  for (const check of checks) {
    if (check.skipped) {
      score += 5;
      continue;
    }
    score += check.passed ? 15 : 0;
  }
  if (riskLevel === "medium") {
    score -= 10;
  }
  if (riskLevel === "high") {
    score -= 30;
  }
  return Math.max(0, Math.min(100, score));
}

/** Reads `"scripts"` map from package.json; empty when file missing/unreadable. */
async function readPackageScripts(repoPath: string): Promise<Record<string, string>> {
  const packageJsonPath = join(repoPath, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return {};
  }
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { scripts?: Record<string, string> };
  return packageJson.scripts ?? {};
}

/** Reads UTF-8 file or returns `""` on ENOENT/other errors — used for optional CLI `-o` outputs. */
export async function readOptionalFile(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

/** Shrinks arbitrary task metadata `env` to stringifiable scalar map for subprocess env injection. */
export function normalizeWorkspaceEnv(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string | number | boolean] => ["string", "number", "boolean"].includes(typeof entry[1]))
      .map(([key, entryValue]) => [key, String(entryValue)])
  );
}

/** Drops `undefined` process env entries so spreads stay JSON-safe string maps. */
export function stringifyEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))
  );
}

/** Lightweight `access` probe without swallowing rationale (boolean only). */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Stable directory name suffix for cloning mirrors keyed by upstream repo URL. */
export function hashRepo(repo: string): string {
  return createHash("sha1").update(repo).digest("hex");
}

/** Stages where retry may succeed (clone/fetch/worktree/install) vs permanent checkout mismatches. */
function isRetryableEnvironmentStage(stage: string): boolean {
  return ["clone", "fetch", "worktree", "install", "cleanup"].includes(stage);
}

/** Maps raw {@link CommandResult} exit/timeout semantics into stable error buckets for dashboards. */
export function classifyExecutionError(result: CommandResult): ExecutionResult["errorCategory"] {
  if (result.timedOut) {
    return "timeout";
  }
  if (result.exitCode === 127) {
    return "launch_error";
  }
  if (result.exitCode !== 0) {
    return "command_failed";
  }
  return "none";
}

/**
 * Detects coding-agent authentication failures in CLI output. These often surface as a
 * non-fatal warning (exit code 0) — e.g. an invalid `CURSOR_API_KEY` — so callers must
 * inspect the text rather than rely on the exit code, otherwise the run silently produces
 * no work and burns the repair budget (or hangs) instead of failing fast with a clear cause.
 */
export function detectCodingAgentAuthFailure(text: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.toLowerCase();
  return (
    normalized.includes("api key is invalid") ||
    normalized.includes("provided api key is invalid") ||
    normalized.includes("invalid api key") ||
    normalized.includes("not logged in") ||
    normalized.includes("unauthenticated") ||
    normalized.includes("please log in") ||
    normalized.includes("please login")
  );
}

/** Actionable message shown when a coding agent fails to authenticate, naming the concrete remediation. */
export const CODING_AGENT_AUTH_FAILURE_MESSAGE =
  "Coding agent authentication failed: the CURSOR_API_KEY is invalid or the agent is not logged in. " +
  "Update CURSOR_API_KEY with a valid key or run `agent login`, then restart the server.";

/** Finds first lowercase UUID-ish token anywhere in streamed CLI output. */
export function extractUuid(value: string): string | null {
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match?.[0] ?? null;
}

/** Scans newline-delimited JSON objects for Codex-flavored `session_id` / `sessionId` / `id` fields. */
export function extractJsonSessionId(stdout: string): string | null {
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const value = parsed.session_id ?? parsed.sessionId ?? parsed.id ?? parsed.thread_id ?? parsed.threadId;
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Walks JSON lines in Cursor agent stdout for latest `text` / `message` assistant payload. */
export function extractCursorSummary(stdout: string): string | null {
  let summary: string | null = null;
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      // Legacy single-object `--output-format json` shape.
      if (typeof parsed.text === "string" && parsed.text.trim()) {
        summary = parsed.text.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        summary = parsed.message.trim();
      }
      // `--output-format stream-json` event shapes.
      const streamText = extractCursorStreamEventText(parsed);
      if (streamText) {
        summary = streamText;
      }
    } catch {
      continue;
    }
  }
  return summary;
}

/** Pulls assistant/result text out of a single cursor stream-json event object, if present. */
function extractCursorStreamEventText(event: Record<string, unknown>): string | null {
  // Final result event: { type: "result", result: "..." }
  if (event.type === "result" && typeof event.result === "string" && event.result.trim()) {
    return event.result.trim();
  }
  // Assistant message event: { type: "assistant", message: { content: [{ type: "text", text: "..." }] } }
  if (event.type === "assistant" && event.message && typeof event.message === "object") {
    const content = (event.message as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      const text = content
        .filter((part): part is Record<string, unknown> => typeof part === "object" && part !== null)
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
      if (text) {
        return text;
      }
    }
  }
  return null;
}

/** Shortens long argv tokens and scrubs obvious secret-shaped flags for logs/metadata. */
export function redactCommand(command: string[]): string[] {
  return command.map((part) => {
    if (part.length > 80) {
      return `${part.slice(0, 32)}...[redacted:${part.length}]`;
    }
    if (/api[-_]?key|token|secret/i.test(part)) {
      return "[redacted]";
    }
    return part;
  });
}

/** Normalizes prior `governance` metadata to an array and appends the newest plugin record. */
export function appendGovernanceEntry(existing: unknown, entry: Record<string, unknown>): Record<string, unknown>[] {
  const list = Array.isArray(existing)
    ? existing.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
  return [...list, entry];
}

/** Token-level secret heuristics (non-destructive); used pre/post command and around eval reports. */
export function scanSecrets(value: string): string[] {
  const findings: string[] = [];
  if (/sk-[A-Za-z0-9]{20,}/.test(value)) {
    findings.push("OpenAI-style secret detected");
  }
  if (/ghp_[A-Za-z0-9]{20,}/.test(value)) {
    findings.push("GitHub token detected");
  }
  if (/xox[baprs]-[A-Za-z0-9-]{10,}/.test(value)) {
    findings.push("Slack token detected");
  }
  if (/api[_-]?key\s*[=:]/i.test(value)) {
    findings.push("API key assignment detected");
  }
  if (/authorization:\s*bearer/i.test(value)) {
    findings.push("Bearer token detected");
  }
  return [...new Set(findings)];
}

/** Enforces governance allow/binary list, regex blocklist, and max argv length for prompts. */
export function scanCommandPolicy(command: string[], policy: GovernancePolicy): string[] {
  const findings: string[] = [];
  const binary = basename(command[0] ?? "").trim();
  const joined = command.join(" ");
  if (policy.allowCommandPrefixes.length > 0 && !policy.allowCommandPrefixes.includes(binary)) {
    findings.push(`Command binary "${binary || "unknown"}" is not on the allowlist`);
  }
  for (const pattern of policy.blockCommandPatterns) {
    try {
      if (new RegExp(pattern, "i").test(joined)) {
        findings.push(`Command matched blocked policy: ${pattern}`);
      }
    } catch {
      findings.push(`Invalid blocked command pattern: ${pattern}`);
    }
  }
  if (joined.length > policy.maxPromptChars) {
    findings.push(`Command payload exceeded maxPromptChars=${policy.maxPromptChars}`);
  }
  return findings;
}

/** Computes diff-size policy violations complementary to governance `afterEval` hard blocks. */
export function scanEvalRisk(
  diff: { filesChanged: number; changedLines: number },
  policy: GovernancePolicy
): string[] {
  const findings: string[] = [];
  if (diff.filesChanged > policy.maxFilesChanged) {
    findings.push(`filesChanged ${diff.filesChanged} exceeded limit ${policy.maxFilesChanged}`);
  }
  if (diff.changedLines > policy.maxDiffLines) {
    findings.push(`changedLines ${diff.changedLines} exceeded limit ${policy.maxDiffLines}`);
  }
  return findings;
}

/** Caps stored stdout/stderr blobs while preserving truncation marker for auditors. */
export function truncateWithMarker(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 20))}[truncated-output]`;
}

/** Reads `report.diff.{filesChanged, insertions, deletions}` from evaluator JSON into governance-friendly metrics. */
export function readDiffReport(report: Record<string, unknown>): { filesChanged: number; changedLines: number } {
  const diff = report.diff;
  if (!diff || typeof diff !== "object") {
    return { filesChanged: 0, changedLines: 0 };
  }
  const value = diff as Record<string, unknown>;
  const insertions = typeof value.insertions === "number" ? value.insertions : 0;
  const deletions = typeof value.deletions === "number" ? value.deletions : 0;
  return {
    filesChanged: typeof value.filesChanged === "number" ? value.filesChanged : 0,
    changedLines: insertions + deletions
  };
}

/** Recursive tree walk applying {@link SECRET_PATTERNS} to strings — safe-ish JSON export for UI/records. */
export function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern.regex, pattern.replacement), value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, sanitizeUnknown(entryValue)])
    );
  }
  return value;
}

/** Parses plugin config arrays, dropping empties while preserving fallback defaults. */
export function asPolicyStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

/** Validates finite numeric thresholds from plugin JSON; substitutes defaults when absent/invalid. */
export function asPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Loads JSON array append-only persistence (Meegle `results.json` pattern); tolerant of missing files. */
export async function readJsonArray(path: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
  } catch {
    return [];
  }
}

export async function appendJsonLine(path: string, value: Record<string, unknown>): Promise<void> {
  await appendFile(path, `${JSON.stringify(sanitizeUnknown(value))}\n`, "utf8");
}

/**
 * Strips Markdown link wrappers around clone URLs, e.g.
 * `[git@host](mailto:git@host):group/repo.git` → `git@host:group/repo.git`.
 */
export function normalizeRepoUrl(value: string | null | undefined): string {
  if (value == null) {
    return "";
  }
  const s = value.trim();
  if (!s) {
    return "";
  }

  const markdownTail = /^\[([^\]]+)\]\(([^)]+)\)\s*(:\S[\S]*)?$/;
  const match = s.match(markdownTail);
  if (!match) {
    return s;
  }

  const linkText = match[1].trim();
  const href = match[2].trim();
  const tail = (match[3] ?? "").trim();

  if (linkText.startsWith("git@")) {
    return tail.startsWith(":") ? `${linkText}${tail}` : linkText;
  }
  if (/^https?:\/\//i.test(href)) {
    return href;
  }
  if (/^https?:\/\//i.test(linkText)) {
    return linkText;
  }

  return linkText || s;
}

/** Canonical row → {@link TitingTask}: merges Chinese/English field aliases and seeds trace metadata defaults. */
export function mapMeegleTask(
  value: unknown,
  index: number,
  defaultExecutor = "programming",
  options: { productRuntime?: string | null } = {}
): TitingTask {
  const row = applyDescriptionFallback((value ?? {}) as Record<string, unknown>);
  const now = new Date();
  const externalId = asNonEmptyString(row.id)
    ?? asNonEmptyString(row.work_item_id)
    ?? asNonEmptyString(row["工作项ID"])
    ?? `meegle-${index + 1}`;
  const title = asNonEmptyString(row.title)
    ?? asNonEmptyString(row.标题)
    ?? asNonEmptyString(row.名称)
    ?? asNonEmptyString(row.name)
    ?? `Meegle task ${externalId}`;
  const instruction = asNonEmptyString(row.instruction)
    ?? asNonEmptyString(row.description)
    ?? asNonEmptyString(row.描述)
    ?? title;
  const repo = normalizeRepoUrl(asNonEmptyString(row.repo) ?? "");
  const branch = asNonEmptyString(row.branch) ?? "";
  const priority = asTaskPriority(row.priority);
  const rowMetadata =
    typeof row.metadata === "object" && row.metadata !== null
      ? row.metadata as Record<string, unknown>
      : {};
  const repos = Array.isArray(rowMetadata.repos)
    ? rowMetadata.repos as TaskRepoRef[]
    : repo
      ? [{ key: "Repo1", url: repo }]
      : [];
  const specAttachments = extractSpecAttachmentsFromRow(row);
  const fieldBag = readMeegleFieldBag(row);
  const metadata = {
    ...rowMetadata,
    repos,
    ...(specAttachments.length > 0 ? { specAttachments } : {}),
    ...(fieldBag ? { meegleFields: fieldBag } : {}),
    ...(Array.isArray(row.work_item_fields) ? { meegleWorkItemFields: row.work_item_fields } : {})
  };
  const routing = resolveMeegleAgentRouting({
    row,
    rowMetadata,
    specAttachments,
    defaultExecutor,
    productRuntime: options.productRuntime
  });
  return {
    id: `meegle-${externalId}`,
    source: "meegle",
    externalId,
    title,
    instruction,
    repo: repo || repos[0]?.url || "",
    branch,
    priority,
    status: "draft",
    executor: routing.executor,
    agentKind: routing.agentKind,
    preferredDriver: routing.preferredDriver,
    preferredRuntime: routing.preferredRuntime,
    driverId: routing.driverId,
    runtimeProviderId: routing.runtimeProviderId,
    traceId: `meegle-${externalId}`,
    constraints: asStringArray(row.constraints),
    acceptanceCriteria: asStringArray(row.acceptanceCriteria),
    metadata: {
      ...metadata,
      ...routing.metadata,
      agentRequest: routing.agentRequest
    },
    retryCount: 0,
    repairCount: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function resolveMeegleAgentRouting(input: {
  row: Record<string, unknown>;
  rowMetadata: Record<string, unknown>;
  specAttachments: SpecAttachmentRef[];
  defaultExecutor: string;
  productRuntime?: string | null;
}): {
  executor: string;
  agentKind: AgentKind;
  preferredDriver: string | null;
  preferredRuntime: string | null;
  driverId: string | null;
  runtimeProviderId: string | null;
  agentRequest: AgentRequest;
  metadata: Record<string, unknown>;
} {
  const metadataAgentRequest = readAgentRequestFromMetadata(input.rowMetadata.agentRequest);
  const explicitAgentKind = readAgentKind(input.row, input.rowMetadata, metadataAgentRequest);
  const explicitRuntime = readPreferredRuntime(input.row, input.rowMetadata, metadataAgentRequest);
  const explicitDriver = readPreferredDriver(input.row, input.rowMetadata, metadataAgentRequest);
  const specPackageInspection = readSpecPackageInspection(input.rowMetadata.specPackageInspection);
  const missingOpenSpecPackage = specPackageInspection?.state === "missing_openspec";
  const hasSpecPackage = !missingOpenSpecPackage && hasOpenSpecPackageAttachment(input.specAttachments);
  const agentKind: AgentKind = missingOpenSpecPackage
    ? "product"
    : explicitAgentKind ?? (hasSpecPackage ? "programming" : "product");
  const productRuntime = normalizeProductRuntime(input.productRuntime) ?? "codex";

  const executor = agentKind === "programming"
    ? "programming"
    : agentKind === "product"
      ? "product"
      : asNonEmptyString(input.row.executor) ?? input.defaultExecutor;
  const preferredDriver = explicitDriver
    ?? (agentKind === "programming" ? "coding" : agentKind === "product" ? "openspec-product" : null);
  const preferredRuntime = explicitRuntime
    ?? (agentKind === "product"
      ? productRuntime
      : inferProgrammingRuntime(input.row, input.rowMetadata, metadataAgentRequest, input.defaultExecutor));
  const agentRequest: AgentRequest = {
    agentKind,
    ...(preferredDriver ? { preferredDriver } : {}),
    ...(preferredRuntime ? { preferredRuntime } : {}),
    ...(asNonEmptyString(input.row.executor) ? { legacyExecutor: asNonEmptyString(input.row.executor) ?? undefined } : {})
  };
  return {
    executor,
    agentKind,
    preferredDriver,
    preferredRuntime,
    driverId: preferredDriver,
    runtimeProviderId: preferredRuntime,
    agentRequest,
    metadata: agentKind === "product"
      ? {
          workflowRole: "product_spec",
          openspecSourceState: "none"
        }
      : hasSpecPackage
        ? {
            workflowRole: "programming_from_spec",
            openspecSourceState: "provided"
          }
        : {}
  };
}

function readAgentRequestFromMetadata(value: unknown): Partial<AgentRequest> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    agentKind: asNonEmptyString(record.agentKind) ?? undefined,
    preferredDriver: asNonEmptyString(record.preferredDriver) ?? undefined,
    preferredRuntime: asNonEmptyString(record.preferredRuntime) ?? undefined,
    legacyExecutor: asNonEmptyString(record.legacyExecutor) ?? undefined
  };
}

function readAgentKind(
  row: Record<string, unknown>,
  metadata: Record<string, unknown>,
  metadataAgentRequest: Partial<AgentRequest>
): AgentKind | null {
  return asNonEmptyString(row.agentKind)
    ?? asNonEmptyString(row.agent_kind)
    ?? asNonEmptyString(row.agent)
    ?? asNonEmptyString(metadata.agentKind)
    ?? asNonEmptyString(metadata.agent_kind)
    ?? metadataAgentRequest.agentKind
    ?? null;
}

function readPreferredDriver(
  row: Record<string, unknown>,
  metadata: Record<string, unknown>,
  metadataAgentRequest: Partial<AgentRequest>
): string | null {
  return asNonEmptyString(row.preferredDriver)
    ?? asNonEmptyString(row.preferred_driver)
    ?? asNonEmptyString(row.driverId)
    ?? asNonEmptyString(row.driver_id)
    ?? asNonEmptyString(metadata.preferredDriver)
    ?? asNonEmptyString(metadata.driverId)
    ?? metadataAgentRequest.preferredDriver
    ?? null;
}

function readPreferredRuntime(
  row: Record<string, unknown>,
  metadata: Record<string, unknown>,
  metadataAgentRequest: Partial<AgentRequest>
): string | null {
  return asNonEmptyString(row.preferredRuntime)
    ?? asNonEmptyString(row.preferred_runtime)
    ?? asNonEmptyString(row.runtimeProviderId)
    ?? asNonEmptyString(row.runtime_provider_id)
    ?? asNonEmptyString(metadata.preferredRuntime)
    ?? asNonEmptyString(metadata.runtimeProviderId)
    ?? metadataAgentRequest.preferredRuntime
    ?? null;
}

function inferProgrammingRuntime(
  row: Record<string, unknown>,
  metadata: Record<string, unknown>,
  metadataAgentRequest: Partial<AgentRequest>,
  defaultExecutor: string
): string | null {
  const executor = asNonEmptyString(row.executor)
    ?? asNonEmptyString(metadata.executor)
    ?? metadataAgentRequest.legacyExecutor
    ?? asNonEmptyString(defaultExecutor)
    ?? null;
  return executor === "codex" || executor === "cursor" ? executor : null;
}

function normalizeProductRuntime(value: string | null | undefined): "codex" | "cursor" | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "cursor" || normalized === "codex" ? normalized : null;
}

function readSpecPackageInspection(value: unknown): { state: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const state = (value as Record<string, unknown>).state;
  return typeof state === "string" && state.trim() ? { state: state.trim() } : null;
}

function hasOpenSpecPackageAttachment(attachments: SpecAttachmentRef[]): boolean {
  return attachments.some((attachment) => isOpenSpecPackageAttachmentName(attachment.name));
}

function isOpenSpecPackageAttachmentName(name: string): boolean {
  const normalized = basename(name).trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const archive = normalized.endsWith(".zip") || normalized.endsWith(".tar.gz") || normalized.endsWith(".tgz");
  if (!archive) {
    return false;
  }
  return true;
}

/** Formats bilingual Meegle comment body with status headline and bounded summary truncation. */
export function buildMeegleResultComment(task: TitingTask, summary: string): string {
  const status = task.status === "succeeded"
    ? "completed"
    : task.status === "failed"
      ? "failed"
      : "updated";
  const headline = `蹄听 ${status} task ${task.id}`;
  const parts = [summary.trim()];
  const prs = task.metadata.prs;
  if (Array.isArray(prs) && prs.length > 0) {
    const links = prs
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Record<string, unknown>;
        const repoKey = asNonEmptyString(record.repoKey) ?? "repo";
        const prUrl = asNonEmptyString(record.prUrl);
        return prUrl ? `${repoKey}: ${prUrl}` : null;
      })
      .filter((value): value is string => Boolean(value));
    if (links.length > 0) {
      parts.push(`PRs:\n${links.join("\n")}`);
    }
  }
  const body = parts.filter(Boolean).join("\n");
  return body ? `${headline}\n${truncateMeegleComment(body)}` : headline;
}

/** Same headline + body shape as {@link buildMeegleResultComment}; appends machine footer for human-loop threading. */
export function buildMeegleNeedsHumanComment(task: TitingTask, payload: NeedsHumanPayload): string {
  const headline = `needs_human task ${task.id}`;
  const parts = [payload.reason.trim(), payload.summary.trim()].filter(Boolean);
  const bodyRaw = parts.join("\n");
  const bodyBlock = bodyRaw ? truncateMeegleComment(bodyRaw) : "";
  const footer = [
    `[DITING_NEEDS_HUMAN requestId=${payload.requestId} taskId=${task.id} traceId=${task.traceId}]`,
    "Reply to this comment with the missing context to continue the task."
  ].join("\n");
  return bodyBlock ? `${headline}\n${bodyBlock}\n${footer}` : `${headline}\n${footer}`;
}

/** Strict JSON.parse for CLI stdout; throws deterministic error when wrappers log noise before JSON payload. */
export function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("Meegle CLI returned non-JSON output");
  }
}

/**
 * Accepts envelope arrays/nested `{ tasks/items/data/... }` shapes emitted by differing Meegle CLI versions → rows for {@link mapMeegleTask}.
 */
export function extractTaskListPayload(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMeegleRecord(item));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.moql_field_list)) {
      return [normalizeMeegleRecord(record)];
    }
    const nested =
      record.tasks ??
      record.items ??
      record.data ??
      record.workItems ??
      record.work_items ??
      record.list ??
      record.records;
    if (Array.isArray(nested)) {
      return nested.map((item) => normalizeMeegleRecord(item));
    }
    if (nested && typeof nested === "object") {
      try {
        return extractTaskListPayload(nested);
      } catch {
        // Fall back to grouped array extraction for shapes like { "1": [...] }.
      }
      const groupedItems = Object.values(nested).filter(Array.isArray).flat();
      if (groupedItems.length > 0) {
        const records = groupedItems.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
        if (records.length > 0) {
          return records.map((item) => normalizeMeegleRecord(item));
        }
      }
    }
  }
  throw new Error("Meegle task list output does not contain tasks");
}

/**
 * Unwraps `{ data }` envelopes and expands `work_item_attribute`/`work_item_fields` records into flattened keys compatible with {@link normalizeMeegleRecord}.
 */
export function extractTaskDetailPayload(value: unknown): Record<string, unknown> {
  const detail = value && typeof value === "object" && (value as Record<string, unknown>).data && typeof (value as Record<string, unknown>).data === "object"
    ? (value as Record<string, unknown>).data
    : value;
  if (!detail || typeof detail !== "object") {
    return {};
  }
  const record = detail as Record<string, unknown>;

  if (record.work_item_attribute && typeof record.work_item_attribute === "object") {
    const attribute = record.work_item_attribute as Record<string, unknown>;
    const normalized: Record<string, unknown> = {
      work_item_id: attribute.work_item_id,
      name: attribute.work_item_name,
      priority: readNestedStatusName(attribute.work_item_status),
      updated_at: attribute.updated_at ?? attribute.update_time,
      updatedAt: attribute.updatedAt ?? attribute.updateTime,
      project_key: attribute.owned_project && typeof attribute.owned_project === "object"
        ? (attribute.owned_project as Record<string, unknown>).key ?? (attribute.owned_project as Record<string, unknown>).simple_name
        : undefined,
      role_members: attribute.role_members
    };

    if (Array.isArray(record.work_item_fields)) {
      const fields: Record<string, unknown> = {};
      for (const field of record.work_item_fields) {
        indexMeegleWorkitemField(fields, field);
      }
      normalized.fields = fields;
    }

    const result = normalizeMeegleRecord(normalized);
    if (Array.isArray(record.work_item_fields)) {
      result.work_item_fields = record.work_item_fields;
    }
    return result;
  }

  const result = normalizeMeegleRecord(record);
  if (Array.isArray(record.work_item_fields)) {
    result.work_item_fields = record.work_item_fields;
  }
  return result;
}

/** Validates presence of canonical `id`, maps synonymous fields, prepares merge-friendly row for downstream tasks. */
function normalizeMeegleRecord(value: unknown): Record<string, unknown> {
  const normalizedValue = normalizeMoqlRecordIfNeeded(value);
  if (!normalizedValue || typeof normalizedValue !== "object") {
    throw new Error("Meegle task output is missing id");
  }
  const record = normalizedValue as Record<string, unknown>;
  const id = readMeegleString(record, ["id", "workItemId", "work_item_id", "workitem_id", "工作项ID", "工作项id"]);
  if (!id) {
    throw new Error("Meegle task output is missing id");
  }
  const fieldBag = readMeegleFieldBag(record);
  const promotedSpec = promoteSpecFieldValues(fieldBag);
  return {
    id,
    title: readMeegleString(record, ["title", "name", "名称"]) ?? "",
    description: readMeegleString(record, ["description", "desc", "描述"]),
    repo: normalizeRepoUrl(readMeegleString(record, ["repo", "repository", "代码库", "仓库"]) ?? undefined),
    branch: readMeegleString(record, ["branch", "分支"]),
    instruction: readMeegleString(record, ["instruction", "prompt", "指令"]),
    priority: readMeegleString(record, ["priority", "优先级", "status", "状态"]),
    projectKey: readMeegleString(record, ["projectKey", "project_key", "项目key", "空间key"]),
    updated_at: readMeegleString(record, ["updated_at", "updatedAt", "modified_at", "modifiedAt"]),
    ...(Array.isArray(record.role_members) ? { role_members: record.role_members } : {}),
    ...(fieldBag ? { fields: fieldBag } : {}),
    ...promotedSpec
  };
}

/** When CLI returns `{ moql_field_list: [...] }`, materializes keyed map + mirrored `fields` bag for parsers. */
export function normalizeMoqlRecordIfNeeded(value: unknown): unknown {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).moql_field_list)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  const fields: Record<string, unknown> = {};
  for (const entry of (value as Record<string, unknown>).moql_field_list as unknown[]) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const key = unwrapScalar(record.key);
    const name = unwrapScalar(record.name);
    const fieldValue = record.value;
    if (key) {
      normalized[key] = fieldValue;
      fields[key] = fieldValue;
    }
    if (name) {
      normalized[name] = fieldValue;
      fields[name] = fieldValue;
    }
  }
  normalized.fields = fields;
  return normalized;
}

/** Finds grouped MQL search payloads (`data.data["1"][].moql_field_list`) without requiring work item id. */
export function extractMoqlSearchRows(value: unknown): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.moql_field_list)) {
      found.push(record);
      return;
    }
    for (const nested of Object.values(record)) {
      visit(nested);
    }
  };
  let root: unknown = value;
  if (root && typeof root === "object" && (root as Record<string, unknown>).data) {
    root = (root as Record<string, unknown>).data;
  }
  visit(root);
  return found;
}

/** Builds a Meegle `fields` bag from `search_by_mql` / `workitem query` attachment projections. */
export function extractMoqlSearchFieldBag(value: unknown): Record<string, unknown> {
  const rows = extractMoqlSearchRows(value);
  if (rows.length === 0) {
    return {};
  }
  const normalized = normalizeMoqlRecordIfNeeded(rows[0]);
  if (!normalized || typeof normalized !== "object") {
    return {};
  }
  return readMeegleFieldBag(normalized as Record<string, unknown>) ?? {};
}

/** Joins sparse list-row with richer detail GET; metadata objects shallow-merged when both sides expose them. */
export function mergeMeegleTaskRecords(
  listItem: Record<string, unknown>,
  detail: Record<string, unknown>,
  projectKey?: string
): Record<string, unknown> {
  const mergedFieldBag = mergeMeegleFieldBags(
    readMeegleFieldBag(listItem),
    readMeegleFieldBag(detail)
  );
  const workItemFields = Array.isArray(detail.work_item_fields)
    ? detail.work_item_fields
    : Array.isArray(listItem.work_item_fields)
      ? listItem.work_item_fields
      : undefined;
  return {
    id: detail.id ?? listItem.id,
    title: detail.title || listItem.title,
    description: detail.description ?? listItem.description ?? null,
    repo: normalizeRepoUrl(asNonEmptyString(detail.repo ?? listItem.repo) ?? undefined) || null,
    branch: detail.branch ?? listItem.branch ?? null,
    instruction: detail.instruction ?? listItem.instruction ?? null,
    priority: detail.priority ?? listItem.priority ?? null,
    projectKey: detail.projectKey ?? listItem.projectKey ?? projectKey ?? null,
    fields: mergedFieldBag,
    ...promoteSpecFieldValues(mergedFieldBag),
    role_members: detail.role_members ?? listItem.role_members,
    ...(workItemFields ? { work_item_fields: workItemFields } : {}),
    metadata: {
      ...(typeof listItem.metadata === "object" && listItem.metadata !== null ? listItem.metadata as Record<string, unknown> : {}),
      ...(typeof detail.metadata === "object" && detail.metadata !== null ? detail.metadata as Record<string, unknown> : {})
    }
  };
}

export type TaskRepoRef = {
  key: string;
  url: string;
};

export type MultiRepoDescription = {
  repos: TaskRepoRef[];
  branch?: string;
  localPath?: string;
  instruction: string;
};

export type SpecAttachmentRef = {
  name: string;
  localPath?: string;
  url?: string;
  token?: string;
  mimeType?: string;
};

/** Whether a URL points at any feishu.cn host (used as a bare-fetch guard). */
export function isFeishuHostUrl(url: string): boolean {
  try {
    return /(^|\.)feishu\.cn$/i.test(new URL(url.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * Whether a URL is a Feishu project file download link that requires the
 * authenticated Meegle CLI (browser session) to fetch. Covers two known forms:
 * - stream form: `/file/stream/download/<token>` (token embedded in path)
 * - TOS object form: `/goapi/.../tos/file/...` (e.g. checklist `.zip` attachments)
 */
export function isFeishuProjectDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (!/(^|\.)feishu\.cn$/i.test(parsed.hostname)) {
      return false;
    }
    return /\/file\/stream\/download\//i.test(parsed.pathname)
      || /\/tos\/file\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Extracts the legacy stream download token from a Feishu project URL.
 * Only the `/file/stream/download/<token>` form carries such a token; TOS object
 * URLs have no usable token and must be fetched via `attachment +download`.
 */
export function extractFeishuFileTokenFromDownloadUrl(url: string): string | undefined {
  if (!isFeishuProjectDownloadUrl(url)) {
    return undefined;
  }
  try {
    const parsed = new URL(url.trim());
    const match = parsed.pathname.match(/\/file\/stream\/download\/(.+)$/i);
    const raw = match?.[1]?.trim();
    return raw ? decodeURIComponent(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function buildMeegleCliArgs(
  meegle: { authProfile?: string | null; authHost?: string | null },
  args: string[]
): string[] {
  const withGlobal = [...args];
  const authHost = meegle.authHost?.trim();
  if (authHost && args[0] === "auth" && args[1] === "login") {
    withGlobal.push("--host", authHost);
  }
  const authProfile = meegle.authProfile?.trim();
  if (authProfile) {
    withGlobal.push("--profile", authProfile);
  }
  return withGlobal;
}

/** Whether a spec attachment file name has an allowed extension (preflight + materialize). */
export function isAllowedSpecFileName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return (
    lower.endsWith(".md")
    || lower.endsWith(".zip")
    || lower.endsWith(".tar.gz")
    || lower.endsWith(".tgz")
    || lower.endsWith(".json")
    || lower.endsWith(".yaml")
    || lower.endsWith(".yml")
    || lower.endsWith(".txt")
  );
}

/** Normalizes Meegle file names that often omit extensions (e.g. zip uploaded as「spec包」). */
export function finalizeSpecAttachmentName(
  ref: SpecAttachmentRef,
  fieldKey?: string
): SpecAttachmentRef {
  const name = normalizeSpecAttachmentName(ref.name, {
    mimeType: ref.mimeType,
    fieldKey,
    hasToken: Boolean(ref.token)
  });
  return name === ref.name ? ref : { ...ref, name };
}

function normalizeSpecAttachmentName(
  rawName: string,
  hints: { mimeType?: string; fieldKey?: string; hasToken?: boolean }
): string {
  let name = rawName.trim() || "spec";
  if (isAllowedSpecFileName(name)) {
    return name;
  }

  const mime = (hints.mimeType ?? "").toLowerCase();
  if (mime.includes("zip")) {
    return ensureSpecFileExtension(name, ".zip");
  }
  if (mime.includes("gzip") || mime.includes("tar")) {
    return ensureSpecFileExtension(name, ".tar.gz");
  }
  if (mime.includes("markdown") || mime === "text/plain") {
    return ensureSpecFileExtension(name, ".md");
  }
  if (mime.includes("json")) {
    return ensureSpecFileExtension(name, ".json");
  }

  const fromSpecField = hints.fieldKey
    ? SPEC_FIELD_KEYS.includes(hints.fieldKey) || isSpecLikeFieldLabel(hints.fieldKey)
    : false;
  if (fromSpecField && !extname(name) && hints.hasToken) {
    return `${name}.zip`;
  }
  if (/\bzip\b/i.test(name) || name.includes("压缩")) {
    return ensureSpecFileExtension(name, ".zip");
  }

  return name;
}

function ensureSpecFileExtension(base: string, ext: string): string {
  const lower = base.toLowerCase();
  if (lower.endsWith(ext)) {
    return base;
  }
  if (ext === ".zip" && lower.endsWith(".tar.gz")) {
    return base;
  }
  return `${base}${ext}`;
}

/** Normalizes `metadata.specAttachments` into typed attachment refs. */
export function readTaskSpecAttachments(task: TitingTask): SpecAttachmentRef[] {
  const raw = task.metadata.specAttachments;
  if (!Array.isArray(raw)) {
    return [];
  }
  const attachments: SpecAttachmentRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    attachments.push(finalizeSpecAttachmentName({
      name: typeof record.name === "string" ? record.name : "spec",
      localPath: typeof record.localPath === "string" ? record.localPath : undefined,
      url: typeof record.url === "string" ? record.url : undefined,
      token: typeof record.token === "string" ? record.token : undefined,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined
    }, "spec文档"));
  }
  return attachments;
}

/** Derives a filesystem-safe directory name from a git remote URL. */
export function resolveRepoSlug(url: string): string {
  const normalized = url.replace(/\.git$/i, "").trim();
  const segment = normalized.split("/").filter(Boolean).pop() ?? "repo";
  return segment.replace(/[^a-zA-Z0-9._-]+/g, "-") || "repo";
}

/** Reads repository list from task metadata or falls back to primary `task.repo`. */
export function readTaskRepos(task: TitingTask): TaskRepoRef[] {
  const raw = task.metadata.repos;
  if (Array.isArray(raw)) {
    const repos = raw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Record<string, unknown>;
        const url = normalizeRepoUrl(asNonEmptyString(record.url) ?? "");
        const key = asNonEmptyString(record.key) ?? "Repo1";
        return url ? { key, url } : null;
      })
      .filter((item): item is TaskRepoRef => Boolean(item));
    if (repos.length > 0) {
      return repos;
    }
  }
  if (task.repo.trim()) {
    return [{ key: "Repo1", url: normalizeRepoUrl(task.repo) }];
  }
  return [];
}

/** Parses `Repo1..N` / legacy `Repo:` blocks with `---` separated instruction body. */
export function parseMultiRepoDescriptionBlock(description: string): MultiRepoDescription {
  const normalized = normalizeDescriptionBlockText(description);
  const separator = normalized.match(/\n\s*---\s*\n/);
  if (!separator || separator.index === undefined) {
    throw new Error("description missing metadata separator");
  }
  const header = normalized.slice(0, separator.index).split("\n");
  const instruction = normalized.slice(separator.index + separator[0].length).trim();
  if (!instruction) {
    throw new Error("description missing instruction");
  }

  const repos: TaskRepoRef[] = [];
  let branch: string | undefined;
  let localPath: string | undefined;
  let pendingRepoKey: string | null = null;

  for (const rawLine of header) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const numberedRepo = line.match(/^Repo\s*(\d+)\s*:\s*(.*)$/i);
    if (numberedRepo) {
      pendingRepoKey = `Repo${numberedRepo[1]}`;
      const inline = normalizeMetadataValue(numberedRepo[2] ?? "");
      if (inline) {
        repos.push({ key: pendingRepoKey, url: normalizeRepoUrl(inline) });
        pendingRepoKey = null;
      }
      continue;
    }
    if (/^Repo\s*:\s*$/i.test(line)) {
      pendingRepoKey = "Repo1";
      continue;
    }
    if (line.startsWith("Repo:")) {
      const inline = normalizeMetadataValue(line.slice("Repo:".length));
      if (inline) {
        repos.push({ key: "Repo1", url: normalizeRepoUrl(inline) });
        pendingRepoKey = null;
      } else {
        pendingRepoKey = "Repo1";
      }
      continue;
    }
    if (pendingRepoKey) {
      const url = normalizeRepoUrl(normalizeMetadataValue(line));
      if (url) {
        repos.push({ key: pendingRepoKey, url });
        pendingRepoKey = null;
      }
      continue;
    }
    if (line.startsWith("Branch:")) {
      branch = normalizeMetadataValue(line.slice("Branch:".length)) || undefined;
      continue;
    }
    if (line.startsWith("LocalPath:")) {
      localPath = normalizeMetadataValue(line.slice("LocalPath:".length)) || undefined;
      continue;
    }
    if (line === "Constraints:" || line.startsWith("- ")) {
      continue;
    }
  }

  if (repos.length === 0) {
    throw new Error("description missing repo");
  }

  return {
    repos,
    branch,
    localPath: localPath ? resolve(localPath) : undefined,
    instruction
  };
}

/** Converts Meegle rich-text HTML snippets into the plain block format parsed below. */
function normalizeDescriptionBlockText(description: string): string {
  return description
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SPEC_FIELD_KEYS = ["spec文档", "spec_doc", "specDocs", "spec_documents"];

/** Meegle text fields that must never be interpreted as file attachments. */
const NON_ATTACHMENT_FIELD_KEYS = new Set([
  "description",
  "desc",
  "描述",
  "instruction",
  "prompt",
  "指令",
  "repo",
  "repository",
  "代码库",
  "仓库",
  "branch",
  "分支",
  "title",
  "name",
  "名称",
  "priority",
  "优先级",
  "status",
  "状态"
]);

/** Extracts spec attachment references from Meegle row fields and metadata. */
export function extractSpecAttachmentsFromRow(row: Record<string, unknown>): SpecAttachmentRef[] {
  const attachments: SpecAttachmentRef[] = [];
  attachments.push(...extractSpecAttachmentsFromWorkitemFields(row.work_item_fields));
  for (const key of SPEC_FIELD_KEYS) {
    const raw = readMeegleFieldValue(row, [key]);
    attachments.push(...normalizeSpecAttachmentValue(raw, key));
  }
  const fieldBag = readMeegleFieldBag(row);
  if (fieldBag) {
    for (const [fieldKey, raw] of Object.entries(fieldBag)) {
      if (isNonAttachmentFieldKey(fieldKey)) {
        continue;
      }
      if (isMeegleSpecFieldLabel(fieldKey)) {
        attachments.push(...normalizeSpecAttachmentValue(raw, fieldKey));
        continue;
      }
      attachments.push(...extractMeegleFileAttachments(raw, 0, fieldKey));
    }
  }
  if (typeof row.metadata === "object" && row.metadata !== null) {
    const metadata = row.metadata as Record<string, unknown>;
    if (Array.isArray(metadata.specAttachments)) {
      for (const item of metadata.specAttachments) {
        attachments.push(...normalizeSpecAttachmentValue(item));
      }
    }
    if (Array.isArray(metadata.specDocumentPaths)) {
      for (const pathValue of metadata.specDocumentPaths) {
        const localPath = asNonEmptyString(pathValue);
        if (localPath) {
          attachments.push(finalizeSpecAttachmentName({ name: basename(localPath), localPath }, "spec文档"));
        }
      }
    }
  }
  const deduped = new Map<string, SpecAttachmentRef>();
  for (const item of attachments) {
    const fingerprint = `${item.name}|${item.localPath ?? ""}|${item.url ?? ""}|${item.token ?? ""}`;
    if (!deduped.has(fingerprint)) {
      deduped.set(fingerprint, item);
    }
  }
  return [...deduped.values()];
}

/** Whether a Meegle field key or display name should be treated as the spec attachment field. */
export function isMeegleSpecFieldLabel(key: string, displayName?: string): boolean {
  if (SPEC_FIELD_KEYS.includes(key) || isSpecLikeFieldLabel(key)) {
    return true;
  }
  if (displayName && (SPEC_FIELD_KEYS.includes(displayName) || isSpecLikeFieldLabel(displayName))) {
    return true;
  }
  return false;
}

/**
 * Extracts a flat `fields` bag from Meegle `workitem get` output.
 * Supports envelope+brief (`work_item_fields`) and non-envelope JSON (top-level `fields`).
 */
export function extractWorkitemFieldsBag(value: unknown): Record<string, unknown> {
  let record: Record<string, unknown> = {};
  if (value && typeof value === "object") {
    const root = value as Record<string, unknown>;
    record = root.data && typeof root.data === "object"
      ? root.data as Record<string, unknown>
      : root;
  }
  if (record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)) {
    return record.fields as Record<string, unknown>;
  }
  if (Array.isArray(record.work_item_fields)) {
    const bag: Record<string, unknown> = {};
    for (const field of record.work_item_fields) {
      indexMeegleWorkitemField(bag, field);
    }
    return bag;
  }
  return readMeegleFieldBag(record) ?? {};
}

/** Merges a supplemental Meegle `fields` bag onto a hydrated workitem row. */
export function mergeMeegleFieldsIntoRow(
  row: Record<string, unknown>,
  fieldsBag: Record<string, unknown>
): Record<string, unknown> {
  const merged = mergeMeegleFieldBags(readMeegleFieldBag(row), fieldsBag);
  return {
    ...row,
    fields: merged,
    ...promoteSpecFieldValues(merged)
  };
}

/** Parses raw `work_item_fields` from Meegle detail (avoids lossy flattening). */
function extractSpecAttachmentsFromWorkitemFields(fields: unknown): SpecAttachmentRef[] {
  if (!Array.isArray(fields)) {
    return [];
  }
  const attachments: SpecAttachmentRef[] = [];
  for (const field of fields) {
    if (!field || typeof field !== "object") {
      continue;
    }
    const record = field as Record<string, unknown>;
    const displayName =
      asNonEmptyString(record.name)
      ?? asNonEmptyString(record.field_name)
      ?? asNonEmptyString(record.fieldName)
      ?? "";
    const fieldKey =
      asNonEmptyString(record.key)
      ?? asNonEmptyString(record.field_key)
      ?? asNonEmptyString(record.fieldKey)
      ?? displayName
      ?? asNonEmptyString(record.field_alias)
      ?? "field";
    const specField = isMeegleSpecFieldLabel(fieldKey, displayName);
    if (isNonAttachmentFieldKey(fieldKey) && !specField && !isFileLikeWorkitemField(record)) {
      continue;
    }
    if (!specField && !isFileLikeWorkitemField(record)) {
      continue;
    }
    const payload = unwrapMeegleFieldPayload(record);
    const labelKey = specField && displayName ? displayName : fieldKey;
    attachments.push(...normalizeSpecAttachmentValue(payload, labelKey));
  }
  return attachments;
}

function isFileLikeWorkitemField(field: Record<string, unknown>): boolean {
  const typeKey = (asNonEmptyString(field.field_type_key) ?? asNonEmptyString(field.field_type) ?? "").toLowerCase();
  return typeKey.includes("file") || typeKey.includes("attach") || typeKey.includes("upload");
}

function unwrapMeegleFieldPayload(field: Record<string, unknown>): unknown {
  let current: unknown = field.field_value ?? field.fieldValue ?? field.value ?? field;
  for (let depth = 0; depth < 6; depth += 1) {
    if (current === null || current === undefined) {
      return current;
    }
    if (typeof current === "string" || Array.isArray(current)) {
      return current;
    }
    if (typeof current !== "object") {
      return current;
    }
    const record = current as Record<string, unknown>;
    if (
      record.file_token
      || record.fileToken
      || record.file_list
      || record.files
      || record.fileList
      || record.drive_files
      || Array.isArray(record)
    ) {
      return current;
    }
    const inner = record.field_value ?? record.fieldValue ?? record.value;
    if (inner === undefined || inner === current) {
      return current;
    }
    current = inner;
  }
  return current;
}

function normalizeSpecAttachmentValue(value: unknown, fieldKey?: string): SpecAttachmentRef[] {
  if (!value) {
    return [];
  }
  const fromMeegleFiles = extractMeegleFileAttachments(value, 0, fieldKey);
  if (fromMeegleFiles.length > 0) {
    return fromMeegleFiles;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return normalizeSpecAttachmentValue(parsed, fieldKey);
    } catch {
      if (trimmed.startsWith("/") || trimmed.startsWith(".")) {
        return [finalizeSpecAttachmentName({ name: basename(trimmed), localPath: trimmed }, fieldKey)];
      }
      if (looksLikeHttpUrl(trimmed)) {
        const urlName = basename(new URL(trimmed).pathname) || "spec";
        return [finalizeSpecAttachmentName({ name: urlName, url: trimmed }, fieldKey)];
      }
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeSpecAttachmentValue(item, fieldKey));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const built = buildSpecAttachmentFromMeegleRecord(record);
    if (built) {
      return [finalizeSpecAttachmentName(built, fieldKey)];
    }
    for (const nestedKey of ["value", "file_list", "files", "fileList", "attachment_list", "key_label_value_list"]) {
      if (record[nestedKey] !== undefined) {
        const nested = normalizeSpecAttachmentValue(record[nestedKey], fieldKey);
        if (nested.length > 0) {
          return nested;
        }
      }
    }
  }
  return [];
}

function buildSpecAttachmentFromMeegleRecord(record: Record<string, unknown>): SpecAttachmentRef | null {
  const nameFromLabel = asNonEmptyString(record.label);
  const name =
    nameFromLabel
    ?? asNonEmptyString(record.name)
    ?? asNonEmptyString(record.fileName)
    ?? asNonEmptyString(record.filename)
    ?? asNonEmptyString(record.file_name)
    ?? asNonEmptyString(record.display_name)
    ?? asNonEmptyString(record.displayName)
    ?? asNonEmptyString(record.origin_name)
    ?? asNonEmptyString(record.title)
    ?? "spec";
  const mimeType =
    asNonEmptyString(record.mime_type)
    ?? asNonEmptyString(record.mimeType)
    ?? asNonEmptyString(record.content_type)
    ?? asNonEmptyString(record.contentType);
  const localPath = asNonEmptyString(record.localPath) ?? asNonEmptyString(record.path);
  const keyAsUrl = asNonEmptyString(record.key);
  const url =
    asNonEmptyString(record.url)
    ?? asNonEmptyString(record.download_url)
    ?? (keyAsUrl && looksLikeHttpUrl(keyAsUrl) ? keyAsUrl : null);
  let token =
    asNonEmptyString(record.token)
    ?? asNonEmptyString(record.file_token)
    ?? asNonEmptyString(record.fileToken)
    ?? asNonEmptyString(record.uid)
    ?? asNonEmptyString(record.attachment_token);
  if (!token && url) {
    token = extractFeishuFileTokenFromDownloadUrl(url) ?? null;
  }
  if (!localPath && !url && !token) {
    return null;
  }
  return {
    name,
    mimeType: mimeType ?? undefined,
    localPath: localPath ?? undefined,
    url: url ?? undefined,
    token: token ?? undefined
  };
}

/** Parses Feishu/Meegle file-field payloads (`file_token`, `file_list`, etc.). */
function extractMeegleFileAttachments(value: unknown, depth = 0, fieldKey?: string): SpecAttachmentRef[] {
  if (!value || depth > 6) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractMeegleFileAttachments(item, depth + 1, fieldKey));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      return extractMeegleFileAttachments(JSON.parse(trimmed) as unknown, depth + 1, fieldKey);
    } catch {
      return [];
    }
  }
  if (typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const built = buildSpecAttachmentFromMeegleRecord(record);
  if (built) {
    return [finalizeSpecAttachmentName(built, fieldKey)];
  }
  for (const nestedKey of [
    "file_list",
    "files",
    "fileList",
    "value",
    "attachment_list",
    "key_label_value_list",
    "file_list_value",
    "multi_file_value",
    "drive_files",
    "driveFiles",
    "data"
  ]) {
    if (record[nestedKey] !== undefined) {
      const nested = extractMeegleFileAttachments(record[nestedKey], depth + 1, fieldKey);
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const found = extractMeegleFileAttachments(nested, depth + 1, fieldKey);
      if (found.length > 0) {
        return found;
      }
    }
  }
  return [];
}

function indexMeegleWorkitemField(fields: Record<string, unknown>, field: unknown): void {
  if (!field || typeof field !== "object") {
    return;
  }
  const fieldRecord = field as Record<string, unknown>;
  const value = unwrapMeegleFieldPayload(fieldRecord);
  const aliases = new Set(
    [
      unwrapScalar(fieldRecord.key),
      unwrapScalar(fieldRecord.field_key),
      unwrapScalar(fieldRecord.fieldKey),
      unwrapScalar(fieldRecord.name),
      unwrapScalar(fieldRecord.field_name),
      unwrapScalar(fieldRecord.fieldName),
      unwrapScalar(fieldRecord.field_alias),
      unwrapScalar(fieldRecord.label)
    ].filter((item): item is string => Boolean(item))
  );
  for (const alias of aliases) {
    fields[alias] = value;
  }
}

function isNonAttachmentFieldKey(fieldKey: string): boolean {
  return NON_ATTACHMENT_FIELD_KEYS.has(fieldKey);
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function isSpecLikeFieldLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return (
    label.includes("spec文档")
    || lower.includes("spec_doc")
    || lower.includes("specdocs")
    || lower === "spec"
    || /^spec[_\s-]/i.test(label)
    || /[_\s-]spec$/i.test(label)
  );
}

export function readMeegleFieldBag(record: Record<string, unknown>): Record<string, unknown> | null {
  for (const containerKey of ["fields", "field_values", "fieldValues", "custom_fields", "customFields"]) {
    const container = record[containerKey];
    if (container && typeof container === "object" && !Array.isArray(container)) {
      return container as Record<string, unknown>;
    }
  }
  return null;
}

export function mergeMeegleFieldBags(
  ...bags: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};
  for (const bag of bags) {
    if (!bag) {
      continue;
    }
    Object.assign(merged, bag);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function promoteSpecFieldValues(fieldBag: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!fieldBag) {
    return {};
  }
  const promoted: Record<string, unknown> = {};
  for (const key of SPEC_FIELD_KEYS) {
    if (fieldBag[key] !== undefined) {
      promoted[key] = fieldBag[key];
    }
  }
  return promoted;
}

/** Reads a raw Meegle field value from top-level keys or nested `fields` bags. */
export function readMeegleFieldValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  const fieldBag = readMeegleFieldBag(record);
  if (!fieldBag) {
    return undefined;
  }
  for (const key of keys) {
    if (fieldBag[key] !== undefined && fieldBag[key] !== null) {
      return fieldBag[key];
    }
  }
  if (typeof record.metadata === "object" && record.metadata !== null) {
    const metadata = record.metadata as Record<string, unknown>;
    for (const key of keys) {
      if (metadata[key] !== undefined && metadata[key] !== null) {
        return metadata[key];
      }
    }
  }
  return undefined;
}

/** Reads a Meegle custom field as a normalized string for filters and comparisons. */
export function readMeegleFieldAsString(record: Record<string, unknown>, fieldName: string): string | null {
  return collectMeegleFieldStrings(readMeegleFieldValue(record, [fieldName]))[0] ?? null;
}

/** Collects display strings from Meegle field payloads (scalars, user objects, option lists). */
export function collectMeegleFieldStrings(value: unknown): string[] {
  const direct = unwrapScalar(value);
  if (direct) {
    return [direct];
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const keys = [
    "name",
    "label",
    "text",
    "display_value",
    "displayValue",
    "value",
    "name_cn",
    "nameCn",
    "chinese_name",
    "chineseName",
    "nick_name",
    "nickName",
    "real_name",
    "realName",
    "user_name",
    "userName",
    "email"
  ];
  const found = new Set<string>();
  for (const key of keys) {
    const nested = unwrapScalar(record[key]);
    if (nested) {
      found.add(nested);
    }
  }
  if (Array.isArray(record.users)) {
    for (const user of record.users) {
      for (const item of collectMeegleFieldStrings(user)) {
        found.add(item);
      }
    }
  }
  if (Array.isArray(record.key_label_value_list)) {
    for (const item of record.key_label_value_list) {
      for (const nested of collectMeegleFieldStrings(item)) {
        found.add(nested);
      }
    }
  }
  return [...found];
}

/** True when any extracted display string equals the expected board/person label. */
export function meegleFieldMatchesExpected(value: unknown, expected: string): boolean {
  const target = expected.trim();
  if (!target) {
    return true;
  }
  return collectMeegleFieldStrings(value).some((item) => item.trim() === target);
}

function mergeTaskMetadata(
  task: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = typeof task.metadata === "object" && task.metadata !== null
    ? task.metadata as Record<string, unknown>
    : {};
  return { ...base, ...patch };
}

function tryParseMultiRepoDescription(description: string | null | undefined): MultiRepoDescription | null {
  if (!description?.trim()) {
    return null;
  }
  try {
    return parseMultiRepoDescriptionBlock(description);
  } catch {
    return null;
  }
}

/** When repo/instruction omitted, parses Meegle description block separated by `---` for Repo1..N metadata. */
export function applyDescriptionFallback(task: Record<string, unknown>): Record<string, unknown> {
  const repo = asNonEmptyString(task.repo);
  const instruction = asNonEmptyString(task.instruction);
  const description = asNonEmptyString(task.description) ?? asNonEmptyString(task.描述);
  const specAttachments = extractSpecAttachmentsFromRow(task);
  const metadataPatch: Record<string, unknown> = {};
  if (specAttachments.length > 0) {
    metadataPatch.specAttachments = specAttachments;
  }

  // Prefer multi-repo block in 描述 even when Meegle also fills single-repo `repo` + `instruction` fields.
  const parsedFromDescription = tryParseMultiRepoDescription(description);
  if (parsedFromDescription) {
    return {
      ...task,
      metadata: mergeTaskMetadata(task, { ...metadataPatch, repos: parsedFromDescription.repos }),
      repo: parsedFromDescription.repos[0]?.url ?? repo ?? "",
      branch: normalizeStoredBranch(asNonEmptyString(task.branch) || parsedFromDescription.branch),
      instruction: instruction || parsedFromDescription.instruction
    };
  }

  if (repo && instruction) {
    const repos: TaskRepoRef[] = [{ key: "Repo1", url: normalizeRepoUrl(repo) }];
    return {
      ...task,
      metadata: mergeTaskMetadata(task, { ...metadataPatch, repos }),
      repo: repos[0].url,
      instruction
    };
  }

  if (specAttachments.length > 0) {
    return { ...task, metadata: mergeTaskMetadata(task, metadataPatch) };
  }
  return task;
}

/** Looks up camel/snake/zh keys on Meegle objects, including nested `fields` blobs from detail APIs. */
function readMeegleString(value: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const direct = unwrapScalar(value[key]);
    if (direct) {
      return direct;
    }
  }

  for (const containerKey of ["fields", "field_values", "fieldValues", "custom_fields", "customFields"]) {
    const container = value[containerKey];
    if (!container || typeof container !== "object") {
      continue;
    }
    const record = container as Record<string, unknown>;
    for (const key of keys) {
      const nested = unwrapScalar(record[key]);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

/** Coerces Meegle field wrapper objects (`value`, `display_value`, etc.) down to display strings. */
function unwrapScalar(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => unwrapScalar(item)).filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(", ") : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of [
    "value",
    "text",
    "label",
    "name",
    "name_cn",
    "nameCn",
    "chinese_name",
    "chineseName",
    "nick_name",
    "nickName",
    "real_name",
    "realName",
    "user_name",
    "userName",
    "display_value",
    "displayValue",
    "string_value",
    "long_value",
    "double_value",
    "float_value",
    "bool_value",
    "key_label_value_list"
  ]) {
    const nested = unwrapScalar(record[key]);
    if (nested) {
      return nested;
    }
  }
  return null;
}

/** Extracts human-readable status label from nested status objects in work item attributes. */
function readNestedStatusName(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return unwrapScalar(record.name) ?? unwrapScalar(record.status_name) ?? unwrapScalar(record.label);
}

/** Preserves explicit branch metadata and leaves blanks unset for downstream defaulting. */
function normalizeStoredBranch(branch?: string | null): string | null {
  return branch?.trim() || null;
}

/** Detects legacy `task` subcommand missing on newer CLIs so {@link MeegleTaskIntegrationPlugin.tryPullLegacyCliTasks} can bail out. */
export function shouldFallbackToWorkitemCli(args: string[], result: CommandResult): boolean {
  const stderr = result.stderr || "";
  const stdout = result.stdout || "";
  return args[0] === "task" && /unknown command|command not found/i.test(`${stderr}\n${stdout}`);
}

/** Keeps Meegle comment API payloads within typical UI limits. */
function truncateMeegleComment(value: string): string {
  return value.length > 2000 ? `${value.slice(0, 2000)}\n...[truncated]` : value;
}

/** @deprecated Use {@link parseMultiRepoDescriptionBlock}; kept for tests referencing legacy shape. */
export function parseDescriptionBlock(description: string): {
  repo: string;
  branch?: string;
  localPath?: string;
  instruction: string;
} {
  const parsed = parseMultiRepoDescriptionBlock(description);
  return {
    repo: parsed.repos[0]?.url ?? "",
    branch: parsed.branch,
    localPath: parsed.localPath,
    instruction: parsed.instruction
  };
}

/** Strips markdown link syntax so `Repo:` lines accept `[text](url)` style inputs. */
function normalizeMetadataValue(value: string): string {
  const trimmed = value.trim();
  const markdownLink = trimmed.match(/^\[(.+?)\]\((.+?)\)$/);
  if (markdownLink) {
    return markdownLink[2].trim();
  }
  return trimmed;
}

/** Null-safe trimming guard used across CLI field coercion. */
export function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Parses task constraint / acceptance bullet lists while dropping blanks. */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/** Normalizes textual/Pn-ish priority indicators into coarse high/medium/low buckets. */
function asTaskPriority(value: unknown): TitingTask["priority"] {
  const normalized = asNonEmptyString(value)?.toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  if (normalized === "p0" || normalized === "p1") {
    return "high";
  }
  if (normalized === "p2" || normalized === "p3") {
    return "medium";
  }
  if (normalized && /^p[4-9]$/.test(normalized)) {
    return "low";
  }
  return "medium";
}
