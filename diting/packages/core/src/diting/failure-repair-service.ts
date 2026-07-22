import { createHash } from "node:crypto";
import {
  CompletionGateResult,
  ExecutionResult,
  PullRequestRecord,
  TitingTask
} from "@diting/plugin-api";
import {
  buildFailureHash,
  buildRepairDoneWhen,
  buildRepairDoneWhenWithoutQuality,
  buildRepairObjective,
  getExecutionRetryDecision,
  isWorkflowPromptsFailure
} from "./service-shared";

export type FailureKind =
  | "quality"
  | "completion_gate"
  | "execution"
  | "workflow_prompt"
  | "environment"
  | "preflight"
  | "pull_request"
  | "unknown";

export type FailureRepairStrategy =
  | "auto_repair"
  | "skip_with_record"
  | "blocked"
  | "needs_human";

export type FailureRepairPlan = {
  source: FailureKind;
  objective: string;
  constraints: string[];
  doneWhen: string[];
};

export type FailureRepairDecision = {
  failureKind: FailureKind;
  strategy: FailureRepairStrategy;
  failureHash: string;
  failureSummary: string;
  failureDetail: Record<string, unknown>;
  repairPlan: FailureRepairPlan;
};

export type FailureRepairHistoryEntry = {
  kind: FailureKind;
  strategy: FailureRepairStrategy;
  hash: string;
  summary: string;
  occurredAt: string;
  executionId: string | null;
};

export type FailureRepairLastFailure = FailureRepairHistoryEntry & {
  detail: Record<string, unknown>;
};

export type FailureRepairMetadata = {
  lastFailure: FailureRepairLastFailure;
  repairPlan: FailureRepairPlan;
  strategy: FailureRepairStrategy;
  history: FailureRepairHistoryEntry[];
};

const FAILURE_REPAIR_HISTORY_LIMIT = 10;

export function readFailureRepairMetadata(metadata: Record<string, unknown>): FailureRepairMetadata | null {
  const value = metadata.failureRepair;
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as FailureRepairMetadata;
}

export function buildFailureRepairHash(input: {
  kind: FailureKind;
  summary: string;
  detail: Record<string, unknown>;
}): string {
  const payload = JSON.stringify({
    kind: input.kind,
    summary: input.summary,
    detail: sortRecord(input.detail)
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function isCodeRepairableExecutionFailure(result: ExecutionResult): boolean {
  const retryDecision = getExecutionRetryDecision(result);
  if (retryDecision.retryable) {
    return false;
  }
  if (result.errorCategory === "launch_error") {
    return false;
  }
  if (result.errorCategory === "timeout" || result.timeoutCategory === "execution_timeout") {
    return false;
  }
  return result.exitCode !== 0 || result.errorCategory === "command_failed";
}

export function canSafelyFallbackWorkflowPrompt(result: ExecutionResult): boolean {
  if (!isWorkflowPromptsFailure(result)) {
    return false;
  }
  return result.metadata.workflowFallbackUnavailable !== true;
}

export function classifyPullRequestFailureStrategy(
  prRecords: PullRequestRecord[]
): FailureRepairStrategy {
  const failures = prRecords.filter((record) => !record.skipped && !record.prUrl);
  for (const record of failures) {
    const message = [
      record.detail,
      record.pushDetail,
      record.prDetail
    ].filter((item): item is string => typeof item === "string").join(" ").toLowerCase();
    if (
      message.includes("auth")
      || message.includes("permission")
      || message.includes("401")
      || message.includes("403")
      || message.includes("protected branch")
      || message.includes("api")
    ) {
      return "needs_human";
    }
  }
  return "blocked";
}

export function decideFailureRepairStrategy(input: {
  kind: FailureKind;
  executionResult?: ExecutionResult;
  retryBudgetExhausted?: boolean;
  canFallback?: boolean;
  pullRequestRecords?: PullRequestRecord[];
  preferNeedsHuman?: boolean;
}): FailureRepairStrategy {
  if (input.preferNeedsHuman) {
    return "needs_human";
  }

  switch (input.kind) {
    case "quality":
    case "completion_gate":
      return "auto_repair";
    case "workflow_prompt":
      return input.canFallback === false ? "blocked" : "skip_with_record";
    case "environment":
    case "preflight":
      return "blocked";
    case "pull_request":
      return classifyPullRequestFailureStrategy(input.pullRequestRecords ?? []);
    case "unknown":
      return "needs_human";
    case "execution": {
      if (input.retryBudgetExhausted && input.executionResult) {
        return isCodeRepairableExecutionFailure(input.executionResult) ? "auto_repair" : "blocked";
      }
      if (input.executionResult && isCodeRepairableExecutionFailure(input.executionResult)) {
        return "auto_repair";
      }
      return "blocked";
    }
    default:
      return "needs_human";
  }
}

export function buildFailureRepairPlan(input: {
  kind: FailureKind;
  task: TitingTask;
  summary: string;
  detail: Record<string, unknown>;
  checks?: Array<{ name: string; passed: boolean; detail: string }>;
  executionResult?: ExecutionResult;
  gate?: CompletionGateResult;
}): FailureRepairPlan {
  const checks = input.checks ?? [];
  const executionResult = input.executionResult ?? createFallbackExecutionResult(input.summary, input.detail);
  const objective = input.gate?.repairObjective
    ?? buildRepairObjective(input.task, executionResult, checks);
  const doneWhen = input.gate?.repairDoneWhen?.length
    ? input.gate.repairDoneWhen
    : checks.length > 0
      ? buildRepairDoneWhen(input.task, checks)
      : buildRepairDoneWhenWithoutQuality(input.task);
  const constraints = [...input.task.constraints];
  if (input.kind === "environment" || input.kind === "preflight") {
    constraints.push("Resolve environment or configuration issues before retrying execution");
  }
  if (input.kind === "pull_request") {
    constraints.push("Resolve pull request creation blockers before marking the task done");
  }
  return {
    source: input.kind,
    objective,
    constraints,
    doneWhen
  };
}

export function buildFailureRepairDecision(input: {
  kind: FailureKind;
  task: TitingTask;
  summary: string;
  detail?: Record<string, unknown>;
  checks?: Array<{ name: string; passed: boolean; detail: string }>;
  executionResult?: ExecutionResult;
  gate?: CompletionGateResult;
  retryBudgetExhausted?: boolean;
  canFallback?: boolean;
  pullRequestRecords?: PullRequestRecord[];
  preferNeedsHuman?: boolean;
}): FailureRepairDecision {
  const detail = summarizeFailureDetail(input.kind, input.detail ?? {}, input.executionResult);
  const strategy = decideFailureRepairStrategy({
    kind: input.kind,
    executionResult: input.executionResult,
    retryBudgetExhausted: input.retryBudgetExhausted,
    canFallback: input.canFallback,
    pullRequestRecords: input.pullRequestRecords,
    preferNeedsHuman: input.preferNeedsHuman
  });
  const failureHash = input.executionResult
    ? buildFailureHash(
      input.executionResult,
      (input.checks ?? []).map((check) => ({ name: check.name, passed: check.passed }))
    )
    : buildFailureRepairHash({ kind: input.kind, summary: input.summary, detail });
  const repairPlan = buildFailureRepairPlan({
    kind: input.kind,
    task: input.task,
    summary: input.summary,
    detail,
    checks: input.checks,
    executionResult: input.executionResult,
    gate: input.gate
  });
  return {
    failureKind: input.kind,
    strategy,
    failureHash,
    failureSummary: input.summary,
    failureDetail: detail,
    repairPlan
  };
}

export function appendFailureRepairHistory(
  history: FailureRepairHistoryEntry[],
  entries: FailureRepairHistoryEntry[]
): FailureRepairHistoryEntry[] {
  return [...history, ...entries].slice(-FAILURE_REPAIR_HISTORY_LIMIT);
}

export function updateFailureRepairMetadata(
  existing: FailureRepairMetadata | null,
  lastFailure: FailureRepairLastFailure,
  repairPlan: FailureRepairPlan,
  strategy: FailureRepairStrategy
): FailureRepairMetadata {
  const historyEntry: FailureRepairHistoryEntry = {
    kind: lastFailure.kind,
    strategy: lastFailure.strategy,
    hash: lastFailure.hash,
    summary: lastFailure.summary,
    occurredAt: lastFailure.occurredAt,
    executionId: lastFailure.executionId
  };
  return {
    lastFailure,
    repairPlan,
    strategy,
    history: appendFailureRepairHistory(existing?.history ?? [], [historyEntry])
  };
}

export function applyFailureRepairMetadata(
  task: TitingTask,
  decision: FailureRepairDecision,
  executionId: string | null,
  occurredAt: string
): FailureRepairMetadata {
  const existing = readFailureRepairMetadata(task.metadata);
  const lastFailure: FailureRepairLastFailure = {
    kind: decision.failureKind,
    strategy: decision.strategy,
    hash: decision.failureHash,
    summary: decision.failureSummary,
    detail: decision.failureDetail,
    occurredAt,
    executionId
  };
  return updateFailureRepairMetadata(existing, lastFailure, decision.repairPlan, decision.strategy);
}

export function summarizeExecutionFailureDetail(result: ExecutionResult): Record<string, unknown> {
  return {
    errorCategory: result.errorCategory,
    timeoutCategory: result.timeoutCategory,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    summary: result.summary,
    stdoutExcerpt: excerpt(result.stdout),
    stderrExcerpt: excerpt(result.stderr),
    failureHash: buildFailureHash(result, [])
  };
}

export function buildFailureRepairLogPayload(
  decision: FailureRepairDecision,
  executionId: string | null,
  correlation: Record<string, unknown>
): Record<string, unknown> {
  return {
    failureKind: decision.failureKind,
    strategy: decision.strategy,
    failureHash: decision.failureHash,
    failureSummary: decision.failureSummary,
    repairPlan: decision.repairPlan,
    executionId,
    correlation
  };
}

function summarizeFailureDetail(
  kind: FailureKind,
  detail: Record<string, unknown>,
  executionResult?: ExecutionResult
): Record<string, unknown> {
  if (executionResult) {
    return {
      ...detail,
      ...summarizeExecutionFailureDetail(executionResult)
    };
  }
  return detail;
}

function createFallbackExecutionResult(
  summary: string,
  detail: Record<string, unknown>
): ExecutionResult {
  return {
    exitCode: typeof detail.exitCode === "number" ? detail.exitCode : 1,
    stdout: typeof detail.stdoutExcerpt === "string" ? detail.stdoutExcerpt : "",
    stderr: typeof detail.stderrExcerpt === "string" ? detail.stderrExcerpt : "",
    summary,
    sessionId: null,
    timedOut: detail.timedOut === true,
    errorCategory: (typeof detail.errorCategory === "string"
      ? detail.errorCategory
      : "command_failed") as ExecutionResult["errorCategory"],
    timeoutCategory: typeof detail.timeoutCategory === "string"
      ? detail.timeoutCategory as ExecutionResult["timeoutCategory"]
      : "none",
    metadata: detail
  };
}

function excerpt(value: string | undefined, maxLength = 500): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

function sortRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}
