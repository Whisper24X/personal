import {
  AgentLease,
  ExecutionLogRecord,
  ExecutionRecord,
  PluginKind,
  RunObservability,
  RunPluginRef,
  RunRawLogItem,
  RunStage,
  RunStageKey,
  RunStageStatus,
  RunStep,
  TitingTask
} from "@diting/plugin-api";

const STAGE_ORDER: RunStageKey[] = [
  "workspace",
  "execute",
  "completion_gate",
  "quality",
  "repair",
  "pull_request",
  "done"
];

const PROGRAMMING_STAGE_ORDER: RunStageKey[] = ["workspace", "execute", "repair", "done"];
const QUALITY_STAGE_ORDER: RunStageKey[] = ["workspace", "completion_gate", "quality", "repair", "done"];

const STAGE_LABELS: Record<RunStageKey, string> = {
  workspace: "Workspace",
  execute: "Execute",
  completion_gate: "Completion Gate",
  quality: "Quality",
  repair: "Repair",
  pull_request: "Pull Request",
  done: "Done"
};

const REQUIRED_PLUGIN_KINDS: PluginKind[] = ["environment", "agent", "observability-governance"];

export type BuildRunObservabilityInput = {
  schemaVersion: string;
  run: ExecutionRecord;
  task: TitingTask;
  logs: ExecutionLogRecord[];
  leases: AgentLease[];
  pluginHealth: Array<{
    id: string;
    kind: PluginKind;
    priority: number;
    capabilities: string[];
    health: { healthy: boolean; message: string };
  }>;
  rawLogSources?: Array<RunRawLogItem["source"]>;
};

export type MergeRunPluginsInput = {
  logs: ExecutionLogRecord[];
  pluginHealth: BuildRunObservabilityInput["pluginHealth"];
  run: ExecutionRecord;
};

export function inferRunStage(
  eventType: string,
  source?: RunRawLogItem["source"]
): RunStageKey | null {
  if (source === "stdout" || source === "stderr" || source === "summary") {
    return "execute";
  }

  const lower = eventType.toLowerCase();
  if (lower === "programming.completed_for_quality") {
    return "done";
  }
  if (lower === "repair.returned_to_programming") {
    return "repair";
  }
  if (
    lower.includes("workspace")
    || lower.includes("environment")
    || lower.includes("preparing")
    || lower.includes("worktree")
  ) {
    return "workspace";
  }
  if (
    lower.includes("executor")
    || lower.includes("agent")
    || lower.includes("execution.runtime")
    || lower.includes("executing")
  ) {
    return "execute";
  }
  if (lower.includes("completion_gate") || lower.includes("completion gate")) {
    return "completion_gate";
  }
  if (lower.includes("quality") || lower.includes("eval")) {
    return "quality";
  }
  if (lower.includes("repair") || lower.includes("goal") || lower.includes("failure.") || lower.includes("task.waiting")) {
    return "repair";
  }
  if (lower.includes("pull_request") || lower.includes("pull request")) {
    return "pull_request";
  }
  if (
    lower.includes("execution.completed")
    || lower === "task.succeeded"
    || lower === "task.done"
    || (lower.includes("completed") && !lower.includes("eval"))
  ) {
    return "done";
  }
  return null;
}

export function inferRunStepStatus(log: ExecutionLogRecord): RunStep["status"] {
  const eventType = log.eventType.toLowerCase();
  if (eventType.includes("failed") || eventType.includes("blocked") || eventType.includes("budget_exhausted")) {
    return "failed";
  }
  if (eventType.includes("skipped") || eventType.includes("quality_skipped")) {
    return "skipped";
  }
  if (
    eventType.includes("started")
    || eventType.includes("preparing")
    || eventType.includes("executing")
    || eventType.includes("repairing")
    || eventType.includes("runtime.")
  ) {
    return "running";
  }
  if (eventType.includes("completed") || eventType.includes("passed") || eventType.includes("achieved")) {
    return "done";
  }
  return "done";
}

export function mergeRunPlugins(input: MergeRunPluginsInput): RunPluginRef[] {
  const actualById = new Map<string, { lastEventAt: Date; status: RunStageStatus }>();

  for (const log of input.logs) {
    const pluginId = readPluginId(log);
    if (!pluginId) {
      continue;
    }
    const stage = inferRunStage(log.eventType);
    const status = inferRunStepStatus(log);
    const existing = actualById.get(pluginId);
    if (!existing || log.createdAt >= existing.lastEventAt) {
      actualById.set(pluginId, {
        lastEventAt: log.createdAt,
        status: terminalStageStatus(status)
      });
    }
  }

  const refs: RunPluginRef[] = [];
  const seen = new Set<string>();

  for (const [pluginId, actual] of actualById) {
    const health = input.pluginHealth.find((plugin) => plugin.id === pluginId);
    refs.push({
      pluginId,
      kind: health?.kind ?? "platform",
      participationSource: "actual",
      fallbackReason: null,
      status: actual.status,
      health: health ? (health.health.healthy ? "healthy" : "unhealthy") : "unknown",
      summary: health?.health.message ?? null,
      lastEventAt: actual.lastEventAt
    });
    seen.add(pluginId);
  }

  for (const plugin of input.pluginHealth) {
    if (seen.has(plugin.id)) {
      continue;
    }
    const fallbackReason = REQUIRED_PLUGIN_KINDS.includes(plugin.kind)
      ? "readiness_required"
      : "runtime_available";
    refs.push({
      pluginId: plugin.id,
      kind: plugin.kind,
      participationSource: "fallback",
      fallbackReason,
      status: plugin.health.healthy ? "done" : "failed",
      health: plugin.health.healthy ? "healthy" : "unhealthy",
      summary: plugin.health.message,
      lastEventAt: null
    });
    seen.add(plugin.id);
  }

  if (refs.length === 0) {
    for (const plugin of input.pluginHealth) {
      refs.push({
        pluginId: plugin.id,
        kind: plugin.kind,
        participationSource: "fallback",
        fallbackReason: "missing_plugin_correlation",
        status: "pending",
        health: plugin.health.healthy ? "healthy" : "unhealthy",
        summary: plugin.health.message,
        lastEventAt: null
      });
    }
  }

  return refs.sort((left, right) => left.pluginId.localeCompare(right.pluginId));
}

export async function buildRunObservabilityView(
  input: BuildRunObservabilityInput
): Promise<RunObservability> {
  const allSteps = buildRunSteps(input.run.id, input.logs);
  const stageOrder = deriveStageOrder(input.run, input.task, input.logs);
  const steps = allSteps.filter((step) => stageOrder.includes(step.stage));
  const stages = buildRunStages(input.run, steps, input.logs, stageOrder);
  const plugins = mergeRunPlugins({
    logs: input.logs,
    pluginHealth: input.pluginHealth,
    run: input.run
  });
  const sources = input.rawLogSources ?? [];
  const available = sources.length > 0;

  return {
    schemaVersion: input.schemaVersion,
    run: input.run,
    stages,
    steps,
    plugins,
    rawLogs: {
      available,
      endpoint: `/api/runs/${input.run.id}/raw-logs`,
      sources,
      scope: "run",
      redacted: true
    }
  };
}

function buildRunSteps(runId: string, logs: ExecutionLogRecord[]): RunStep[] {
  const steps: RunStep[] = [];
  for (const log of logs) {
    const stage = inferRunStageForLog(log);
    if (!stage) {
      continue;
    }
    steps.push({
      id: log.id,
      runId,
      stage,
      status: inferRunStepStatus(log),
      title: formatStepTitle(log.eventType),
      message: log.message,
      pluginId: readPluginId(log),
      startedAt: log.createdAt,
      endedAt: log.createdAt,
      error: log.eventType.toLowerCase().includes("failed") ? log.message : null
    });
  }
  return steps.sort((left, right) => {
    const byTime = (left.startedAt?.getTime() ?? 0) - (right.startedAt?.getTime() ?? 0);
    return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
  });
}

function buildRunStages(
  run: ExecutionRecord,
  steps: RunStep[],
  logs: ExecutionLogRecord[],
  stageOrder: RunStageKey[]
): RunStage[] {
  const qualitySkipped = logs.some((log) => log.eventType.includes("quality_skipped"));
  const runTerminal = run.status === "completed" || run.status === "failed";
  const runSucceeded = run.status === "completed";

  return stageOrder.map((key) => {
    const stageSteps = steps.filter((step) => step.stage === key);
    const status = deriveStageStatus(key, stageSteps, {
      qualitySkipped,
      runTerminal,
      runSucceeded,
      runStatus: run.status
    });
    const startedAt = stageSteps[0]?.startedAt ?? null;
    const endedAt = stageSteps.at(-1)?.endedAt ?? null;
    const summary = stageSteps.at(-1)?.message ?? null;

    return {
      key,
      label: STAGE_LABELS[key],
      status,
      startedAt,
      endedAt,
      summary
    } satisfies RunStage;
  });
}

function inferRunStageForLog(log: ExecutionLogRecord): RunStageKey | null {
  const phase = readPhase(log);
  if (log.eventType === "execution.quality_skipped" && phase === "programming") {
    return "done";
  }
  return inferRunStage(log.eventType);
}

function deriveStageOrder(
  run: ExecutionRecord,
  task: TitingTask,
  logs: ExecutionLogRecord[]
): RunStageKey[] {
  const runAgentKind = run.agentKind ?? task.agentKind ?? normalizeLegacyAgentKind(run.executor);
  if (runAgentKind === "quality" || logs.some((log) => readPhase(log) === "quality")) {
    return QUALITY_STAGE_ORDER;
  }

  const hasInlineQualityLifecycle = logs.some((log) => {
    const stage = inferRunStage(log.eventType);
    return stage === "completion_gate" || stage === "quality" || stage === "pull_request";
  }) && !logs.some((log) => log.eventType === "programming.completed_for_quality");
  if (hasInlineQualityLifecycle) {
    return STAGE_ORDER;
  }

  if (
    runAgentKind === "programming"
    || run.executor === "programming"
    || run.executor === "codex"
    || run.executor === "cursor"
    || logs.some((log) => readPhase(log) === "programming")
  ) {
    return PROGRAMMING_STAGE_ORDER;
  }

  return STAGE_ORDER;
}

function deriveStageStatus(
  key: RunStageKey,
  stageSteps: RunStep[],
  context: {
    qualitySkipped: boolean;
    runTerminal: boolean;
    runSucceeded: boolean;
    runStatus: ExecutionRecord["status"];
  }
): RunStageStatus {
  if (key === "quality" && context.qualitySkipped) {
    return "skipped";
  }

  if (stageSteps.length === 0) {
    if (key === "done" && context.runSucceeded) {
      return "done";
    }
    if (context.runTerminal && key === "done" && !context.runSucceeded) {
      return "failed";
    }
    return "pending";
  }

  const latest = stageSteps.at(-1);
  if (!latest) {
    return "pending";
  }

  if (latest.status === "running") {
    return "running";
  }

  const latestFailed = [...stageSteps].reverse().find((step) => step.status === "failed");
  if (latestFailed) {
    if (context.runSucceeded && hasLaterRecovery(stageSteps, latestFailed)) {
      return "done";
    }
    if (!context.runTerminal && key === "execute") {
      return "running";
    }
    return context.runSucceeded ? "done" : "failed";
  }

  if (latest.status === "skipped") {
    return "skipped";
  }

  if (latest.status === "failed") {
    if (context.runSucceeded && hasLaterRecovery(stageSteps, latest)) {
      return "done";
    }
    if (context.runSucceeded && key !== "done") {
      const laterStagesHaveProgress = stageSteps.some((step) => step.status === "done" && step.id !== latest.id);
      if (laterStagesHaveProgress) {
        return "done";
      }
    }
    if (!context.runTerminal && key === "execute") {
      return "running";
    }
    return context.runSucceeded ? "done" : "failed";
  }

  if (key === "done") {
    return context.runSucceeded ? "done" : context.runStatus === "failed" ? "failed" : "pending";
  }

  return "done";
}

function hasLaterRecovery(stageSteps: RunStep[], failedStep: RunStep): boolean {
  const failedAt = failedStep.startedAt?.getTime() ?? 0;
  return stageSteps.some((step) =>
    step.id !== failedStep.id
    && (step.startedAt?.getTime() ?? 0) > failedAt
    && step.status === "done"
  );
}

function terminalStageStatus(status: RunStep["status"]): RunStageStatus {
  if (status === "running") {
    return "running";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  return "done";
}

function readPhase(log: ExecutionLogRecord): "programming" | "quality" | null {
  const phase = log.data.phase;
  return phase === "programming" || phase === "quality" ? phase : null;
}

function normalizeLegacyAgentKind(executor: string): "programming" | "quality" | null {
  if (executor === "quality") {
    return "quality";
  }
  if (executor === "programming" || executor === "codex" || executor === "cursor") {
    return "programming";
  }
  return null;
}

function readPluginId(log: ExecutionLogRecord): string | null {
  const correlation = log.data?.correlation;
  if (!correlation || typeof correlation !== "object") {
    return null;
  }
  const pluginId = (correlation as Record<string, unknown>).pluginId;
  return typeof pluginId === "string" ? pluginId : null;
}

function formatStepTitle(eventType: string): string {
  const parts = eventType.split(".");
  const last = parts.at(-1) ?? eventType;
  return last
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
