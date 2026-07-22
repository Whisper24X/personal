import {
  ExecutionLogRecord,
  ExecutionRecord,
  PluginKind,
  TitingTask
} from "@diting/plugin-api";
import { buildRunObservabilityView } from "./run-observability";

describe("buildRunObservabilityView", () => {
  it("summarizes a successful run with stages, steps, actual plugins, and raw log metadata", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-1", status: "completed", agentId: "agent-1" }),
      task: createTask({ id: "task-1" }),
      logs: [
        createLog("environment.workspace_prepared", "Workspace ready", { pluginId: "git-worktree-local" }),
        createLog("executor.completed", "Executor completed", { pluginId: "cursor" }),
        createLog("execution.quality_skipped", "Quality skipped", { pluginId: "default-quality" })
      ],
      pluginHealth: [
        createPlugin("git-worktree-local", "environment"),
        createPlugin("cursor", "agent"),
        createPlugin("default-quality", "quality")
      ],
      rawLogSources: ["stdout", "stderr", "summary"],
      leases: []
    });

    expect(view.stages.map((stage) => `${stage.key}:${stage.status}`)).toContain("execute:done");
    expect(view.steps.some((step) => step.pluginId === "cursor")).toBe(true);
    expect(view.plugins.find((plugin) => plugin.pluginId === "cursor")?.participationSource).toBe("actual");
    expect(view.rawLogs.sources).toContain("summary");
    expect(view.rawLogs.available).toBe(true);
  });

  it("does not keep execute stage failed after a later successful completion", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-2", status: "completed" }),
      task: createTask({ id: "task-2" }),
      logs: [
        createLog("executor.failed", "First attempt failed", { pluginId: "cursor" }),
        createLog("goal.iteration_started", "Repair started", { pluginId: "quality" }),
        createLog("executor.completed", "Recovered on retry", { pluginId: "cursor" }),
        createLog("execution.completed", "Run completed", { pluginId: "cursor" })
      ],
      pluginHealth: [createPlugin("cursor", "agent")],
      leases: []
    });

    expect(view.stages.find((stage) => stage.key === "execute")?.status).toBe("done");
  });

  it("creates fallback plugin refs when pluginId is missing from logs", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-3", status: "completed" }),
      task: createTask({ id: "task-3" }),
      logs: [createLog("executor.completed", "Executor completed")],
      pluginHealth: [createPlugin("cursor", "agent")],
      leases: []
    });

    const plugin = view.plugins.find((item) => item.pluginId === "cursor");
    expect(plugin?.participationSource).toBe("fallback");
    expect(plugin?.fallbackReason).toBeTruthy();
  });

  it("maps quality disabled signals to skipped quality stage", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-4", status: "completed" }),
      task: createTask({ id: "task-4" }),
      logs: [
        createLog("executor.completed", "Executor completed", { pluginId: "cursor" }),
        createLog("execution.quality_skipped", "Quality skipped", { pluginId: "default-quality" })
      ],
      pluginHealth: [createPlugin("default-quality", "quality")],
      leases: []
    });

    expect(view.stages.find((stage) => stage.key === "quality")?.status).toBe("skipped");
  });

  it("maps completion gate logs to a stage between execute and quality", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-completion-gate", status: "completed" }),
      task: createTask({ id: "task-completion-gate" }),
      logs: [
        createLog("executor.completed", "Executor completed", { pluginId: "cursor" }),
        createLog("completion_gate.completed", "Completion gate passed", { pluginId: "openspec-completion-gate" }),
        createLog("eval.completed", "Evaluation completed", { pluginId: "default-quality" })
      ],
      pluginHealth: [
        createPlugin("cursor", "execution"),
        createPlugin("openspec-completion-gate", "completion-gate"),
        createPlugin("default-quality", "quality")
      ],
      leases: []
    });

    expect(view.stages.map((stage) => stage.key)).toEqual([
      "workspace",
      "execute",
      "completion_gate",
      "quality",
      "repair",
      "pull_request",
      "done"
    ]);
    expect(view.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "completion_gate", title: "Completed", message: "Completion gate passed" })
    ]));
    expect(view.plugins.find((plugin) => plugin.pluginId === "openspec-completion-gate")?.kind).toBe("completion-gate");
  });

  it("maps failure repair logs to the repair stage", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-failure-repair", status: "failed" }),
      task: createTask({ id: "task-failure-repair" }),
      logs: [
        createLog("failure.recorded", "Environment failed", { pluginId: "git-worktree-local" }),
        createLog("failure.blocked", "Failure requires blocked task state", { pluginId: "git-worktree-local" })
      ],
      pluginHealth: [createPlugin("git-worktree-local", "environment")],
      leases: []
    });

    expect(view.steps.some((step) => step.stage === "repair" && step.title === "Recorded")).toBe(true);
    expect(view.stages.find((stage) => stage.key === "repair")?.status).toBe("failed");
  });

  it("infers completion gate skipped and failed statuses from event suffixes", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-completion-gate-status", status: "failed" }),
      task: createTask({ id: "task-completion-gate-status" }),
      logs: [
        createLog("completion_gate.skipped", "Completion gate skipped", { pluginId: "openspec-completion-gate" }),
        createLog("completion_gate.failed", "Completion gate failed", { pluginId: "openspec-completion-gate" })
      ],
      pluginHealth: [createPlugin("openspec-completion-gate", "completion-gate")],
      leases: []
    });

    expect(view.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "completion_gate", status: "skipped" }),
      expect.objectContaining({ stage: "completion_gate", status: "failed" })
    ]));
    expect(view.stages.find((stage) => stage.key === "completion_gate")?.status).toBe("failed");
  });

  it("maps pull request failure to failed pull_request stage", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-5", status: "failed" }),
      task: createTask({ id: "task-5" }),
      logs: [
        createLog("executor.completed", "Executor completed", { pluginId: "cursor" }),
        createLog("pull_request.failed", "Pull request creation failed", { pluginId: "cursor" })
      ],
      pluginHealth: [createPlugin("cursor", "agent")],
      leases: []
    });

    expect(view.stages.find((stage) => stage.key === "pull_request")?.status).toBe("failed");
  });

  it("maps repair and pull request logs to visible run steps", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-5b", status: "completed" }),
      task: createTask({ id: "task-5b" }),
      logs: [
        createLog("goal.iteration_started", "Repair iteration started", { pluginId: "quality" }),
        createLog("pull_request.started", "Pull request creation started", { pluginId: "quality" }),
        createLog("pull_request.completed", "Pull request creation completed", { pluginId: "quality" })
      ],
      pluginHealth: [createPlugin("quality", "quality")],
      leases: []
    });

    expect(view.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "repair", title: "Iteration Started", message: "Repair iteration started" }),
      expect.objectContaining({ stage: "pull_request", title: "Started", message: "Pull request creation started" }),
      expect.objectContaining({ stage: "pull_request", title: "Completed", message: "Pull request creation completed" })
    ]));
  });

  it("keeps programming handoff events out of the quality lifecycle", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({
        id: "exec-programming-agent",
        status: "completed",
        executor: "programming",
        agentKind: "programming"
      }),
      task: createTask({ id: "task-programming-agent", executor: "programming", agentKind: "programming" }),
      logs: [
        createLog("environment.workspace_prepared", "Workspace ready", { pluginId: "git-worktree-local" }),
        createLog("executor.completed", "Executor completed", { pluginId: "codex" }),
        createLog("programming.completed_for_quality", "Programming handed off", {
          pluginId: "codex",
          phase: "programming"
        })
      ],
      pluginHealth: [
        createPlugin("codex", "agent"),
        createPlugin("default-quality", "quality")
      ],
      leases: []
    });

    expect(view.stages.map((stage) => stage.key)).toEqual(["workspace", "execute", "repair", "done"]);
    expect(view.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "done", message: "Programming handed off" })
    ]));
    expect(view.steps.some((step) => step.stage === "quality")).toBe(false);
  });

  it("keeps quality orchestration events in the quality lifecycle", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({
        id: "exec-quality-agent",
        status: "completed",
        executor: "quality",
        agentKind: "quality"
      }),
      task: createTask({ id: "task-quality-agent", executor: "quality", agentKind: "quality" }),
      logs: [
        createLog("quality.started", "Quality started", {
          pluginId: "quality-orchestrator-codex",
          phase: "quality"
        }),
        createLog("completion_gate.completed", "Completion gate passed", {
          pluginId: "openspec-completion-gate",
          phase: "quality"
        }),
        createLog("quality.failed_for_repair", "Quality failed", {
          pluginId: "default-quality",
          phase: "quality"
        }),
        createLog("repair.returned_to_programming", "Returned to programming", {
          pluginId: "default-quality",
          phase: "quality"
        })
      ],
      pluginHealth: [
        createPlugin("quality-orchestrator-codex", "agent"),
        createPlugin("openspec-completion-gate", "completion-gate"),
        createPlugin("default-quality", "quality")
      ],
      leases: []
    });

    expect(view.stages.map((stage) => stage.key)).toEqual(["workspace", "completion_gate", "quality", "repair", "done"]);
    expect(view.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "quality", message: "Quality started" }),
      expect.objectContaining({ stage: "quality", message: "Quality failed" }),
      expect.objectContaining({ stage: "repair", message: "Returned to programming" })
    ]));
    expect(view.steps.some((step) => step.stage === "execute")).toBe(false);
  });

  it("returns unavailable raw logs when no sources are provided", async () => {
    const view = await buildRunObservabilityView({
      schemaVersion: "2026-05-11",
      run: createExecution({ id: "exec-6", status: "completed" }),
      task: createTask({ id: "task-6" }),
      logs: [],
      pluginHealth: [],
      rawLogSources: [],
      leases: []
    });

    expect(view.rawLogs.available).toBe(false);
    expect(view.rawLogs.sources).toEqual([]);
  });
});

function createTask(input: {
  id: string;
  executor?: string;
  agentKind?: TitingTask["agentKind"];
}): TitingTask {
  const now = new Date("2026-05-11T00:00:00.000Z");
  return {
    id: input.id,
    source: "manual",
    externalId: null,
    title: input.id,
    instruction: "do work",
    repo: "repo",
    branch: "main",
    priority: "medium",
    status: "succeeded",
    executor: input.executor ?? "cursor",
    agentKind: input.agentKind,
    traceId: `trace-${input.id}`,
    constraints: [],
    acceptanceCriteria: [],
    metadata: {},
    retryCount: 0,
    repairCount: 0,
    startedAt: now,
    completedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function createExecution(input: {
  id: string;
  status: ExecutionRecord["status"];
  agentId?: string;
  executor?: string;
  agentKind?: ExecutionRecord["agentKind"];
}): ExecutionRecord {
  return {
    id: input.id,
    taskId: "task-1",
    agentId: input.agentId ?? "agent-1",
    workspace: "/tmp/workspace",
    status: input.status,
    summary: "done",
    executor: input.executor ?? "cursor",
    agentKind: input.agentKind,
    startedAt: new Date("2026-05-11T00:00:00.000Z"),
    endedAt: new Date("2026-05-11T00:01:00.000Z")
  };
}

function createLog(
  eventType: string,
  message: string,
  correlation: { pluginId?: string; phase?: "programming" | "quality" } = {}
): ExecutionLogRecord {
  return {
    id: `log-${eventType}`,
    taskId: "task-1",
    executionId: "exec-1",
    eventType,
    message,
    data: {
      ...(correlation.phase ? { phase: correlation.phase } : {}),
      correlation: {
        correlationId: "corr-1",
        traceId: "trace-1",
        pluginId: correlation.pluginId
      }
    },
    createdAt: new Date("2026-05-11T00:00:30.000Z")
  };
}

function createPlugin(id: string, kind: PluginKind) {
  return {
    id,
    kind,
    priority: 100,
    capabilities: ["default"],
    health: { healthy: true, message: `${id} ok` }
  };
}
