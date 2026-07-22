/**
 * Fastify HTTP 网关与运行时装配：SQLite 校验与迁移、`PluginRuntime` +
 * `TitingServices` 组装、REST `/api/*`、SSE `/api/events`、readiness，以及支持
 * `registerRoutes` 的插件扩展路由。
 */
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import {
  AgentRecord,
  CreateTaskInput,
  ExecutionRecord,
  ObservabilityEvent,
  PluginConfigRepository,
  RunAttemptRepository,
  RunRawLogItem,
  RuntimePlugin,
  TitingTask
} from "@diting/plugin-api";
import { NotFoundError, PluginRuntime, TitingServices } from "@diting/core";
import { readConfig, ServerConfig } from "./config";
import { createDatabase, DatabaseClient } from "./database";
import { EventStreamView } from "./event-stream";
import { isHttpRoutePlugin } from "./http-plugin";
import { FileExecutionLogRepository, FileLogEventStream } from "./log-adapters";
import { runMigrations } from "./migration-runner";
import { buildOpsView } from "./ops-view";
import { verifyDatabaseConnection } from "./startup-errors";
import { DependencyCheckCategory, DependencyCheckService } from "./dependency-checks";
import {
  PgAgentLeaseRepository,
  PgAgentRepository,
  PgEvalResultRepository,
  PgExecutionRepository,
  PgHumanReviewRepository,
  PgPluginConfigRepository,
  PgRepairGoalRepository,
  PgRunAttemptRepository,
  PgTaskRepository,
  PgTaskTransitionRepository
} from "./repositories";
import { createResolvedPlugins } from "./external-plugins";
import { buildServerServiceHooks } from "./server-integration";
import { buildTaskLifecycleDiagnostics } from "./task-lifecycle-diagnostics";

/** HTTP 路由仅依赖的服务方法子集，缩小 `wireRoutes` 与测试 mock 的表面。 */
type RouteServices = Pick<
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

type ServerPool = DatabaseClient;

/** `buildServer` 完成后的可关闭资源与对外状态，供 `buildServerWithState` 挂载 HTTP。 */
type BootstrapState = {
  services: RouteServices;
  events: EventStreamView;
  pool: ServerPool;
  runAttempts: RunAttemptRepository;
  config: ServerConfig;
  plugins: RuntimePlugin[];
};

/**
 * 生产路径：建库 → 迁移 → 仓储与插件 → `TitingServices` → 默认调度器 + 全量路由。
 */
export async function buildServer(config: ServerConfig = readConfig()) {
  const database = createDatabase();
  try {
    await verifyDatabaseConnection(database.pool);
    await runMigrations(database.pool);
  } catch (error) {
    await database.pool.end().catch(() => undefined);
    throw error;
  }

  const tasks = new PgTaskRepository(database.pool);
  const taskTransitions = new PgTaskTransitionRepository(database.pool);
  const runAttempts = new PgRunAttemptRepository(database.pool);
  const executions = new PgExecutionRepository(database.pool);
  const agents = new PgAgentRepository(database.pool);
  const agentLeases = new PgAgentLeaseRepository(database.pool);
  const repairGoals = new PgRepairGoalRepository(database.pool);
  const humanReviews = new PgHumanReviewRepository(database.pool);
  const evalResults = new PgEvalResultRepository(database.pool);
  const pluginConfigs: PluginConfigRepository = new PgPluginConfigRepository(database.pool);
  const resolvedPlugins = await createResolvedPlugins(config);
  const runtime = new PluginRuntime(resolvedPlugins, await pluginConfigs.list());
  await runtime.init();
  const logPlugin = runtime.selectLogPlugin();
  const events = new FileLogEventStream(logPlugin);
  const executionLogs = new FileExecutionLogRepository(logPlugin);

  const services = new TitingServices({
    tasks,
    taskTransitions,
    runAttempts,
    executions,
    executionLogs,
    agentLeases,
    agents,
    repairGoals,
    humanReviews,
    evalResults,
    pluginConfigs,
    events,
    runtime,
    agentOfflineTimeoutMs: config.scheduler.agentOfflineTimeoutMs,
    agentWorkerPollIntervalMs: config.scheduler.agentWorkerPollIntervalMs,
    environmentRetryLimit: config.goalRecovery.environmentRetryLimit,
    executionRetryLimit: config.goalRecovery.executionRetryLimit,
    maxRepairIterations: config.goalRecovery.maxRepairIterations,
    enableNeedsHumanLoop: config.goalRecovery.enableNeedsHumanLoop,
    enableOpenSpecReviewGate: config.openspecReview.gateEnabled,
    createId: () => randomUUID(),
    ...buildServerServiceHooks(config, runtime.list())
  });

  await seedAgents(
    services,
    config.scheduler.agentCount,
    config.scheduler.agents.product.count,
    config.plugins.agents.product.defaultRuntime,
    config.scheduler.agents.quality.count,
    config.plugins.agents.quality.defaultRuntime
  );
  return buildServerWithState(
    { services, events, pool: database.pool, runAttempts, config, plugins: runtime.list() },
    { schedulerIntervalMs: config.scheduler.intervalMs, logger: true, startScheduler: true }
  );
}

/**
 * 在已构造的 `BootstrapState` 上挂载 Fastify（测试注入、或与 `buildServer` 解耦时使用）。
 */
export async function buildServerWithState(
  state: BootstrapState,
  options: { schedulerIntervalMs?: number; logger?: boolean; startScheduler?: boolean } = {}
) {
  const fastify = Fastify({ logger: options.logger ?? false });
  await fastify.register(cors, { origin: true });
  wireRoutes(fastify, state);

  const startScheduler = options.startScheduler ?? true;
  const schedulerTimer = startScheduler
    ? setInterval(() => {
        void state.services.runSchedulerTick().catch((error: unknown) => {
          fastify.log.error(error);
        });
      }, options.schedulerIntervalMs ?? 30_000)
    : null;
  schedulerTimer?.unref?.();
  const stopIdleHeartbeat = startScheduler ? state.services.startIdleHeartbeatLoop() : null;
  const stopAgentWorkers = startScheduler ? state.services.startAgentWorkerPool() : null;

  if (startScheduler) {
    void state.services.runSchedulerTick().catch((error: unknown) => {
      fastify.log.error(error);
    });
  }

  fastify.addHook("onClose", async () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
    }
    stopIdleHeartbeat?.();
    stopAgentWorkers?.();
    await state.pool.end();
  });

  return fastify;
}

/** 挂载错误处理、`/api` 路由、SSE，以及实现了 `HttpRoutePlugin.registerRoutes` 的插件路由。 */
function wireRoutes(fastify: FastifyInstance, state: BootstrapState): void {
  fastify.setErrorHandler((error: Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof NotFoundError) {
      void reply.status(404).send({ error: error.message });
      return;
    }
    const statusCode = error.name === "ConflictError" ? 409 : error.name === "InvalidTransitionError" ? 400 : 500;
    void reply.status(statusCode).send({ error: error.message });
  });

  fastify.get("/api/health", async () => ({
    ok: true,
    status: "alive",
    schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
    service: "diting",
    timestamp: new Date().toISOString()
  }));

  fastify.get("/api/readiness", async (_request: FastifyRequest, reply: FastifyReply) => {
    const readiness = await buildReadiness(state);
    return reply.status(readiness.ok ? 200 : 503).send(readiness);
  });

  fastify.get("/api/tasks", async (request: FastifyRequest) => {
    const query = request.query as { status?: TitingTask["status"]; executor?: string; agentKind?: string };
    return state.services.listTasks(query);
  });

  fastify.post("/api/tasks", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<CreateTaskInput>;
    if (!body?.title || !body?.instruction || !body?.repo) {
      return reply.status(400).send({ error: "title, instruction, and repo are required" });
    }
    const task = await state.services.createTask({
      title: body.title,
      instruction: body.instruction,
      repo: body.repo,
      branch: body.branch,
      priority: body.priority,
      executor: body.executor,
      agentKind: body.agentKind,
      capability: body.capability,
      preferredDriver: body.preferredDriver,
      preferredRuntime: body.preferredRuntime,
      source: body.source,
      externalId: body.externalId,
      constraints: body.constraints,
      acceptanceCriteria: body.acceptanceCriteria,
      metadata: body.metadata
    });
    return reply.status(201).send(task);
  });

  fastify.get("/api/tasks/:id", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    const task = await state.services.getTask(params.id);
    const diagnostics = await buildTaskLifecycleDiagnostics(task, state.runAttempts);
    return { ...task, ...diagnostics };
  });

  fastify.post("/api/tasks/:id/submit", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.submitTask(params.id, "api");
  });

  fastify.post("/api/tasks/:id/resume", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.resumeTask(params.id, "api");
  });

  fastify.post("/api/tasks/:id/reopen", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.reopenTask(params.id, "api");
  });

  fastify.post("/api/tasks/:id/validate", async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(410).send({
      error: "Use POST /api/tasks/:id/submit instead of /validate",
      migration: { replacement: "/api/tasks/:id/submit" }
    });
  });

  fastify.post("/api/tasks/:id/queue", async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(410).send({
      error: "Use POST /api/tasks/:id/submit instead of /queue",
      migration: { replacement: "/api/tasks/:id/submit" }
    });
  });

  fastify.post("/api/tasks/:id/retry", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.retryTask(params.id, "api");
  });

  fastify.post("/api/tasks/:id/block", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    return state.services.blockTask(params.id, body.reason, "api");
  });

  fastify.post("/api/tasks/:id/needs-human", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    return state.services.markNeedsHuman(params.id, body.reason, "api");
  });

  fastify.post("/api/tasks/:id/recover", async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(410).send({
      error: "Use POST /api/tasks/:id/resume or /reopen instead of /recover",
      migration: { replacement: "/api/tasks/:id/resume" }
    });
  });

  fastify.post("/api/tasks/:id/sync-human-repair-issue", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.syncHumanRepairIssue(params.id, "api");
  });

  fastify.post("/api/tasks/:id/sync-human-reply", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.syncHumanReply(params.id, "api");
  });

  fastify.post("/api/tasks/:id/cancel", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.cancelTask(params.id, "api");
  });

  fastify.get("/api/runs", async (request: FastifyRequest) => {
    const query = request.query as {
      taskId?: string;
      agentId?: string;
      status?: ExecutionRecord["status"];
      limit?: string;
      cursor?: string;
    };
    return state.services.listRuns({
      taskId: query.taskId,
      agentId: query.agentId,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor
    });
  });

  fastify.get("/api/runs/:id/observability", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.getRunObservability(params.id);
  });

  fastify.get("/api/runs/:id/raw-logs", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    const query = request.query as {
      source?: RunRawLogItem["source"];
      q?: string;
      limit?: string;
      cursor?: string;
    };
    return state.services.listRunRawLogs(params.id, {
      source: query.source,
      q: query.q,
      limit: query.limit ? Number(query.limit) : undefined,
      cursor: query.cursor
    });
  });

  fastify.get("/api/tasks/:id/executions", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.listExecutions(params.id);
  });

  fastify.get("/api/tasks/:id/transitions", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.listTaskTransitions(params.id);
  });

  fastify.get("/api/ops-view", async () => buildOpsView(state.services));

  fastify.get("/api/tasks/:id/logs", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.listExecutionLogs(params.id);
  });

  fastify.get("/api/tasks/:id/observability", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    const [task, observability] = await Promise.all([
      state.services.getTask(params.id),
      state.services.getTaskObservability(params.id)
    ]);
    const diagnostics = await buildTaskLifecycleDiagnostics(task, state.runAttempts);
    return {
      ...observability,
      currentAttempt: diagnostics.currentAttempt,
      waitReason: diagnostics.waitReason ?? observability.waitReason ?? null
    };
  });

  fastify.get("/api/traces/:traceId", async (request: FastifyRequest) => {
    const params = request.params as { traceId: string };
    return state.services.getTraceView(params.traceId);
  });

  fastify.get("/api/tasks/:id/eval-results", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.listEvalResults(params.id);
  });

  fastify.get("/api/tasks/:id/repair-goal", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.getRepairGoal(params.id);
  });

  fastify.get("/api/agents", async () => state.services.listAgents());
  fastify.post("/api/agents/:id/heartbeat", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as { status?: AgentRecord["status"] };
    return state.services.heartbeatAgent(params.id, body.status);
  });
  fastify.post("/api/agents/:id/disable", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.disableAgent(params.id);
  });
  fastify.post("/api/agents/:id/enable", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.enableAgent(params.id);
  });
  fastify.post("/api/agents/:id/recover", async (request: FastifyRequest) => {
    const params = request.params as { id: string };
    return state.services.recoverAgent(params.id);
  });
  fastify.get("/api/plugins", async () => state.services.listPlugins());
  fastify.get("/api/dependency-checks", async (request: FastifyRequest) => {
    const query = request.query as { category?: DependencyCheckCategory; requiredFor?: string; id?: string | string[] };
    const ids = Array.isArray(query.id) ? query.id : query.id ? [query.id] : undefined;
    const service = new DependencyCheckService(state.plugins, { gitlab: state.config.plugins.gitlab });
    return service.list({ category: query.category, requiredFor: query.requiredFor, ids });
  });
  fastify.post("/api/dependency-checks/recheck", async (request: FastifyRequest) => {
    const body = request.body as { category?: DependencyCheckCategory; requiredFor?: string; ids?: string[] } | undefined;
    const service = new DependencyCheckService(state.plugins, { gitlab: state.config.plugins.gitlab });
    return service.list({ category: body?.category, requiredFor: body?.requiredFor, ids: body?.ids });
  });
  fastify.get("/api/plugin-configs", async () => state.services.listPluginConfigs());
  fastify.post("/api/plugin-configs", async (request: FastifyRequest) => {
    const body = request.body as {
      pluginId: string;
      kind: "task-integration" | "agent" | "execution" | "environment" | "completion-gate" | "quality" | "observability-governance" | "log";
      enabled: boolean;
      priority: number;
      config?: Record<string, unknown>;
    };
    return state.services.upsertPluginConfig({
      pluginId: body.pluginId,
      kind: body.kind,
      enabled: body.enabled,
      priority: body.priority,
      config: body.config ?? {}
    });
  });
  fastify.get("/api/dashboard", async () => state.services.dashboard());
  fastify.get("/api/ops/events", async () => {
    const [tasks, events] = await Promise.all([state.services.listTasks(), Promise.resolve(state.events.snapshot())]);
    return buildOpsEventSnapshot(tasks, events);
  });
  fastify.post("/api/debug/sync", async () => state.services.runTaskSyncNow());
  fastify.post("/api/debug/scheduler", async () => state.services.runSchedulerDispatchNow());

  // Server-Sent Events：先 replay 当前快照，再订阅后续；客户端断开时取消监听。
  fastify.get("/api/events", async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;
    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    };
    if (typeof origin === "string" && origin.length > 0) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers.Vary = "Origin";
    }

    reply.hijack();
    reply.raw.writeHead(200, headers);
    reply.raw.write(": connected\n\n");

    for (const event of state.events.snapshot()) {
      reply.raw.write(formatSseEvent(event));
    }

    const unsubscribe = state.events.subscribe((event) => {
      reply.raw.write(formatSseEvent(event));
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(": keepalive\n\n");
    }, 25_000);
    heartbeat.unref?.();

    reply.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  for (const plugin of state.plugins) {
    if (!isHttpRoutePlugin(plugin)) {
      continue;
    }
    plugin.registerRoutes?.(fastify, {
      services: state.services,
      config: state.config
    });
  }
}

/**
 * SSE `data` 行承载完整 ObservabilityEvent JSON。
 * 使用默认 `message` 通道，以便浏览器 `EventSource.onmessage` 能收到（自定义 `event:` 名不会触发 onmessage）。
 */
function formatSseEvent(data: unknown): string {
  return `event: message\ndata: ${JSON.stringify(data)}\n\n`;
}

const OPS_WATCH_EVENT_TYPES = [
  "execution.blocked",
  "execution.retry_scheduled",
  "scheduler.tick_skipped",
  "agent.offline",
  "plugin.integration_skipped"
] as const;

/** 运维视角：聚合关注事件类型计数、排行榜与关联任务的摘要列表。 */
function buildOpsEventSnapshot(tasks: TitingTask[], events: ObservabilityEvent[]) {
  const watchSet = new Set<string>(OPS_WATCH_EVENT_TYPES);
  const sortedEvents = [...events].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
  const watchedEvents = sortedEvents.filter((event) => watchSet.has(event.eventType));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const countsByEventType = watchedEvents.reduce<Record<string, number>>((result, event) => {
    result[event.eventType] = (result[event.eventType] ?? 0) + 1;
    return result;
  }, {});

  const recentAbnormalTasks = new Map<
    string,
    {
      taskId: string;
      title: string;
      status: string;
      traceId: string;
      eventType: string;
      message: string;
      createdAt: Date;
      retryCount: number;
      repairCount: number;
    }
  >();
  for (const event of watchedEvents) {
    if (!event.taskId || recentAbnormalTasks.has(event.taskId)) {
      continue;
    }
    const task = taskById.get(event.taskId);
    if (!task) {
      continue;
    }
    recentAbnormalTasks.set(event.taskId, {
      taskId: task.id,
      title: task.title,
      status: task.status,
      traceId: task.traceId,
      eventType: event.eventType,
      message: event.message,
      createdAt: event.createdAt,
      retryCount: task.retryCount,
      repairCount: task.repairCount
    });
  }

  return {
    focusEventTypes: [...OPS_WATCH_EVENT_TYPES],
    watchedEventCount: watchedEvents.length,
    eventTypeCounts: countsByEventType,
    eventTypeRanking: Object.entries(countsByEventType)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([eventType, count]) => ({ eventType, count })),
    recentWatchedEvents: watchedEvents.slice(0, 12).map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString()
    })),
    recentAbnormalTasks: [...recentAbnormalTasks.values()].slice(0, 8).map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    }))
  };
}

/** `/api/readiness`：DB `select 1` + 必备插件种类 health。 */
async function buildReadiness(state: BootstrapState) {
  const databaseCheck = await checkDatabase(state.pool);
  const plugins = await state.services.listPlugins();
  const pluginReadiness = evaluatePluginReadiness(plugins);
  const ok = databaseCheck.ok && pluginReadiness.ok;
  return {
    ok,
    status: ok ? "ready" : "degraded",
    schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
    service: "diting",
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseCheck,
      plugins: pluginReadiness
    }
  };
}

/** readiness 中的数据库探测：单次 `select 1`。 */
async function checkDatabase(pool: Pick<ServerPool, "query">): Promise<{ ok: boolean; message: string }> {
  try {
    await pool.query("select 1");
    return { ok: true, message: "Database connection is ready" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/** 环境、执行、可观测治理三类必须存在且 `health.healthy`。 */
function evaluatePluginReadiness(
  plugins: Awaited<ReturnType<TitingServices["listPlugins"]>>
): {
  ok: boolean;
  message: string;
  total: number;
  healthy: number;
  requiredKinds: Record<string, boolean>;
  items: Awaited<ReturnType<TitingServices["listPlugins"]>>;
} {
  const requiredKinds = {
    environment: plugins.some((plugin) => plugin.kind === "environment" && plugin.health.healthy),
    agent: plugins.some((plugin) => plugin.kind === "agent" && plugin.health.healthy),
    "observability-governance": plugins.some(
      (plugin) => plugin.kind === "observability-governance" && plugin.health.healthy
    )
  };
  const ok = Object.values(requiredKinds).every(Boolean);
  return {
    ok,
    message: ok ? "Required plugin kinds are ready" : "One or more required plugin kinds are unhealthy",
    total: plugins.length,
    healthy: plugins.filter((plugin) => plugin.health.healthy).length,
    requiredKinds,
    items: plugins
  };
}

/**
 * 确保存在 `programming-agent-*` 占位 Agent；空闲旧 executor Agent 会被摘除。
 */
export async function seedAgents(
  services: TitingServices,
  agentCount: number,
  productAgentCount = 0,
  productRuntimeProvider: "codex" | "cursor" = "codex",
  qualityAgentCount = 0,
  qualityRuntimeProvider: "codex" | "cursor" = "codex"
): Promise<void> {
  const existing = await services.listAgents();
  const byKey = new Map(existing.map((agent) => [agent.id, agent]));
  const now = new Date();
  const desired: AgentRecord[] = [];
  for (let index = 1; index <= agentCount; index += 1) {
    desired.push({
      id: `programming-agent-${index}`,
      status: "idle",
      taskId: null,
      executor: "programming",
      kind: "programming",
      driverId: "coding",
      labels: ["local"],
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now
    });
  }
  for (let index = 1; index <= productAgentCount; index += 1) {
    desired.push({
      id: `product-agent-${index}`,
      status: "idle",
      taskId: null,
      executor: "product",
      kind: "product",
      driverId: "openspec-product",
      runtimeProviderId: productRuntimeProvider,
      labels: ["local", "openspec"],
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now
    });
  }
  for (let index = 1; index <= qualityAgentCount; index += 1) {
    desired.push({
      id: `quality-agent-${index}`,
      status: "idle",
      taskId: null,
      executor: "quality",
      kind: "quality",
      driverId: "quality-orchestrator",
      runtimeProviderId: qualityRuntimeProvider,
      labels: ["local", "quality", "review"],
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  for (const agent of desired) {
    const existingAgent = byKey.get(agent.id);
    if (!existingAgent) {
      await services.upsertAgent(agent);
      continue;
    }
    if ((existingAgent.status === "idle" || existingAgent.status === "offline") && existingAgent.taskId === null) {
      await services.upsertAgent({
        ...existingAgent,
        status: "idle",
        executor: agent.executor,
        kind: agent.kind ?? "programming",
        driverId: agent.driverId ?? "coding",
        runtimeProviderId: agent.runtimeProviderId,
        labels: agent.labels,
        lastHeartbeatAt: now,
        updatedAt: now
      });
    }
  }

  for (const agent of existing) {
    if (!["codex", "cursor"].includes(agent.executor) || agent.taskId !== null || agent.status === "busy") {
      continue;
    }
    await services.upsertAgent({
      ...agent,
      status: "disabled",
      kind: agent.kind ?? "programming",
      driverId: agent.driverId ?? "coding",
      updatedAt: now
    });
  }
}
