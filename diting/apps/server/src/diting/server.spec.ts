import { InMemoryEventStream } from "./event-stream";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildServerWithState, seedAgents } from "./server";
import { CONFIG_DEFAULTS, ServerConfig } from "./config";
import { createBuiltinPlugins } from "./plugins";
import { InMemoryRunAttemptRepository, NotFoundError, TitingServices } from "@diting/core";
import {
  AgentRecord,
  CreateTaskInput,
  EvalResult,
  ExecutionLogRecord,
  ExecutionRecord,
  ObservabilityEvent,
  PluginConfig,
  RunObservability,
  RunRawLogsResponse,
  RepairGoal,
  TaskTransition,
  TitingTask
} from "@diting/plugin-api";

const execFileAsync = promisify(execFile);

describe("diting server handlers", () => {
  it("seeds programming agents and disables idle legacy executor agents on startup", async () => {
    const existingLegacyOffline = {
      ...createAgent(),
      id: "codex-agent-1",
      status: "offline" as const,
      executor: "codex",
      taskId: null,
      lastHeartbeatAt: new Date("2026-05-10T00:00:00.000Z"),
      updatedAt: new Date("2026-05-10T00:00:00.000Z")
    };
    const upserts: AgentRecord[] = [];
    const services = {
      listAgents: async () => [existingLegacyOffline, {
        ...createAgent(),
        id: "cursor-agent-1",
        status: "idle",
        executor: "cursor",
        taskId: null
      }],
      upsertAgent: async (agent: AgentRecord) => {
        upserts.push(agent);
      }
    } as Pick<TitingServices, "listAgents" | "upsertAgent"> as TitingServices;

    await seedAgents(services, 1);

    expect(upserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "programming-agent-1",
        status: "idle",
        executor: "programming",
        taskId: null
      }),
      expect.objectContaining({
        id: "cursor-agent-1",
        status: "disabled",
        executor: "cursor",
        taskId: null
      }),
      expect.objectContaining({
        id: "codex-agent-1",
        status: "disabled",
        executor: "codex",
        taskId: null
      })
    ]));
    expect(upserts).toHaveLength(3);
  });

  it("refreshes stale idle programming agents during seeding", async () => {
    const staleHeartbeat = new Date("2026-05-10T00:00:00.000Z");
    const existingProgrammingAgent = {
      ...createAgent(),
      id: "programming-agent-1",
      status: "idle" as const,
      executor: "programming",
      kind: "programming",
      driverId: "coding",
      taskId: null,
      lastHeartbeatAt: staleHeartbeat,
      updatedAt: staleHeartbeat
    };
    const upserts: AgentRecord[] = [];
    const services = {
      listAgents: async () => [existingProgrammingAgent],
      upsertAgent: async (agent: AgentRecord) => {
        upserts.push(agent);
      }
    } as Pick<TitingServices, "listAgents" | "upsertAgent"> as TitingServices;

    await seedAgents(services, 1);

    expect(upserts).toEqual([
      expect.objectContaining({
        id: "programming-agent-1",
        status: "idle",
        executor: "programming",
        kind: "programming",
        driverId: "coding",
        taskId: null,
        labels: ["local"]
      })
    ]);
    expect(upserts[0].lastHeartbeatAt.getTime()).toBeGreaterThan(staleHeartbeat.getTime());
  });

  it("seeds product agents separately from programming agents", async () => {
    const upserts: AgentRecord[] = [];
    const services = {
      listAgents: async () => [],
      upsertAgent: async (agent: AgentRecord) => {
        upserts.push(agent);
      }
    } as Pick<TitingServices, "listAgents" | "upsertAgent"> as TitingServices;

    await seedAgents(services, 2, 1);

    expect(upserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "programming-agent-1",
        executor: "programming",
        kind: "programming",
        driverId: "coding"
      }),
      expect.objectContaining({
        id: "programming-agent-2",
        executor: "programming",
        kind: "programming",
        driverId: "coding"
      }),
      expect.objectContaining({
        id: "product-agent-1",
        executor: "product",
        kind: "product",
        driverId: "openspec-product",
        runtimeProviderId: "codex"
      })
    ]));
  });

  it("seeds product agents with the configured product runtime provider", async () => {
    const upserts: AgentRecord[] = [];
    const services = {
      listAgents: async () => [],
      upsertAgent: async (agent: AgentRecord) => {
        upserts.push(agent);
      }
    } as Pick<TitingServices, "listAgents" | "upsertAgent"> as TitingServices;

    await seedAgents(services, 1, 1, "cursor");

    expect(upserts).toContainEqual(expect.objectContaining({
      id: "product-agent-1",
      executor: "product",
      kind: "product",
      driverId: "openspec-product",
      runtimeProviderId: "cursor"
    }));
  });

  it("seeds quality agents separately from programming and product agents", async () => {
    const upserts: AgentRecord[] = [];
    const services = {
      listAgents: async () => [],
      upsertAgent: async (agent: AgentRecord) => {
        upserts.push(agent);
      }
    } as Pick<TitingServices, "listAgents" | "upsertAgent"> as TitingServices;

    await seedAgents(services, 2, 1, "codex", 1, "cursor");

    expect(upserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "quality-agent-1",
        executor: "quality",
        kind: "quality",
        driverId: "quality-orchestrator",
        runtimeProviderId: "cursor",
        labels: ["local", "quality", "review"]
      })
    ]));
  });

  it("does not disable busy legacy executor agents during seeding", async () => {
    const busyLegacy = {
      ...createAgent(),
      id: "codex-agent-1",
      status: "busy" as const,
      executor: "codex",
      taskId: "task-legacy"
    };
    const upserts: AgentRecord[] = [];
    const services = {
      listAgents: async () => [busyLegacy],
      upsertAgent: async (agent: AgentRecord) => {
        upserts.push(agent);
      }
    } as Pick<TitingServices, "listAgents" | "upsertAgent"> as TitingServices;

    await seedAgents(services, 1);

    expect(upserts).toEqual([
      expect.objectContaining({
        id: "programming-agent-1",
        status: "idle",
        executor: "programming"
      })
    ]);
  });

  it("returns structured health and readiness payloads", async () => {
    const server = await buildServerWithState(await createState(), { startScheduler: false });
    try {
      const health = await server.inject({ method: "GET", url: "/api/health" });
      const readiness = await server.inject({ method: "GET", url: "/api/readiness" });

      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual(expect.objectContaining({
        ok: true,
        status: "alive",
        schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
        service: "diting"
      }));
      expect(readiness.statusCode).toBe(200);
      expect(readiness.json()).toEqual(expect.objectContaining({
        ok: true,
        status: "ready",
        schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION
      }));
    } finally {
      await server.close();
    }
  });

  it("serves dependency checks without redefining readiness", async () => {
    const runtimePlugins = [
      ...createPlugins().map((plugin) => ({
        ...plugin,
        health: async () => plugin.health
      })),
      {
        id: "meegle",
        kind: "task-integration" as const,
        priority: 100,
        capabilities: ["pull"],
        health: async () => ({ healthy: false, message: "auth_required: run `meegle auth login`" })
      },
      {
        id: "gitlab",
        kind: "platform" as const,
        priority: 100,
        capabilities: ["merge-request"],
        health: async () => ({ healthy: true, message: "authenticated" })
      }
    ];
    const state = await createState({
      listPlugins: async () => [
        ...createPlugins(),
        {
          id: "meegle",
          kind: "task-integration" as const,
          priority: 100,
          capabilities: ["pull"],
          displayName: "Meegle",
          binaryPath: "meegle",
          runtimeSource: "config",
          runtimeKind: null,
          health: { healthy: false, message: "auth_required: run `meegle auth login`" }
        },
        {
          id: "gitlab",
          kind: "platform" as const,
          priority: 100,
          capabilities: ["merge-request"],
          displayName: "GitLab",
          binaryPath: "glab",
          runtimeSource: "config",
          runtimeKind: null,
          health: { healthy: true, message: "authenticated" }
        }
      ]
    });
    state.plugins = runtimePlugins;
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const checks = await server.inject({ method: "GET", url: "/api/dependency-checks" });
      const readiness = await server.inject({ method: "GET", url: "/api/readiness" });

      expect(checks.statusCode).toBe(200);
      expect(checks.json()).toMatchObject({
        ready: expect.any(Number),
        total: expect.any(Number),
        degraded: true,
        checks: expect.arrayContaining([
          expect.objectContaining({ id: "meegle-auth", status: "blocked" }),
          expect.objectContaining({ id: "gitlab-auth", status: "ready" })
        ])
      });
      expect(readiness.statusCode).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("starts and stops the idle heartbeat and agent worker loops with the scheduler", async () => {
    let started = 0;
    let stopped = 0;
    let workerStarted = 0;
    let workerStopped = 0;
    const state = await createState({
      startIdleHeartbeatLoop: () => {
        started += 1;
        return () => {
          stopped += 1;
        };
      },
      startAgentWorkerPool: () => {
        workerStarted += 1;
        return () => {
          workerStopped += 1;
        };
      }
    });
    const server = await buildServerWithState(state, { schedulerIntervalMs: 60_000 });

    await server.close();

    expect(started).toBe(1);
    expect(stopped).toBe(1);
    expect(workerStarted).toBe(1);
    expect(workerStopped).toBe(1);
  });

  it("keeps readiness green when no quality plugin is registered", async () => {
    const state = await createState({
      listPlugins: async () => createPlugins().filter((plugin) => plugin.kind !== "quality")
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const readiness = await server.inject({ method: "GET", url: "/api/readiness" });

      expect(readiness.statusCode).toBe(200);
      expect(readiness.json()).toEqual(expect.objectContaining({
        ok: true,
        status: "ready",
            checks: expect.objectContaining({
              plugins: expect.objectContaining({
                ok: true,
                requiredKinds: {
                  environment: true,
                  agent: true,
                  "observability-governance": true
                }
              })
            })
      }));
    } finally {
      await server.close();
    }
  });

  it("validates task creation payloads before calling the service", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: { title: "missing fields" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "title, instruction, and repo are required" });
      expect(state.calls.createTask).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it("passes task creation fields through without forcing an executor default", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Fix build",
          instruction: "Run build and fix errors",
          repo: "https://example.com/repo.git"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(state.calls.createTask).toHaveLength(1);
      expect(state.calls.createTask[0].executor).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("passes agent request fields through to task creation", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Review docs",
          instruction: "Review the generated docs",
          repo: "https://example.com/repo.git",
          agentKind: "programming",
          preferredRuntime: "codex"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(state.calls.createTask).toHaveLength(1);
      expect(state.calls.createTask[0]).toEqual(expect.objectContaining({
        agentKind: "programming",
        preferredRuntime: "codex"
      }));
    } finally {
      await server.close();
    }
  });

  it("returns run list from /api/runs", async () => {
    const state = await createState({
      listRuns: async () => [createRunExecution("task-1")]
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({ method: "GET", url: "/api/runs?limit=25&status=executing" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "exec-1" })]));
    } finally {
      await server.close();
    }
  });

  it("returns run observability and raw logs", async () => {
    const state = await createState({
      getRunObservability: async () => createRunObservability(),
      listRunRawLogs: async () => createRunRawLogs()
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const observability = await server.inject({ method: "GET", url: "/api/runs/exec-1/observability" });
      const rawLogs = await server.inject({ method: "GET", url: "/api/runs/exec-1/raw-logs?source=stdout&q=build" });

      expect(observability.statusCode).toBe(200);
      expect(observability.json().plugins[0]).toEqual(expect.objectContaining({ participationSource: "actual" }));
      expect(rawLogs.statusCode).toBe(200);
      expect(rawLogs.json()).toEqual(expect.objectContaining({ scope: "run" }));
    } finally {
      await server.close();
    }
  });

  it("serves trace aggregates from the trace endpoint", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/traces/trace-shared"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
        traceId: "trace-shared",
        tasks: [expect.objectContaining({ id: "task-1" })],
        transitions: [expect.objectContaining({ taskId: "task-1", to: "ready" })]
      }));
      expect(state.calls.getTraceView).toEqual(["trace-shared"]);
    } finally {
      await server.close();
    }
  });

  it("exposes manual sync and dispatch debug handlers", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const sync = await server.inject({ method: "POST", url: "/api/debug/sync" });
      const dispatch = await server.inject({ method: "POST", url: "/api/debug/scheduler" });

      expect(sync.statusCode).toBe(200);
      expect(sync.json()).toEqual({ integrations: 1, pulledTasks: 2 });
      expect(dispatch.statusCode).toBe(200);
      expect(dispatch.json()).toEqual({ queuedBefore: 3 });
      expect(state.calls.runTaskSyncNow).toBe(1);
      expect(state.calls.runSchedulerDispatchNow).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("aggregates global ops events into ranked counts and abnormal tasks", async () => {
    const state = await createState({
      listTasks: async () => [
        createTask(),
        {
          ...createTask(),
          id: "task-2",
          title: "Repair tests",
          status: "waiting",
          traceId: "trace-2",
          retryCount: 2,
          repairCount: 1
        }
      ]
    });
    await seedOpsEvents(state.events);
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({ method: "GET", url: "/api/ops/events" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        focusEventTypes: expect.arrayContaining([
          "execution.blocked",
          "execution.retry_scheduled",
          "scheduler.tick_skipped",
          "agent.offline",
          "plugin.integration_skipped"
        ]),
        watchedEventCount: 5,
        eventTypeCounts: {
          "execution.blocked": 1,
          "execution.retry_scheduled": 2,
          "scheduler.tick_skipped": 1,
          "agent.offline": 1
        },
        eventTypeRanking: [
          { eventType: "execution.retry_scheduled", count: 2 },
          { eventType: "agent.offline", count: 1 },
          { eventType: "execution.blocked", count: 1 },
          { eventType: "scheduler.tick_skipped", count: 1 }
        ],
        recentAbnormalTasks: [
          expect.objectContaining({
            taskId: "task-1",
            title: "Fix build",
            eventType: "execution.retry_scheduled"
          }),
          expect.objectContaining({
            taskId: "task-2",
            title: "Repair tests",
            eventType: "execution.blocked"
          })
        ]
      });
    } finally {
      await server.close();
    }
  });

  it("exposes task lifecycle command endpoints", async () => {
    const calls = {
      submit: 0,
      resume: 0,
      retry: 0,
      reopen: 0
    };
    const state = await createState({
      submitTask: async () => {
        calls.submit += 1;
        return { ...createTask(), status: "ready" };
      },
      resumeTask: async () => {
        calls.resume += 1;
        return { ...createTask(), status: "ready" };
      },
      retryTask: async () => {
        calls.retry += 1;
        return { ...createTask(), status: "ready" };
      },
      reopenTask: async () => {
        calls.reopen += 1;
        return { ...createTask(), status: "draft" };
      }
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const submit = await server.inject({ method: "POST", url: "/api/tasks/task-1/submit" });
      const resume = await server.inject({ method: "POST", url: "/api/tasks/task-1/resume" });
      const retry = await server.inject({ method: "POST", url: "/api/tasks/task-1/retry" });
      const reopen = await server.inject({ method: "POST", url: "/api/tasks/task-1/reopen" });

      expect(submit.statusCode).toBe(200);
      expect(resume.statusCode).toBe(200);
      expect(retry.statusCode).toBe(200);
      expect(reopen.statusCode).toBe(200);
      expect(calls).toEqual({ submit: 1, resume: 1, retry: 1, reopen: 1 });
    } finally {
      await server.close();
    }
  });

  it("returns migration hints for legacy lifecycle endpoints", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const validate = await server.inject({ method: "POST", url: "/api/tasks/task-1/validate" });
      const queue = await server.inject({ method: "POST", url: "/api/tasks/task-1/queue" });
      const recover = await server.inject({ method: "POST", url: "/api/tasks/task-1/recover" });

      expect(validate.statusCode).toBe(410);
      expect(queue.statusCode).toBe(410);
      expect(recover.statusCode).toBe(410);
      expect(validate.json()).toEqual(expect.objectContaining({
        migration: { replacement: "/api/tasks/:id/submit" }
      }));
    } finally {
      await server.close();
    }
  });

  it("includes current attempt and wait reason in task diagnostics", async () => {
    const activeTask = { ...createTask(), status: "active" as const };
    const waitingTask = {
      ...createTask(),
      id: "task-wait",
      status: "waiting" as const,
      metadata: {
        waitReason: {
          type: "human_input",
          source: "api",
          message: "Needs review",
          recoverableBy: "user",
          createdAt: "2026-05-11T00:00:00.000Z"
        }
      }
    };
    const state = await createState({
      getTask: async (id: string) => (id === "task-wait" ? waitingTask : activeTask),
      getTaskObservability: async (taskId: string) => ({
        schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
        taskId,
        transitions: [],
        executionLogs: []
      })
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const active = await server.inject({ method: "GET", url: "/api/tasks/task-1" });
      const waiting = await server.inject({ method: "GET", url: "/api/tasks/task-wait" });
      const observability = await server.inject({ method: "GET", url: "/api/tasks/task-1/observability" });

      expect(active.json()).toEqual(expect.objectContaining({
        currentAttempt: expect.objectContaining({ stage: "executing" })
      }));
      expect(waiting.json()).toEqual(expect.objectContaining({
        waitReason: expect.objectContaining({ type: "human_input" })
      }));
      expect(observability.json()).toEqual(expect.objectContaining({
        currentAttempt: expect.objectContaining({ stage: "executing" })
      }));
    } finally {
      await server.close();
    }
  });

  it("maps service not found and invalid transition errors to HTTP status codes", async () => {
    const state = await createState({
      getTask: async () => {
        throw new NotFoundError("Task missing");
      },
      retryTask: async () => {
        const error = new Error("bad transition");
        error.name = "InvalidTransitionError";
        throw error;
      }
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const missing = await server.inject({ method: "GET", url: "/api/tasks/missing" });
      const invalid = await server.inject({ method: "POST", url: "/api/tasks/task-1/retry" });

      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: "Task missing" });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json()).toEqual({ error: "bad transition" });
    } finally {
      await server.close();
    }
  });

  it("syncs child repair issue descriptions through the task command API", async () => {
    const state = await createState({
      syncHumanRepairIssue: async () => ({
        ready: true,
        recovered: true,
        childExternalId: "child-1",
        replyId: "child-1:ready",
        summary: "Child repair issue solution applied"
      })
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks/task-1/sync-human-repair-issue"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        ready: true,
        recovered: true,
        childExternalId: "child-1",
        replyId: "child-1:ready"
      }));
    } finally {
      await server.close();
    }
  });

  it("syncs product agent reply comments through the task command API", async () => {
    const state = await createState({
      syncHumanReply: async () => ({
        ready: true,
        recovered: true,
        externalId: "MEEGLE-PRODUCT-1",
        replyId: "reply-1",
        summary: "Human reply applied"
      })
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks/task-1/sync-human-reply"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        ready: true,
        recovered: true,
        externalId: "MEEGLE-PRODUCT-1",
        replyId: "reply-1"
      }));
    } finally {
      await server.close();
    }
  });

  it("returns 409 when human reply sync is not valid for the task", async () => {
    const state = await createState({
      syncHumanReply: async () => {
        const error = new Error("Task task-1 cannot sync human replies");
        error.name = "ConflictError";
        throw error;
      }
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks/task-1/sync-human-reply"
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "Task task-1 cannot sync human replies" });
    } finally {
      await server.close();
    }
  });

  it("returns 409 when child repair issue sync is not valid for the task", async () => {
    const state = await createState({
      syncHumanRepairIssue: async () => {
        const error = new Error("Task task-1 has no child repair issue metadata");
        error.name = "ConflictError";
        throw error;
      }
    });
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/tasks/task-1/sync-human-repair-issue"
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "Task task-1 has no child repair issue metadata" });
    } finally {
      await server.close();
    }
  });

  it("accepts Meegle webhook tasks when webhook mode and secret are valid", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/integrations/meegle/webhook",
        headers: {
          "x-diting-webhook-secret": "secret-1"
        },
        payload: {
          task: {
            id: "MEEGLE-2",
            title: "Webhook task",
            instruction: "Fix from webhook",
            repo: "https://example.com/repo.git",
            branch: "main",
            executor: "codex"
          }
        }
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({
        accepted: 1,
        externalIds: ["MEEGLE-2"]
      });
      expect(state.calls.ingestTaskFromIntegration).toEqual([
        expect.objectContaining({
          externalId: "MEEGLE-2",
          source: "meegle"
        })
      ]);
    } finally {
      await server.close();
    }
  });

  it("rejects Meegle webhook requests with invalid secret and exposes Meegle health", async () => {
    const state = await createState();
    const server = await buildServerWithState(state, { startScheduler: false });
    try {
      const denied = await server.inject({
        method: "POST",
        url: "/api/integrations/meegle/webhook",
        headers: {
          "x-diting-webhook-secret": "wrong"
        },
        payload: {
          task: { id: "MEEGLE-3", title: "bad", instruction: "bad", repo: "repo" }
        }
      });
      const health = await server.inject({
        method: "GET",
        url: "/api/integrations/meegle/health"
      });

      expect(denied.statusCode).toBe(401);
      expect(denied.json()).toEqual({ error: "Invalid Meegle webhook secret" });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({
        ok: true,
        pluginId: "meegle",
        healthy: true,
        message: "Meegle webhook integration ready"
      });
    } finally {
      await server.close();
    }
  });

  it("exposes Meegle browser authorization routes from the plugin registry", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-server-meegle-auth-"));
    const previousAuthState = process.env.MEEGLE_TEST_AUTH_STATE;
    try {
      const bin = join(sandbox, "fake-meegle");
      await writeServerFakeMeegleCli(bin);
      process.env.MEEGLE_TEST_AUTH_STATE = "unauthenticated";

      const state = await createState();
      state.config = {
        ...state.config,
        plugins: {
          ...state.config.plugins,
          meegle: {
            ...state.config.plugins.meegle,
            mode: "polling",
            cliBin: bin,
            tasksFile: null,
            resultsFile: null,
            webhookSecret: null
          }
        }
      };
      state.plugins = await createBuiltinPlugins(state.config);
      const server = await buildServerWithState(state, { startScheduler: false });
      try {
        const status = await server.inject({ method: "GET", url: "/api/integrations/meegle/auth/status" });
        const start = await server.inject({ method: "POST", url: "/api/integrations/meegle/auth/start" });
        const started = start.json();
        const pending = await server.inject({
          method: "POST",
          url: "/api/integrations/meegle/auth/poll",
          payload: {
            deviceCode: started.deviceCode,
            clientId: started.clientId,
            intervalSeconds: started.intervalSeconds,
            expiresInSeconds: started.expiresInSeconds
          }
        });
        process.env.MEEGLE_TEST_AUTH_STATE = "authenticated";
        const authenticated = await server.inject({
          method: "POST",
          url: "/api/integrations/meegle/auth/poll",
          payload: {
            deviceCode: started.deviceCode,
            clientId: started.clientId,
            intervalSeconds: started.intervalSeconds,
            expiresInSeconds: started.expiresInSeconds
          }
        });

        expect(status.statusCode).toBe(200);
        expect(status.json()).toEqual(expect.objectContaining({
          status: "unauthenticated",
          authenticated: false
        }));
        expect(start.statusCode).toBe(200);
        expect(started).toEqual(expect.objectContaining({
          status: "pending",
          authorizationUrl: "https://project.feishu.cn/auth/device"
        }));
        expect(pending.statusCode).toBe(200);
        expect(pending.json()).toEqual(expect.objectContaining({
          status: "pending",
          authenticated: false
        }));
        expect(authenticated.statusCode).toBe(200);
        expect(authenticated.json()).toEqual(expect.objectContaining({
          status: "authenticated",
          authenticated: true
        }));
      } finally {
        await server.close();
      }
    } finally {
      process.env.MEEGLE_TEST_AUTH_STATE = previousAuthState;
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("exposes GitLab CLI device authorization routes from the plugin registry", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-server-gitlab-auth-"));
    const previousAuthState = process.env.GITLAB_TEST_AUTH_STATE;
    try {
      const bin = join(sandbox, "fake-glab");
      await writeServerFakeGitLabCli(bin);
      process.env.GITLAB_TEST_AUTH_STATE = "unauthenticated";

      const state = await createState();
      state.config = {
        ...state.config,
        plugins: {
          ...state.config.plugins,
          gitlab: {
            cliBin: bin,
            host: "gitlab.yc345.tv"
          }
        }
      };
      state.plugins = await createBuiltinPlugins(state.config);
      const server = await buildServerWithState(state, { startScheduler: false });
      try {
        const status = await server.inject({ method: "GET", url: "/api/integrations/gitlab/auth/status" });
        const start = await server.inject({ method: "POST", url: "/api/integrations/gitlab/auth/start" });
        const pending = await server.inject({ method: "POST", url: "/api/integrations/gitlab/auth/poll" });
        process.env.GITLAB_TEST_AUTH_STATE = "authenticated";
        const authenticated = await server.inject({ method: "POST", url: "/api/integrations/gitlab/auth/poll" });
        const logout = await server.inject({ method: "POST", url: "/api/integrations/gitlab/auth/logout" });

        expect(status.statusCode).toBe(200);
        expect(status.json()).toEqual(expect.objectContaining({
          status: "unauthenticated",
          authenticated: false,
          host: "gitlab.yc345.tv"
        }));
        expect(start.statusCode).toBe(200);
        expect(start.json()).toEqual(expect.objectContaining({
          status: "pending",
          authorizationUrl: "https://gitlab.yc345.tv/oauth/device",
          userCode: "ABCD-EFGH"
        }));
        expect(pending.statusCode).toBe(200);
        expect(pending.json()).toEqual(expect.objectContaining({
          status: "pending",
          authenticated: false
        }));
        expect(authenticated.statusCode).toBe(200);
        expect(authenticated.json()).toEqual(expect.objectContaining({
          status: "authenticated",
          authenticated: true
        }));
        expect(logout.statusCode).toBe(200);
        expect(logout.json()).toEqual({ ok: true, message: "GitLab CLI logged out" });
      } finally {
        await server.close();
      }
    } finally {
      process.env.GITLAB_TEST_AUTH_STATE = previousAuthState;
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

async function createState(overrides: Partial<RouteServiceMocks> = {}) {
  const calls = {
    createTask: [] as CreateTaskInput[],
    getTraceView: [] as string[],
    runTaskSyncNow: 0,
    runSchedulerDispatchNow: 0,
    ingestTaskFromIntegration: [] as TitingTask[]
  };
  const task = createTask();
  const traceView = {
    schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
    traceId: "trace-shared",
    tasks: [task],
    transitions: [createTransition(task)],
    executions: [createExecution(task.id)],
    executionLogs: [createExecutionLog(task.id)],
    evalResults: [createEvalResult(task.id)],
    repairGoals: [createRepairGoal(task.id)]
  };
  const services: RouteServiceMocks = {
    createTask: async (input) => {
      calls.createTask.push(input);
      return task;
    },
    listTasks: async () => [task],
    getTask: async () => task,
    submitTask: async () => ({ ...task, status: "ready" }),
    resumeTask: async () => ({ ...task, status: "ready" }),
    reopenTask: async () => ({ ...task, status: "draft" }),
    validateTask: async () => ({ ...task, status: "draft" }),
    queueTask: async () => ({ ...task, status: "ready" }),
    retryTask: async () => ({ ...task, status: "ready" }),
    blockTask: async () => ({ ...task, status: "waiting" }),
    markNeedsHuman: async () => ({ ...task, status: "waiting" }),
    recoverTask: async () => ({ ...task, status: "ready" }),
    syncHumanRepairIssue: async () => ({
      ready: false,
      recovered: false,
      childExternalId: null,
      replyId: null,
      summary: "Child repair issue is not ready"
    }),
    syncHumanReply: async () => ({
      ready: false,
      recovered: false,
      externalId: null,
      replyId: null,
      summary: "No tagged human reply found"
    }),
    cancelTask: async () => ({ ...task, status: "cancelled" }),
    listExecutions: async () => [createExecution(task.id)],
    listRuns: async () => [createRunExecution(task.id)],
    getRunObservability: async () => createRunObservability(),
    listRunRawLogs: async () => createRunRawLogs(),
    listTaskTransitions: async () => [createTransition(task)],
    listExecutionLogs: async () => [createExecutionLog(task.id)],
    getTaskObservability: async () => ({
      schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
      taskId: task.id,
      transitions: [createTransition(task)],
      executionLogs: [createExecutionLog(task.id)]
    }),
    getTraceView: async (traceId) => {
      calls.getTraceView.push(traceId);
      return { ...traceView, traceId };
    },
    listEvalResults: async () => [createEvalResult(task.id)],
    getRepairGoal: async () => createRepairGoal(task.id),
    listAgents: async () => [createAgent()],
    heartbeatAgent: async () => createAgent(),
    disableAgent: async () => ({ ...createAgent(), status: "disabled" }),
    enableAgent: async () => createAgent(),
    recoverAgent: async () => createAgent(),
    listPlugins: async () => createPlugins(),
    listPluginConfigs: async () => [createPluginConfig()],
    upsertPluginConfig: async (input) => ({
      ...createPluginConfig(),
      pluginId: input.pluginId,
      kind: input.kind,
      enabled: input.enabled,
      priority: input.priority,
      config: input.config
    }),
    dashboard: async () => ({
      tasks: { total: 1, byStatus: { ready: 1 } },
      agents: { total: 1, byStatus: { idle: 1 } },
      plugins: { total: 4, healthy: 4 }
    }),
    runTaskSyncNow: async () => {
      calls.runTaskSyncNow += 1;
      return { integrations: 1, pulledTasks: 2 };
    },
    runSchedulerDispatchNow: async () => {
      calls.runSchedulerDispatchNow += 1;
      return { queuedBefore: 3 };
    },
    runSchedulerTick: async () => undefined,
    startIdleHeartbeatLoop: () => () => undefined,
    startAgentWorkerPool: () => () => undefined,
    upsertAgent: async () => undefined,
    ingestTaskFromIntegration: async (task) => {
      calls.ingestTaskFromIntegration.push(task);
      return task;
    },
    ...overrides
  };

  return {
    services,
    calls,
    events: new InMemoryEventStream(),
    runAttempts: (() => {
      const repo = new InMemoryRunAttemptRepository();
      void repo.create({
        id: "attempt-1",
        taskId: "task-1",
        agentId: "agent-1",
        stage: "executing",
        startedAt: new Date("2026-05-11T00:02:00.000Z"),
        metadata: {}
      });
      return repo;
    })(),
    config: createConfig(),
    plugins: await createBuiltinPlugins(createConfig()),
    pool: {
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => undefined
    }
  };
}

type RouteServiceMocks = Pick<
  TitingServices,
  | "createTask"
  | "listTasks"
  | "getTask"
  | "submitTask"
  | "resumeTask"
  | "retryTask"
  | "reopenTask"
  | "validateTask"
  | "queueTask"
  | "blockTask"
  | "markNeedsHuman"
  | "recoverTask"
  | "syncHumanRepairIssue"
  | "syncHumanReply"
  | "cancelTask"
  | "listExecutions"
  | "listRuns"
  | "getRunObservability"
  | "listRunRawLogs"
  | "listTaskTransitions"
  | "listExecutionLogs"
  | "getTaskObservability"
  | "getTraceView"
  | "listEvalResults"
  | "getRepairGoal"
  | "listAgents"
  | "heartbeatAgent"
  | "disableAgent"
  | "enableAgent"
  | "recoverAgent"
  | "listPlugins"
  | "listPluginConfigs"
  | "upsertPluginConfig"
  | "dashboard"
  | "runTaskSyncNow"
  | "runSchedulerDispatchNow"
  | "runSchedulerTick"
  | "startIdleHeartbeatLoop"
  | "startAgentWorkerPool"
  | "upsertAgent"
  | "ingestTaskFromIntegration"
>;

function createConfig(): ServerConfig {
  return {
    ...CONFIG_DEFAULTS,
    workspace: {
      ...CONFIG_DEFAULTS.workspace,
      root: "/tmp/diting-workspaces",
      repoCacheRoot: "/tmp/diting-repos"
    },
    plugins: {
      ...CONFIG_DEFAULTS.plugins,
      execution: {
        ...CONFIG_DEFAULTS.plugins.execution,
        defaultExecutor: "programming"
      },
      agents: {
        ...CONFIG_DEFAULTS.plugins.agents,
        defaultRuntime: "codex"
      },
      meegle: {
        mode: "webhook",
        tasksFile: null,
        resultsFile: null,
        webhookSecret: "secret-1"
      }
    }
  };
}

function createTask(): TitingTask {
  const now = new Date("2026-05-11T00:00:00.000Z");
  return {
    id: "task-1",
    source: "manual",
    externalId: null,
    title: "Fix build",
    instruction: "Run build and fix errors",
    repo: "repo",
    branch: "main",
    priority: "medium",
    status: "ready",
    executor: "codex",
    traceId: "trace-shared",
    constraints: [],
    acceptanceCriteria: [],
    metadata: {},
    retryCount: 0,
    repairCount: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function createTransition(task: TitingTask): TaskTransition {
  return {
    taskId: task.id,
    traceId: task.traceId,
    from: "draft",
    to: "ready",
    reason: "ready",
    operator: "api",
    timestamp: new Date("2026-05-11T00:01:00.000Z")
  };
}

function createExecution(taskId: string): ExecutionRecord {
  return {
    id: "execution-1",
    taskId,
    agentId: "agent-1",
    workspace: "/tmp/task-1",
    status: "completed",
    summary: "done",
    executor: "codex",
    startedAt: new Date("2026-05-11T00:02:00.000Z"),
    endedAt: new Date("2026-05-11T00:03:00.000Z")
  };
}

function createRunExecution(taskId: string): ExecutionRecord {
  return {
    id: "exec-1",
    taskId,
    agentId: "agent-1",
    workspace: "/tmp/task-1",
    status: "executing",
    summary: null,
    executor: "codex",
    startedAt: new Date("2026-05-11T00:02:00.000Z"),
    endedAt: null
  };
}

function createRunObservability(): RunObservability {
  return {
    schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
    run: createRunExecution("task-1"),
    stages: [
      {
        key: "execute",
        label: "Execute",
        status: "done",
        startedAt: new Date("2026-05-11T00:02:00.000Z"),
        endedAt: new Date("2026-05-11T00:03:00.000Z"),
        summary: "done"
      }
    ],
    steps: [],
    plugins: [
      {
        pluginId: "codex",
        kind: "agent",
        participationSource: "actual",
        fallbackReason: null,
        status: "done",
        health: "healthy",
        summary: "ok",
        lastEventAt: new Date("2026-05-11T00:03:00.000Z")
      }
    ],
    rawLogs: {
      available: true,
      endpoint: "/api/runs/exec-1/raw-logs",
      sources: ["stdout"],
      scope: "run",
      redacted: true
    }
  };
}

function createRunRawLogs(): RunRawLogsResponse {
  return {
    schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
    runId: "exec-1",
    taskId: "task-1",
    scope: "run",
    redacted: true,
    items: [
      {
        id: "exec-1:stdout:1",
        runId: "exec-1",
        taskId: "task-1",
        source: "stdout",
        channel: "executor_stdout",
        stage: "execute",
        pluginId: "codex",
        createdAt: new Date("2026-05-11T00:02:00.000Z"),
        text: "build ok",
        redacted: true
      }
    ],
    nextCursor: null
  };
}

function createExecutionLog(taskId: string): ExecutionLogRecord {
  return {
    id: "log-1",
    taskId,
    executionId: "execution-1",
    eventType: "task.transition",
    message: "ready",
    data: { to: "ready" },
    createdAt: new Date("2026-05-11T00:01:00.000Z")
  };
}

function createEvalResult(taskId: string): EvalResult {
  return {
    id: "eval-1",
    taskId,
    executionId: "execution-1",
    passed: true,
    score: 100,
    riskLevel: "low",
    report: {},
    createdAt: new Date("2026-05-11T00:03:30.000Z")
  };
}

function createRepairGoal(taskId: string): RepairGoal {
  return {
    id: "goal-1",
    taskId,
    objective: "repair build",
    constraints: [],
    doneWhen: ["tests pass"],
    status: "achieved",
    currentIteration: 1,
    maxIterations: 3,
    lastFailureHash: null,
    metadata: {},
    createdAt: new Date("2026-05-11T00:03:00.000Z"),
    updatedAt: new Date("2026-05-11T00:04:00.000Z")
  };
}

function createAgent(): AgentRecord {
  const now = new Date("2026-05-11T00:00:00.000Z");
  return {
    id: "agent-1",
    status: "idle",
    taskId: null,
    executor: "codex",
    labels: ["local"],
    lastHeartbeatAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function createPluginConfig(): PluginConfig {
  return {
    id: "plugin-config-1",
    pluginId: "meegle",
    kind: "task-integration",
    enabled: true,
    priority: 10,
    config: { mode: "poll" },
    updatedAt: new Date("2026-05-11T00:00:00.000Z")
  };
}

function createPlugins() {
  return [
    {
      id: "env",
      kind: "environment" as const,
      priority: 100,
      capabilities: ["local"],
      displayName: "Environment",
      binaryPath: null,
      runtimeSource: null,
      runtimeKind: null,
      health: { healthy: true, message: "ok" }
    },
    {
      id: "codex",
      kind: "agent" as const,
      priority: 100,
      capabilities: ["programming", "codex"],
      displayName: "Codex",
      binaryPath: "/usr/local/bin/codex",
      runtimeSource: "config",
      runtimeKind: "codex",
      health: { healthy: true, message: "ok" }
    },
    {
      id: "quality",
      kind: "quality" as const,
      priority: 100,
      capabilities: ["checks"],
      displayName: "Quality",
      binaryPath: null,
      runtimeSource: null,
      runtimeKind: null,
      health: { healthy: true, message: "ok" }
    },
    {
      id: "governance",
      kind: "observability-governance" as const,
      priority: 100,
      capabilities: ["events"],
      displayName: "Governance",
      binaryPath: null,
      runtimeSource: null,
      runtimeKind: null,
      health: { healthy: true, message: "ok" }
    }
  ];
}

async function seedOpsEvents(stream: InMemoryEventStream): Promise<void> {
  const base = new Date("2026-05-11T00:00:00.000Z");
  const events: ObservabilityEvent[] = [
    createOpsEvent({
      id: "event-1",
      taskId: "task-1",
      traceId: "trace-shared",
      eventType: "execution.retry_scheduled",
      message: "Execution failure scheduled for retry",
      createdAt: new Date(base.getTime() + 1_000)
    }),
    createOpsEvent({
      id: "event-2",
      taskId: "task-2",
      traceId: "trace-2",
      eventType: "execution.blocked",
      message: "Execution failure blocked task",
      createdAt: new Date(base.getTime() + 2_000)
    }),
    createOpsEvent({
      id: "event-3",
      traceId: "scheduler",
      eventType: "scheduler.tick_skipped",
      message: "Scheduler tick skipped",
      createdAt: new Date(base.getTime() + 3_000)
    }),
    createOpsEvent({
      id: "event-4",
      taskId: "task-1",
      traceId: "trace-shared",
      eventType: "execution.retry_scheduled",
      message: "Execution failure scheduled for retry",
      createdAt: new Date(base.getTime() + 4_000)
    }),
    createOpsEvent({
      id: "event-5",
      traceId: "agent:agent-1",
      eventType: "agent.offline",
      message: "Agent marked offline after heartbeat timeout",
      createdAt: new Date(base.getTime() + 5_000)
    })
  ];

  for (const event of events) {
    await stream.publish(event);
  }
}

function createOpsEvent(
  input: Partial<ObservabilityEvent> & Pick<ObservabilityEvent, "id" | "traceId" | "eventType" | "message" | "createdAt">
): ObservabilityEvent {
  return {
    schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
    data: {},
    ...input
  };
}

async function writeServerFakeMeegleCli(path: string): Promise<void> {
  await writeFile(
    path,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const print = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === "auth" && args[1] === "status") {
  if (process.env.MEEGLE_TEST_AUTH_STATE === "unauthenticated") {
    process.stderr.write("Meegle authorization required");
    process.exit(1);
  }
  print({ authenticated: true, host: "project.feishu.cn" });
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "login" && args.includes("--phase") && args.includes("init")) {
  print({
    authorization_url: "https://project.feishu.cn/auth/device",
    device_code: "device-123",
    client_id: "client-123",
    interval: 2,
    expires_in: 600
  });
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "login" && args.includes("--phase") && args.includes("poll")) {
  if (process.env.MEEGLE_TEST_AUTH_STATE === "authenticated") {
    print({ authenticated: true, host: "project.feishu.cn" });
    process.exit(0);
  }
  print({ status: "pending", authenticated: false });
  process.exit(0);
}
process.exit(1);
`
  );
  await execFileAsync("chmod", ["+x", path]);
}

async function writeServerFakeGitLabCli(path: string): Promise<void> {
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
process.exit(1);
`
  );
  await execFileAsync("chmod", ["+x", path]);
}
