/**
 * 横切能力：**任务状态迁移**（与 state-machine 一致）、**执行日志**、**可观测事件发布**、
 * **Agent 释放与集成回传**。被 `TitingServices`、`ServiceExecution`、`ServiceScheduler` 共享，
 * 避免在多处复制「写 transition + append log + publish」样板。
 */
import {
  AgentRecord,
  AttemptStage,
  EnvironmentRuntimeEvent,
  ExecutionRecord,
  ExecutionRuntimeEvent,
  ObservabilityCorrelation,
  TaskStatus,
  TaskTransition,
  TitingTask,
  WaitReason
} from "@diting/plugin-api";
import { NotFoundError } from "./errors";
import {
  applyFailureRepairMetadata,
  buildFailureRepairDecision,
  buildFailureRepairLogPayload,
  FailureKind,
  FailureRepairDecision
} from "./failure-repair-service";
import { assertValidTransition } from "./state-machine";
import { readGovernanceEntries, ServiceConfig, ServiceDependencies } from "./service-shared";

/**
 * 所有 API 与后台定时逻辑共享的「写路径」助手：持有一份 `schemaVersion` 用于 `events.publish`。
 */
export class ServiceSupport {
  constructor(
    private readonly deps: ServiceDependencies,
    private readonly config: ServiceConfig,
    private readonly schemaVersion: string
  ) {}

  /** 测试注入或时钟冻结：与 `ServiceConfig.now` 一致。 */
  now(): Date {
    return this.config.now();
  }

  createId(): string {
    return this.config.createId();
  }

  /**
   * 合法迁移：先 `assertValidTransition`，再落库任务、追加 transition、写执行日志并广播可观测事件。
   * `execution` 用于把当前执行实例挂到 correlation / 日志上。
   */
  async transitionTask(
    task: TitingTask,
    to: TaskStatus,
    reason: string,
    operator: string,
    execution: ExecutionRecord | null = null
  ): Promise<TitingTask> {
    assertValidTransition(task.status, to);
    return this.recordTaskMutation(task, task.status, to, reason, operator, execution);
  }

  async pauseForWait(
    task: TitingTask,
    waitReason: Omit<WaitReason, "createdAt">,
    reason: string,
    operator: string,
    execution: ExecutionRecord | null = null
  ): Promise<TitingTask> {
    const fullWaitReason: WaitReason = {
      ...waitReason,
      createdAt: this.now().toISOString()
    };
    task.metadata = {
      ...task.metadata,
      waitReason: fullWaitReason
    };
    const updated = await this.transitionTask(task, "waiting", reason, operator, execution);
    await this.appendExecutionLog(updated, execution, "task.wait_reason", reason, {
      waitReason: fullWaitReason
    }, this.buildCorrelation({ task: updated, execution, pluginId: operator }));
    return updated;
  }

  async updateRunAttemptStage(taskId: string, stage: AttemptStage): Promise<void> {
    const attempt = await this.deps.runAttempts.getLatestByTask(taskId);
    if (!attempt || attempt.endedAt) {
      return;
    }
    attempt.stage = stage;
    await this.deps.runAttempts.save(attempt);
  }

  async completeRunAttempt(taskId: string, stage: AttemptStage, releaseReason?: string): Promise<void> {
    const attempt = await this.deps.runAttempts.getLatestByTask(taskId);
    if (!attempt) {
      return;
    }
    attempt.stage = stage;
    attempt.endedAt = this.now();
    if (releaseReason) {
      attempt.releaseReason = releaseReason;
    }
    await this.deps.runAttempts.save(attempt);
  }

  async recordTaskMutation(
    task: TitingTask,
    from: TaskStatus,
    to: TaskStatus,
    reason: string,
    operator: string,
    execution: ExecutionRecord | null = null
  ): Promise<TitingTask> {
    task.status = to;
    task.updatedAt = this.now();
    await this.deps.tasks.save(task);
    const transition: TaskTransition = {
      taskId: task.id,
      traceId: task.traceId,
      from,
      to,
      reason,
      operator,
      timestamp: this.now()
    };
    await this.deps.taskTransitions.append(transition);
    const correlation = this.buildCorrelation({
      task,
      execution,
      pluginId: operator,
      eventId: this.createId()
    });
    await this.appendExecutionLog(task, execution, "task.transition", reason, {
      traceId: task.traceId,
      from,
      to,
      operator
    }, correlation);
    await this.publish(`task.${to}`, reason, task, {
      from,
      to,
      operator
    }, { execution, pluginId: operator, correlation });
    return task;
  }

  /**
   * 「创建瞬间」等非完整 transition 场景的轻量事件：from/to 相同，仅写一条过渡记录用于观测（如 `created`）。
   */
  async emitStatus(task: TitingTask, to: TaskStatus, reason: string, operator: string): Promise<void> {
    await this.deps.taskTransitions.append({
      taskId: task.id,
      traceId: task.traceId,
      from: to,
      to,
      reason,
      operator,
      timestamp: this.now()
    });
    const correlation = this.buildCorrelation({
      task,
      pluginId: operator,
      eventId: this.createId()
    });
    await this.appendExecutionLog(task, null, "task.transition", reason, {
      traceId: task.traceId,
      from: to,
      to,
      operator
    }, correlation);
    await this.publish(`task.${to}`, reason, task, { from: to, to, operator }, { pluginId: operator, correlation });
  }

  async appendExecutionLog(
    task: TitingTask,
    execution: ExecutionRecord | null,
    eventType: string,
    message: string,
    data: Record<string, unknown>,
    correlation: ObservabilityCorrelation
  ): Promise<void> {
    await this.deps.executionLogs.append({
      id: this.createId(),
      taskId: task.id,
      executionId: execution?.id ?? null,
      eventType,
      message,
      data: {
        ...data,
        correlation
      },
      createdAt: this.now()
    });
  }

  async recordFailureRepair(input: {
    task: TitingTask;
    execution: ExecutionRecord | null;
    kind: FailureKind;
    summary: string;
    detail?: Record<string, unknown>;
    checks?: Array<{ name: string; passed: boolean; detail: string }>;
    executionResult?: import("@diting/plugin-api").ExecutionResult;
    gate?: import("@diting/plugin-api").CompletionGateResult;
    retryBudgetExhausted?: boolean;
    canFallback?: boolean;
    pullRequestRecords?: import("@diting/plugin-api").PullRequestRecord[];
    preferNeedsHuman?: boolean;
    agentId?: string;
    pluginId?: string;
  }): Promise<{ task: TitingTask; decision: FailureRepairDecision }> {
    const decision = buildFailureRepairDecision({
      kind: input.kind,
      task: input.task,
      summary: input.summary,
      detail: input.detail,
      checks: input.checks,
      executionResult: input.executionResult,
      gate: input.gate,
      retryBudgetExhausted: input.retryBudgetExhausted,
      canFallback: input.canFallback,
      pullRequestRecords: input.pullRequestRecords,
      preferNeedsHuman: input.preferNeedsHuman
    });
    const failureRepair = applyFailureRepairMetadata(
      input.task,
      decision,
      input.execution?.id ?? null,
      this.now().toISOString()
    );
    const task: TitingTask = {
      ...input.task,
      metadata: {
        ...input.task.metadata,
        failureRepair
      },
      updatedAt: this.now()
    };
    await this.deps.tasks.save(task);
    const correlation = this.buildCorrelation({
      task,
      execution: input.execution,
      agentId: input.agentId,
      pluginId: input.pluginId
    });
    const payload = buildFailureRepairLogPayload(decision, input.execution?.id ?? null, correlation);
    await this.appendExecutionLog(
      task,
      input.execution,
      "failure.recorded",
      decision.failureSummary,
      payload,
      correlation
    );
    if (decision.strategy === "auto_repair") {
      await this.appendExecutionLog(
        task,
        input.execution,
        "failure.repair_plan_created",
        "Failure repair plan created",
        payload,
        correlation
      );
      await this.appendExecutionLog(
        task,
        input.execution,
        "failure.auto_repair_invoked",
        "Automatic repair invoked",
        payload,
        correlation
      );
    } else if (decision.strategy === "skip_with_record") {
      await this.appendExecutionLog(
        task,
        input.execution,
        "failure.workflow_prompt_skipped",
        "Workflow prompt failure skipped with fallback",
        payload,
        correlation
      );
    } else if (decision.strategy === "blocked") {
      await this.appendExecutionLog(
        task,
        input.execution,
        "failure.blocked",
        "Failure requires blocked task state",
        payload,
        correlation
      );
    } else if (decision.strategy === "needs_human") {
      await this.appendExecutionLog(
        task,
        input.execution,
        "failure.needs_human",
        "Failure requires human intervention",
        payload,
        correlation
      );
    }
    return { task, decision };
  }

  async recordEnvironmentRuntimeEvent(
    task: TitingTask,
    agentId: string,
    event: EnvironmentRuntimeEvent,
    pluginId?: string
  ): Promise<void> {
    await this.appendExecutionLog(
      task,
      null,
      `environment.runtime.${event.type}`,
      this.describeEnvironmentRuntimeEvent(event),
      { runtimeEvent: event },
      this.buildCorrelation({ task, agentId, pluginId })
    );
  }

  async recordExecutionRuntimeEvent(
    task: TitingTask,
    execution: ExecutionRecord,
    agentId: string,
    event: ExecutionRuntimeEvent,
    pluginId?: string
  ): Promise<void> {
    const message = this.describeExecutionRuntimeEvent(event);
    const correlation = this.buildCorrelation({ task, execution, agentId, pluginId });
    await this.appendExecutionLog(
      task,
      execution,
      `execution.runtime.${event.type}`,
      message,
      { runtimeEvent: event },
      correlation
    );
    if (this.shouldPublishExecutionRuntimeEvent(event)) {
      await this.publish(`execution.runtime.${event.type}`, message, task, {
        runtimeEvent: event
      }, { execution, agentId, pluginId, correlation });
    }
  }

  async updateExecutionStatus(
    execution: ExecutionRecord,
    task: TitingTask,
    status: ExecutionRecord["status"],
    message: string,
    data: Record<string, unknown>,
    pluginId?: string
  ): Promise<void> {
    execution.status = status;
    if (status === "completed" || status === "failed") {
      execution.endedAt = execution.endedAt ?? this.now();
    }
    await this.deps.executions.save(execution);
    const correlation = this.buildCorrelation({
      task,
      execution,
      pluginId,
      eventId: this.createId()
    });
    await this.appendExecutionLog(task, execution, `execution.${status}`, message, data, correlation);
    await this.publish(`execution.${status}`, message, task, {
      executionId: execution.id,
      status,
      ...data
    }, { execution, correlation });
  }

  async recordGovernanceEntries(
    task: TitingTask,
    execution: ExecutionRecord | null,
    container: Record<string, unknown>,
    agentId?: string
  ): Promise<void> {
    const entries = readGovernanceEntries(container);
    for (const entry of entries) {
      const eventType = entry.phase === "after_eval" ? "governance.eval" : "governance.command";
      const correlation = this.buildCorrelation({
        task,
        execution,
        pluginId: entry.pluginId,
        agentId,
        eventId: this.createId()
      });
      await this.appendExecutionLog(task, execution, eventType, entry.message, {
        phase: entry.phase,
        outcome: entry.outcome,
        findings: entry.findings,
        metadata: entry.metadata
      }, correlation);
      await this.publish(eventType, entry.message, task, {
        phase: entry.phase,
        outcome: entry.outcome,
        findings: entry.findings,
        metadata: entry.metadata
      }, { execution, pluginId: entry.pluginId, agentId, correlation });
    }
  }

  async requireAgent(id: string): Promise<AgentRecord> {
    const agent = await this.deps.agents.getById(id);
    if (!agent) {
      throw new NotFoundError(`Agent ${id} not found`);
    }
    return agent;
  }

  async releaseAgent(agent: AgentRecord): Promise<void> {
    agent.status = "idle";
    agent.taskId = null;
    agent.updatedAt = this.now();
    agent.lastHeartbeatAt = this.now();
    await this.deps.agents.upsert(agent);
  }

  async reportTaskResultIfNeeded(task: TitingTask, summary: string): Promise<void> {
    if (!task.externalId) {
      return;
    }
    const integrations = this.deps.runtime.getTaskIntegrations().filter((plugin) => plugin.id === task.source);
    for (const integration of integrations) {
      await integration.reportResult(task, summary);
      await this.publishEvent({
        correlation: this.buildCorrelation({
          task,
          pluginId: integration.id
        }),
        eventType: "plugin.result_reported",
        message: "Task result reported to integration",
        data: {
          externalId: task.externalId,
          status: task.status
        }
      });
    }
  }

  async publishAgentEvent(eventType: string, message: string, agent: AgentRecord): Promise<void> {
    await this.publishEvent({
      correlation: this.buildCorrelation({
        traceId: `agent:${agent.id}`,
        taskId: agent.taskId ?? undefined,
        agentId: agent.id
      }),
      eventType,
      message,
      data: {
        status: agent.status,
        executor: agent.executor
      }
    });
  }

  async publish(
    eventType: string,
    message: string,
    task: TitingTask,
    data: Record<string, unknown>,
    options: {
      execution?: ExecutionRecord | null;
      pluginId?: string;
      agentId?: string;
      correlation?: ObservabilityCorrelation;
    } = {}
  ): Promise<void> {
    await this.publishEvent({
      correlation: options.correlation ?? this.buildCorrelation({
        task,
        execution: options.execution ?? null,
        pluginId: options.pluginId,
        agentId: options.agentId
      }),
      eventType,
      message,
      data
    });
  }

  buildCorrelation(input: {
    traceId?: string;
    task?: TitingTask;
    taskId?: string;
    execution?: ExecutionRecord | null;
    executionId?: string;
    pluginId?: string;
    agentId?: string;
    eventId?: string;
  }): ObservabilityCorrelation {
    return {
      correlationId: this.createId(),
      traceId: input.task?.traceId ?? input.traceId ?? "system",
      taskId: input.task?.id ?? input.taskId,
      executionId: input.execution?.id ?? input.executionId,
      pluginId: input.pluginId,
      agentId: input.agentId,
      eventId: input.eventId
    };
  }

  async publishEvent(input: {
    correlation: ObservabilityCorrelation;
    eventType: string;
    message: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    const eventId = input.correlation.eventId ?? this.createId();
    const correlation = {
      ...input.correlation,
      eventId
    };
    await this.deps.events.publish({
      id: eventId,
      schemaVersion: this.schemaVersion,
      traceId: correlation.traceId,
      taskId: correlation.taskId,
      executionId: correlation.executionId,
      pluginId: correlation.pluginId,
      agentId: correlation.agentId,
      eventType: input.eventType,
      message: input.message,
      data: {
        ...input.data,
        correlation
      },
      createdAt: this.now()
    });
  }

  private describeEnvironmentRuntimeEvent(event: EnvironmentRuntimeEvent): string {
    switch (event.type) {
      case "command_start":
        return `Environment stage started: ${event.stage}`;
      case "spawn":
        return `Environment process spawned: ${event.stage}`;
      case "stdout":
        return `Environment stdout chunk received: ${event.stage}`;
      case "stderr":
        return `Environment stderr chunk received: ${event.stage}`;
      case "timeout":
        return `Environment command timed out: ${event.stage}`;
      case "idle_timeout":
        return `Environment command stalled without output: ${event.stage}`;
      case "error":
        return `Environment process error: ${event.stage}`;
      case "close":
        return `Environment process closed: ${event.stage}`;
      case "result":
        return `Environment stage finished: ${event.stage}`;
    }
  }

  private shouldPublishExecutionRuntimeEvent(event: ExecutionRuntimeEvent): boolean {
    return event.type === "stderr"
      || event.type === "error"
      || event.type === "timeout"
      || event.type === "idle_timeout";
  }

  private describeExecutionRuntimeEvent(event: ExecutionRuntimeEvent): string {
    switch (event.type) {
      case "command_start":
        return "Executor command started";
      case "spawn":
        return "Executor process spawned";
      case "stdout":
        return "Executor stdout chunk received";
      case "stderr":
        return this.formatRuntimeChunkMessage("Executor stderr", event.chunk);
      case "timeout":
        return `Executor command timed out after ${event.timeoutMs}ms`;
      case "idle_timeout":
        return `Executor command stalled without output after ${event.timeoutMs}ms`;
      case "error":
        return this.formatRuntimeChunkMessage("Executor process error", event.error);
      case "close":
        return "Executor process closed";
      case "result":
        return "Executor command finished";
      case "session_create_start":
        return "Executor session creation started";
      case "session_create_result":
        return "Executor session created";
    }
  }

  private formatRuntimeChunkMessage(prefix: string, chunk?: string): string {
    const trimmed = chunk?.trim();
    if (!trimmed) {
      return prefix;
    }
    const maxLength = 400;
    const excerpt = trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
    return `${prefix}: ${excerpt}`;
  }
}
