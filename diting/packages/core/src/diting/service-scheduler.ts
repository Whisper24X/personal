/**
 * 后台调度：`runSchedulerTick` 串联 **集成拉单**（`pullTasks`）、**心跳超时的 Agent/任务恢复**、
 * **恢复离线 Agent/任务**；执行派发由 Agent worker pool 负责。
 *
 * `schedulerTickInFlight` 避免重入；并行 tick 会发出 `scheduler.tick_skipped`。
 */
import { AgentRecord, OpenSpecReviewIssueReply, PluginConfig, TaskIntegrationPlugin, TitingTask } from "@diting/plugin-api";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { ServiceSupport } from "./service-support";
import {
  appendHumanGuidanceConstraint,
  appendHumanReplyToInstruction,
  attachBranchMetadata,
  buildDefaultTaskBranch,
  normalizeAgentRequest,
  normalizeOptionalBranch,
  readHumanLoopMetadata,
  ServiceConfig,
  ServiceDependencies,
  sortHumanReplies,
  trimReplyIds
} from "./service-shared";

type SchedulerTaskHost = {
  submitTask(id: string, operator?: string): Promise<TitingTask>;
  queueTask(id: string, operator?: string): Promise<TitingTask>;
  resumeTask(id: string, operator?: string, reason?: string): Promise<TitingTask>;
  retryTask(id: string, operator?: string): Promise<TitingTask>;
  releaseTask(id: string, reason: string, operator?: string): Promise<TitingTask>;
  pauseForWait(
    id: string,
    waitReason: import("@diting/plugin-api").WaitReason extends infer W ? Omit<W, "createdAt"> : never,
    operator?: string,
    reason?: string
  ): Promise<TitingTask>;
};

/**
 * @param taskHost - 通常为 `TitingServices`，仅需 `queueTask` 将集成拉取的任务推进到队列。
 */
export class ServiceScheduler {
  private schedulerTickInFlight = false;

  constructor(
    private readonly deps: ServiceDependencies,
    private readonly config: ServiceConfig,
    private readonly support: ServiceSupport,
    private readonly taskHost: SchedulerTaskHost
  ) {}

  /**
   * 单线程 tick：sync（拉单+可选人工回复）→ recoverOffline。
   * 若上一 tick 未结束则跳过并打点。
   */
  async runSchedulerTick(): Promise<void> {
    if (this.schedulerTickInFlight) {
      await this.support.publishEvent({
        correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
        eventType: "scheduler.tick_skipped",
        message: "Scheduler tick skipped because a previous tick is still running",
        data: {}
      });
      return;
    }
    this.schedulerTickInFlight = true;
    try {
      await this.support.publishEvent({
        correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
        eventType: "scheduler.tick_started",
        message: "Scheduler tick started",
        data: {}
      });
      await this.syncTaskIntegrations();
      await this.recoverOfflineAgentsAndTasks();
    } finally {
      await this.support.publishEvent({
        correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
        eventType: "scheduler.tick_completed",
        message: "Scheduler tick completed",
        data: {}
      });
      this.schedulerTickInFlight = false;
    }
  }

  /**
   * 逐个 integration `pullTasks`，不健康则跳过；可选 `pullHumanReplies`（`enableNeedsHumanLoop`）。
   * 返回集成的数量与拉取到的任务条数（条数包含多插件之和）。
   */
  async runTaskSyncNow(): Promise<{ integrations: number; pulledTasks: number }> {
    const integrations = this.deps.runtime.getTaskIntegrations();
    let pulledTasks = 0;
    await this.support.publishEvent({
      correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
      eventType: "scheduler.sync_started",
      message: "Task integration sync started",
      data: { integrations: integrations.length }
    });
    for (const integration of integrations) {
      const health = await integration.health();
      if (!health.healthy) {
        await this.support.publishEvent({
          correlation: this.support.buildCorrelation({
            traceId: `plugin:${integration.id}`,
            pluginId: integration.id
          }),
          eventType: "plugin.integration_skipped",
          message: "Task integration skipped because plugin is unhealthy",
          data: { health }
        });
        continue;
      }
      const tasks = await integration.pullTasks();
      pulledTasks += tasks.length;
      await this.support.publishEvent({
        correlation: this.support.buildCorrelation({
          traceId: `plugin:${integration.id}`,
          pluginId: integration.id
        }),
        eventType: "plugin.integration_pulled",
        message: "Task integration pulled tasks",
        data: { count: tasks.length }
      });
      for (const task of tasks) {
        await this.ingestPulledTask(task, integration.id);
      }
      if (this.config.enableNeedsHumanLoop && integration.pullHumanReplies) {
        try {
          await this.syncHumanRepliesForIntegration(
            integration as TaskIntegrationPlugin & Required<Pick<TaskIntegrationPlugin, "pullHumanReplies">>
          );
        } catch (error) {
          await this.support.publishEvent({
            correlation: this.support.buildCorrelation({
              traceId: `plugin:${integration.id}`,
              pluginId: integration.id
            }),
            eventType: "plugin.human_reply_sync_failed",
            message: "Human reply sync failed",
            data: {
              error: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
      if (integration.pullOpenSpecReviewIssues) {
        try {
          await this.syncOpenSpecReviewsForIntegration(
            integration as TaskIntegrationPlugin & Required<Pick<TaskIntegrationPlugin, "pullOpenSpecReviewIssues">>
          );
        } catch (error) {
          await this.support.publishEvent({
            correlation: this.support.buildCorrelation({
              traceId: `plugin:${integration.id}`,
              pluginId: integration.id
            }),
            eventType: "plugin.openspec_review_sync_failed",
            message: "OpenSpec review sync failed",
            data: {
              error: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
    }
    await this.support.publishEvent({
      correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
      eventType: "scheduler.sync_completed",
      message: "Task integration sync completed",
      data: { integrations: integrations.length, pulledTasks }
    });
    return { integrations: integrations.length, pulledTasks };
  }

  /** 仅执行派发阶段并返回 tick 前队列深度（调试用）。 */
  async runSchedulerDispatchNow(): Promise<{ queuedBefore: number }> {
    const queuedBefore = (await this.deps.tasks.list({ status: "ready" })).length;
    await this.support.publishEvent({
      correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
      eventType: "scheduler.dispatch_started",
      message: "Scheduler dispatch started",
      data: { queuedBefore }
    });
    await this.support.publishEvent({
      correlation: this.support.buildCorrelation({ traceId: "scheduler" }),
      eventType: "scheduler.dispatch_completed",
      message: "Scheduler dispatch completed",
      data: { queuedBefore }
    });
    return { queuedBefore };
  }

  /** 语义上等同于 `runTaskSyncNow`（全量集成同步），供 `TitingServices.syncTaskIntegrations` 委托。 */
  async syncTaskIntegrations(): Promise<void> {
    await this.runTaskSyncNow();
  }

  /** Webhook 等外部入口复用与 pull 相同的入库+入队逻辑。 */
  async ingestTaskFromIntegration(task: TitingTask, operator: string): Promise<TitingTask | null> {
    return this.ingestPulledTask(task, operator);
  }

  /**
   * 心跳早于 `now - agentOfflineTimeoutMs` 的 Agent：`active` 任务释放回 `ready`，Agent 标为 `offline`。
   */
  private async recoverOfflineAgentsAndTasks(): Promise<void> {
    const staleBefore = new Date(this.support.now().getTime() - this.config.agentOfflineTimeoutMs);
    const agents = await this.deps.agents.list();
    for (const agent of agents) {
      if (agent.lastHeartbeatAt > staleBefore) {
        continue;
      }
      let agentChanged = false;
      const shouldPublishOffline = agent.status === "busy" || agent.status === "idle";
      if ((agent.status === "busy" || agent.status === "offline") && agent.taskId) {
        const task = await this.deps.tasks.getById(agent.taskId);
        if (task) {
          await this.failTimedOutExecution(agent, task);
        }
        if (agent.status === "busy" && task?.status === "active") {
          await this.taskHost.releaseTask(task.id, "Agent heartbeat timed out; task re-queued", "scheduler");
          await this.support.appendExecutionLog(task, null, "scheduler.task_released", "Task released after agent timeout", {
            agentId: agent.id,
            lastHeartbeatAt: agent.lastHeartbeatAt.toISOString()
          }, this.support.buildCorrelation({ task, agentId: agent.id }));
          await this.support.publish("scheduler.task_released", "Task released after agent timeout", task, {
            agentId: agent.id,
            lastHeartbeatAt: agent.lastHeartbeatAt.toISOString()
          }, { agentId: agent.id });
        }
        agent.taskId = null;
        agentChanged = true;
      }
      if (shouldPublishOffline) {
        agent.status = "offline";
        agentChanged = true;
      }
      if (agentChanged) {
        agent.updatedAt = this.support.now();
        await this.deps.agents.upsert(agent);
        if (shouldPublishOffline) {
          await this.support.publishAgentEvent("agent.offline", "Agent marked offline after heartbeat timeout", agent);
        }
      }
    }
  }

  private async failTimedOutExecution(agent: AgentRecord, task: TitingTask): Promise<void> {
    const [execution] = await this.deps.executions.list({
      taskId: task.id,
      agentId: agent.id,
      status: "executing",
      limit: 1
    });
    if (!execution) {
      return;
    }
    const message = "Agent heartbeat timed out; execution marked failed";
    execution.summary = message;
    await this.support.updateExecutionStatus(execution, task, "failed", message, {
      agentId: agent.id,
      lastHeartbeatAt: agent.lastHeartbeatAt.toISOString(),
      reason: "agent_heartbeat_timeout"
    }, execution.executor);
  }

  private async syncHumanRepliesForIntegration(
    integration: TaskIntegrationPlugin & Required<Pick<TaskIntegrationPlugin, "pullHumanReplies">>
  ): Promise<void> {
    const tasks = (await this.deps.tasks.list({ status: "waiting" }))
      .filter((task) => task.source === integration.id && Boolean(task.externalId));
    if (tasks.length === 0) {
      return;
    }
    const replies = await integration.pullHumanReplies(tasks);
    for (const reply of sortHumanReplies(replies)) {
      await this.applyHumanReply(integration, tasks, reply);
    }
  }

  async applyHumanReplyFromIntegration(
    integration: TaskIntegrationPlugin,
    candidateTasks: TitingTask[],
    reply: Awaited<ReturnType<NonNullable<TaskIntegrationPlugin["pullHumanReplies"]>>>[number]
  ): Promise<boolean> {
    return this.applyHumanReply(integration, candidateTasks, reply);
  }

  private async applyHumanReply(
    integration: TaskIntegrationPlugin,
    candidateTasks: TitingTask[],
    reply: Awaited<ReturnType<NonNullable<TaskIntegrationPlugin["pullHumanReplies"]>>>[number]
  ): Promise<boolean> {
    const task = candidateTasks.find((item) => item.id === reply.taskId)
      ?? candidateTasks.find((item) => item.externalId === reply.externalId)
      ?? await this.deps.tasks.getById(reply.taskId)
      ?? await this.deps.tasks.getByExternalId(integration.id, reply.externalId);
    if (!task || task.status !== "waiting") {
      return false;
    }

    const humanLoop = readHumanLoopMetadata(task.metadata);
    if (!humanLoop.requestedAt || humanLoop.seenReplyIds.includes(reply.replyId)) {
      return false;
    }
    if (new Date(reply.createdAt).getTime() < new Date(humanLoop.requestedAt).getTime()) {
      return false;
    }

    task.instruction = appendHumanReplyToInstruction(task.instruction, reply);
    task.metadata = {
      ...task.metadata,
      humanLoop: {
        ...humanLoop,
        lastReplyId: reply.replyId,
        lastReplyAt: reply.createdAt,
        lastReplyAuthor: reply.author,
        lastReplyBody: reply.body,
        seenReplyIds: trimReplyIds([...humanLoop.seenReplyIds, reply.replyId])
      }
    };
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

    await this.support.appendExecutionLog(task, null, "goal.human_reply_received", "Human reply received from integration comment", {
      replyId: reply.replyId,
      externalId: reply.externalId,
      author: reply.author,
      createdAt: reply.createdAt
    }, this.support.buildCorrelation({ task, pluginId: integration.id }));

    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);
    await this.taskHost.resumeTask(task.id, integration.id, "Recovered from integration comment reply");
    return true;
  }

  private async syncOpenSpecReviewsForIntegration(
    integration: TaskIntegrationPlugin & Required<Pick<TaskIntegrationPlugin, "pullOpenSpecReviewIssues">>
  ): Promise<void> {
    const tasks = (await this.deps.tasks.list({ status: "waiting" }))
      .filter((task) => task.agentKind === "product")
      .filter((task) => task.source === integration.id || Boolean(readObject(task.metadata.openSpecReview)?.externalId));
    if (tasks.length === 0) {
      return;
    }
    const replies = await integration.pullOpenSpecReviewIssues(tasks);
    for (const reply of replies.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))) {
      await this.applyOpenSpecReviewReply(integration, tasks, reply);
    }
  }

  private async applyOpenSpecReviewReply(
    integration: TaskIntegrationPlugin,
    candidateTasks: TitingTask[],
    reply: OpenSpecReviewIssueReply
  ): Promise<void> {
    const task = candidateTasks.find((item) => item.id === reply.taskId)
      ?? await this.deps.tasks.getById(reply.taskId);
    if (!task || task.status !== "waiting" || task.agentKind !== "product") {
      return;
    }

    const openSpecReview = readObject(task.metadata.openSpecReview) ?? {};
    const reviewExternalId = readString(openSpecReview.externalId);
    if (reviewExternalId && reply.reviewExternalId !== reviewExternalId) {
      return;
    }
    const seenReplyIds = Array.isArray(openSpecReview.seenReplyIds)
      ? openSpecReview.seenReplyIds.filter((item): item is string => typeof item === "string")
      : [];
    if (seenReplyIds.includes(reply.replyId)) {
      return;
    }
    if (!reply.ready || reply.decision === "pending") {
      return;
    }

    const now = this.support.now();
    const nextReviewMetadata = {
      ...openSpecReview,
      lastReplyId: reply.replyId,
      lastReplyAt: reply.updatedAt,
      lastDecision: reply.decision,
      lastBody: reply.body,
      seenReplyIds: trimReplyIds([...seenReplyIds, reply.replyId])
    };
    task.metadata = {
      ...task.metadata,
      openSpecReview: nextReviewMetadata
    };
    task.updatedAt = now;
    await this.deps.tasks.save(task);

    const review = await this.deps.humanReviews.getLatestByTask(task.id);
    if (review) {
      review.status = reply.decision === "dismissed" ? "dismissed" : "answered";
      review.responseSummary = `${reply.decision}: ${reply.body}`.trim();
      review.updatedAt = now;
      await this.deps.humanReviews.save(review);
    } else {
      await this.deps.humanReviews.create({
        id: this.support.createId(),
        taskId: task.id,
        executionId: null,
        requestType: "openspec_review",
        reason: "OpenSpec review reply received",
        externalThreadRef: reply.reviewExternalId,
        responseSummary: `${reply.decision}: ${reply.body}`.trim(),
        status: reply.decision === "dismissed" ? "dismissed" : "answered",
        createdAt: now,
        updatedAt: now
      });
    }

    await this.support.appendExecutionLog(task, null, "openspec_review.reply_received", "OpenSpec review reply received", {
      replyId: reply.replyId,
      decision: reply.decision,
      reviewExternalId: reply.reviewExternalId,
      rawBody: reply.rawBody
    }, this.support.buildCorrelation({ task, pluginId: integration.id }));

    if (reply.decision === "approved") {
      if (!this.config.enableOpenSpecReviewGate) {
        await this.support.appendExecutionLog(task, null, "openspec_review.gate_disabled", "OpenSpec review gate automation is disabled", {
          replyId: reply.replyId,
          reviewExternalId: reply.reviewExternalId
        }, this.support.buildCorrelation({ task, pluginId: integration.id }));
        return;
      }
      await this.promoteProductTaskToProgramming(task, reply, integration.id);
      return;
    }

    if (reply.decision === "changes_requested") {
      const nextReviewAttempt = readReviewAttempt(openSpecReview.attempt) + 1;
      task.metadata = {
        ...task.metadata,
        openSpecReview: {
          ...nextReviewMetadata,
          previousExternalId: reviewExternalId || readString(openSpecReview.externalId) || null,
          externalId: null,
          title: null,
          url: null,
          reused: false,
          attempt: nextReviewAttempt
        }
      };
      task.instruction = appendHumanReplyToInstruction(task.instruction, {
        taskId: task.id,
        externalId: task.externalId ?? reply.parentExternalId,
        replyId: reply.replyId,
        body: reply.body,
        author: "meegle-openspec-review",
        createdAt: reply.updatedAt
      });
      task.updatedAt = now;
      await this.deps.tasks.save(task);
      await this.taskHost.resumeTask(task.id, integration.id, "OpenSpec review requested changes");
      return;
    }

    if (reply.decision === "dismissed") {
      await this.support.transitionTask(task, "cancelled", "OpenSpec review dismissed", integration.id);
    }
  }

  private async promoteProductTaskToProgramming(
    productTask: TitingTask,
    reply: OpenSpecReviewIssueReply,
    operator: string
  ): Promise<void> {
    const existing = (await this.deps.tasks.list()).find((task) => {
      return task.id !== productTask.id && task.metadata.sourceProductTaskId === productTask.id;
    });
    if (existing) {
      return;
    }
    const workspaceId = readString(productTask.metadata.workspaceId);
    const openspecChangeId = readString(productTask.metadata.openspecChangeId);
    const openSpecReview = readObject(productTask.metadata.openSpecReview) ?? {};
    const openspecPath = readString(productTask.metadata.openspecPath) ?? readString(openSpecReview.openspecPath);
    if (productTask.metadata.openspecSourceState === "none" && !openspecPath) {
      await this.support.appendExecutionLog(productTask, null, "openspec_review.handoff_blocked", "OpenSpec local path metadata is missing", {
        workspaceId: workspaceId ?? null,
        openspecChangeId: openspecChangeId ?? null,
        replyId: reply.replyId
      }, this.support.buildCorrelation({ task: productTask, pluginId: operator }));
      return;
    }
    if (!workspaceId || !openspecChangeId) {
      await this.support.appendExecutionLog(productTask, null, "openspec_review.handoff_blocked", "OpenSpec handoff metadata is incomplete", {
        workspaceId: workspaceId ?? null,
        openspecChangeId: openspecChangeId ?? null,
        replyId: reply.replyId
      }, this.support.buildCorrelation({ task: productTask, pluginId: operator }));
      return;
    }
    const handoffWrite = await writeHandoffArtifact(workspaceId, {
      sourceProductTaskId: productTask.id,
      openspecChangeId,
      openspecRevision: productTask.metadata.openspecRevision ?? null,
      reviewExternalId: reply.reviewExternalId,
      replyId: reply.replyId,
      approvedAt: reply.updatedAt
    });
    if (!handoffWrite.ok) {
      await this.support.appendExecutionLog(productTask, null, "openspec_review.handoff_blocked", "OpenSpec handoff workspace is not restorable", {
        workspaceId,
        openspecChangeId,
        replyId: reply.replyId,
        reason: handoffWrite.reason
      }, this.support.buildCorrelation({ task: productTask, pluginId: operator }));
      return;
    }
    await cleanupProductTaskContext(workspaceId);

    const metadata = attachBranchMetadata({
      repos: productTask.metadata.repos ?? [{ key: "Repo1", url: productTask.repo }],
      sourceProductTaskId: productTask.id,
      workspaceId,
      openspecPath,
      openspecChangeId,
      openspecRevision: productTask.metadata.openspecRevision,
      openspecValidation: productTask.metadata.openspecValidation,
      workflowRole: "programming_from_product",
      approvedOpenSpec: true,
      openSpecReview: {
        ...openSpecReview,
        externalId: reply.reviewExternalId,
        replyId: reply.replyId,
        decision: reply.decision,
        approvedAt: reply.updatedAt,
        body: reply.body
      },
      agentRequest: normalizeAgentRequest({ agentKind: "programming" })
    }, false);
    productTask.instruction = buildProgrammingHandoffInstruction(productTask, reply);
    productTask.executor = "programming";
    productTask.agentKind = "programming";
    productTask.preferredDriver = "coding";
    productTask.preferredRuntime = null;
    productTask.driverId = "coding";
    productTask.runtimeProviderId = null;
    productTask.metadata = metadata;
    productTask.startedAt = null;
    productTask.completedAt = null;
    productTask.updatedAt = this.support.now();
    await this.deps.tasks.save(productTask);
    const preflightPassed = await this.runProgrammingHandoffPreflight(productTask, operator);
    if (!preflightPassed) {
      return;
    }
    await this.taskHost.resumeTask(productTask.id, operator, "OpenSpec review approved for programming");
  }

  private async runProgrammingHandoffPreflight(task: TitingTask, operator: string): Promise<boolean> {
    if (!this.deps.runPreflight) {
      return true;
    }
    const preflightResult = await this.deps.runPreflight(task);
    let updated: TitingTask = {
      ...task,
      metadata: {
        ...task.metadata,
        preflight: {
          passed: preflightResult.passed,
          checkedAt: this.support.now().toISOString(),
          checks: preflightResult.checks
        },
        ...(preflightResult.error ? { preflightError: preflightResult.error } : {})
      },
      updatedAt: this.support.now()
    };
    await this.deps.tasks.save(updated);
    if (preflightResult.passed) {
      await this.support.publish("task.preflight.passed", "Task preflight passed for approved OpenSpec handoff", updated, {
        checks: preflightResult.checks
      });
      return true;
    }

    const recorded = await this.support.recordFailureRepair({
      task: updated,
      execution: null,
      kind: "preflight",
      summary: preflightResult.error ?? "Task preflight failed",
      detail: {
        checks: preflightResult.checks,
        stage: "approved_openspec_handoff"
      },
      pluginId: operator
    });
    updated = recorded.task;
    const waitReason = {
      type: "environment_blocked" as const,
      source: "preflight",
      message: preflightResult.error ?? "Task preflight failed",
      recoverableBy: "operator" as const,
      createdAt: this.support.now().toISOString()
    };
    updated.metadata = {
      ...updated.metadata,
      waitReason
    };
    updated.updatedAt = this.support.now();
    await this.deps.tasks.save(updated);
    await this.support.publish("task.preflight.failed", "Task preflight failed for approved OpenSpec handoff", updated, {
      checks: preflightResult.checks
    });
    await this.support.appendExecutionLog(updated, null, "task.wait_reason", waitReason.message, {
      waitReason
    }, this.support.buildCorrelation({ task: updated, pluginId: operator }));
    return false;
  }

  private async ingestPulledTask(pulledTask: TitingTask, operator: string): Promise<TitingTask | null> {
    if (!pulledTask.externalId) {
      return null;
    }

    const existing = await this.deps.tasks.getByExternalId(pulledTask.source, pulledTask.externalId);
    const task = existing
      ? await this.updatePulledTask(existing, pulledTask)
      : await this.createPulledTask(pulledTask);

    if (!task.instruction.trim() || !task.repo.trim() || !task.branch.trim()) {
      if (task.status === "draft") {
        return this.taskHost.pauseForWait(task.id, {
          type: "environment_blocked",
          source: operator,
          message: "Pulled task is missing required fields",
          recoverableBy: "operator"
        }, operator);
      }
      return task;
    }

    if (task.status === "draft") {
      return this.taskHost.submitTask(task.id, operator);
    }

    if (task.status === "waiting" && this.shouldRequeueBlockedPreflight(task)) {
      const retried = await this.taskHost.retryTask(task.id, operator);
      return retried;
    }
    return task;
  }

  private shouldRequeueBlockedPreflight(task: TitingTask): boolean {
    if (isOpenSpecReviewApprovalWaiting(task)) {
      return false;
    }
    const preflight = task.metadata.preflight;
    if (preflight && typeof preflight === "object" && (preflight as Record<string, unknown>).passed === true) {
      return false;
    }
    const specAttachments = task.metadata.specAttachments;
    if (Array.isArray(specAttachments) && specAttachments.length > 0) {
      return true;
    }
    const meegleWorkItemFields = task.metadata.meegleWorkItemFields;
    if (Array.isArray(meegleWorkItemFields) && meegleWorkItemFields.length > 0) {
      return true;
    }
    const meegleFields = task.metadata.meegleFields;
    return typeof meegleFields === "object" && meegleFields !== null && Object.keys(meegleFields as Record<string, unknown>).length > 0;
  }

  private async createPulledTask(pulledTask: TitingTask): Promise<TitingTask> {
    const now = this.support.now();
    const id = this.support.createId();
    const normalizedBranch = normalizeOptionalBranch(pulledTask.branch);
    const agentRequest = normalizeAgentRequest({
      executor: pulledTask.executor,
      agentKind: pulledTask.agentKind,
      preferredDriver: pulledTask.preferredDriver ?? pulledTask.driverId ?? undefined,
      preferredRuntime: pulledTask.preferredRuntime ?? pulledTask.runtimeProviderId ?? undefined
    });
    const task: TitingTask = {
      ...pulledTask,
      id,
      traceId: this.support.createId(),
      branch: normalizedBranch ?? buildDefaultTaskBranch(id, now),
      status: "draft",
      retryCount: 0,
      repairCount: 0,
      executor: pulledTask.executor || agentRequest.legacyExecutor || agentRequest.agentKind,
      agentKind: agentRequest.agentKind,
      preferredDriver: agentRequest.preferredDriver ?? null,
      preferredRuntime: agentRequest.preferredRuntime ?? null,
      driverId: agentRequest.preferredDriver ?? null,
      runtimeProviderId: agentRequest.preferredRuntime ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      metadata: attachBranchMetadata({
        ...pulledTask.metadata,
        agentRequest
      }, normalizedBranch === null)
    };
    await this.deps.tasks.create(task);
    await this.support.emitStatus(task, "draft", "Task pulled from integration", task.source);
    return task;
  }

  private async updatePulledTask(existing: TitingTask, pulledTask: TitingTask): Promise<TitingTask> {
    const normalizedBranch = normalizeOptionalBranch(pulledTask.branch);
    const preserveOpenSpecReview = isOpenSpecReviewApprovalWaiting(existing);
    const preservedRouting = preserveOpenSpecReview
      ? {
          executor: existing.executor,
          agentKind: existing.agentKind,
          preferredDriver: existing.preferredDriver,
          preferredRuntime: existing.preferredRuntime,
          driverId: existing.driverId,
          runtimeProviderId: existing.runtimeProviderId
        }
      : null;
    const preservedMetadata = preserveOpenSpecReview
      ? preserveOpenSpecReviewMetadata(existing.metadata)
      : {};
    existing.title = pulledTask.title;
    existing.instruction = pulledTask.instruction;
    existing.repo = pulledTask.repo;
    existing.branch = normalizedBranch ?? existing.branch;
    existing.priority = pulledTask.priority;
    const agentRequest = normalizeAgentRequest({
      executor: pulledTask.executor,
      agentKind: pulledTask.agentKind,
      preferredDriver: pulledTask.preferredDriver ?? pulledTask.driverId ?? undefined,
      preferredRuntime: pulledTask.preferredRuntime ?? pulledTask.runtimeProviderId ?? undefined
    });
    if (preservedRouting) {
      existing.executor = preservedRouting.executor;
      existing.agentKind = preservedRouting.agentKind;
      existing.preferredDriver = preservedRouting.preferredDriver;
      existing.preferredRuntime = preservedRouting.preferredRuntime;
      existing.driverId = preservedRouting.driverId;
      existing.runtimeProviderId = preservedRouting.runtimeProviderId;
    } else {
      existing.executor = pulledTask.executor || agentRequest.legacyExecutor || agentRequest.agentKind;
      existing.agentKind = agentRequest.agentKind;
      existing.preferredDriver = agentRequest.preferredDriver ?? null;
      existing.preferredRuntime = agentRequest.preferredRuntime ?? null;
      existing.driverId = agentRequest.preferredDriver ?? null;
      existing.runtimeProviderId = agentRequest.preferredRuntime ?? null;
    }
    existing.constraints = [...pulledTask.constraints];
    existing.acceptanceCriteria = [...pulledTask.acceptanceCriteria];
    existing.metadata = attachBranchMetadata({
      ...existing.metadata,
      ...pulledTask.metadata,
      agentRequest,
      ...preservedMetadata
    }, normalizedBranch === null);
    existing.updatedAt = this.support.now();
    await this.deps.tasks.save(existing);
    return existing;
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isOpenSpecReviewApprovalWaiting(task: TitingTask): boolean {
  const waitReason = readObject(task.metadata.waitReason);
  const openSpecReview = readObject(task.metadata.openSpecReview);
  return (
    task.status === "waiting"
    && waitReason?.type === "approval"
    && Boolean(readString(openSpecReview?.externalId))
  );
}

function preserveOpenSpecReviewMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const preserved: Record<string, unknown> = {};
  for (const key of [
    "workflowRole",
    "openspecSourceState",
    "agentRequest",
    "waitReason",
    "openSpecReview",
    "workspaceId",
    "openspecPath",
    "openspecChangeId",
    "openspecRevision",
    "openspecValidation"
  ]) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      preserved[key] = metadata[key];
    }
  }
  return preserved;
}

function readReviewAttempt(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function buildProgrammingHandoffInstruction(productTask: TitingTask, reply: OpenSpecReviewIssueReply): string {
  const lines = [
    productTask.instruction.trim(),
    "",
    "OpenSpec review approved. Implement the approved OpenSpec change in the shared workspace.",
    `Product task: ${productTask.id}`,
    `Review reply: ${reply.replyId}`,
    reply.body ? `Review note: ${reply.body}` : ""
  ];
  return lines.filter((line, index) => index === 1 || line.trim().length > 0).join("\n");
}

async function writeHandoffArtifact(workspaceId: string, payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isAbsolute(workspaceId)) {
    return { ok: false, reason: "workspaceId must be an absolute path" };
  }
  try {
    const artifactsPath = join(workspaceId, "artifacts");
    await mkdir(artifactsPath, { recursive: true });
    await writeFile(join(artifactsPath, "handoff.json"), `${JSON.stringify(payload, null, 2)}\n`);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function cleanupProductTaskContext(workspaceId: string): Promise<void> {
  if (!isAbsolute(workspaceId)) {
    return;
  }
  await rm(join(workspaceId, "task.md"), { force: true });
}
