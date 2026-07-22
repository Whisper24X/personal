import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PreparedWorkspace, PullRequestRecord, TitingTask } from "@diting/plugin-api";
import { ServerConfig } from "../config";
import { detectDefaultBaseBranch, normalizeRepoUrl, runCommand } from "./shared";

export { detectDefaultBaseBranch };

export type PullRequestProvider = "github" | "gitlab" | "unknown";

export type PullRequestCreateCommand = {
  bin: string;
  args: string[];
  successDetail: string;
  failureDetail: string;
};

export async function createPullRequestsForTask(
  task: TitingTask,
  workspace: PreparedWorkspace,
  config: ServerConfig
): Promise<PullRequestRecord[]> {
  const timeoutMs = config.goalRecovery.executionTimeoutMs;
  const records: PullRequestRecord[] = [];

  for (const repo of workspace.repos) {
    const provider = detectPullRequestProvider(repo.url);
    const base = await detectDefaultBaseBranch(repo.path, timeoutMs, {
      fallback: config.workspace.prBaseBranchFallback ?? undefined
    });
    const hasChanges = await hasWorkingTreeChanges(repo.path, timeoutMs, workspace.env);
    if (!hasChanges) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base,
        skipped: true,
        detail: "No local changes"
      });
      continue;
    }

    const stage = await stageChanges(repo.path, timeoutMs, workspace.env);
    if (stage.exitCode !== 0) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base,
        skipped: false,
        detail: commandDetail(stage, "git add failed")
      });
      continue;
    }

    const hasStaged = await hasStagedChanges(repo.path, timeoutMs, workspace.env);
    if (!hasStaged) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base,
        skipped: true,
        detail: "No committable changes"
      });
      continue;
    }

    const commit = await commitStagedChanges(repo.path, task, workspace, config);
    if (commit.exitCode !== 0) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base,
        skipped: false,
        detail: commandDetail(commit, "git commit failed")
      });
      continue;
    }

    const commitSha = await readHeadSha(repo.path, timeoutMs, workspace.env);
    if (!commitSha) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base,
        skipped: false,
        detail: "Unable to resolve committed HEAD"
      });
      continue;
    }

    const push = await pushTaskBranch(repo.url, repo.path, task.branch, timeoutMs, workspace.env);
    if (push.exitCode !== 0) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base,
        skipped: false,
        detail: commandDetail(push, "git push failed"),
        commitSha,
        pushDetail: commandDetail(push, "git push failed")
      });
      continue;
    }

    const mergeBranch = await detectMergeTargetBranch(repo.path, timeoutMs, workspace.env);
    if (!mergeBranch) {
      const missingDetail = "Merge branch missing: develop or test";
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base: "",
        skipped: false,
        detail: missingDetail,
        commitSha,
        pushDetail: commandDetail(push, "Branch pushed"),
        prDetail: missingDetail
      });
      continue;
    }

    const command = buildPullRequestCreateCommand({
      provider,
      branch: task.branch,
      base: mergeBranch,
      title: task.title,
      body: buildPullRequestBody(task),
      gitlabBin: config.plugins.gitlab.cliBin
    });
    if (!command) {
      records.push({
        repoKey: repo.key,
        url: repo.url,
        provider,
        prUrl: null,
        branch: task.branch,
        base: mergeBranch,
        skipped: false,
        detail: `Unsupported pull request provider for repository: ${repo.url}`,
        commitSha,
        pushDetail: commandDetail(push, "Branch pushed")
      });
      continue;
    }

    const pr = await runCommand(
      command.bin,
      command.args,
      repo.path,
      timeoutMs,
      provider === "gitlab"
        ? { ...workspace.env, GITLAB_HOST: config.plugins.gitlab.host }
        : workspace.env
    );
    const prUrl = extractPrUrl(pr.stdout) ?? extractPrUrl(pr.stderr);
    records.push({
      repoKey: repo.key,
      url: repo.url,
      provider,
      prUrl: pr.exitCode === 0 ? prUrl : null,
      branch: task.branch,
      base: mergeBranch,
      skipped: false,
      detail: pr.exitCode === 0 ? command.successDetail : commandDetail(pr, command.failureDetail),
      commitSha,
      pushDetail: commandDetail(push, "Branch pushed"),
      prDetail: pr.exitCode === 0 ? command.successDetail : commandDetail(pr, command.failureDetail)
    });
  }

  await writeFile(join(workspace.artifactsPath, "prs.json"), JSON.stringify(records, null, 2));
  return records;
}

function buildPullRequestBody(task: TitingTask): string {
  const quality = readQualityMetadata(task.metadata);
  if (!quality) {
    return task.instruction.slice(0, 4000);
  }
  const checks = quality.checks
    .map((check) => `- ${check.name}: ${check.passed ? "passed" : "failed"} - ${check.detail}`)
    .join("\n");
  const qualitySection = [
    "## Quality Risk",
    "",
    `- riskLevel: ${quality.riskLevel}`,
    `- score: ${quality.score}`,
    ...(checks ? ["", checks] : [])
  ].join("\n");
  const separator = "\n\n";
  const baseLimit = Math.max(0, 4000 - separator.length - qualitySection.length);
  return [
    task.instruction.slice(0, baseLimit),
    qualitySection
  ].filter(Boolean).join(separator).slice(0, 4000);
}

function readQualityMetadata(metadata: Record<string, unknown>): {
  riskLevel: string;
  score: number;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
} | null {
  const quality = metadata.quality;
  if (!quality || typeof quality !== "object") {
    return null;
  }
  const value = quality as Record<string, unknown>;
  const riskLevel = value.riskLevel;
  const score = value.score;
  const rawChecks = value.checks;
  if (typeof riskLevel !== "string" || typeof score !== "number") {
    return null;
  }
  const checks = Array.isArray(rawChecks)
    ? rawChecks.flatMap((check) => {
      if (!check || typeof check !== "object") {
        return [];
      }
      const item = check as Record<string, unknown>;
      return typeof item.name === "string" && typeof item.passed === "boolean" && typeof item.detail === "string"
        ? [{ name: item.name, passed: item.passed, detail: item.detail }]
        : [];
    })
    : [];
  return { riskLevel, score, checks };
}

export function detectPullRequestProvider(repoUrl: string): PullRequestProvider {
  const host = extractRepoHost(repoUrl);
  if (!host) {
    return "unknown";
  }
  if (isGithubHost(host)) {
    return "github";
  }
  if (isGitlabHost(host)) {
    return "gitlab";
  }
  return "unknown";
}

export function buildPullRequestCreateCommand(input: {
  provider: PullRequestProvider;
  branch: string;
  base: string;
  title: string;
  body: string;
  gitlabBin?: string;
}): PullRequestCreateCommand | null {
  if (input.provider === "github") {
    return {
      bin: "gh",
      args: [
        "pr",
        "create",
        "--head",
        input.branch,
        "--base",
        input.base,
        "--title",
        input.title,
        "--body",
        input.body
      ],
      successDetail: "PR created",
      failureDetail: "gh pr create failed"
    };
  }
  if (input.provider === "gitlab") {
    return {
      bin: input.gitlabBin ?? "glab",
      args: [
        "mr",
        "create",
        "--source-branch",
        input.branch,
        "--target-branch",
        input.base,
        "--title",
        input.title,
        "--description",
        input.body
      ],
      successDetail: "MR created",
      failureDetail: "glab mr create failed"
    };
  }
  return null;
}

async function hasWorkingTreeChanges(
  repoPath: string,
  timeoutMs: number,
  env: Record<string, string>
): Promise<boolean> {
  const status = await runCommand("git", ["-C", repoPath, "status", "--porcelain"], repoPath, timeoutMs, env);
  return status.stdout.trim().length > 0;
}

function stageChanges(repoPath: string, timeoutMs: number, env: Record<string, string>) {
  return runCommand("git", ["-C", repoPath, "add", "-A"], repoPath, timeoutMs, env);
}

async function hasStagedChanges(repoPath: string, timeoutMs: number, env: Record<string, string>): Promise<boolean> {
  const diff = await runCommand("git", ["-C", repoPath, "diff", "--cached", "--quiet"], repoPath, timeoutMs, env);
  return diff.exitCode === 1;
}

async function commitStagedChanges(
  repoPath: string,
  task: TitingTask,
  workspace: PreparedWorkspace,
  config: ServerConfig
) {
  const timeoutMs = config.goalRecovery.executionTimeoutMs;
  const env = workspace.env;
  const stagedFiles = await readStagedFiles(repoPath, timeoutMs, env);
  const message = await buildTaskCommitMessage(repoPath, task, stagedFiles, workspace, config);
  return runCommand(
    "git",
    ["-C", repoPath, "commit", "-m", message.subject, "-m", message.body],
    repoPath,
    timeoutMs,
    env
  );
}

async function readHeadSha(repoPath: string, timeoutMs: number, env: Record<string, string>): Promise<string | null> {
  const head = await runCommand("git", ["-C", repoPath, "rev-parse", "HEAD"], repoPath, timeoutMs, env);
  if (head.exitCode !== 0) {
    return null;
  }
  const sha = head.stdout.trim();
  return sha || null;
}

function pushTaskBranch(
  repoUrl: string,
  repoPath: string,
  branch: string,
  timeoutMs: number,
  env: Record<string, string>
) {
  return runCommand("git", ["-C", repoPath, "push", repoUrl, `HEAD:refs/heads/${branch}`], repoPath, timeoutMs, env);
}

async function detectMergeTargetBranch(
  repoPath: string,
  timeoutMs: number,
  env: Record<string, string>
): Promise<string | null> {
  for (const branch of ["develop", "test"]) {
    if (await branchExists(repoPath, branch, timeoutMs, env)) {
      return branch;
    }
  }
  return null;
}

async function branchExists(
  repoPath: string,
  branch: string,
  timeoutMs: number,
  env: Record<string, string>
): Promise<boolean> {
  for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`]) {
    const result = await runCommand("git", ["-C", repoPath, "show-ref", "--verify", "--quiet", ref], repoPath, timeoutMs, env);
    if (result.exitCode === 0) {
      return true;
    }
  }
  return false;
}

async function readStagedFiles(repoPath: string, timeoutMs: number, env: Record<string, string>): Promise<string[]> {
  const result = await runCommand("git", ["-C", repoPath, "diff", "--cached", "--name-only"], repoPath, timeoutMs, env);
  if (result.exitCode !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function buildTaskCommitMessage(
  repoPath: string,
  task: TitingTask,
  stagedFiles: string[],
  workspace: PreparedWorkspace,
  config: ServerConfig
): Promise<{ subject: string; body: string }> {
  const generated = await generateCommitMessageWithAgent(repoPath, task, stagedFiles, workspace, config);
  if (generated) {
    return generated;
  }
  return {
    subject: buildTaskCommitSubject(task, stagedFiles),
    body: buildTaskCommitBody(task)
  };
}

async function generateCommitMessageWithAgent(
  repoPath: string,
  task: TitingTask,
  stagedFiles: string[],
  workspace: PreparedWorkspace,
  config: ServerConfig
): Promise<{ subject: string; body: string } | null> {
  const agent = config.plugins.execution.commitMessageAgent;
  if (agent === "heuristic") {
    return null;
  }
  const timeoutMs = config.goalRecovery.executionTimeoutMs;
  const diff = await readStagedDiff(repoPath, timeoutMs, workspace.env, config.governance.maxDiffLines);
  const prompt = buildCommitMessageAgentPrompt(task, stagedFiles, diff);
  const command = buildCommitMessageAgentCommand(agent, prompt, workspace, config);
  const result = await runCommand(command.bin, command.args, workspace.workspacePath, timeoutMs, workspace.env);
  if (result.exitCode !== 0) {
    return null;
  }
  return parseAgentCommitMessage(`${result.stdout}\n${result.stderr}`);
}

async function readStagedDiff(
  repoPath: string,
  timeoutMs: number,
  env: Record<string, string>,
  maxLines: number
): Promise<string> {
  const result = await runCommand("git", ["-C", repoPath, "diff", "--cached", "--", "."], repoPath, timeoutMs, env);
  if (result.exitCode !== 0) {
    return "";
  }
  const lines = result.stdout.split(/\r?\n/);
  return lines.slice(0, Math.max(1, maxLines)).join("\n");
}

function buildCommitMessageAgentCommand(
  agent: ServerConfig["plugins"]["execution"]["commitMessageAgent"],
  prompt: string,
  workspace: PreparedWorkspace,
  config: ServerConfig
): { bin: string; args: string[] } {
  if (agent === "codex") {
    return {
      bin: config.plugins.execution.codexBin,
      args: [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
        "-C",
        workspace.workspacePath,
        prompt
      ]
    };
  }
  return {
    bin: config.plugins.execution.cursorBin,
    args: [
      "agent",
      "--print",
      "--output-format",
      "json",
      "--force",
      "--trust",
      "--workspace",
      workspace.workspacePath,
      prompt
    ]
  };
}

function buildCommitMessageAgentPrompt(task: TitingTask, stagedFiles: string[], diff: string): string {
  return [
    "Generate a git commit message for the staged changes.",
    "Return only JSON with this exact shape: {\"subject\":\"type(scope): subject\",\"body\":\"- Change: ...\\n- Task: ...\\n- Task ID: ...\\n- Branch: ...\"}.",
    "Follow Conventional Commits. The subject must reflect the task feature and the actual staged implementation.",
    "The body must summarize functional changes and must not be a changed-file list.",
    "",
    `Task title: ${task.title}`,
    `Task instruction: ${task.instruction}`,
    `Task ID: ${task.id}`,
    `Branch: ${task.branch}`,
    "",
    "Staged files:",
    stagedFiles.length > 0 ? stagedFiles.map((file) => `- ${file}`).join("\n") : "- none",
    "",
    "Staged diff:",
    diff || "(diff unavailable)"
  ].join("\n");
}

function parseAgentCommitMessage(output: string): { subject: string; body: string } | null {
  for (const candidate of extractJsonCandidates(output)) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const subject = typeof parsed.subject === "string" ? normalizeAgentCommitSubject(parsed.subject) : "";
      const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
      if (isValidCommitSubject(subject) && body) {
        return { subject, body };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractJsonCandidates(output: string): string[] {
  const candidates: string[] = [];
  for (const block of output.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    if (block[1]) {
      candidates.push(block[1].trim());
    }
  }
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      candidates.push(trimmed);
    }
  }
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first >= 0 && last > first) {
    candidates.push(output.slice(first, last + 1));
  }
  return candidates;
}

function normalizeAgentCommitSubject(subject: string): string {
  return truncateSubject(subject.trim().replace(/\s+/g, " ").replace(/[.。]+$/g, ""), 100);
}

function isValidCommitSubject(subject: string): boolean {
  return /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?: .+/.test(subject);
}

function buildTaskCommitSubject(task: TitingTask, stagedFiles: string[]): string {
  const type = inferCommitType(task, stagedFiles);
  const scope = inferCommitScope(stagedFiles);
  const subject = normalizeCommitSubject(task.title) || "apply task output";
  const prefix = scope ? `${type}(${scope}): ` : `${type}: `;
  return `${prefix}${truncateSubject(subject, 100 - prefix.length)}`;
}

function buildTaskCommitBody(task: TitingTask): string {
  return [
    `- Change: ${buildChangeSummary(task)}`,
    `- Task: ${task.title}`,
    `- Task ID: ${task.id}`,
    `- Branch: ${task.branch}`
  ].join("\n");
}

function inferCommitType(task: TitingTask, stagedFiles: string[]): string {
  const text = `${task.title}\n${task.instruction}`.toLowerCase();
  if (/\b(fix|repair|correct|resolve|bug|修复|解决)\b/.test(text)) {
    return "fix";
  }
  if (stagedFiles.length > 0 && stagedFiles.every((file) => isDocsPath(file))) {
    return "docs";
  }
  if (stagedFiles.length > 0 && stagedFiles.every((file) => isTestPath(file))) {
    return "test";
  }
  if (/\b(refactor|重构)\b/.test(text)) {
    return "refactor";
  }
  if (/\b(add|create|implement|support|enable|introduce|新增|实现|支持)\b/.test(text)) {
    return "feat";
  }
  return "chore";
}

function inferCommitScope(stagedFiles: string[]): string | null {
  if (stagedFiles.length === 0) {
    return null;
  }
  const scopes = new Set<string>();
  for (const file of stagedFiles) {
    const scope = scopeForPath(file);
    if (scope) {
      scopes.add(scope);
    }
  }
  return scopes.size === 1 ? [...scopes][0] ?? null : null;
}

function scopeForPath(file: string): string | null {
  if (file.startsWith("apps/server/")) {
    return "server";
  }
  if (file.startsWith("apps/web/")) {
    return "web";
  }
  if (file.startsWith("packages/core/")) {
    return "core";
  }
  if (file.startsWith("packages/plugin-api/")) {
    return "plugin-api";
  }
  if (file.startsWith("openspec/")) {
    return "openspec";
  }
  if (file.startsWith("docs/")) {
    return "docs";
  }
  return null;
}

function isDocsPath(file: string): boolean {
  return file.startsWith("docs/") || file.endsWith(".md");
}

function isTestPath(file: string): boolean {
  return /(^|\/)(test|tests|__tests__)\/|(\.|-)(spec|test)\.[cm]?[jt]sx?$/.test(file);
}

function buildChangeSummary(task: TitingTask): string {
  return normalizeCommitSubject(firstMeaningfulLine(task.instruction) || task.title) || "apply task output";
}

function firstMeaningfulLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
}

function normalizeCommitSubject(input: string): string {
  const normalized = input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/g, "");
  if (!normalized) {
    return "";
  }
  return normalized.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function truncateSubject(subject: string, maxLength: number): string {
  if (subject.length <= maxLength) {
    return subject;
  }
  return subject.slice(0, Math.max(1, maxLength)).trimEnd();
}

function commandDetail(result: { stdout: string; stderr: string }, fallback: string): string {
  return result.stderr.trim() || result.stdout.trim() || fallback;
}

function extractPrUrl(output: string): string | null {
  const match = output.match(/https?:\/\/\S+/);
  return match?.[0] ?? null;
}

function extractRepoHost(repoUrl: string): string | null {
  const normalized = normalizeRepoUrl(repoUrl);
  if (!normalized) {
    return null;
  }
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    const match = normalized.match(/^[^@/\s]+@([^:/\s]+)[:/]/);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

function isGithubHost(host: string): boolean {
  return host === "github.com" || host.startsWith("github.") || host.includes(".github.");
}

function isGitlabHost(host: string): boolean {
  return host === "gitlab.com" || host.startsWith("gitlab.") || host.includes(".gitlab.");
}
