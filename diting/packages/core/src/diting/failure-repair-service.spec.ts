import {
  appendFailureRepairHistory,
  buildFailureRepairDecision,
  buildFailureRepairHash,
  canSafelyFallbackWorkflowPrompt,
  classifyPullRequestFailureStrategy,
  decideFailureRepairStrategy,
  isCodeRepairableExecutionFailure,
  readFailureRepairMetadata,
  updateFailureRepairMetadata
} from "./failure-repair-service";
import { createHash } from "node:crypto";
import { ExecutionResult, PullRequestRecord, TitingTask } from "@diting/plugin-api";

describe("failure-repair-service", () => {
  it("routes failure kinds to expected strategies", () => {
    expect(decideFailureRepairStrategy({ kind: "quality" })).toBe("auto_repair");
    expect(decideFailureRepairStrategy({ kind: "completion_gate" })).toBe("auto_repair");
    expect(decideFailureRepairStrategy({ kind: "workflow_prompt", canFallback: true })).toBe("skip_with_record");
    expect(decideFailureRepairStrategy({ kind: "workflow_prompt", canFallback: false })).toBe("blocked");
    expect(decideFailureRepairStrategy({ kind: "environment" })).toBe("blocked");
    expect(decideFailureRepairStrategy({ kind: "preflight" })).toBe("blocked");
    expect(decideFailureRepairStrategy({ kind: "unknown" })).toBe("needs_human");
    expect(decideFailureRepairStrategy({
      kind: "execution",
      executionResult: createExecutionResult({ errorCategory: "command_failed" })
    })).toBe("auto_repair");
    expect(decideFailureRepairStrategy({
      kind: "execution",
      executionResult: createExecutionResult({ errorCategory: "timeout" }),
      retryBudgetExhausted: true
    })).toBe("blocked");
  });

  it("keeps failure hash stable for identical failure inputs", () => {
    const input = {
      kind: "quality" as const,
      summary: "build failed",
      detail: { errorCategory: "command_failed", failedChecks: ["build"] }
    };
    expect(buildFailureRepairHash(input)).toBe(buildFailureRepairHash(input));
    expect(buildFailureRepairHash(input)).not.toBe(buildFailureRepairHash({
      ...input,
      summary: "lint failed"
    }));
  });

  it("builds repair plan with objective, constraints, and doneWhen", () => {
    const task = createTask();
    const decision = buildFailureRepairDecision({
      kind: "execution",
      task,
      summary: "command failed",
      detail: { errorCategory: "command_failed" },
      checks: [],
      executionResult: createExecutionResult({ errorCategory: "command_failed", summary: "command failed" })
    });
    expect(decision.repairPlan.objective).toContain("command_failed");
    expect(decision.repairPlan.constraints.length).toBeGreaterThan(0);
    expect(decision.repairPlan.doneWhen.length).toBeGreaterThan(0);
    expect(decision.failureHash).toContain("command_failed");
  });

  it("trims failure repair history to the latest 10 entries", () => {
    let metadata: ReturnType<typeof readFailureRepairMetadata> = readFailureRepairMetadata({});
    for (let index = 0; index < 12; index += 1) {
      metadata = updateFailureRepairMetadata(metadata, {
        kind: "execution",
        strategy: "auto_repair",
        hash: `hash-${index}`,
        summary: `failure-${index}`,
        detail: { index },
        occurredAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`).toISOString(),
        executionId: "exec-1"
      }, {
        source: "execution",
        objective: "fix",
        constraints: [],
        doneWhen: ["done"]
      }, "auto_repair");
    }
    expect(metadata?.history).toHaveLength(10);
    expect(metadata?.history[0]?.summary).toBe("failure-2");
    expect(metadata?.history.at(-1)?.summary).toBe("failure-11");
  });

  it("classifies pull request failures for needs_human vs blocked", () => {
    expect(classifyPullRequestFailureStrategy([
      createPullRequestRecord({ detail: "403 forbidden: protected branch" })
    ])).toBe("needs_human");
    expect(classifyPullRequestFailureStrategy([
      createPullRequestRecord({ detail: "branch name invalid" })
    ])).toBe("blocked");
  });

  it("detects code-repairable execution failures", () => {
    expect(isCodeRepairableExecutionFailure(createExecutionResult({
      errorCategory: "command_failed",
      exitCode: 1
    }))).toBe(true);
    expect(isCodeRepairableExecutionFailure(createExecutionResult({
      errorCategory: "timeout",
      timeoutCategory: "execution_timeout"
    }))).toBe(false);
    expect(isCodeRepairableExecutionFailure(createExecutionResult({
      errorCategory: "launch_error"
    }))).toBe(false);
  });

  it("allows workflow prompt fallback unless explicitly unavailable", () => {
    expect(canSafelyFallbackWorkflowPrompt(createExecutionResult({
      metadata: { workflowStage: "workflow-prompts" }
    }))).toBe(true);
    expect(canSafelyFallbackWorkflowPrompt(createExecutionResult({
      metadata: { workflowStage: "workflow-prompts", workflowFallbackUnavailable: true }
    }))).toBe(false);
  });

  it("appendFailureRepairHistory keeps only 10 items", () => {
    const entries = Array.from({ length: 11 }, (_, index) => ({
      kind: "preflight" as const,
      strategy: "blocked" as const,
      hash: createHash("sha256").update(String(index)).digest("hex"),
      summary: `preflight-${index}`,
      occurredAt: new Date().toISOString(),
      executionId: null
    }));
    const trimmed = appendFailureRepairHistory([], entries);
    expect(trimmed).toHaveLength(10);
    expect(trimmed[0]?.summary).toBe("preflight-1");
  });
});

function createTask(overrides: Partial<TitingTask> = {}): TitingTask {
  return {
    id: "task-1",
    traceId: "trace-1",
    source: "manual",
    externalId: null,
    title: "Fix build",
    instruction: "Fix the build",
    repo: "https://example.com/repo.git",
    branch: "main",
    executor: "codex",
    agentKind: "programming",
    preferredRuntime: "codex",
    priority: "medium",
    status: "active",
    constraints: ["Keep scope minimal"],
    acceptanceCriteria: ["Build passes"],
    metadata: {},
    retryCount: 0,
    repairCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: null,
    ...overrides
  };
}

function createPullRequestRecord(overrides: Partial<PullRequestRecord> = {}): PullRequestRecord {
  return {
    repoKey: "Repo1",
    url: "https://example.com/repo.git",
    prUrl: null,
    branch: "feature/test",
    base: "main",
    skipped: false,
    detail: "failed",
    ...overrides
  };
}

function createExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    exitCode: overrides.exitCode ?? 1,
    stdout: "",
    stderr: "",
    summary: overrides.summary ?? "failed",
    sessionId: null,
    timedOut: false,
    errorCategory: overrides.errorCategory ?? "command_failed",
    timeoutCategory: "none",
    metadata: overrides.metadata ?? {},
    ...overrides
  };
}
