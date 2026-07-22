import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PgAgentLeaseRepository,
  PgAgentRepository,
  PgExecutionLogRepository,
  PgExecutionRepository,
  PgPluginConfigRepository,
  PgRepairGoalRepository,
  PgRunAttemptRepository,
  PgTaskRepository,
  readWaitReason
} from "./repositories";
import { RootLogsPlugin } from "./plugins/log";
import { AgentRecord, ExecutionLogRecord, PluginConfig, RepairGoal, RunAttempt, TitingTask, WaitReason } from "@diting/plugin-api";

describe("PG repository JSON schema envelopes", () => {
  it("writes versioned envelopes for task JSON fields", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pool = createPool(async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [] };
    });
    const repository = new PgTaskRepository(pool);

    await repository.save(createTask());

    const values = queries[0]?.values ?? [];
    expect(values[13]).toEqual(JSON.stringify({ schemaVersion: "2026-05-11", data: ["safe"] }));
    expect(values[14]).toEqual(JSON.stringify({ schemaVersion: "2026-05-11", data: ["passes"] }));
    expect(values[15]).toEqual(JSON.stringify({ schemaVersion: "2026-05-11", data: { env: "dev" } }));
  });

  it("reads legacy and envelope task JSON formats", async () => {
    const legacyPool = createPool(async () => ({
      rows: [{
        id: "task-1",
        source: "manual",
        external_id: null,
        title: "Fix build",
        instruction: "do work",
        repo: "repo",
        branch: "main",
        priority: "medium",
        status: "ready",
        executor: "codex",
        trace_id: "trace-1",
        constraints_json: ["legacy"],
        acceptance_criteria_json: ["ok"],
        metadata_json: { mode: "legacy" },
        retry_count: 0,
        repair_count: 0,
        started_at: null,
        completed_at: null,
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T00:00:00.000Z"
      }]
    }));
    const envelopePool = createPool(async () => ({
      rows: [{
        id: "task-2",
        source: "manual",
        external_id: null,
        title: "Fix build",
        instruction: "do work",
        repo: "repo",
        branch: "main",
        priority: "medium",
        status: "ready",
        executor: "codex",
        trace_id: "trace-2",
        constraints_json: { schemaVersion: "2026-05-11", data: ["wrapped"] },
        acceptance_criteria_json: { schemaVersion: "2026-05-11", data: ["good"] },
        metadata_json: { schemaVersion: "2026-05-11", data: { mode: "wrapped" } },
        retry_count: 0,
        repair_count: 0,
        started_at: null,
        completed_at: null,
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T00:00:00.000Z"
      }]
    }));

    const legacy = await new PgTaskRepository(legacyPool).getById("task-1");
    const wrapped = await new PgTaskRepository(envelopePool).getById("task-2");

    expect(legacy).toEqual(expect.objectContaining({
      constraints: ["legacy"],
      acceptanceCriteria: ["ok"],
      metadata: { mode: "legacy" }
    }));
    expect(wrapped).toEqual(expect.objectContaining({
      constraints: ["wrapped"],
      acceptanceCriteria: ["good"],
      metadata: { mode: "wrapped" }
    }));
  });

  it("writes and reads envelopes for execution logs, agents, repair goals, and plugin configs", async () => {
    const logQueries: Array<{ values: unknown[] }> = [];
    const logPool = createPool(async (_sql, values) => {
      logQueries.push({ values });
      return { rows: [] };
    });
    await new PgExecutionLogRepository(logPool).append(createExecutionLog());
    expect(logQueries[0]?.values[5]).toEqual(
      JSON.stringify({ schemaVersion: "2026-05-11", data: { correlation: { traceId: "trace-1" } } })
    );

    const agentPool = createPool(async () => ({
      rows: [{
        id: "agent-1",
        status: "idle",
        task_id: null,
        executor: "codex",
        labels_json: { schemaVersion: "2026-05-11", data: ["local"] },
        last_heartbeat_at: "2026-05-11T00:00:00.000Z",
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T00:00:00.000Z"
      }]
    }));
    const repairQueries: Array<{ values: unknown[] }> = [];
    const repairPool = createPool(async (_sql, values) => {
      repairQueries.push({ values });
      return {
        rows: [{
          id: "goal-1",
          task_id: "task-1",
          objective: "repair",
          constraints_json: { schemaVersion: "2026-05-11", data: ["no force push"] },
          done_when_json: { schemaVersion: "2026-05-11", data: ["tests pass"] },
          status: "repairing",
          iteration: 1,
          max_iterations: 3,
          last_failure_hash: null,
          metadata_json: { schemaVersion: "2026-05-11", data: { repairSource: "completion-gate" } },
          created_at: "2026-05-11T00:00:00.000Z",
          updated_at: "2026-05-11T00:00:00.000Z"
        }]
      };
    });
    const pluginPool = createPool(async () => ({
      rows: [{
        id: "plugin-1",
        plugin_id: "meegle",
        kind: "task-integration",
        enabled: true,
        priority: 10,
        config_json: { schemaVersion: "2026-05-11", data: { mode: "poll" } },
        updated_at: "2026-05-11T00:00:00.000Z"
      }]
    }));

    expect(await new PgAgentRepository(agentPool).list()).toEqual([
      expect.objectContaining({ labels: ["local"] })
    ]);
    const repairRepository = new PgRepairGoalRepository(repairPool);
    await repairRepository.upsert(createRepairGoal());
    expect(repairQueries[0]?.values).toContain(
      JSON.stringify({ schemaVersion: "2026-05-11", data: { repairSource: "completion-gate" } })
    );
    expect(await repairRepository.getByTaskId("task-1")).toEqual(
      expect.objectContaining({
        constraints: ["no force push"],
        doneWhen: ["tests pass"],
        metadata: { repairSource: "completion-gate" }
      })
    );
    expect(await new PgPluginConfigRepository(pluginPool).getByPluginId("meegle")).toEqual(
      expect.objectContaining({ config: { mode: "poll" } })
    );
  });
});

describe("PG repository run queries", () => {
  it("lists executions by filters and retrieves execution by id", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pool = createPool(async (sql, values = []) => {
      queries.push({ sql, values });
      return { rows: [] };
    });

    const repository = new PgExecutionRepository(pool);

    await repository.list({ taskId: "task-1", agentId: "agent-1", status: "executing", limit: 25 });
    await repository.getById("exec-1");

    expect(queries[0]?.sql).toContain("from executions");
    expect(queries[0]?.sql).toContain("task_id");
    expect(queries[0]?.sql).toContain("agent_id");
    expect(queries[0]?.sql).toContain("status");
    expect(queries[0]?.sql).toContain("order by started_at desc");
    expect(queries[1]?.sql).toContain("where id = $1");
  });

  it("lists execution logs and leases by execution id", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pool = createPool(async (sql, values = []) => {
      queries.push({ sql, values });
      return { rows: [] };
    });

    await new PgExecutionLogRepository(pool).listByExecution("exec-1");
    await new PgAgentLeaseRepository(pool).listByExecution("exec-1");

    expect(queries[0]?.sql).toContain("execution_id = $1");
    expect(queries[1]?.sql).toContain("execution_id = $1");
  });
});

describe("PG repository task lifecycle persistence", () => {
  it("claims ready tasks as active", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pool = createPool(async (sql, values) => {
      queries.push({ sql, values });
      if (sql.includes("returning *")) {
        return {
          rows: [{
            id: "task-1",
            source: "manual",
            external_id: null,
            title: "Fix build",
            instruction: "do work",
            repo: "repo",
            branch: "main",
            priority: "medium",
            status: "active",
            executor: "codex",
            trace_id: "trace-1",
            constraints_json: { schemaVersion: "2026-05-11", data: [] },
            acceptance_criteria_json: { schemaVersion: "2026-05-11", data: [] },
            metadata_json: { schemaVersion: "2026-05-11", data: {} },
            retry_count: 0,
            repair_count: 0,
            started_at: values[1],
            completed_at: null,
            created_at: "2026-05-11T00:00:00.000Z",
            updated_at: values[1]
          }]
        };
      }
      return { rows: [] };
    });
    const repository = new PgTaskRepository(pool);
    const startedAt = new Date("2026-05-11T00:05:00.000Z");

    const claimed = await repository.claimQueued("task-1", startedAt);

    expect(queries[0]?.sql).toContain("status = 'active'");
    expect(queries[0]?.sql).toContain("status = 'ready'");
    expect(queries[0]?.sql).not.toContain("'running'");
    expect(queries[0]?.sql).not.toContain("'queued'");
    expect(claimed).toEqual(expect.objectContaining({
      id: "task-1",
      status: "active",
      startedAt
    }));
  });

  it("persists and reads RunAttempt records", async () => {
    const writes: Array<{ sql: string; values: unknown[] }> = [];
    const attempt = createRunAttempt();
    const pool = createPool(async (sql, values) => {
      writes.push({ sql, values });
      if (sql.includes("insert into run_attempts")) {
        return { rows: [] };
      }
      if (sql.includes("where id = $1")) {
        return {
          rows: [{
            id: attempt.id,
            task_id: attempt.taskId,
            agent_id: attempt.agentId,
            stage: attempt.stage,
            release_reason: attempt.releaseReason ?? null,
            metadata_json: { schemaVersion: "2026-05-11", data: { source: "test" } },
            started_at: attempt.startedAt.toISOString(),
            ended_at: null
          }]
        };
      }
      if (sql.includes("order by started_at desc, id desc limit 1")) {
        return {
          rows: [{
            id: attempt.id,
            task_id: attempt.taskId,
            agent_id: attempt.agentId,
            stage: attempt.stage,
            release_reason: null,
            metadata_json: { schemaVersion: "2026-05-11", data: {} },
            started_at: attempt.startedAt.toISOString(),
            ended_at: null
          }]
        };
      }
      return { rows: [] };
    });

    const repository = new PgRunAttemptRepository(pool);
    await repository.create(attempt);
    const byId = await repository.getById(attempt.id);
    const latest = await repository.getLatestByTask(attempt.taskId);

    expect(writes[0]?.sql).toContain("insert into run_attempts");
    expect(byId).toEqual(expect.objectContaining({
      id: attempt.id,
      taskId: attempt.taskId,
      stage: "executing"
    }));
    expect(latest?.id).toBe(attempt.id);
  });

  it("reads WaitReason from task metadata", () => {
    const waitReason: WaitReason = {
      type: "human_input",
      source: "legacy_status_migration",
      message: "Needs operator input",
      recoverableBy: "user",
      createdAt: "2026-05-11T00:00:00.000Z"
    };

    expect(readWaitReason({ waitReason })).toEqual(waitReason);
    expect(readWaitReason({})).toBeNull();
  });
});

describe("RootLogsPlugin raw logs", () => {
  it("returns stdout, stderr, and summary sources from executor output files", async () => {
    const root = await mkdtemp(join(tmpdir(), "diting-logs-"));
    const previousCwd = process.cwd();
    try {
      process.chdir(root);
      const plugin = new RootLogsPlugin();
      await plugin.init();
      const common = {
        level: "info" as const,
        traceId: "trace-1",
        taskId: "task-1",
        executionId: "exec-1",
        data: {}
      };
      await plugin.append({
        id: "stdout-1",
        ...common,
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
        channel: "executor_stdout",
        eventType: "executor.stdout",
        message: "stdout line",
        data: { raw: "build ok\n" }
      });
      await plugin.append({
        id: "stderr-1",
        ...common,
        createdAt: new Date("2026-05-11T00:00:01.000Z"),
        channel: "executor_stderr",
        eventType: "executor.stderr",
        message: "stderr line",
        data: { raw: "npm warn deprecated\n" }
      });
      await plugin.append({
        id: "summary-1",
        ...common,
        createdAt: new Date("2026-05-11T00:00:02.000Z"),
        channel: "executor_summary",
        eventType: "executor.summary",
        message: "summary line",
        data: { raw: "tests passed\n" }
      });

      const result = await plugin.listRawByExecution({
        taskId: "task-1",
        executionId: "exec-1"
      });

      expect(result.scope).toBe("run");
      expect(result.redacted).toBe(true);
      expect(result.items.map((item) => item.source).sort()).toEqual(["stderr", "stdout", "summary"]);
      expect(result.items.map((item) => item.createdAt.toISOString()).sort()).toEqual([
        "2026-05-11T00:00:00.000Z",
        "2026-05-11T00:00:01.000Z",
        "2026-05-11T00:00:02.000Z"
      ]);
    } finally {
      process.chdir(previousCwd);
      await rm(root, { recursive: true, force: true });
    }
  });
});

function createPool(
  handler: (sql: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
) {
  return {
    query: async (sql: string, values: unknown[] = []) => handler(sql, values)
  } as any;
}

function createTask(): TitingTask {
  const now = new Date("2026-05-11T00:00:00.000Z");
  return {
    id: "task-1",
    source: "manual",
    externalId: null,
    title: "Fix build",
    instruction: "do work",
    repo: "repo",
    branch: "main",
    priority: "medium",
    status: "ready",
    executor: "codex",
    traceId: "trace-1",
    constraints: ["safe"],
    acceptanceCriteria: ["passes"],
    metadata: { env: "dev" },
    retryCount: 0,
    repairCount: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function createRepairGoal(): RepairGoal {
  const now = new Date("2026-05-11T00:00:00.000Z");
  return {
    id: "goal-1",
    taskId: "task-1",
    objective: "repair",
    constraints: ["no force push"],
    doneWhen: ["tests pass"],
    status: "repairing",
    currentIteration: 1,
    maxIterations: 3,
    lastFailureHash: null,
    metadata: { repairSource: "completion-gate" },
    createdAt: now,
    updatedAt: now
  };
}

function createExecutionLog(): ExecutionLogRecord {
  return {
    id: "log-1",
    taskId: "task-1",
    executionId: "exec-1",
    eventType: "task.transition",
    message: "ready",
    data: { correlation: { traceId: "trace-1" } },
    createdAt: new Date("2026-05-11T00:00:00.000Z")
  };
}

function createRunAttempt(): RunAttempt {
  return {
    id: "attempt-1",
    taskId: "task-1",
    agentId: "agent-1",
    stage: "executing",
    startedAt: new Date("2026-05-11T00:00:00.000Z"),
    metadata: { source: "test" }
  };
}
