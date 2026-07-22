/**
 * Titing **领域门面**：聚合仓储、`PluginRuntime`、任务命令/查询与后台调度。
 *
 * - **本类**：任务与 Agent 生命周期、可观测读模型（trace/dashboard）、插件配置 API；
 *   将周期调度委托给 `ServiceScheduler`。
 * - **内部协作**：`ServiceSupport`（迁移+日志+事件）、`ServiceExecution`（单次执行与质量/修复）、
 *   `ServiceScheduler`（拉单、离线恢复、`queued`→`running`）。
 * - **细粒度门面**（便于客户端只依赖子集）：`taskCommands`、`taskQueries`、`scheduler`、
 *   `repairLoop`、`humanIntervention`、`pluginAdmin`；`executionOrchestrator` 为薄适配层。
 *
 * @see ServiceDependencies
 */
import {
  AgentRecord,
  CreateTaskInput,
  EvalResult,
  ExecutionListQuery,
  ExecutionLogRecord,
  ExecutionRecord,
  PluginConfig,
  RawLogQuery,
  RepairGoal,
  RunObservability,
  RunRawLogsResponse,
  RuntimePlugin,
  RunAttempt,
  TaskListQuery,
  TaskTransition,
  TitingTask,
  WaitReason
} from "@diting/plugin-api";
import { randomUUID } from "node:crypto";
import { NotFoundError } from "./errors";
import { ExecutionOrchestrator } from "./execution-orchestrator";
import { HumanInterventionService } from "./human-intervention-service";
import { PluginAdminService } from "./plugin-admin-service";
import { RepairLoopService } from "./repair-loop-service";
import { SchedulerService } from "./scheduler-service";
import { TaskCommandService } from "./task-command-service";
import { TaskQueryService } from "./task-query-service";
import {
  attachBranchMetadata,
  appendHumanGuidanceConstraint,
  appendHumanReplyToInstruction,
  buildDefaultTaskBranch,
  countBy,
  normalizeOptionalBranch,
  normalizeAgentRequest,
  readHumanLoopMetadata,
  ServiceConfig,
  ServiceDependencies,
  sortHumanReplies,
  trimReplyIds
} from "./service-shared";
import { ServiceSupport } from "./service-support";
import { ServiceExecution } from "./service-execution";
import { ServiceScheduler } from "./service-scheduler";
import { ServiceAgentWorkerPool } from "./agent-worker-pool";
import { buildRunObservabilityView } from "./run-observability";

export type { ServiceDependencies } from "./service-shared";

export type HumanRepairIssueSyncResult = {
  ready: boolean;
  recovered: boolean;
  childExternalId: string | null;
  replyId: string | null;
  summary: string;
};

export type HumanReplySyncResult = {
  ready: boolean;
  recovered: boolean;
  externalId: string | null;
  replyId: string | null;
  summary: string;
};

/**
 * 对外业务能力入口；`OBSERVABILITY_SCHEMA_VERSION` 与执行日志/事件信封对齐。
 */
export class TitingServices {
  /** 可观测 API（getTraceView、getTaskObservability 等）返回结构中的 schema 版本号。 */
  static readonly OBSERVABILITY_SCHEMA_VERSION = "2026-05-11";

  /** 只含写操作的任务 API，与 `taskQueries` 对称，便于权限拆分。 */
  readonly taskCommands: TaskCommandService;
  readonly taskQueries: TaskQueryService;
  readonly scheduler: SchedulerService;
  readonly executionOrchestrator: ExecutionOrchestrator;
  readonly repairLoop: RepairLoopService;
  readonly humanIntervention: HumanInterventionService;
  readonly pluginAdmin: PluginAdminService;

  private readonly config: ServiceConfig;
  private readonly support: ServiceSupport;
  private readonly execution: ServiceExecution;
  private readonly schedulerEngine: ServiceScheduler;
  private readonly agentWorkerPool: ServiceAgentWorkerPool;

  /**
   * 注入仓储与运行时；可选字段见 `ServiceDependencies`（时钟、ID、重试上限等用于测试或调参）。
   */
  constructor(private readonly deps: ServiceDependencies) {
    const now = deps.now ?? (() => new Date());
    const createId = deps.createId ?? (() => randomUUID());
    const agentOfflineTimeoutMs = deps.agentOfflineTimeoutMs ?? 5 * 60 * 1000;

    this.config = {
      now,
      createId,
      agentOfflineTimeoutMs,
      environmentRetryLimit: deps.environmentRetryLimit ?? 2,
      executionRetryLimit: deps.executionRetryLimit ?? 2,
      maxRepairIterations: deps.maxRepairIterations ?? 3,
      enableNeedsHumanLoop: deps.enableNeedsHumanLoop ?? false,
      enableOpenSpecReviewGate: deps.enableOpenSpecReviewGate ?? true,
      executionHeartbeatIntervalMs: deps.executionHeartbeatIntervalMs ?? Math.max(1_000, Math.floor(agentOfflineTimeoutMs / 3)),
      agentWorkerPollIntervalMs: deps.agentWorkerPollIntervalMs ?? 1_000,
      setIntervalFn: deps.setIntervalFn ?? ((callback, ms) => setInterval(callback, ms)),
      clearIntervalFn: deps.clearIntervalFn ?? ((timer) => clearInterval(timer as NodeJS.Timeout))
    };

    this.support = new ServiceSupport(deps, this.config, TitingServices.OBSERVABILITY_SCHEMA_VERSION);
    this.execution = new ServiceExecution(deps, this.config, this.support);
    this.schedulerEngine = new ServiceScheduler(deps, this.config, this.support, this);
    this.agentWorkerPool = new ServiceAgentWorkerPool(deps, this.config, this.support, this.execution);

    this.taskCommands = new TaskCommandService(this);
    this.taskQueries = new TaskQueryService(this);
    this.scheduler = new SchedulerService(this as unknown as ConstructorParameters<typeof SchedulerService>[0]);
    this.executionOrchestrator = new ExecutionOrchestrator(this);
    this.repairLoop = new RepairLoopService(this);
    this.humanIntervention = new HumanInterventionService(this);
    this.pluginAdmin = new PluginAdminService(this);
  }

  /** 创建任务：补全 trace、默认分支名与 `metadata.diting.branch.autoGenerated` 标记。 */
  async createTask(input: CreateTaskInput): Promise<TitingTask> {
    const now = this.support.now();
    const id = this.support.createId();
    const normalizedBranch = normalizeOptionalBranch(input.branch);
    const branch = normalizedBranch ?? buildDefaultTaskBranch(id, now);
    const agentRequest = normalizeAgentRequest(input);
    const metadata = attachBranchMetadata(
      {
        ...input.metadata,
        repos: [{ key: "Repo1", url: input.repo }],
        agentRequest
      },
      normalizedBranch === null
    );
    const task: TitingTask = {
      id,
      source: input.source ?? "manual",
      externalId: input.externalId ?? null,
      title: input.title,
      instruction: input.instruction,
      repo: input.repo,
      branch,
      priority: input.priority ?? "medium",
      status: "draft",
      executor: input.executor ?? agentRequest.legacyExecutor ?? agentRequest.agentKind ?? "programming",
      agentKind: agentRequest.agentKind,
      preferredDriver: agentRequest.preferredDriver ?? null,
      preferredRuntime: agentRequest.preferredRuntime ?? null,
      driverId: agentRequest.preferredDriver ?? null,
      runtimeProviderId: agentRequest.preferredRuntime ?? null,
      traceId: this.support.createId(),
      constraints: input.constraints ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      metadata,
      retryCount: 0,
      repairCount: 0,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
    await this.deps.tasks.create(task);
    await this.support.emitStatus(task, "draft", "Task created", "system");
    return task;
  }

  /** 按状态/执行器过滤；无参返回全部（慎用大数据集）。 */
  async listTasks(query: TaskListQuery = {}): Promise<TitingTask[]> {
    return this.deps.tasks.list(query);
  }

  async getTask(id: string): Promise<TitingTask> {
    const task = await this.deps.tasks.getById(id);
    if (!task) {
      throw new NotFoundError(`Task ${id} not found`);
    }
    return task;
  }

  /**
   * 校验必填字段；失败则 `failed`，成功保持 `draft`。
   */
  async validateTask(id: string, operator = "system"): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (!task.instruction.trim() || !task.repo.trim() || !task.branch.trim()) {
      return this.support.transitionTask(task, "failed", "Task validation failed", operator);
    }
    await this.support.appendExecutionLog(task, null, "task.validated", "Task validated", {
      operator
    }, this.support.buildCorrelation({ task, pluginId: operator }));
    return task;
  }

  /**
   * 提交任务：`draft` → `ready`，preflight 失败则 `draft` → `waiting`。
   */
  async submitTask(id: string, operator = "system"): Promise<TitingTask> {
    const initial = await this.getTask(id);
    const validated = initial.status === "draft" ? await this.validateTask(id, operator) : initial;
    if (validated.status !== "draft") {
      return validated;
    }

    let task = validated;
    if (this.deps.runPreflight) {
      const preflightResult = await this.deps.runPreflight(validated);
      task = await this.getTask(id);
      task.metadata = {
        ...task.metadata,
        preflight: {
          passed: preflightResult.passed,
          checkedAt: this.support.now().toISOString(),
          checks: preflightResult.checks
        },
        ...(preflightResult.error ? { preflightError: preflightResult.error } : {})
      };
      await this.deps.tasks.save(task);
      if (!preflightResult.passed) {
        const recorded = await this.support.recordFailureRepair({
          task,
          execution: null,
          kind: "preflight",
          summary: preflightResult.error ?? "Task preflight failed",
          detail: {
            checks: preflightResult.checks,
            stage: "submit"
          }
        });
        task = recorded.task;
        await this.support.publish("task.preflight.failed", "Task preflight failed", task, {
          checks: preflightResult.checks
        });
        return this.pauseForWait(id, {
          type: "environment_blocked",
          source: "preflight",
          message: preflightResult.error ?? "Task preflight failed",
          recoverableBy: "operator"
        }, operator);
      }
      await this.support.publish("task.preflight.passed", "Task preflight passed", task, {
        checks: preflightResult.checks
      });
    }

    return this.support.transitionTask(task, "ready", "Task submitted", operator);
  }

  async queueTask(id: string, operator = "system"): Promise<TitingTask> {
    return this.submitTask(id, operator);
  }

  async pauseForWait(
    id: string,
    waitReason: Omit<WaitReason, "createdAt">,
    operator = "system",
    reason?: string
  ): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (!["draft", "ready", "active"].includes(task.status)) {
      throw new Error(`Task ${task.id} cannot pause for wait from ${task.status}`);
    }
    return this.support.pauseForWait(
      task,
      waitReason,
      reason ?? waitReason.message,
      operator
    );
  }

  async resumeTask(
    id: string,
    operator = "system",
    reason = "Task resumed",
    options?: { allowChildRepairWaiting?: boolean }
  ): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (task.status !== "waiting") {
      throw new Error(`Task ${task.id} cannot be resumed from ${task.status}`);
    }
    if (!options?.allowChildRepairWaiting) {
      assertNotWaitingOnChildRepairIssue(task);
    }
    task.metadata = { ...task.metadata };
    delete task.metadata.waitReason;
    task.startedAt = null;
    task.completedAt = null;
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);
    return this.support.transitionTask(task, "ready", reason, operator);
  }

  /**
   * 从 `failed` 回到 `ready` 重试；递增 `retryCount`，清空起止时间。
   */
  async retryTask(id: string, operator = "system"): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (task.status !== "failed") {
      throw new Error(`Task ${task.id} cannot be retried from ${task.status}`);
    }
    assertNotWaitingOnChildRepairIssue(task);
    task.retryCount += 1;
    task.startedAt = null;
    task.completedAt = null;
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);
    return this.support.transitionTask(task, "ready", "Task retried", operator);
  }

  async reopenTask(
    id: string,
    operator = "system",
    target: "draft" | "ready" = "draft",
    reason = "Task reopened"
  ): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (!["succeeded", "failed", "cancelled"].includes(task.status)) {
      throw new Error(`Task ${task.id} cannot be reopened from ${task.status}`);
    }
    task.startedAt = null;
    task.completedAt = null;
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);
    return this.support.transitionTask(task, target, reason, operator);
  }

  /** 调度器内部：释放 claim，`active` → `ready`。 */
  async releaseTask(id: string, reason: string, operator = "scheduler"): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (task.status !== "active") {
      throw new Error(`Task ${task.id} cannot be released from ${task.status}`);
    }
    const attempt = await this.deps.runAttempts.getLatestByTask(id);
    if (attempt && !attempt.endedAt) {
      attempt.releaseReason = reason;
      attempt.endedAt = this.support.now();
      await this.deps.runAttempts.save(attempt);
    }
    return this.support.transitionTask(task, "ready", reason, operator);
  }

  async completeTask(id: string, reason: string, operator = "system"): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (task.status !== "active") {
      throw new Error(`Task ${task.id} cannot be completed from ${task.status}`);
    }
    await this.support.completeRunAttempt(id, "completed");
    const completed = await this.support.transitionTask(task, "succeeded", reason, operator);
    completed.completedAt = this.support.now();
    await this.deps.tasks.save(completed);
    return completed;
  }

  async failTask(id: string, reason: string, operator = "system"): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (task.status !== "active") {
      throw new Error(`Task ${task.id} cannot fail from ${task.status}`);
    }
    await this.support.completeRunAttempt(id, "failed");
    const failed = await this.support.transitionTask(task, "failed", reason, operator);
    failed.completedAt = this.support.now();
    await this.deps.tasks.save(failed);
    return failed;
  }

  async blockTask(id: string, reason = "Task blocked by operator", operator = "system"): Promise<TitingTask> {
    return this.pauseForWait(id, {
      type: "environment_blocked",
      source: "operator",
      message: reason,
      recoverableBy: "operator"
    }, operator, reason);
  }

  async markNeedsHuman(
    id: string,
    reason = "Task requires human intervention",
    operator = "system"
  ): Promise<TitingTask> {
    const task = await this.getTask(id);
    const paused = await this.pauseForWait(id, {
      type: "human_input",
      source: operator,
      message: reason,
      recoverableBy: "user"
    }, operator, reason);
    if (task.status === "active") {
      paused.completedAt = this.support.now();
      await this.deps.tasks.save(paused);
    }
    return paused;
  }

  async recoverTask(
    id: string,
    operator = "system",
    reason = "Task manually recovered to queue"
  ): Promise<TitingTask> {
    const task = await this.getTask(id);
    if (task.status === "cancelled") {
      return this.reopenTask(id, operator, "ready", reason);
    }
    if (task.status !== "waiting") {
      throw new Error(`Task ${task.id} cannot be recovered from ${task.status}`);
    }
    return this.resumeTask(id, operator, reason);
  }

  async syncHumanRepairIssue(id: string, operator = "system"): Promise<HumanRepairIssueSyncResult> {
    const task = await this.getTask(id);
    if (task.status !== "waiting") {
      throw createConflictError(`Task ${task.id} is not waiting for a child repair issue`);
    }
    if (task.source !== "meegle") {
      throw createConflictError(`Task ${task.id} is not sourced from Meegle`);
    }
    const humanLoop = readObject(task.metadata.humanLoop);
    const childIssue = readObject(humanLoop.childIssue);
    const childExternalId = typeof childIssue.externalId === "string" ? childIssue.externalId : null;
    if (!childExternalId) {
      throw createConflictError(`Task ${task.id} has no child repair issue metadata`);
    }
    const integration = this.deps.runtime.getTaskIntegrations().find((plugin) => plugin.id === task.source);
    if (!integration?.pullHumanRepairIssues) {
      throw createConflictError(`Task ${task.id} integration cannot sync child repair issues`);
    }

    const replies = await integration.pullHumanRepairIssues([task]);
    const reply = replies.find((item) => item.taskId === task.id && item.childExternalId === childExternalId);
    if (!reply || !reply.ready) {
      return {
        ready: false,
        recovered: false,
        childExternalId,
        replyId: reply?.replyId ?? null,
        summary: "Child repair issue is not ready"
      };
    }

    const seenReplyIds = Array.isArray(humanLoop.seenReplyIds)
      ? humanLoop.seenReplyIds.filter((item): item is string => typeof item === "string")
      : [];
    if (seenReplyIds.includes(reply.replyId)) {
      return {
        ready: true,
        recovered: false,
        childExternalId,
        replyId: reply.replyId,
        summary: "Child repair issue reply was already applied"
      };
    }

    task.instruction = appendHumanReplyToInstruction(task.instruction, {
      taskId: task.id,
      externalId: task.externalId ?? reply.parentExternalId,
      replyId: reply.replyId,
      body: reply.body,
      author: "meegle-child-issue",
      createdAt: reply.updatedAt
    });
    task.metadata = {
      ...task.metadata,
      humanLoop: {
        ...humanLoop,
        executionMode: "repair_only",
        lastChildIssueReply: {
          childExternalId,
          replyId: reply.replyId,
          updatedAt: reply.updatedAt
        },
        seenReplyIds: trimReplyIds([...seenReplyIds, reply.replyId]),
        childIssue: {
          ...childIssue,
          solution: reply.body,
          rawDescription: reply.rawDescription,
          updatedAt: reply.updatedAt
        }
      }
    };
    task.startedAt = null;
    task.completedAt = null;
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);

    const goal = await this.deps.repairGoals.getByTaskId(task.id);
    if (goal) {
      await this.deps.repairGoals.upsert({
        ...goal,
        status: "repairing",
        constraints: appendHumanGuidanceConstraint(goal.constraints, reply.body),
        updatedAt: this.support.now()
      });
    }

    await this.support.appendExecutionLog(task, null, "goal.child_issue_reply_received", "Child repair issue reply received", {
      childExternalId,
      replyId: reply.replyId,
      updatedAt: reply.updatedAt
    }, this.support.buildCorrelation({ task, pluginId: integration.id }));
    await this.resumeTask(task.id, operator, "Recovered from child repair issue", { allowChildRepairWaiting: true });

    return {
      ready: true,
      recovered: true,
      childExternalId,
      replyId: reply.replyId,
      summary: "Child repair issue solution applied"
    };
  }

  async syncHumanReply(id: string, operator = "system"): Promise<HumanReplySyncResult> {
    let task = await this.getTask(id);
    if (task.status !== "waiting") {
      throw createConflictError(`Task ${task.id} is not waiting for a human reply`);
    }
    if (!task.externalId) {
      throw createConflictError(`Task ${task.id} has no external task id`);
    }
    assertNotWaitingOnChildRepairIssue(task);
    if (readObject(task.metadata.waitReason).type === "approval") {
      throw createConflictError(`Task ${task.id} is waiting for approval, not human reply`);
    }

    const integration = this.deps.runtime.getTaskIntegrations().find((plugin) => plugin.id === task.source);
    if (!integration?.pullHumanReplies) {
      throw createConflictError(`Task ${task.id} integration cannot sync human replies`);
    }

    task = await this.ensureHumanReplyLoopMetadata(task);
    const humanLoop = readHumanLoopMetadata(task.metadata);
    const replies = await integration.pullHumanReplies([task]);
    const reply = sortHumanReplies(replies)
      .filter((item) => item.taskId === task.id || item.externalId === task.externalId)
      .filter((item) => !humanLoop.seenReplyIds.includes(item.replyId))
      .filter((item) => !humanLoop.requestedAt || new Date(item.createdAt).getTime() >= new Date(humanLoop.requestedAt).getTime())
      .at(-1);

    if (!reply) {
      return {
        ready: false,
        recovered: false,
        externalId: task.externalId,
        replyId: null,
        summary: "尚未找到以 `【回复】` 开头的最新评论。"
      };
    }

    const recovered = await this.schedulerEngine.applyHumanReplyFromIntegration(integration, [task], reply);
    return {
      ready: true,
      recovered,
      externalId: reply.externalId,
      replyId: reply.replyId,
      summary: recovered ? "Human reply applied" : "Human reply was already applied"
    };
  }

  private async ensureHumanReplyLoopMetadata(task: TitingTask): Promise<TitingTask> {
    const humanLoop = readObject(task.metadata.humanLoop);
    if (typeof humanLoop.requestedAt === "string" && humanLoop.requestedAt.trim()) {
      return task;
    }

    const waitReason = readObject(task.metadata.waitReason);
    const requestedAt = typeof waitReason.createdAt === "string" && waitReason.createdAt.trim()
      ? waitReason.createdAt
      : task.updatedAt.toISOString();
    const seenReplyIds = Array.isArray(humanLoop.seenReplyIds)
      ? humanLoop.seenReplyIds.filter((item): item is string => typeof item === "string")
      : [];
    task.metadata = {
      ...task.metadata,
      humanLoop: {
        ...humanLoop,
        requestId: typeof humanLoop.requestId === "string" && humanLoop.requestId.trim()
          ? humanLoop.requestId
          : this.support.createId(),
        requestedAt,
        seenReplyIds
      }
    };
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);
    return task;
  }

  async cancelTask(id: string, operator = "system"): Promise<TitingTask> {
    const task = await this.getTask(id);
    return this.support.transitionTask(task, "cancelled", "Task cancelled", operator);
  }

  async listRuns(query?: ExecutionListQuery): Promise<ExecutionRecord[]> {
    return this.deps.executions.list(query);
  }

  async getRunObservability(id: string): Promise<RunObservability> {
    const run = await this.deps.executions.getById(id);
    if (!run) {
      throw new NotFoundError(`Run ${id} not found`);
    }
    const [task, logs, leases, plugins, rawPreview] = await Promise.all([
      this.getTask(run.taskId),
      this.deps.executionLogs.listByExecution(id),
      this.deps.agentLeases.listByExecution(id),
      this.listPlugins(),
      this.deps.runtime.selectLogPlugin().listRawByExecution({
        taskId: run.taskId,
        executionId: run.id,
        limit: 1
      })
    ]);
    const rawLogSources = [...new Set(rawPreview.items.map((item) => item.source))];
    return buildRunObservabilityView({
      schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
      run,
      task,
      logs,
      leases,
      pluginHealth: plugins,
      rawLogSources: rawLogSources.length > 0
        ? rawLogSources
        : ["stdout", "stderr", "summary", "event"]
    });
  }

  async listRunRawLogs(
    id: string,
    query: Omit<RawLogQuery, "taskId" | "executionId">
  ): Promise<RunRawLogsResponse> {
    const run = await this.deps.executions.getById(id);
    if (!run) {
      throw new NotFoundError(`Run ${id} not found`);
    }
    const raw = await this.deps.runtime.selectLogPlugin().listRawByExecution({
      ...query,
      taskId: run.taskId,
      executionId: run.id
    });
    return {
      schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
      runId: run.id,
      taskId: run.taskId,
      ...raw
    };
  }

  async listExecutions(taskId: string): Promise<ExecutionRecord[]> {
    return this.deps.executions.listByTask(taskId);
  }

  async listExecutionLogs(taskId: string): Promise<ExecutionLogRecord[]> {
    return this.deps.executionLogs.listByTask(taskId);
  }

  async listTaskTransitions(taskId: string): Promise<TaskTransition[]> {
    return this.deps.taskTransitions.listByTask(taskId);
  }

  async getTaskObservability(taskId: string): Promise<{
    schemaVersion: string;
    taskId: string;
    transitions: TaskTransition[];
    executionLogs: ExecutionLogRecord[];
    failureRepair?: Record<string, unknown>;
    currentAttempt?: RunAttempt | null;
    waitReason?: WaitReason | null;
  }> {
    const task = await this.getTask(taskId);
    const [transitions, executionLogs] = await Promise.all([
      this.deps.taskTransitions.listByTask(taskId),
      this.deps.executionLogs.listByTask(taskId)
    ]);
    const failureRepair = task.metadata.failureRepair;
    const waitReason = task.status === "waiting" && task.metadata.waitReason && typeof task.metadata.waitReason === "object"
      ? task.metadata.waitReason as WaitReason
      : null;
    const currentAttempt = task.status === "active"
      ? await this.deps.runAttempts.getLatestByTask(taskId)
      : null;
    return {
      schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
      taskId,
      transitions,
      executionLogs,
      waitReason,
      currentAttempt,
      ...(failureRepair && typeof failureRepair === "object"
        ? { failureRepair: failureRepair as Record<string, unknown> }
        : {})
    };
  }

  /**
   * 按 **traceId** 聚合跨任务数据：同 trace 下多任务（如 repair 重入）的执行、日志、评测与 repair goal。
   * 无任务时抛 `NotFoundError`。
   */
  async getTraceView(traceId: string): Promise<{
    schemaVersion: string;
    traceId: string;
    tasks: TitingTask[];
    transitions: TaskTransition[];
    executions: ExecutionRecord[];
    executionLogs: ExecutionLogRecord[];
    evalResults: EvalResult[];
    repairGoals: RepairGoal[];
  }> {
    const tasks = await this.deps.tasks.listByTraceId(traceId);
    if (tasks.length === 0) {
      throw new NotFoundError(`Trace ${traceId} not found`);
    }
    const [transitions, executionArtifacts] = await Promise.all([
      this.deps.taskTransitions.listByTraceId(traceId),
      Promise.all(tasks.map(async (task) => ({
        executions: await this.deps.executions.listByTask(task.id),
        executionLogs: await this.deps.executionLogs.listByTask(task.id),
        evalResults: await this.deps.evalResults.listByTask(task.id),
        repairGoal: await this.deps.repairGoals.getByTaskId(task.id)
      })))
    ]);
    return {
      schemaVersion: TitingServices.OBSERVABILITY_SCHEMA_VERSION,
      traceId,
      tasks,
      transitions,
      executions: executionArtifacts.flatMap((item) => item.executions),
      executionLogs: executionArtifacts.flatMap((item) => item.executionLogs),
      evalResults: executionArtifacts.flatMap((item) => item.evalResults),
      repairGoals: executionArtifacts.flatMap((item) => (item.repairGoal ? [item.repairGoal] : []))
    };
  }

  async listEvalResults(taskId: string): Promise<EvalResult[]> {
    return this.deps.evalResults.listByTask(taskId);
  }

  async getRepairGoal(taskId: string): Promise<RepairGoal | null> {
    return this.deps.repairGoals.getByTaskId(taskId);
  }

  async listAgents(): Promise<AgentRecord[]> {
    return this.deps.agents.list();
  }

  async upsertAgent(agent: AgentRecord): Promise<void> {
    await this.deps.agents.upsert(agent);
  }

  async heartbeatAgent(id: string, status?: AgentRecord["status"]): Promise<AgentRecord> {
    const agent = await this.support.requireAgent(id);
    if (status && !["idle", "busy"].includes(status)) {
      throw new Error(`Heartbeat cannot set agent ${id} to ${status}`);
    }
    if (agent.status === "disabled" || agent.status === "error") {
      throw new Error(`Agent ${id} cannot heartbeat while ${agent.status}`);
    }
    agent.status = status ?? (agent.status === "offline" ? "idle" : agent.status);
    agent.lastHeartbeatAt = this.support.now();
    agent.updatedAt = this.support.now();
    await this.deps.agents.upsert(agent);
    await this.support.publishAgentEvent("agent.heartbeat", "Agent heartbeat refreshed", agent);
    return agent;
  }

  startIdleHeartbeatLoop(): () => void {
    let active = true;
    let heartbeatInFlight = false;
    const timer = this.config.setIntervalFn(() => {
      if (!active || heartbeatInFlight) {
        return;
      }
      heartbeatInFlight = true;
      void this.refreshIdleAgentHeartbeats()
        .catch(() => undefined)
        .finally(() => {
          heartbeatInFlight = false;
        });
    }, this.config.executionHeartbeatIntervalMs);

    return () => {
      active = false;
      this.config.clearIntervalFn(timer);
    };
  }

  async disableAgent(id: string): Promise<AgentRecord> {
    const agent = await this.support.requireAgent(id);
    if (agent.status === "busy") {
      throw new Error(`Agent ${id} cannot be disabled while busy`);
    }
    agent.status = "disabled";
    agent.updatedAt = this.support.now();
    await this.deps.agents.upsert(agent);
    await this.support.publishAgentEvent("agent.disabled", "Agent disabled", agent);
    return agent;
  }

  async enableAgent(id: string): Promise<AgentRecord> {
    const agent = await this.support.requireAgent(id);
    if (agent.status !== "disabled") {
      throw new Error(`Agent ${id} is not disabled`);
    }
    agent.status = "idle";
    agent.taskId = null;
    agent.lastHeartbeatAt = this.support.now();
    agent.updatedAt = this.support.now();
    await this.deps.agents.upsert(agent);
    await this.support.publishAgentEvent("agent.enabled", "Agent enabled", agent);
    return agent;
  }

  async recoverAgent(id: string): Promise<AgentRecord> {
    const agent = await this.support.requireAgent(id);
    if (!["offline", "error"].includes(agent.status)) {
      throw new Error(`Agent ${id} cannot be recovered from ${agent.status}`);
    }
    agent.status = "idle";
    agent.taskId = null;
    agent.lastHeartbeatAt = this.support.now();
    agent.updatedAt = this.support.now();
    await this.deps.agents.upsert(agent);
    await this.support.publishAgentEvent("agent.recovered", "Agent recovered", agent);
    return agent;
  }

  /** 读插件列表并逐项 `health()`，供 dashboard 与 readiness。 */
  async listPlugins() {
    const plugins = this.deps.runtime.list();
    return Promise.all(
      plugins.map(async (plugin) => ({
        id: plugin.id,
        kind: plugin.kind,
        priority: plugin.priority,
        capabilities: plugin.capabilities,
        displayName: (plugin as RuntimePlugin & { displayName?: string }).displayName ?? plugin.id,
        binaryPath: (plugin as RuntimePlugin & { binaryPath?: string }).binaryPath ?? null,
        runtimeSource: (plugin as RuntimePlugin & { runtimeSource?: string }).runtimeSource ?? null,
        runtimeKind: (plugin as RuntimePlugin & { runtimeKind?: string }).runtimeKind ?? null,
        health: await plugin.health()
      }))
    );
  }

  async listPluginConfigs() {
    return this.deps.pluginConfigs.list();
  }

  async upsertPluginConfig(input: {
    pluginId: string;
    kind: PluginConfig["kind"];
    enabled: boolean;
    priority: number;
    config: Record<string, unknown>;
  }) {
    const existing = await this.deps.pluginConfigs.getByPluginId(input.pluginId);
    const config = {
      id: existing?.id ?? this.support.createId(),
      pluginId: input.pluginId,
      kind: input.kind,
      enabled: input.enabled,
      priority: input.priority,
      config: input.config,
      updatedAt: this.support.now()
    };
    await this.deps.pluginConfigs.upsert(config);
    await this.support.publishEvent({
      correlation: this.support.buildCorrelation({
        traceId: `plugin:${config.pluginId}`,
        pluginId: config.pluginId
      }),
      eventType: "plugin.config_updated",
      message: "Plugin config updated",
      data: {
        kind: config.kind,
        enabled: config.enabled,
        priority: config.priority
      }
    });
    return config;
  }

  async dashboard() {
    const tasks = await this.deps.tasks.list();
    const agents = await this.deps.agents.list();
    const plugins = await this.listPlugins();
    const statusCounts = countBy(tasks.map((task) => task.status));
    return {
      tasks: {
        total: tasks.length,
        byStatus: statusCounts
      },
      agents: {
        total: agents.length,
        byStatus: countBy(agents.map((agent) => agent.status))
      },
      plugins: {
        total: plugins.length,
        healthy: plugins.filter((plugin) => plugin.health.healthy).length
      }
    };
  }

  /** 定时器入口：同步集成 → 恢复离线 Agent/任务 → 派发队列。 */
  async runSchedulerTick(): Promise<void> {
    await this.schedulerEngine.runSchedulerTick();
    await this.agentWorkerPool.runAllWorkersOnce();
  }

  async runTaskSyncNow(): Promise<{ integrations: number; pulledTasks: number }> {
    return this.schedulerEngine.runTaskSyncNow();
  }

  async runSchedulerDispatchNow(): Promise<{ queuedBefore: number }> {
    const readyBefore = (await this.deps.tasks.list({ status: "ready" })).length;
    await this.schedulerEngine.runSchedulerDispatchNow();
    await this.agentWorkerPool.runAllWorkersOnce();
    return { queuedBefore: readyBefore };
  }

  async syncTaskIntegrations(): Promise<void> {
    await this.schedulerEngine.syncTaskIntegrations();
  }

  async ingestTaskFromIntegration(task: TitingTask, operator: string): Promise<TitingTask | null> {
    return this.schedulerEngine.ingestTaskFromIntegration(task, operator);
  }

  startAgentWorkerPool(): () => void {
    return this.agentWorkerPool.start();
  }

  runAgentWorkerOnce(agentId: string): Promise<boolean> {
    return this.agentWorkerPool.runOnce(agentId);
  }

  private async refreshIdleAgentHeartbeats(): Promise<void> {
    const now = this.support.now();
    const agents = await this.deps.agents.list();
    await Promise.all(
      agents
        .filter((agent) => agent.status === "idle")
        .map((agent) => this.deps.agents.upsert({
          ...agent,
          lastHeartbeatAt: now,
          updatedAt: now
        }))
    );
  }
}

function readObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function assertNotWaitingOnChildRepairIssue(task: TitingTask): void {
  if (task.source !== "meegle" || task.status !== "waiting") {
    return;
  }
  const childIssue = readObject(readObject(task.metadata.humanLoop).childIssue);
  if (typeof childIssue.externalId === "string" && childIssue.externalId.trim()) {
    throw createConflictError(`Task ${task.id} must sync the child repair issue before it can recover`);
  }
}

function createConflictError(message: string): Error {
  const error = new Error(message);
  error.name = "ConflictError";
  return error;
}
