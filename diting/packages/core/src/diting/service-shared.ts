/**
 * `TitingServices` 与各子模块共享的 **依赖契约**、纯函数工具与业务启发式。
 *
 * - `ServiceDependencies` / `ServiceConfig`：仓储、事件总线、插件运行时、重试/修复预算、时钟与定时器注入（便于测试）。
 * - 分支命名、repair 目标文案、`decideStopReason`、治理/质量报告解析等尽量保持无副作用，可在单测中直接断言。
 */
import { createHash } from "node:crypto";
import {
  AgentKind,
  AgentRequest,
  AgentRecord,
  CreateTaskInput,
  EnvironmentRuntimeEvent,
  ExecutionLogRecord,
  ExecutionRecord,
  ExecutionResult,
  ExecutionRuntimeEvent,
  HumanReply,
  HumanReviewRepository,
  ObservabilityCorrelation,
  PluginConfig,
  PreparedWorkspace,
  PullRequestRecord,
  RepairGoal,
  TaskIntegrationPlugin,
  TaskPreflightResult,
  TaskListQuery,
  TaskRepository,
  TaskStatus,
  TaskTransition,
  TitingTask,
  AgentLeaseRepository,
  AgentRepository,
  EvalResult,
  EvalResultRepository,
  EventSink,
  ExecutionLogRepository,
  ExecutionRepository,
  PluginConfigRepository,
  RepairGoalRepository,
  RunAttemptRepository,
  TaskTransitionRepository
} from "@diting/plugin-api";
import { PluginRuntime } from "./plugin-runtime";

const CHILD_REPAIR_READY_PREFIX = "【开发中】";
const LEGACY_CODING_EXECUTORS = new Set(["codex", "cursor", "programming"]);

export function readReadyChildRepairDescription(rawDescription: string): string | null {
  if (!rawDescription.startsWith(CHILD_REPAIR_READY_PREFIX)) {
    return null;
  }
  return rawDescription.slice(CHILD_REPAIR_READY_PREFIX.length).trim();
}

export function buildChildRepairIssueIdempotencyKey(parentExternalId: string, failureHash: string): string {
  const digest = createHash("sha256")
    .update(parentExternalId)
    .update("\0")
    .update(failureHash)
    .digest("hex");
  return `diting-child-repair:${digest}`;
}

/**
 * 构造 `TitingServices` 所需的全部外部端口：任务/执行/日志/Agent 等仓储、
 * 可观测 `events` 出口，以及注入的 `PluginRuntime`。
 *
 * 可选字段用于测试或嵌入环境：自定义 `now` / `createId`、缩短离线超时、替换 `setInterval` 等。
 */
export type ServiceDependencies = {
  tasks: TaskRepository;
  taskTransitions: TaskTransitionRepository;
  runAttempts: RunAttemptRepository;
  executions: ExecutionRepository;
  executionLogs: ExecutionLogRepository;
  agentLeases: AgentLeaseRepository;
  agents: AgentRepository;
  repairGoals: RepairGoalRepository;
  humanReviews: HumanReviewRepository;
  evalResults: EvalResultRepository;
  pluginConfigs: PluginConfigRepository;
  events: EventSink;
  runtime: PluginRuntime;
  now?: () => Date;
  createId?: () => string;
  agentOfflineTimeoutMs?: number;
  environmentRetryLimit?: number;
  executionRetryLimit?: number;
  maxRepairIterations?: number;
  enableNeedsHumanLoop?: boolean;
  enableOpenSpecReviewGate?: boolean;
  executionHeartbeatIntervalMs?: number;
  agentWorkerPollIntervalMs?: number;
  setIntervalFn?: (callback: () => void, ms: number) => unknown;
  clearIntervalFn?: (timer: unknown) => void;
  runPreflight?: (task: TitingTask) => Promise<TaskPreflightResult>;
  createPullRequests?: (task: TitingTask, workspace: PreparedWorkspace) => Promise<PullRequestRecord[]>;
};

/**
 * 从 `ServiceDependencies` 归一化后的运行期配置（必选项均有默认值），在 `TitingServices` 构造时固化。
 */
export type ServiceConfig = {
  now: () => Date;
  createId: () => string;
  agentOfflineTimeoutMs: number;
  environmentRetryLimit: number;
  executionRetryLimit: number;
  maxRepairIterations: number;
  enableNeedsHumanLoop: boolean;
  enableOpenSpecReviewGate: boolean;
  executionHeartbeatIntervalMs: number;
  agentWorkerPollIntervalMs: number;
  setIntervalFn: (callback: () => void, ms: number) => unknown;
  clearIntervalFn: (timer: unknown) => void;
};

export function normalizeAgentRequest(
  input: Pick<CreateTaskInput, "executor" | "agentKind" | "capability" | "preferredDriver" | "preferredRuntime">
): AgentRequest {
  const legacyExecutor = normalizeLegacyExecutor(input.executor);
  const explicitKind = normalizeString(input.agentKind);
  const agentKind = explicitKind ?? inferAgentKind(legacyExecutor);
  const capability = normalizeString(input.capability);
  const preferredDriver = normalizeString(input.preferredDriver) ?? inferPreferredDriver(agentKind);
  const preferredRuntime = normalizeString(input.preferredRuntime) ?? inferPreferredRuntime(agentKind, legacyExecutor);

  return {
    agentKind,
    capability: capability ?? undefined,
    preferredDriver: preferredDriver ?? undefined,
    preferredRuntime: preferredRuntime ?? undefined,
    legacyExecutor: legacyExecutor ?? undefined
  };
}

/**
 * 由环境插件抛出的结构化错误形态（与 `@diting/server` 的 `EnvironmentPreparationError` 等对齐），
 * 用于区分是否可重试、发生在何阶段。
 */
export type EnvironmentFailureShape = {
  message: string;
  stage: string;
  detail: string;
  retryable: boolean;
};

// --- 分支与任务元数据（创建任务、集成拉单时共用） ---

export function normalizeOptionalBranch(branch?: string | null): string | null {
  const normalized = branch?.trim();
  return normalized ? normalized : null;
}

export function buildDefaultTaskBranch(taskId: string, now: Date): string {
  return `feature/${formatBranchTimestamp(now)}-${taskId.slice(0, 8)}`;
}

function formatBranchTimestamp(value: Date): string {
  return [
    value.getFullYear(),
    padBranchDatePart(value.getMonth() + 1),
    padBranchDatePart(value.getDate()),
    padBranchDatePart(value.getHours()),
    padBranchDatePart(value.getMinutes()),
    padBranchDatePart(value.getSeconds())
  ].join("");
}

function padBranchDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeLegacyExecutor(executor: string | undefined): string | null {
  return normalizeString(executor);
}

function inferAgentKind(legacyExecutor: string | null): AgentKind {
  if (!legacyExecutor) {
    return "programming";
  }
  if (LEGACY_CODING_EXECUTORS.has(legacyExecutor)) {
    return "programming";
  }
  return legacyExecutor;
}

function inferPreferredDriver(agentKind: AgentKind): string | null {
  if (agentKind === "programming") {
    return "coding";
  }
  if (agentKind === "product") {
    return "openspec-product";
  }
  if (agentKind === "quality") {
    return "quality-orchestrator";
  }
  return null;
}

function inferPreferredRuntime(agentKind: AgentKind, legacyExecutor: string | null): string | null {
  if (agentKind === "product" || agentKind === "quality") {
    if (legacyExecutor === "cursor") {
      return "cursor";
    }
    return "codex";
  }
  if (!legacyExecutor) {
    return null;
  }
  if (legacyExecutor === "codex" || legacyExecutor === "cursor") {
    return legacyExecutor;
  }
  return null;
}

export function attachBranchMetadata(
  metadata: Record<string, unknown> | undefined,
  generated: boolean
): Record<string, unknown> {
  const existing = metadata ?? {};
  const branchInfo = readBranchMetadata(existing);
  return {
    ...existing,
    diting: {
      ...branchInfo.container,
      branch: {
        ...branchInfo.branch,
        autoGenerated: generated
      }
    }
  };
}

function readBranchMetadata(metadata: Record<string, unknown>): {
  container: Record<string, unknown>;
  branch: Record<string, unknown>;
} {
  const diting = metadata.diting;
  const container = diting && typeof diting === "object" ? diting as Record<string, unknown> : {};
  const branch = container.branch && typeof container.branch === "object"
    ? container.branch as Record<string, unknown>
    : {};
  return { container, branch };
}

export function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

// --- 调度：任务优先级排序 ---

export function sortTaskPriority(left: TitingTask, right: TitingTask): number {
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return rank[right.priority] - rank[left.priority] || left.createdAt.getTime() - right.createdAt.getTime();
}

export function readDiffStats(report: Record<string, unknown>): {
  filesChanged: number;
  insertions: number;
  deletions: number;
} {
  const diff = report.diff;
  if (!diff || typeof diff !== "object") {
    return { filesChanged: 0, insertions: 0, deletions: 0 };
  }
  const value = diff as Record<string, unknown>;
  return {
    filesChanged: toNumber(value.filesChanged),
    insertions: toNumber(value.insertions),
    deletions: toNumber(value.deletions)
  };
}

// --- Repair loop：失败指纹、停止条件、retry 判定、目标文案 ---

export function buildFailureHash(
  result: ExecutionResult,
  checks: Array<{ name: string; passed: boolean }>
): string {
  const failedChecks = checks
    .filter((check) => !check.passed)
    .map((check) => check.name)
    .sort();
  return JSON.stringify({
    errorCategory: result.errorCategory,
    timeoutCategory: result.timeoutCategory,
    summary: result.summary,
    failedChecks
  });
}

export function decideStopReason(input: {
  qualityRiskLevel: "low" | "medium" | "high";
  repeatedFailureCount: number;
  noDiffStreak: number;
  iteration: number;
  maxIterations: number;
}): "high_risk" | "repeated_failure" | "no_effective_diff" | "budget_limited" | null {
  if (input.iteration >= input.maxIterations) {
    return "budget_limited";
  }
  if (input.qualityRiskLevel === "high") {
    return "high_risk";
  }
  if (input.repeatedFailureCount >= 2) {
    return "repeated_failure";
  }
  if (input.noDiffStreak >= 2) {
    return "no_effective_diff";
  }
  return null;
}

export function decideStopReasonWithoutQuality(input: {
  repeatedFailureCount: number;
  iteration: number;
  maxIterations: number;
}): "repeated_failure" | "budget_limited" | null {
  if (input.iteration >= input.maxIterations) {
    return "budget_limited";
  }
  if (input.repeatedFailureCount >= 2) {
    return "repeated_failure";
  }
  return null;
}

export function describeStopReason(
  reason: "high_risk" | "repeated_failure" | "no_effective_diff" | "budget_limited"
): string {
  switch (reason) {
    case "high_risk":
      return "High-risk modification detected";
    case "repeated_failure":
      return "Repeated failure pattern detected";
    case "no_effective_diff":
      return "Two consecutive repair rounds produced no effective diff";
    case "budget_limited":
      return "Repair budget exhausted";
  }
}

/**
 * 从执行器 stderr 中提取首条有意义的错误行，用于在 budget_limited 失败时附加根因提示。
 * 优先匹配 error:/fatal:/panic: 等关键词行；否则取首条非空非标头行。
 * 返回 null 表示无法提取有效提示。
 */
export function extractRootCauseHint(stderr: string | null | undefined): string | null {
  if (!stderr?.trim()) {
    return null;
  }
  const lines = stderr.split("\n").map((line) => line.trim()).filter(Boolean);
  const errorLine = lines.find((line) =>
    /^(error|fatal|panic|exception|fail|FAIL|Error|Fatal)[\s:/]/i.test(line)
  );
  const candidate = errorLine ?? lines.find((line) => !/stderr:|stdout:/i.test(line)) ?? lines[0];
  if (!candidate) {
    return null;
  }
  return candidate.length > 200 ? `${candidate.slice(0, 200)}…` : candidate;
}

export function getExecutionRetryDecision(result: ExecutionResult): {
  retryable: boolean;
  reason: "timeout" | "launch_error" | null;
} {
  if (result.timeoutCategory === "execution_timeout" || result.errorCategory === "timeout") {
    return {
      retryable: true,
      reason: "timeout"
    };
  }
  if (result.errorCategory === "launch_error") {
    return {
      retryable: true,
      reason: "launch_error"
    };
  }
  return {
    retryable: false,
    reason: null
  };
}

export function buildRepairObjective(
  task: TitingTask,
  result: ExecutionResult,
  checks: Array<{ name: string; passed: boolean; detail: string }>
): string {
  const failedChecks = checks.filter((check) => !check.passed).map((check) => check.name);
  if (failedChecks.length > 0) {
    return `Fix ${failedChecks.join(", ")} while preserving task intent for ${task.title}`;
  }
  return `Address ${result.errorCategory} and complete ${task.title}`;
}

export function buildRepairConstraints(task: TitingTask, riskLevel: "low" | "medium" | "high"): string[] {
  const constraints = [...task.constraints];
  if (riskLevel !== "low") {
    constraints.push(`Avoid ${riskLevel} risk changes`);
  }
  return constraints;
}

export function buildRepairDoneWhen(
  task: TitingTask,
  checks: Array<{ name: string; passed: boolean }>
): string[] {
  const failedChecks = checks.filter((check) => !check.passed).map((check) => `Pass ${check.name}`);
  if (task.acceptanceCriteria.length > 0) {
    return [...task.acceptanceCriteria, ...failedChecks];
  }
  return failedChecks.length > 0 ? failedChecks : ["All checks pass"];
}

export function buildRepairDoneWhenWithoutQuality(task: TitingTask): string[] {
  return task.acceptanceCriteria.length > 0 ? [...task.acceptanceCriteria] : ["Successful execution"];
}

export function readQualityChecks(report: Record<string, unknown>): Array<{ name: string; passed: boolean; detail: string }> {
  const checks = report.checks;
  if (!Array.isArray(checks)) {
    return [];
  }
  return checks
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "unknown",
      passed: item.passed === true,
      detail: typeof item.detail === "string" ? item.detail : ""
    }));
}

export function readGovernanceEntries(container: Record<string, unknown>): Array<{
  phase: string;
  outcome: string;
  message: string;
  findings: string[];
  metadata: Record<string, unknown>;
  pluginId?: string;
}> {
  const governance = container.governance;
  const entries = Array.isArray(governance) ? governance : governance ? [governance] : [];
  return entries
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      phase: typeof item.phase === "string" ? item.phase : "unknown",
      outcome: typeof item.outcome === "string" ? item.outcome : "flagged",
      message: typeof item.message === "string" ? item.message : "Governance policy applied",
      findings: Array.isArray(item.findings)
        ? item.findings.filter((finding): finding is string => typeof finding === "string")
        : [],
      metadata: typeof item.metadata === "object" && item.metadata !== null
        ? item.metadata as Record<string, unknown>
        : {},
      pluginId: typeof item.pluginId === "string" ? item.pluginId : undefined
    }));
}

// --- Human-in-the-loop（集成侧人工回复、与 repair 约束合并） ---

export function sortHumanReplies(replies: HumanReply[]): HumanReply[] {
  return [...replies].sort((left, right) => {
    const byTime = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (byTime !== 0) {
      return byTime;
    }
    return left.replyId.localeCompare(right.replyId);
  });
}

export function appendHumanReplyToInstruction(instruction: string, reply: HumanReply): string {
  const author = reply.author?.trim() ? `, ${reply.author.trim()}` : "";
  return `${instruction.trim()}\n\nHuman reply (${reply.createdAt}${author}):\n${reply.body.trim()}`.trim();
}

export function appendHumanGuidanceConstraint(constraints: string[], body: string): string[] {
  return [...constraints, `Human guidance: ${body.trim()}`];
}

export function trimReplyIds(replyIds: string[]): string[] {
  return replyIds.slice(-20);
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return ["succeeded", "failed", "waiting", "cancelled"].includes(status);
}

export function isWorkflowPromptsFailure(result: ExecutionResult): boolean {
  return result.metadata.workflowStage === "workflow-prompts";
}

export function readHumanLoopMetadata(metadata: Record<string, unknown>): {
  requestId?: string;
  requestedAt?: string;
  seenReplyIds: string[];
} {
  const humanLoop = metadata.humanLoop;
  if (!humanLoop || typeof humanLoop !== "object") {
    return { seenReplyIds: [] };
  }
  const value = humanLoop as Record<string, unknown>;
  return {
    requestId: typeof value.requestId === "string" ? value.requestId : undefined,
    requestedAt: typeof value.requestedAt === "string" ? value.requestedAt : undefined,
    seenReplyIds: Array.isArray(value.seenReplyIds)
      ? value.seenReplyIds.filter((item): item is string => typeof item === "string")
      : []
  };
}

/** 宽松解析 `unknown` 为数值；用于报告 JSON 中缺字段或非数字场景。 */
function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function isEnvironmentPreparationError(error: unknown): error is EnvironmentFailureShape {
  if (!error || typeof error !== "object") {
    return false;
  }
  const value = error as Record<string, unknown>;
  return value.name === "EnvironmentPreparationError"
    && typeof value.message === "string"
    && typeof value.stage === "string"
    && typeof value.detail === "string"
    && typeof value.retryable === "boolean";
}
