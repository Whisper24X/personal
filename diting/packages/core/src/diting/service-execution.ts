/**
 * 环境与执行插件编排，以及与质量/修复闭环、治理元数据的交互；**不**负责任务入队（由调度器完成）。
 */
import {
  AgentRecord,
  CompletionGateResult,
  EnvironmentContext,
  EvalResult,
  ExecutionContext,
  ExecutionPlugin,
  ExecutionRecord,
  ExecutionResult,
  HumanReview,
  NeedsHumanPayload,
  PreparedWorkspace,
  QualityResult,
  RepairGoal,
  TitingTask
} from "@diting/plugin-api";
import { join } from "node:path";
import { ServiceSupport } from "./service-support";
import { canTransition } from "./state-machine";
import { canSafelyFallbackWorkflowPrompt } from "./failure-repair-service";
import { PreflightBlockedError } from "./errors";
import { writeQualityJsonArtifact } from "./quality-artifacts";
import { CodeReviewReport, evaluateQualityEvidence } from "./quality-evidence";
import {
  buildImplementationHandoff,
  buildQualityRepairHandoff,
  parseImplementationHandoff,
  validateHandoffAnchors
} from "./quality-handoff";
import {
  buildFailureHash,
  buildChildRepairIssueIdempotencyKey,
  buildRepairConstraints,
  buildRepairDoneWhen,
  buildRepairDoneWhenWithoutQuality,
  buildRepairObjective,
  decideStopReason,
  decideStopReasonWithoutQuality,
  describeStopReason,
  EnvironmentFailureShape,
  extractRootCauseHint,
  getExecutionRetryDecision,
  isEnvironmentPreparationError,
  isWorkflowPromptsFailure,
  normalizeAgentRequest,
  readDiffStats,
  readHumanLoopMetadata,
  readQualityChecks,
  ServiceConfig,
  ServiceDependencies
} from "./service-shared";

/**
 * 单任务执行管线（由 `ServiceScheduler` 在 Agent claim 后调用）：
 *
 * 1. **准备环境**：`EnvironmentPlugin.prepareWorkspace`
 * 2. **循环**：创建 `ExecutionRecord` → 调执行器 `execute` / `continueSession` → 持久化结果与治理扫描
 * 3. **质量**（若启用）：`QualityPlugin.evaluate`，结合 `RepairGoal` 做修复轮次与停止条件（`decideStopReason` 等）
 * 4. **无质量插件时**： success 跳过评测后继续 PR/done；失败走简化 repair 预算
 * 5. **异常路径**：可重试执行失败、环境失败、needs_human、workflow-prompts 特判等
 *
 * Agent 维度的「保活心跳」由 `startAgentHeartbeatLoop` 在长时间执行期间维持。
 */

/**
 * 可重试执行失败的处理结果，供执行循环决定如何推进：
 * - `requeued`：已转入 `queued`，跳出循环交还调度器重新派发。
 * - `retry-inline`：当前状态（如 `repairing`）不允许回到 `queued`，保持原状态在管线内再跑一轮。
 * - `terminal`：重试预算耗尽，已落入合法终态（`blocked`/`failed`），跳出循环。
 */
type RetryOutcome = {
  action: "requeued" | "retry-inline" | "terminal";
  task: TitingTask;
};

type QualityFailureRepairOptions = {
  failureSummary?: string;
  failedChecks?: string[];
  repairObjective?: string;
  repairDoneWhen?: string[];
  artifactPaths?: Record<string, string>;
  codeReview?: {
    reportPath: string;
    report: CodeReviewReport;
  };
};

export class ServiceExecution {
  constructor(
    private readonly deps: ServiceDependencies,
    private readonly config: ServiceConfig,
    private readonly support: ServiceSupport
  ) {}

  /**
   * 执行单任务直至进入终态或交出调度（例如内部 `retryTask` 提前 break）。
   * 外层应已在 `running` 且 Agent 已占用。
   */
  async runTask(task: TitingTask, agent: AgentRecord): Promise<void> {
    const environment = this.deps.runtime.selectEnvironmentPlugin();
    const executor = task.preferredRuntime ?? task.executor;
    const agentPlugin = this.deps.runtime.selectAgentPluginForTask({
      agentKind: task.agentKind ?? null,
      driverId: task.driverId ?? task.preferredDriver ?? null,
      runtimeProviderId: task.runtimeProviderId ?? task.preferredRuntime ?? null,
      capability: task.agentKind === "product" ? "openspec" : undefined,
      executor
    });
    const completionGatePlugin = this.deps.runtime.getPrimaryCompletionGatePlugin();
    const qualityPlugin = this.deps.runtime.getPrimaryQualityPlugin();
    const governancePlugins = this.deps.runtime.getGovernancePlugins();
    const logPlugin = this.deps.runtime.selectLogPlugin();
    const selectedPluginIds = {
      environment: environment.id,
      agent: agentPlugin.id,
      completionGate: completionGatePlugin?.id ?? null,
      quality: qualityPlugin?.id ?? null,
      governance: governancePlugins.map((plugin) => plugin.id),
      log: logPlugin.id,
      requestedExecutor: task.executor,
      requestedAgentKind: task.agentKind ?? null,
      requestedDriver: task.driverId ?? task.preferredDriver ?? null,
      requestedRuntime: task.runtimeProviderId ?? task.preferredRuntime ?? null,
      selectedAgentKind: agentPlugin.agentKind ?? null,
      selectedDriver: agentPlugin.driverId ?? null,
      selectedRuntime: agentPlugin.runtimeProviderId ?? null
    };
    let currentTask = task;
    let workspace: PreparedWorkspace | null = null;
    let execution: ExecutionRecord | null = null;
    const stopHeartbeat = this.startAgentHeartbeatLoop(agent.id);

    await this.support.publish("scheduler.agent_selected", "Agent selected", currentTask, { agentId: agent.id });

    try {
      currentTask = await this.ensurePreflightBeforeEnvironment(currentTask, agent.id);
      await this.support.appendExecutionLog(
        currentTask,
        null,
        "execution.plugins_selected",
        "Execution plugins selected",
        { selectedPluginIds },
        this.support.buildCorrelation({
          task: currentTask,
          agentId: agent.id,
          pluginId: agentPlugin.id
        })
      );
      const environmentContext: EnvironmentContext = {
        runtimeLogger: async (event) => (
          this.support.recordEnvironmentRuntimeEvent(currentTask, agent.id, event, environment.id)
        )
      };
      workspace = await environment.prepareWorkspace(currentTask, environmentContext);
      await this.support.appendExecutionLog(
        currentTask,
        null,
        "environment.workspace_prepared",
        "Workspace prepared",
        { workspacePath: workspace.workspacePath },
        this.support.buildCorrelation({
          task: currentTask,
          agentId: agent.id,
          pluginId: environment.id
        })
      );
      if (isQualityOrchestrationTask(currentTask)) {
        execution = await this.createExecution(currentTask, agent.id, workspace, environment.id);
        currentTask = await this.runQualityOrchestration(
          currentTask,
          execution,
          workspace,
          agentPlugin,
          agent.id
        );
        return;
      }
      let goal = await this.deps.repairGoals.getByTaskId(currentTask.id);
      let loopCount = goal?.currentIteration ?? 0;
      let previousResult: ExecutionResult | null = null;
      let previousFailureHash: string | null = goal?.lastFailureHash ?? null;
      let repeatedFailureCount = 0;
      let noDiffStreak = 0;

      while (true) {
        execution = await this.createExecution(currentTask, agent.id, workspace, environment.id);
        const activeExecution = execution;
        await this.support.updateExecutionStatus(
          execution,
          currentTask,
          "executing",
          "Execution started",
          {
            agentId: agent.id,
            iteration: loopCount + 1
          },
          agentPlugin.id
        );
        const executionContext: ExecutionContext = {
          runtimeLogger: async (event) => (
            this.support.recordExecutionRuntimeEvent(
              currentTask,
              activeExecution,
              agent.id,
              event,
              agentPlugin.id
            )
          )
        };

        const result: ExecutionResult = goal && previousResult?.sessionId && agentPlugin.continueSession
          ? await agentPlugin.continueSession(previousResult.sessionId, currentTask, workspace, goal, executionContext)
          : await agentPlugin.execute(currentTask, workspace, goal, executionContext);
        execution.summary = result.summary;
        execution.endedAt = this.support.now();
        await this.deps.executions.save(execution);
        await this.support.appendExecutionLog(currentTask, execution, "executor.completed", result.summary, {
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          sessionId: result.sessionId,
          errorCategory: result.errorCategory,
          timeoutCategory: result.timeoutCategory,
          stdout: result.stdout,
          stderr: result.stderr,
          metadata: result.metadata
        }, this.support.buildCorrelation({
          task: currentTask,
          execution,
          agentId: agent.id,
          pluginId: agentPlugin.id
        }));
        await this.support.recordGovernanceEntries(currentTask, execution, result.metadata, agent.id);

        if (isProductOpenSpecTask(currentTask)) {
          currentTask = await this.handleProductOpenSpecResult(currentTask, execution, workspace, result, agentPlugin.id, agent.id);
          break;
        }

        const retryOutcome = await this.handleRetryableExecutionFailure(currentTask, execution, agent, result);
        if (retryOutcome) {
          currentTask = retryOutcome.task;
          if (retryOutcome.action === "retry-inline") {
            // 修复轮内遇到可重试错误：状态机不允许 repairing -> queued，
            // 因此保持 repairing 在当前执行管线内再跑一轮，而非交还调度器重新入队。
            previousResult = result;
            continue;
          }
          break;
        }

        if (isWorkflowPromptsFailure(result)) {
          if (canSafelyFallbackWorkflowPrompt(result)) {
            const recorded = await this.support.recordFailureRepair({
              task: currentTask,
              execution,
              kind: "workflow_prompt",
              summary: result.summary,
            detail: {
              workflowError: result.metadata.workflowError,
              fallbackReason: "default-superpowers-workflow",
              fallbackMode: "default-superpowers-workflow"
            },
              executionResult: result,
              canFallback: true,
              agentId: agent.id,
              pluginId: agentPlugin.id
            });
            currentTask = recorded.task;
            workspace = {
              ...workspace,
              workflowPromptsPath: undefined
            };
            await this.support.updateExecutionStatus(
              execution,
              currentTask,
              "completed",
              "Workflow prompt failure skipped; continuing with fallback workflow",
              {
                sessionId: result.sessionId,
                workflowFallback: true
              }
            );
            previousResult = null;
            continue;
          }

          const recorded = await this.support.recordFailureRepair({
            task: currentTask,
            execution,
            kind: "workflow_prompt",
            summary: result.summary,
            detail: {
              workflowError: result.metadata.workflowError,
              workflowFallbackUnavailable: true
            },
            executionResult: result,
            canFallback: false,
            agentId: agent.id,
            pluginId: agentPlugin.id
          });
          currentTask = recorded.task;
          await this.support.updateExecutionStatus(execution, currentTask, "failed", result.summary, {
            sessionId: result.sessionId,
            errorCategory: result.errorCategory,
            timeoutCategory: result.timeoutCategory
          });
          currentTask = await applyFailureTerminalStatus(
            this.support,
            currentTask,
            recorded.decision.strategy,
            result.summary,
            agentPlugin.id,
            execution
          );
          if (currentTask.status !== "waiting") {
            currentTask.completedAt = this.support.now();
            await this.deps.tasks.save(currentTask);
          }
          await this.support.reportTaskResultIfNeeded(currentTask, result.summary);
          break;
        }

        if (isProgrammingImplementationTask(currentTask) && result.exitCode === 0) {
          currentTask = await this.handoffImplementationToQuality(
            currentTask,
            execution,
            workspace,
            result,
            agentPlugin.id,
            agent.id
          );
          break;
        }

        const explicitlyOpenSpecTask = isOpenSpecTask(currentTask);
        if (explicitlyOpenSpecTask && !completionGatePlugin) {
          const summary = "OpenSpec completion gate plugin is required but not registered";
          await this.support.appendExecutionLog(
            currentTask,
            execution,
            "completion_gate.missing",
            summary,
            { openspecChangeId: currentTask.metadata.openspecChangeId },
            this.support.buildCorrelation({ task: currentTask, execution, agentId: agent.id, pluginId: agentPlugin.id })
          );
          await this.support.updateExecutionStatus(execution, currentTask, "failed", summary, {
            openspecChangeId: currentTask.metadata.openspecChangeId
          });
          currentTask = await this.support.transitionTask(currentTask, "failed", summary, agentPlugin.id, execution);
          currentTask.completedAt = this.support.now();
          await this.deps.tasks.save(currentTask);
          await this.support.reportTaskResultIfNeeded(currentTask, summary);
          break;
        }

        if (completionGatePlugin) {
          const gate = await completionGatePlugin.evaluate({
            task: currentTask,
            workspace,
            execution: result,
            repairGoal: goal
          });
          const completionGateEventType = gate.passed
            ? (gate.metadata.skipped === true ? "completion_gate.skipped" : "completion_gate.completed")
            : "completion_gate.failed";
          await this.support.appendExecutionLog(
            currentTask,
            execution,
            completionGateEventType,
            gate.passed
              ? (gate.metadata.skipped === true ? "OpenSpec completion gate skipped" : "OpenSpec completion gate passed")
              : "OpenSpec completion gate failed",
            {
              passed: gate.passed,
              checks: gate.checks,
              incompleteTasks: gate.incompleteTasks,
              metadata: gate.metadata
            },
            this.support.buildCorrelation({
              task: currentTask,
              execution,
              agentId: agent.id,
              pluginId: completionGatePlugin.id
            })
          );

          if (!gate.passed) {
            const failureHash = buildCompletionGateFailureHash(result, gate);
            const recorded = await this.support.recordFailureRepair({
              task: currentTask,
              execution,
              kind: "completion_gate",
              summary: "OpenSpec completion gate failed",
              detail: {
                incompleteTasks: gate.incompleteTasks,
                checks: gate.checks,
                metadata: gate.metadata
              },
              gate,
              executionResult: result,
              agentId: agent.id,
              pluginId: completionGatePlugin.id
            });
            currentTask = recorded.task;
            repeatedFailureCount = failureHash === previousFailureHash ? repeatedFailureCount + 1 : 1;
            previousFailureHash = failureHash;
            loopCount += 1;
            const stopReason = decideStopReasonWithoutQuality({
              repeatedFailureCount,
              iteration: loopCount,
              maxIterations: goal?.maxIterations ?? this.config.maxRepairIterations
            });
            const nextGoalStatus: RepairGoal["status"] = stopReason === "budget_limited" ? "budget_limited" : "repairing";
            const nextGoal: RepairGoal = {
              id: goal?.id ?? this.support.createId(),
              taskId: currentTask.id,
              objective: gate.repairObjective ?? `Complete OpenSpec autonomous tasks: ${gate.incompleteTasks.join("; ")}`,
              constraints: [...currentTask.constraints],
              doneWhen: gate.repairDoneWhen.length > 0 ? gate.repairDoneWhen : gate.incompleteTasks,
              status: nextGoalStatus,
              currentIteration: loopCount,
              maxIterations: goal?.maxIterations ?? this.config.maxRepairIterations,
              lastFailureHash: failureHash,
              metadata: {
                ...(goal?.metadata ?? {}),
                repairSource: "completion-gate",
                incompleteTasks: gate.incompleteTasks,
                completionGate: gate.metadata
              },
              createdAt: goal?.createdAt ?? this.support.now(),
              updatedAt: this.support.now()
            };
            goal = nextGoal;
            await this.deps.repairGoals.upsert(goal);

            if (stopReason === "budget_limited") {
              const hint = extractRootCauseHint(result.stderr);
              const summary = hint
                ? `${describeStopReason(stopReason)} — recurring error: ${hint}`
                : describeStopReason(stopReason);
              await this.support.updateExecutionStatus(execution, currentTask, "failed", summary, {
                iteration: loopCount,
                maxIterations: nextGoal.maxIterations,
                stopReason,
                repairSource: "completion-gate"
              });
              currentTask = await this.support.transitionTask(currentTask, "failed", summary, completionGatePlugin.id, execution);
              currentTask.completedAt = this.support.now();
              await this.deps.tasks.save(currentTask);
              await this.support.reportTaskResultIfNeeded(currentTask, summary);
              break;
            }

            await this.support.updateExecutionStatus(execution, currentTask, "repairing", "Completion gate requires repair", {
              iteration: loopCount,
              repairSource: "completion-gate",
              incompleteTasks: gate.incompleteTasks
            });
            await this.support.updateRunAttemptStage(currentTask.id, "repairing");
            currentTask.repairCount = loopCount;
            await this.deps.tasks.save(currentTask);
            await this.support.appendExecutionLog(
              currentTask,
              execution,
              "completion_gate.iteration_started",
              "Completion gate repair iteration started",
              {
                iteration: loopCount,
                objective: nextGoal.objective,
                incompleteTasks: gate.incompleteTasks
              },
              this.support.buildCorrelation({
                task: currentTask,
                execution,
                agentId: agent.id,
                pluginId: completionGatePlugin.id
              })
            );
            previousResult = result;
            continue;
          }
        }

        const inlineQualityPlugin = shouldRunInlineQuality(currentTask) ? qualityPlugin : null;
        if (!inlineQualityPlugin) {
          const qualityEnabled = Boolean(qualityPlugin);
          const skipSummary = qualityEnabled
            ? "Inline quality disabled for programming agent; quality belongs to quality agent"
            : "Quality plugin disabled; skipping evaluation";
          const completionSummary = qualityEnabled
            ? "Execution completed without inline quality evaluation"
            : "Execution completed without quality evaluation";
          const correlation = this.support.buildCorrelation({
            task: currentTask,
            execution,
            agentId: agent.id,
            pluginId: agentPlugin.id
          });
          await this.support.appendExecutionLog(
            currentTask,
            execution,
            "execution.quality_skipped",
            skipSummary,
            {
              sessionId: result.sessionId,
              qualityEnabled,
              inlineQualityEnabled: false,
              phase: "programming"
            },
            correlation
          );
          await this.support.publish(
            "execution.quality_skipped",
            skipSummary,
            currentTask,
            {
              executionId: execution.id,
              qualityEnabled,
              inlineQualityEnabled: false,
              sessionId: result.sessionId,
              phase: "programming"
            },
            { execution, correlation }
          );

          if (result.exitCode === 0) {
            const pullRequestResult = await this.createPullRequestsBeforeDone({
              task: currentTask,
              execution,
              workspace,
              agentId: agent.id,
              operatorPluginId: agentPlugin.id,
              startData: {
                qualityEnabled,
                inlineQualityEnabled: false,
                sessionId: result.sessionId,
                phase: "programming"
              }
            });
            currentTask = pullRequestResult.task;
            if (pullRequestResult.failed) {
              break;
            }
            await this.support.reportTaskResultIfNeeded(currentTask, result.summary);
            if (goal) {
              await this.deps.repairGoals.upsert({
                ...goal,
                status: "achieved",
                updatedAt: this.support.now()
              });
            }
            await this.support.updateExecutionStatus(
              execution,
              currentTask,
              "completed",
              completionSummary,
              {
                sessionId: result.sessionId,
                qualityEnabled,
                inlineQualityEnabled: false,
                phase: "programming"
              }
            );
            await this.support.completeRunAttempt(currentTask.id, "completed");
            currentTask = await this.support.transitionTask(
              currentTask,
              "succeeded",
              completionSummary,
              agentPlugin.id,
              execution
            );
            currentTask.completedAt = this.support.now();
            await this.deps.tasks.save(currentTask);
            break;
          }

          const failureHash = buildFailureHash(result, []);
          const recorded = await this.support.recordFailureRepair({
            task: currentTask,
            execution,
            kind: "execution",
            summary: result.summary,
            executionResult: result,
            agentId: agent.id,
            pluginId: agentPlugin.id
          });
          currentTask = recorded.task;
          repeatedFailureCount = failureHash === previousFailureHash ? repeatedFailureCount + 1 : 1;
          previousFailureHash = failureHash;
          loopCount += 1;
          const stopReason = decideStopReasonWithoutQuality({
            repeatedFailureCount,
            iteration: loopCount,
            maxIterations: goal?.maxIterations ?? this.config.maxRepairIterations
          });
          const nextGoalStatus: RepairGoal["status"] = stopReason === "budget_limited" ? "budget_limited" : "repairing";
          const nextGoal: RepairGoal = {
            id: goal?.id ?? this.support.createId(),
            taskId: currentTask.id,
            objective: buildRepairObjective(currentTask, result, []),
            constraints: [...currentTask.constraints],
            doneWhen: buildRepairDoneWhenWithoutQuality(currentTask),
            status: nextGoalStatus,
            currentIteration: loopCount,
            maxIterations: goal?.maxIterations ?? this.config.maxRepairIterations,
            lastFailureHash: failureHash,
            metadata: { ...(goal?.metadata ?? {}), repairSource: "execution" },
            createdAt: goal?.createdAt ?? this.support.now(),
            updatedAt: this.support.now()
          };
          goal = nextGoal;
          await this.deps.repairGoals.upsert(goal);

          if (stopReason === "budget_limited") {
            const hint = extractRootCauseHint(result.stderr);
            const summary = hint
              ? `${describeStopReason(stopReason)} — recurring error: ${hint}`
              : describeStopReason(stopReason);
            await this.support.appendExecutionLog(
              currentTask,
              execution,
              "goal.budget_exhausted",
              summary,
              {
                stopReason,
                iteration: loopCount,
                maxIterations: nextGoal.maxIterations,
                qualityEnabled: false
              },
              this.support.buildCorrelation({ task: currentTask, execution, agentId: agent.id })
            );
            await this.support.updateExecutionStatus(execution, currentTask, "failed", summary, {
              iteration: loopCount,
              maxIterations: nextGoal.maxIterations,
              stopReason,
              qualityEnabled: false
            });
            currentTask = await this.support.transitionTask(currentTask, "failed", summary, agentPlugin.id, execution);
            currentTask.completedAt = this.support.now();
            await this.deps.tasks.save(currentTask);
            await this.support.reportTaskResultIfNeeded(currentTask, summary);
            break;
          }

          if (stopReason) {
            await this.support.appendExecutionLog(
              currentTask,
              execution,
              "goal.stop_reason_continued",
              `Continuing repair after stop signal: ${stopReason}`,
              {
                stopReason,
                iteration: loopCount,
                maxIterations: nextGoal.maxIterations,
                qualityEnabled: false
              },
              this.support.buildCorrelation({ task: currentTask, execution, agentId: agent.id })
            );
          }

          await this.support.updateExecutionStatus(
            execution,
            currentTask,
            "repairing",
            "Execution requires repair without quality evaluation",
            {
              sessionId: result.sessionId,
              errorCategory: result.errorCategory,
              qualityEnabled: false
            }
          );
          if (currentTask.status === "active") {
            await this.support.updateRunAttemptStage(currentTask.id, "repairing");
          }
          currentTask.repairCount = loopCount;
          await this.deps.tasks.save(currentTask);
          const repairStartedCorrelation = this.support.buildCorrelation({
            task: currentTask,
            execution,
            agentId: agent.id,
            pluginId: agentPlugin.id
          });
          const repairStartedData = {
            iteration: loopCount,
            objective: nextGoal.objective,
            sessionId: result.sessionId,
            qualityEnabled: false
          };
          await this.support.appendExecutionLog(
            currentTask,
            execution,
            "goal.iteration_started",
            "Repair iteration started",
            repairStartedData,
            repairStartedCorrelation
          );
          await this.support.publish("goal.iteration_started", "Repair iteration started", currentTask, {
            ...repairStartedData
          }, { execution, pluginId: agentPlugin.id, agentId: agent.id, correlation: repairStartedCorrelation });
          previousResult = result;
          continue;
        }

        await this.support.updateExecutionStatus(execution, currentTask, "evaluating", "Execution output ready for evaluation", {
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          sessionId: result.sessionId
        });
        await this.support.updateRunAttemptStage(currentTask.id, "evaluating");

        workspace = await this.ensureTargetServicesBeforeQuality(currentTask, workspace, environment, governancePlugins);
        const quality = await inlineQualityPlugin.evaluate({ task: currentTask, workspace, execution: result });
        const evalResult: EvalResult = {
          id: this.support.createId(),
          taskId: currentTask.id,
          executionId: execution.id,
          passed: quality.passed,
          score: quality.score,
          riskLevel: quality.riskLevel,
          report: {
            checks: quality.checks,
            ...quality.report
          },
          createdAt: this.support.now()
        };
        for (const governance of governancePlugins) {
          await governance.afterEval?.(evalResult);
        }
        await this.deps.evalResults.create(evalResult);
        await this.support.recordGovernanceEntries(currentTask, execution, evalResult.report, agent.id);
        await this.support.publish("eval.completed", "Evaluation completed", currentTask, {
          passed: evalResult.passed,
          score: evalResult.score,
          riskLevel: evalResult.riskLevel
        });

        const evalChecks = readQualityChecks(evalResult.report);
        if (evalResult.passed) {
          currentTask.metadata = {
            ...currentTask.metadata,
            quality: {
              evalResultId: evalResult.id,
              score: evalResult.score,
              riskLevel: evalResult.riskLevel,
              checks: evalChecks
            }
          };
          currentTask.updatedAt = this.support.now();
          await this.deps.tasks.save(currentTask);
          const pullRequestResult = await this.createPullRequestsBeforeDone({
            task: currentTask,
            execution,
            workspace,
            agentId: agent.id,
            operatorPluginId: inlineQualityPlugin.id,
            startData: {
              evalResultId: evalResult.id,
              score: evalResult.score,
              riskLevel: evalResult.riskLevel
            }
          });
          currentTask = pullRequestResult.task;
          if (pullRequestResult.failed) {
            break;
          }
          await this.support.reportTaskResultIfNeeded(currentTask, result.summary);
          if (goal) {
            await this.deps.repairGoals.upsert({
              ...goal,
              status: "achieved",
              updatedAt: this.support.now()
            });
          }
          await this.support.updateExecutionStatus(execution, currentTask, "completed", "Execution passed quality checks", {
            score: evalResult.score,
            riskLevel: evalResult.riskLevel
          });
          await this.support.completeRunAttempt(currentTask.id, "completed");
          currentTask = await this.support.transitionTask(currentTask, "succeeded", "Evaluation passed", inlineQualityPlugin.id, execution);
          currentTask.completedAt = this.support.now();
          await this.deps.tasks.save(currentTask);
          break;
        }

        const failureHash = buildFailureHash(result, evalChecks);
        const meegleChildIssueAvailable = currentTask.source === "meegle"
          && !!currentTask.externalId
          && this.deps.runtime.getTaskIntegrations().some((plugin) => (
            plugin.id === currentTask.source
            && typeof plugin.openHumanRepairIssue === "function"
          ));
        const recorded = await this.support.recordFailureRepair({
          task: currentTask,
          execution,
          kind: "quality",
          summary: "Quality evaluation failed",
          detail: {
            evalResultId: evalResult.id,
            score: evalResult.score,
            riskLevel: evalResult.riskLevel,
            checks: evalChecks
          },
          checks: evalChecks,
          executionResult: result,
          preferNeedsHuman: meegleChildIssueAvailable,
          agentId: agent.id,
          pluginId: inlineQualityPlugin.id
        });
        currentTask = recorded.task;
        repeatedFailureCount = failureHash === previousFailureHash ? repeatedFailureCount + 1 : 1;
        previousFailureHash = failureHash;
        const diffStats = readDiffStats(evalResult.report);
        noDiffStreak = diffStats.filesChanged === 0 ? noDiffStreak + 1 : 0;
        loopCount += 1;
        const stopReason = decideStopReason({
          qualityRiskLevel: evalResult.riskLevel,
          repeatedFailureCount,
          noDiffStreak,
          iteration: loopCount,
          maxIterations: goal?.maxIterations ?? this.config.maxRepairIterations
        });
        const nextGoalStatus: RepairGoal["status"] = stopReason === "budget_limited" ? "budget_limited" : "repairing";
        const nextGoal: RepairGoal = {
          id: goal?.id ?? this.support.createId(),
          taskId: currentTask.id,
          objective: buildRepairObjective(currentTask, result, evalChecks),
          constraints: buildRepairConstraints(currentTask, evalResult.riskLevel),
          doneWhen: buildRepairDoneWhen(currentTask, evalChecks),
          status: nextGoalStatus,
          currentIteration: loopCount,
          maxIterations: goal?.maxIterations ?? this.config.maxRepairIterations,
          lastFailureHash: failureHash,
          metadata: { ...(goal?.metadata ?? {}), repairSource: "quality" },
          createdAt: goal?.createdAt ?? this.support.now(),
          updatedAt: this.support.now()
        };
        goal = nextGoal;
        await this.deps.repairGoals.upsert(goal);

        const childRepairIssueHandled = await this.handleChildRepairIssueQualityFailure(
          currentTask,
          execution,
          nextGoal,
          failureHash,
          stopReason,
          result,
          evalResult,
          evalChecks,
          inlineQualityPlugin.id,
          agent.id
        );
        if (childRepairIssueHandled) {
          currentTask = childRepairIssueHandled.task;
          goal = childRepairIssueHandled.goal;
          break;
        }

        if (stopReason === "budget_limited") {
          const hint = extractRootCauseHint(result.stderr);
          const summary = hint
            ? `${describeStopReason(stopReason)} — recurring error: ${hint}`
            : describeStopReason(stopReason);
          await this.support.appendExecutionLog(
            currentTask,
            execution,
            "goal.budget_exhausted",
            summary,
            {
              stopReason,
              iteration: loopCount,
              maxIterations: nextGoal.maxIterations,
              riskLevel: evalResult.riskLevel,
              evalResultId: evalResult.id,
              score: evalResult.score
            },
            this.support.buildCorrelation({ task: currentTask, execution, agentId: agent.id })
          );
          await this.support.updateExecutionStatus(execution, currentTask, "failed", summary, {
            iteration: loopCount,
            maxIterations: nextGoal.maxIterations,
            stopReason
          });
          currentTask = await this.support.transitionTask(currentTask, "failed", summary, inlineQualityPlugin.id, execution);
          currentTask.completedAt = this.support.now();
          await this.deps.tasks.save(currentTask);
          await this.support.reportTaskResultIfNeeded(currentTask, summary);
          break;
        }

        if (stopReason && this.config.enableNeedsHumanLoop) {
          const handledByHumanLoop = await this.handleNeedsHumanStopReason(
            currentTask,
            execution,
            nextGoal,
            stopReason,
            result,
            evalResult,
            inlineQualityPlugin.id,
            agent.id
          );
          if (handledByHumanLoop) {
            currentTask = handledByHumanLoop.task;
            goal = handledByHumanLoop.goal;
            break;
          }
        }

        if (stopReason) {
          await this.support.appendExecutionLog(
            currentTask,
            execution,
            "goal.stop_reason_continued",
            `Continuing repair after stop signal: ${stopReason}`,
            {
              stopReason,
              riskLevel: evalResult.riskLevel,
              iteration: loopCount,
              maxIterations: nextGoal.maxIterations,
              evalResultId: evalResult.id,
              score: evalResult.score,
              evalPassed: evalResult.passed
            },
            this.support.buildCorrelation({ task: currentTask, execution, agentId: agent.id })
          );
        }

        await this.support.updateExecutionStatus(execution, currentTask, "repairing", "Execution requires repair", {
          score: evalResult.score,
          riskLevel: evalResult.riskLevel,
          sessionId: result.sessionId
        });
        await this.support.updateRunAttemptStage(currentTask.id, "repairing");
        currentTask.repairCount = loopCount;
        await this.deps.tasks.save(currentTask);
        const repairStartedCorrelation = this.support.buildCorrelation({
          task: currentTask,
          execution,
          agentId: agent.id,
          pluginId: inlineQualityPlugin.id
        });
        const repairStartedData = {
          iteration: loopCount,
          objective: nextGoal.objective,
          sessionId: result.sessionId
        };
        await this.support.appendExecutionLog(
          currentTask,
          execution,
          "goal.iteration_started",
          "Repair iteration started",
          repairStartedData,
          repairStartedCorrelation
        );
        await this.support.publish("goal.iteration_started", "Repair iteration started", currentTask, {
          ...repairStartedData
        }, { execution, pluginId: inlineQualityPlugin.id, agentId: agent.id, correlation: repairStartedCorrelation });
        previousResult = result;
      }
    } catch (error) {
      if (error instanceof PreflightBlockedError) {
        return;
      }
      if (isEnvironmentPreparationError(error)) {
        currentTask = await this.handleEnvironmentFailure(currentTask, agent, error);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (execution) {
        execution.summary = message;
        execution.endedAt = this.support.now();
        await this.support.updateExecutionStatus(execution, currentTask, "failed", message, {});
      }
      const recorded = await this.support.recordFailureRepair({
        task: currentTask,
        execution,
        kind: "unknown",
        summary: message,
        detail: {
          message,
          stack: error instanceof Error ? error.stack : undefined
        },
        agentId: agent.id,
        pluginId: agentPlugin.id
      });
      currentTask = recorded.task;
      const failedTask = await applyFailureTerminalStatus(
        this.support,
        currentTask,
        recorded.decision.strategy,
        message,
        "scheduler",
        execution
      );
      if (failedTask.status !== "waiting") {
        failedTask.completedAt = this.support.now();
        await this.deps.tasks.save(failedTask);
      }
      await this.support.appendExecutionLog(
        failedTask,
        execution,
        "executor.failed",
        message,
        {},
        this.support.buildCorrelation({
          task: failedTask,
          execution,
          agentId: agent.id,
          pluginId: agentPlugin.id
        })
      );
      await this.support.reportTaskResultIfNeeded(failedTask, message);
    } finally {
      stopHeartbeat();
      if (workspace) {
        workspace = await this.stopTargetServicesOnFinalize(currentTask, workspace, environment);
      }
      if (workspace && currentTask.status === "succeeded") {
        await environment.cleanupWorkspace(currentTask, workspace);
      }
      await this.support.releaseAgent(agent);
    }
  }

  private async ensureTargetServicesBeforeQuality(
    task: TitingTask,
    workspace: PreparedWorkspace,
    environment: Awaited<ReturnType<ServiceDependencies["runtime"]["selectEnvironmentPlugin"]>>,
    governancePlugins: ReturnType<ServiceDependencies["runtime"]["getGovernancePlugins"]>
  ): Promise<PreparedWorkspace> {
    if (typeof environment.startTargetServices !== "function") {
      return workspace;
    }

    const serviceStartup = task.metadata.serviceStartup;
    const restartBeforeQuality = !(
      serviceStartup
      && typeof serviceStartup === "object"
      && !Array.isArray(serviceStartup)
      && (serviceStartup as Record<string, unknown>).restartBeforeQuality === false
    );

    if (restartBeforeQuality && typeof environment.stopTargetServices === "function" && workspace.services?.running?.length) {
      workspace = await environment.stopTargetServices(task, workspace);
    }
    if (!restartBeforeQuality && workspace.services?.running?.length) {
      return workspace;
    }
    return environment.startTargetServices(task, workspace, {
      roundExecuted: true,
      beforeCommand: async (command) => {
        for (const governance of governancePlugins) {
          await governance.beforeCommand?.(command);
        }
      }
    });
  }

  private async stopTargetServicesOnFinalize(
    task: TitingTask,
    workspace: PreparedWorkspace,
    environment: Awaited<ReturnType<ServiceDependencies["runtime"]["selectEnvironmentPlugin"]>>
  ): Promise<PreparedWorkspace> {
    if (typeof environment.stopTargetServices !== "function") {
      return workspace;
    }
    return environment.stopTargetServices(task, workspace);
  }

  private startAgentHeartbeatLoop(agentId: string): () => void {
    let active = true;
    let heartbeatInFlight = false;
    const timer = this.config.setIntervalFn(() => {
      if (!active || heartbeatInFlight) {
        return;
      }
      heartbeatInFlight = true;
      void this.heartbeatAgent(agentId, "busy")
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

  private async heartbeatAgent(id: string, status?: AgentRecord["status"]): Promise<AgentRecord> {
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

  /** Re-runs preflight when metadata was refreshed after an earlier blocked state. */
  private async ensurePreflightBeforeEnvironment(task: TitingTask, agentId: string): Promise<TitingTask> {
    if (!this.deps.runPreflight) {
      return task;
    }
    const preflight = task.metadata.preflight;
    if (preflight && typeof preflight === "object" && (preflight as Record<string, unknown>).passed === true) {
      return task;
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
    if (!preflightResult.passed) {
      const recorded = await this.support.recordFailureRepair({
        task: updated,
        execution: null,
        kind: "preflight",
        summary: preflightResult.error ?? "Task preflight failed",
        detail: {
          checks: preflightResult.checks,
          stage: "before_environment"
        },
        agentId
      });
      updated = recorded.task;
      await this.support.publish("task.preflight.failed", "Task preflight failed before environment", updated, {
        checks: preflightResult.checks,
        agentId
      });
      await this.support.pauseForWait(
        updated,
        {
          type: "environment_blocked",
          source: "preflight",
          message: preflightResult.error ?? "Task preflight failed",
          recoverableBy: "operator"
        },
        preflightResult.error ?? "Task preflight failed",
        "system"
      );
      throw new PreflightBlockedError(preflightResult.error ?? "Task preflight failed");
    }
    await this.support.publish("task.preflight.passed", "Task preflight passed before environment", updated, {
      checks: preflightResult.checks,
      agentId
    });
    return updated;
  }

  private async createExecution(
    task: TitingTask,
    agentId: string,
    workspace: PreparedWorkspace,
    environmentPluginId: string
  ): Promise<ExecutionRecord> {
    const execution: ExecutionRecord = {
      id: this.support.createId(),
      taskId: task.id,
      agentId,
      workspace: workspace.workspacePath,
      status: "preparing",
      summary: null,
      executor: task.executor,
      agentKind: task.agentKind,
      driverId: task.driverId ?? task.preferredDriver ?? null,
      runtimeProviderId: task.runtimeProviderId ?? task.preferredRuntime ?? null,
      startedAt: this.support.now(),
      endedAt: null
    };
    await this.deps.executions.create(execution);
    const primaryRepo = workspace.repos.find((repo) => repo.path === workspace.repoPath) ?? workspace.repos[0] ?? null;
    await this.support.appendExecutionLog(task, execution, "execution.preparing", "Workspace prepared for execution", {
      workspacePath: workspace.workspacePath,
      repoPath: workspace.repoPath,
      branch: workspace.branch,
      artifactsPath: workspace.artifactsPath,
      git: primaryRepo
        ? {
            isGitWorktree: primaryRepo.isGitWorktree === true,
            branch: primaryRepo.branch ?? workspace.branch,
            commit: primaryRepo.commit ?? null
          }
        : null,
      repos: workspace.repos.map((repo) => ({
        key: repo.key,
        url: repo.url,
        path: repo.path,
        cachePath: repo.cachePath,
        isGitWorktree: repo.isGitWorktree === true,
        branch: repo.branch ?? null,
        commit: repo.commit ?? null
      }))
    }, this.support.buildCorrelation({ task, execution, agentId, pluginId: environmentPluginId }));
    return execution;
  }

  private async handleProductOpenSpecResult(
    task: TitingTask,
    execution: ExecutionRecord,
    workspace: PreparedWorkspace,
    result: ExecutionResult,
    operatorPluginId: string,
    agentId: string
  ): Promise<TitingTask> {
    if (result.exitCode !== 0) {
      await this.support.updateExecutionStatus(execution, task, "failed", result.summary, {
        exitCode: result.exitCode,
        productWorkflow: true,
        failClosed: true
      }, operatorPluginId);
      const blockedTask = await this.support.pauseForWait(
        task,
        {
          type: "human_input",
          source: operatorPluginId,
          message: `Product OpenSpec workflow failed closed: ${result.summary}`,
          recoverableBy: "user"
        },
        `Product OpenSpec workflow failed closed: ${result.summary}`,
        operatorPluginId,
        execution
      );
      blockedTask.completedAt = this.support.now();
      await this.deps.tasks.save(blockedTask);
      return blockedTask;
    }

    const metadata = result.metadata ?? {};
    const changeId = readNonEmptyString(metadata.openspecChangeId) ?? readNonEmptyString(task.metadata.openspecChangeId);
    const revision = readNonEmptyString(metadata.openspecRevision) ?? readNonEmptyString(task.metadata.openspecRevision) ?? "latest";
    const validation = readObject(metadata.openspecValidation) ?? readObject(task.metadata.openspecValidation);
    const workspaceId = readNonEmptyString(task.metadata.workspaceId) ?? workspace.workspacePath;
    const summary = readNonEmptyString(readObject(metadata.productReview)?.summary) ?? result.summary;
    const requestedAt = this.support.now();
    const requestId = this.support.createId();
    const reviewAttempt = readOpenSpecReviewAttempt(task.metadata.openSpecReview);
    const idempotencyKey = buildOpenSpecReviewIdempotencyKey(task, changeId ?? "unknown", revision, reviewAttempt);
    const integration = this.selectOpenSpecReviewIntegration(task);
    const openspecPath = changeId ? join(workspaceId, "openspec", "changes", changeId) : null;

    let externalThreadRef: string | null = null;
    let reviewError: string | null = null;
    if (integration?.openOpenSpecReviewIssue && changeId) {
      try {
        const reviewRef = await integration.openOpenSpecReviewIssue(task, {
          requestId,
          idempotencyKey,
          changeId,
          revision,
          workspaceId,
          ...(openspecPath ? { openspecPath } : {}),
          summary,
          requestedAt: requestedAt.toISOString()
        });
        externalThreadRef = reviewRef.externalId;
        task.metadata = {
          ...task.metadata,
          openspecChangeId: changeId,
          openspecRevision: revision,
          ...(validation ? { openspecValidation: validation } : {}),
          workspaceId,
          openSpecReview: {
            externalId: reviewRef.externalId,
            title: reviewRef.title,
            url: reviewRef.url,
            idempotencyKey: reviewRef.idempotencyKey,
            reused: reviewRef.reused,
            requestedAt: requestedAt.toISOString(),
            seenReplyIds: [],
            attempt: reviewAttempt,
            ...(openspecPath ? { openspecPath } : {})
          }
        };
      } catch (error) {
        reviewError = error instanceof Error ? error.message : String(error);
      }
    } else {
      reviewError ??= changeId
        ? "OpenSpec review integration is unavailable"
        : "Product OpenSpec workflow did not return openspecChangeId";
    }

    if (!externalThreadRef) {
      task.metadata = {
        ...task.metadata,
        ...(changeId ? { openspecChangeId: changeId } : {}),
        openspecRevision: revision,
        ...(validation ? { openspecValidation: validation } : {}),
        workspaceId,
        openSpecReview: {
          ...(readObject(task.metadata.openSpecReview) ?? {}),
          requestedAt: requestedAt.toISOString(),
          seenReplyIds: [],
          error: reviewError,
          idempotencyKey,
          attempt: reviewAttempt,
          ...(openspecPath ? { openspecPath } : {})
        }
      };
    }
    task.updatedAt = requestedAt;
    await this.deps.tasks.save(task);

    const review: HumanReview = {
      id: this.support.createId(),
      taskId: task.id,
      executionId: execution.id,
      requestType: "openspec_review",
      reason: reviewError
        ? `OpenSpec review requires human attention: ${reviewError}`
        : appendOpenSpecPathSummary(summary, openspecPath),
      externalThreadRef,
      responseSummary: null,
      status: "pending",
      createdAt: requestedAt,
      updatedAt: requestedAt
    };
    await this.deps.humanReviews.create(review);

    await this.support.appendExecutionLog(
      task,
      execution,
      externalThreadRef ? "openspec_review.requested" : "openspec_review.fail_closed",
      externalThreadRef ? "OpenSpec review requested" : review.reason,
      {
        productWorkflow: true,
        openspecChangeId: changeId ?? null,
        openspecRevision: revision,
        workspaceId,
        openspecPath,
        externalThreadRef,
        reviewError
      },
      this.support.buildCorrelation({ task, execution, agentId, pluginId: integration?.id ?? operatorPluginId })
    );
    await this.support.updateExecutionStatus(execution, task, "completed", "Product OpenSpec workflow awaits review", {
      productWorkflow: true,
      openspecChangeId: changeId ?? null,
      openspecRevision: revision,
      workspaceId,
      openspecPath,
      externalThreadRef,
      reviewError
    }, operatorPluginId);
    const needsHumanTask = await this.support.pauseForWait(
      task,
      {
        type: "approval",
        source: integration?.id ?? operatorPluginId,
        message: reviewError ? `OpenSpec review failed closed: ${reviewError}` : "OpenSpec review required",
        recoverableBy: "user"
      },
      reviewError ? `OpenSpec review failed closed: ${reviewError}` : "OpenSpec review required",
      operatorPluginId,
      execution
    );
    needsHumanTask.completedAt = requestedAt;
    await this.deps.tasks.save(needsHumanTask);
    return needsHumanTask;
  }

  private selectOpenSpecReviewIntegration(task: TitingTask) {
    const integrations = this.deps.runtime.getTaskIntegrations().filter((plugin) => (
      typeof plugin.openOpenSpecReviewIssue === "function"
    ));
    return integrations.find((plugin) => plugin.id === task.source) ?? integrations[0] ?? null;
  }

  private async createPullRequestsBeforeDone(input: {
    task: TitingTask;
    execution: ExecutionRecord;
    workspace: PreparedWorkspace;
    agentId: string;
    operatorPluginId: string;
    startData: Record<string, unknown>;
  }): Promise<{ task: TitingTask; failed: boolean }> {
    if (!this.deps.createPullRequests) {
      return { task: input.task, failed: false };
    }

    const pullRequestCorrelation = this.support.buildCorrelation({
      task: input.task,
      execution: input.execution,
      agentId: input.agentId,
      pluginId: input.operatorPluginId
    });
    await this.support.appendExecutionLog(
      input.task,
      input.execution,
      "pull_request.started",
      "Pull request creation started",
      input.startData,
      pullRequestCorrelation
    );

    const prRecords = await this.deps.createPullRequests(input.task, input.workspace);
    input.task.metadata = {
      ...input.task.metadata,
      prs: prRecords
    };
    await this.deps.tasks.save(input.task);

    const prFailures = prRecords.filter((record) => !record.skipped && !record.prUrl);
    if (prFailures.length > 0) {
      const recorded = await this.support.recordFailureRepair({
        task: input.task,
        execution: input.execution,
        kind: "pull_request",
        summary: "Pull request creation failed",
        detail: {
          ...input.startData,
          prRecords
        },
        pullRequestRecords: prRecords,
        agentId: input.agentId,
        pluginId: input.operatorPluginId
      });
      input.task = recorded.task;
      await this.support.appendExecutionLog(
        input.task,
        input.execution,
        "pull_request.failed",
        "Pull request creation failed",
        {
          ...input.startData,
          prRecords
        },
        pullRequestCorrelation
      );
      await this.support.updateExecutionStatus(input.execution, input.task, "failed", "Pull request creation failed", {
        prRecords
      });
      const failedTask = await applyFailureTerminalStatus(
        this.support,
        input.task,
        recorded.decision.strategy,
        "Pull request creation failed",
        input.operatorPluginId,
        input.execution
      );
      if (failedTask.status !== "waiting") {
        failedTask.completedAt = this.support.now();
        await this.deps.tasks.save(failedTask);
      }
      await this.support.reportTaskResultIfNeeded(failedTask, "Pull request creation failed");
      return { task: failedTask, failed: true };
    }

    await this.support.appendExecutionLog(
      input.task,
      input.execution,
      "pull_request.completed",
      "Pull request creation completed",
      {
        ...input.startData,
        prRecords
      },
      pullRequestCorrelation
    );
    return { task: input.task, failed: false };
  }

  private async handoffImplementationToQuality(
    task: TitingTask,
    execution: ExecutionRecord,
    workspace: PreparedWorkspace,
    result: ExecutionResult,
    pluginId: string,
    agentId: string
  ): Promise<TitingTask> {
    const metadata = result.metadata ?? {};
    const openspecChangeId = readNonEmptyString(metadata.openspecChangeId)
      ?? readNonEmptyString(task.metadata.openspecChangeId)
      ?? "unknown";
    const openspecRevision = readNonEmptyString(metadata.openspecRevision)
      ?? readNonEmptyString(task.metadata.openspecRevision)
      ?? "latest";
    const openspecPath = readNonEmptyString(metadata.openspecPath)
      ?? readNonEmptyString(task.metadata.openspecPath)
      ?? join(workspace.specRootPath, "openspec", "changes", openspecChangeId);
    const workspaceId = readNonEmptyString(task.metadata.workspaceId) ?? workspace.workspacePath;
    const headSha = readNonEmptyString(metadata.headSha)
      ?? readNonEmptyString(task.metadata.headSha)
      ?? workspace.repos[0]?.commit
      ?? "unknown";
    const baseSha = readNonEmptyString(metadata.baseSha)
      ?? readNonEmptyString(task.metadata.baseSha)
      ?? headSha;
    const changedFiles = readStringArray(metadata.changedFiles)
      ?? readStringArray(task.metadata.changedFiles)
      ?? [];
    const handoff = buildImplementationHandoff({
      workspaceId,
      openspecChangeId,
      openspecRevision,
      openspecPath,
      sourceProgrammingTaskId: task.id,
      baseSha,
      headSha,
      summary: result.summary,
      repos: workspace.repos.map((repo) => ({
        key: repo.key,
        url: repo.url,
        path: repo.path,
        baseSha,
        headSha: repo.commit ?? headSha
      })),
      changedFiles,
      artifactPaths: {}
    });
    const artifact = await writeQualityJsonArtifact({
      artifactsPath: workspace.artifactsPath,
      filename: "implementation-handoff.json",
      value: handoff
    });

    task.executor = "quality";
    task.agentKind = "quality";
    task.preferredDriver = "quality-orchestrator";
    task.driverId = "quality-orchestrator";
    task.preferredRuntime = "codex";
    task.runtimeProviderId = "codex";
    task.metadata = {
      ...task.metadata,
      agentRequest: {
        agentKind: "quality",
        preferredDriver: "quality-orchestrator",
        preferredRuntime: "codex"
      },
      workspaceSync: {
        sourceWorkspaceId: workspace.workspacePath,
        targetAgentKind: "quality",
        handoff: "implementation_to_quality"
      },
      implementationHandoff: handoff,
      implementationHandoffPath: artifact.path
    };
    await this.support.updateExecutionStatus(
      execution,
      task,
      "completed",
      "Implementation handed to quality agent",
      {
        sessionId: result.sessionId,
        implementationHandoffPath: artifact.path,
        openspecChangeId
      }
    );
    await this.support.completeRunAttempt(task.id, "completed", "Implementation handed to quality agent");
    const updated = await this.support.transitionTask(
      task,
      "ready",
      "Implementation handed to quality agent",
      pluginId,
      execution
    );
    await this.support.appendExecutionLog(
      updated,
      execution,
      "programming.completed_for_quality",
      "Programming completed implementation for quality orchestration",
      {
        phase: "programming",
        handoff: "implementation_to_quality",
        implementationHandoffPath: artifact.path,
        openspecChangeId,
        openspecRevision,
        targetAgentKind: "quality",
        targetDriverId: "quality-orchestrator"
      },
      this.support.buildCorrelation({ task: updated, execution, agentId, pluginId })
    );
    return updated;
  }

  private async runQualityOrchestration(
    task: TitingTask,
    execution: ExecutionRecord,
    workspace: PreparedWorkspace,
    agentPlugin: ExecutionPlugin,
    agentId: string
  ): Promise<TitingTask> {
    const pluginId = agentPlugin.id;
    await this.support.appendExecutionLog(
      task,
      execution,
      "quality.started",
      "Quality orchestration started",
      {
        phase: "quality",
        handoff: "implementation_from_programming"
      },
      this.support.buildCorrelation({ task, execution, agentId, pluginId })
    );

    const handoffValue = task.metadata.implementationHandoff;
    if (!handoffValue) {
      return this.failClosedQualityOrchestration(task, execution, "Implementation handoff is missing", pluginId, agentId);
    }

    let handoff: ReturnType<typeof parseImplementationHandoff>;
    try {
      handoff = parseImplementationHandoff(handoffValue);
    } catch (error) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        error instanceof Error ? error.message : String(error),
        pluginId,
        agentId
      );
    }

    const anchorValidation = validateHandoffAnchors(handoff, workspace);
    if (!anchorValidation.passed) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        `Implementation handoff anchors are invalid: ${anchorValidation.reasons.join("; ")}`,
        pluginId,
        agentId
      );
    }

    const completionGatePlugin = this.deps.runtime.getPrimaryCompletionGatePlugin();
    const qualityPlugin = this.deps.runtime.getPrimaryQualityPlugin();
    if (!completionGatePlugin || !qualityPlugin) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        "Completion gate and quality plugins are required for quality orchestration",
        pluginId,
        agentId
      );
    }

    const executionResult: ExecutionResult = {
      exitCode: 0,
      stdout: "",
      stderr: "",
      summary: handoff.summary,
      sessionId: null,
      timedOut: false,
      errorCategory: "none",
      timeoutCategory: "none",
      metadata: { implementationHandoff: handoff }
    };
    const repairGoal = await this.deps.repairGoals.getByTaskId(task.id);
    const gate = await completionGatePlugin.evaluate({
      task,
      workspace,
      execution: executionResult,
      repairGoal
    });
    await this.support.appendExecutionLog(
      task,
      execution,
      gate.passed ? "completion_gate.completed" : "completion_gate.failed",
      gate.passed ? "OpenSpec completion gate passed" : "OpenSpec completion gate failed",
      {
        phase: "quality",
        passed: gate.passed,
        checks: gate.checks,
        incompleteTasks: gate.incompleteTasks,
        metadata: gate.metadata
      },
      this.support.buildCorrelation({ task, execution, agentId, pluginId: completionGatePlugin.id })
    );
    if (!gate.passed) {
      return this.failClosedQualityOrchestration(task, execution, "OpenSpec completion gate failed", completionGatePlugin.id, agentId);
    }

    await this.support.updateRunAttemptStage(task.id, "evaluating");
    const quality = await qualityPlugin.evaluate({ task, workspace, execution: executionResult });
    const evalResult: EvalResult = {
      id: this.support.createId(),
      taskId: task.id,
      executionId: execution.id,
      score: quality.score,
      passed: quality.passed,
      riskLevel: quality.riskLevel,
      report: {
        checks: quality.checks,
        ...quality.report
      },
      createdAt: this.support.now()
    };
    await this.deps.evalResults.create(evalResult);

    if (!quality.passed) {
      return this.returnQualityFailureToProgramming(
        task,
        execution,
        workspace,
        handoff,
        gate,
        quality,
        evalResult,
        qualityPlugin.id,
        agentId
      );
    }

    const executionContext: ExecutionContext = {
      runtimeLogger: async (event) => (
        this.support.recordExecutionRuntimeEvent(
          task,
          execution,
          agentId,
          event,
          pluginId
        )
      )
    };
    const reviewResult = await agentPlugin.execute(task, workspace, null, executionContext);
    execution.summary = reviewResult.summary;
    await this.deps.executions.save(execution);
    await this.support.appendExecutionLog(
      task,
      execution,
      "executor.completed",
      reviewResult.summary,
      {
        exitCode: reviewResult.exitCode,
        timedOut: reviewResult.timedOut,
        sessionId: reviewResult.sessionId,
        errorCategory: reviewResult.errorCategory,
        timeoutCategory: reviewResult.timeoutCategory,
        stdout: reviewResult.stdout,
        stderr: reviewResult.stderr,
        metadata: reviewResult.metadata
      },
      this.support.buildCorrelation({ task, execution, agentId, pluginId })
    );
    if (reviewResult.exitCode !== 0) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        `Code review runtime failed: ${reviewResult.summary}`,
        pluginId,
        agentId
      );
    }
    const parsedCodeReviewReport = readCodeReviewReport(reviewResult.metadata.codeReviewReport);
    if (!parsedCodeReviewReport) {
      return this.failClosedQualityOrchestration(task, execution, "code-review-report.json is required", pluginId, agentId);
    }
    const codeReviewReport: CodeReviewReport = {
      ...parsedCodeReviewReport,
      reviewArtifactId: parsedCodeReviewReport.reviewArtifactId
        ?? readNonEmptyString(reviewResult.metadata.reviewArtifactId)
        ?? join(workspace.artifactsPath, "code-review-report.json"),
      executionId: parsedCodeReviewReport.executionId ?? execution.id
    };
    let codeReviewArtifact: { path: string };
    try {
      codeReviewArtifact = await writeQualityJsonArtifact({
        artifactsPath: workspace.artifactsPath,
        filename: "code-review-report.json",
        value: codeReviewReport
      });
    } catch (error) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        `Failed to write code-review-report.json: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
        agentId
      );
    }
    const evidence = evaluateQualityEvidence({
      automationRequirements: readAutomationRequirements(task.metadata.qualityRequirements),
      artifactPaths: {
        ...handoff.artifactPaths,
        codeReviewReport: codeReviewArtifact.path
      },
      codeReviewReport
    });
    if (!evidence.passed) {
      const blockingFindings = codeReviewReport.findings.filter(isBlockingCodeReviewFinding);
      if (blockingFindings.length > 0) {
        const titles = blockingFindings.map((finding) => finding.title);
        return this.returnQualityFailureToProgramming(
          task,
          execution,
          workspace,
          handoff,
          gate,
          quality,
          evalResult,
          pluginId,
          agentId,
          {
            failureSummary: "Code review found blocking findings",
            failedChecks: blockingFindings.map((finding) => `code-review:${finding.severity}:${finding.title}`),
            repairObjective: `Repair code review findings: ${titles.join(", ")}`,
            repairDoneWhen: ["quality orchestration passes", "code review has no CRITICAL or IMPORTANT findings"],
            artifactPaths: {
              codeReviewReport: codeReviewArtifact.path
            },
            codeReview: {
              reportPath: codeReviewArtifact.path,
              report: codeReviewReport
            }
          }
        );
      }
      return this.failClosedQualityOrchestration(task, execution, evidence.failures.join("; "), pluginId, agentId);
    }

    const qualityReport = {
      schemaVersion: "2026-07-03",
      taskId: task.id,
      sourceProgrammingTaskId: handoff.sourceProgrammingTaskId,
      implementationHandoff: handoff,
      completionGate: gate,
      codeReview: {
        reportPath: codeReviewArtifact.path,
        reviewArtifactId: codeReviewReport.reviewArtifactId,
        executionId: codeReviewReport.executionId
      },
      quality: {
        evalResultId: evalResult.id,
        score: quality.score,
        passed: quality.passed,
        riskLevel: quality.riskLevel,
        checks: quality.checks,
        report: quality.report
      }
    };
    let reportArtifact: { path: string };
    try {
      reportArtifact = await writeQualityJsonArtifact({
        artifactsPath: workspace.artifactsPath,
        filename: "quality-report.json",
        value: qualityReport
      });
    } catch (error) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        `Failed to write quality-report.json: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
        agentId
      );
    }
    task.metadata = {
      ...task.metadata,
      qualityReport,
      qualityReportPath: reportArtifact.path,
      codeReviewReportPath: codeReviewArtifact.path,
      quality: {
        evalResultId: evalResult.id,
        score: quality.score,
        riskLevel: quality.riskLevel,
        checks: quality.checks
      }
    };
    await this.deps.tasks.save(task);

    const pullRequestResult = await this.createPullRequestsBeforeDone({
      task,
      execution,
      workspace,
      agentId,
      operatorPluginId: qualityPlugin.id,
      startData: {
        phase: "quality",
        evalResultId: evalResult.id,
        qualityReportPath: reportArtifact.path,
        codeReviewReportPath: codeReviewArtifact.path,
        score: quality.score,
        riskLevel: quality.riskLevel
      }
    });
    if (pullRequestResult.failed) {
      return pullRequestResult.task;
    }
    task = pullRequestResult.task;

    await this.support.updateExecutionStatus(execution, task, "completed", "Quality orchestration passed", {
      evalResultId: evalResult.id,
      qualityReportPath: reportArtifact.path,
      codeReviewReportPath: codeReviewArtifact.path,
      score: quality.score,
      riskLevel: quality.riskLevel
    });
    await this.support.completeRunAttempt(task.id, "completed");
    const completed = await this.support.transitionTask(
      task,
      "succeeded",
      "Quality orchestration passed",
      qualityPlugin.id,
      execution
    );
    completed.completedAt = this.support.now();
    completed.metadata = task.metadata;
    await this.deps.tasks.save(completed);
    await this.support.appendExecutionLog(
      completed,
      execution,
      "quality.passed",
      "Quality orchestration passed",
      {
        phase: "quality",
        evalResultId: evalResult.id,
        qualityReportPath: reportArtifact.path,
        codeReviewReportPath: codeReviewArtifact.path
      },
      this.support.buildCorrelation({ task: completed, execution, agentId, pluginId: qualityPlugin.id })
    );
    return completed;
  }

  private async failClosedQualityOrchestration(
    task: TitingTask,
    execution: ExecutionRecord,
    reason: string,
    pluginId: string,
    agentId: string
  ): Promise<TitingTask> {
    await this.support.updateExecutionStatus(execution, task, "failed", reason, { failClosed: true });
    await this.support.completeRunAttempt(task.id, "failed");
    await this.support.appendExecutionLog(
      task,
      execution,
      "quality.fail_closed",
      reason,
      {
        phase: "quality",
        failClosed: true
      },
      this.support.buildCorrelation({ task, execution, agentId, pluginId })
    );
    return this.support.pauseForWait(task, {
      type: "environment_blocked",
      source: "quality",
      message: reason,
      recoverableBy: "operator"
    }, reason, pluginId, execution);
  }

  private async returnQualityFailureToProgramming(
    task: TitingTask,
    execution: ExecutionRecord,
    workspace: PreparedWorkspace,
    handoff: ReturnType<typeof parseImplementationHandoff>,
    gate: CompletionGateResult,
    quality: QualityResult,
    evalResult: EvalResult,
    pluginId: string,
    agentId: string,
    options: QualityFailureRepairOptions = {}
  ): Promise<TitingTask> {
    const failedChecks = options.failedChecks
      ?? quality.checks.filter((check) => !check.passed).map((check) => check.name);
    const failureSummary = options.failureSummary ?? "Quality evaluation failed";
    const repairObjective = options.repairObjective
      ?? `Repair quality failures: ${failedChecks.join(", ") || "quality evaluation failed"}`;
    const repairDoneWhen = options.repairDoneWhen ?? ["quality orchestration passes"];
    const qualityReport = {
      schemaVersion: "2026-07-03",
      taskId: task.id,
      sourceProgrammingTaskId: handoff.sourceProgrammingTaskId,
      implementationHandoff: handoff,
      completionGate: gate,
      quality: {
        evalResultId: evalResult.id,
        score: quality.score,
        passed: quality.passed,
        riskLevel: quality.riskLevel,
        checks: quality.checks,
        report: quality.report
      },
      ...(options.codeReview ? {
        codeReview: {
          reportPath: options.codeReview.reportPath,
          reviewArtifactId: options.codeReview.report.reviewArtifactId,
          executionId: options.codeReview.report.executionId,
          passed: false,
          findings: options.codeReview.report.findings,
          summary: options.codeReview.report.summary
        }
      } : {})
    };
    let qualityReportArtifact: { path: string };
    try {
      qualityReportArtifact = await writeQualityJsonArtifact({
        artifactsPath: workspace.artifactsPath,
        filename: "quality-report.json",
        value: qualityReport
      });
    } catch (error) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        `Failed to write quality-report.json: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
        agentId
      );
    }

    const repairHandoff = buildQualityRepairHandoff({
      sourceQualityTaskId: task.id,
      targetProgrammingTaskId: handoff.sourceProgrammingTaskId,
      qualityReportPath: qualityReportArtifact.path,
      failedChecks,
      repairObjective,
      repairDoneWhen,
      artifactPaths: {
        qualityReport: qualityReportArtifact.path,
        ...(options.artifactPaths ?? {})
      }
    });
    let repairHandoffArtifact: { path: string };
    try {
      repairHandoffArtifact = await writeQualityJsonArtifact({
        artifactsPath: workspace.artifactsPath,
        filename: "quality-repair-handoff.json",
        value: repairHandoff
      });
    } catch (error) {
      return this.failClosedQualityOrchestration(
        task,
        execution,
        `Failed to write quality-repair-handoff.json: ${error instanceof Error ? error.message : String(error)}`,
        pluginId,
        agentId
      );
    }

    const recorded = await this.support.recordFailureRepair({
      task,
      execution,
      kind: "quality",
      summary: failureSummary,
      detail: {
        qualityReportPath: qualityReportArtifact.path,
        qualityRepairHandoffPath: repairHandoffArtifact.path,
        failedChecks,
        ...(options.codeReview ? { codeReviewReportPath: options.codeReview.reportPath } : {})
      },
      checks: quality.checks,
      agentId,
      pluginId
    });
    const previousGoal = await this.deps.repairGoals.getByTaskId(task.id);
    const nextIteration = (previousGoal?.currentIteration ?? 0) + 1;
    const repairGoal: RepairGoal = {
      id: previousGoal?.id ?? this.support.createId(),
      taskId: task.id,
      objective: repairObjective,
      constraints: [...task.constraints],
      doneWhen: repairDoneWhen,
      status: nextIteration > (previousGoal?.maxIterations ?? this.config.maxRepairIterations) ? "budget_limited" : "repairing",
      currentIteration: nextIteration,
      maxIterations: previousGoal?.maxIterations ?? this.config.maxRepairIterations,
      lastFailureHash: buildFailureHash({
        exitCode: 1,
        stdout: "",
        stderr: failedChecks.join("\n"),
        summary: failureSummary,
        sessionId: null,
        timedOut: false,
        errorCategory: "command_failed",
        timeoutCategory: "none",
        metadata: {
          qualityReportPath: qualityReportArtifact.path,
          ...(options.codeReview ? { codeReviewReportPath: options.codeReview.reportPath } : {})
        }
      }, quality.checks),
      metadata: {
        ...(previousGoal?.metadata ?? {}),
        repairSource: "quality",
        qualityReportPath: qualityReportArtifact.path,
        qualityRepairHandoffPath: repairHandoffArtifact.path,
        failedChecks,
        ...(options.codeReview ? { codeReviewReportPath: options.codeReview.reportPath } : {})
      },
      createdAt: previousGoal?.createdAt ?? this.support.now(),
      updatedAt: this.support.now()
    };
    await this.deps.repairGoals.upsert(repairGoal);

    const updated = recorded.task;
    updated.metadata = {
      ...updated.metadata,
      qualityReport,
      qualityReportPath: qualityReportArtifact.path,
      qualityRepairHandoff: repairHandoff,
      qualityRepairHandoffPath: repairHandoffArtifact.path,
      qualityWorkspaceId: workspace.workspacePath
    };
    if (repairGoal.status === "budget_limited") {
      await this.support.updateExecutionStatus(execution, updated, "failed", "Quality repair budget exhausted", {
        qualityReportPath: qualityReportArtifact.path,
        qualityRepairHandoffPath: repairHandoffArtifact.path,
        iteration: nextIteration,
        maxIterations: repairGoal.maxIterations
      });
      await this.support.completeRunAttempt(task.id, "failed");
      const failed = await this.support.transitionTask(updated, "failed", "Quality repair budget exhausted", pluginId, execution);
      failed.completedAt = this.support.now();
      failed.metadata = updated.metadata;
      await this.deps.tasks.save(failed);
      await this.support.appendExecutionLog(
        failed,
        execution,
        "quality.failed_for_repair",
        "Quality repair budget exhausted",
        {
          phase: "quality",
          handoff: "quality_to_programming",
          qualityReportPath: qualityReportArtifact.path,
          qualityRepairHandoffPath: repairHandoffArtifact.path,
          iteration: nextIteration,
          maxIterations: repairGoal.maxIterations
        },
        this.support.buildCorrelation({ task: failed, execution, agentId, pluginId })
      );
      return failed;
    }
    updated.executor = "programming";
    updated.agentKind = "programming";
    updated.driverId = "coding";
    updated.preferredDriver = "coding";
    updated.runtimeProviderId = "codex";
    updated.preferredRuntime = "codex";
    updated.repairCount = nextIteration;
    updated.metadata = {
      ...updated.metadata,
      agentRequest: {
        agentKind: "programming",
        preferredDriver: "coding",
        preferredRuntime: "codex"
      },
      workspaceSync: {
        sourceWorkspaceId: workspace.workspacePath,
        targetAgentKind: "programming",
        handoff: "quality_to_programming"
      }
    };
    await this.support.updateExecutionStatus(execution, updated, "completed", "Quality failed; returned to programming repair", {
      qualityReportPath: qualityReportArtifact.path,
      qualityRepairHandoffPath: repairHandoffArtifact.path,
      failedChecks
    });
    await this.support.completeRunAttempt(task.id, "completed", "Quality failed; returned to programming repair");
    const returned = await this.support.transitionTask(
      updated,
      "ready",
      "Quality failed; returned to programming repair",
      pluginId,
      execution
    );
    await this.support.appendExecutionLog(
      returned,
      execution,
      "quality.failed_for_repair",
      "Quality failed and repair handoff was created",
      {
        phase: "quality",
        handoff: "quality_to_programming",
        qualityReportPath: qualityReportArtifact.path,
        qualityRepairHandoffPath: repairHandoffArtifact.path,
        failedChecks,
        targetAgentKind: "programming",
        targetDriverId: "coding"
      },
      this.support.buildCorrelation({ task: returned, execution, agentId, pluginId })
    );
    await this.support.appendExecutionLog(
      returned,
      execution,
      "repair.returned_to_programming",
      "Task returned to programming agent for repair",
      {
        phase: "quality",
        handoff: "quality_to_programming",
        repairGoalId: repairGoal.id,
        iteration: nextIteration,
        targetAgentKind: "programming",
        targetDriverId: "coding"
      },
      this.support.buildCorrelation({ task: returned, execution, agentId, pluginId })
    );
    return returned;
  }

  private async handleNeedsHumanStopReason(
    task: TitingTask,
    execution: ExecutionRecord,
    goal: RepairGoal,
    stopReason: "high_risk" | "repeated_failure" | "no_effective_diff",
    result: ExecutionResult,
    evalResult: EvalResult,
    operator: string,
    agentId: string
  ): Promise<{ task: TitingTask; goal: RepairGoal } | null> {
    const integration = this.deps.runtime.getTaskIntegrations().find((plugin) => (
      plugin.id === task.source && typeof plugin.reportNeedsHuman === "function"
    ));
    if (!integration?.reportNeedsHuman) {
      return null;
    }

    const requestedAt = this.support.now();
    const requestId = this.support.createId();
    task.metadata = {
      ...task.metadata,
      humanLoop: {
        ...readHumanLoopMetadata(task.metadata),
        requestId,
        requestedAt: requestedAt.toISOString()
      }
    };
    task.updatedAt = requestedAt;
    await this.deps.tasks.save(task);

    const nextGoal: RepairGoal = {
      ...goal,
      status: "needs_human",
      updatedAt: requestedAt
    };
    await this.deps.repairGoals.upsert(nextGoal);

    const summary = describeStopReason(stopReason);
    const payload: NeedsHumanPayload = {
      reason: summary,
      stopReason,
      summary: result.summary,
      requestId,
      requestedAt: requestedAt.toISOString(),
      evalResultId: evalResult.id,
      executionId: execution.id
    };
    await this.support.appendExecutionLog(
      task,
      execution,
      "goal.needs_human_requested",
      summary,
      {
        stopReason,
        requestId,
        riskLevel: evalResult.riskLevel,
        iteration: nextGoal.currentIteration,
        maxIterations: nextGoal.maxIterations,
        evalResultId: evalResult.id,
        executionId: execution.id,
        score: evalResult.score
      },
      this.support.buildCorrelation({ task, execution, pluginId: integration.id, agentId })
    );
    await integration.reportNeedsHuman(task, payload);
    await this.support.updateExecutionStatus(execution, task, "failed", `Human input required: ${summary}`, {
      stopReason,
      requestId,
      riskLevel: evalResult.riskLevel
    });
    const needsHumanTask = await this.support.pauseForWait(
      task,
      {
        type: "human_input",
        source: integration.id,
        message: summary,
        recoverableBy: "user"
      },
      summary,
      operator,
      execution
    );
    needsHumanTask.completedAt = requestedAt;
    await this.deps.tasks.save(needsHumanTask);
    return { task: needsHumanTask, goal: nextGoal };
  }

  private async handleChildRepairIssueQualityFailure(
    task: TitingTask,
    execution: ExecutionRecord,
    goal: RepairGoal,
    failureHash: string,
    stopReason: "high_risk" | "repeated_failure" | "no_effective_diff" | "budget_limited" | null,
    result: ExecutionResult,
    evalResult: EvalResult,
    evalChecks: Array<{ name: string; passed: boolean; detail: string }>,
    operator: string,
    agentId: string
  ): Promise<{ task: TitingTask; goal: RepairGoal } | null> {
    if (task.source !== "meegle" || !task.externalId) {
      return null;
    }
    const integration = this.deps.runtime.getTaskIntegrations().find((plugin) => (
      plugin.id === task.source
      && typeof plugin.openHumanRepairIssue === "function"
      && typeof plugin.pullHumanRepairIssues === "function"
    ));
    if (!integration?.openHumanRepairIssue) {
      return this.failClosedChildRepairIssue(
        task,
        execution,
        goal,
        failureHash,
        evalResult,
        "Meegle child repair issue capability is unavailable",
        operator,
        agentId
      );
    }

    const requestedAt = this.support.now();
    const requestId = this.support.createId();
    const idempotencyKey = buildChildRepairIssueIdempotencyKey(task.externalId, failureHash);
    let childIssue: Awaited<ReturnType<NonNullable<typeof integration.openHumanRepairIssue>>>;
    try {
      childIssue = await integration.openHumanRepairIssue(task, {
        requestId,
        idempotencyKey,
        failureHash,
        failureSummary: result.summary,
        failedChecks: evalChecks.filter((check) => !check.passed).map((check) => check.name),
        executionId: execution.id,
        evalResultId: evalResult.id,
        stopReason,
        requestedAt: requestedAt.toISOString()
      });
    } catch (error) {
      return this.failClosedChildRepairIssue(
        task,
        execution,
        goal,
        failureHash,
        evalResult,
        error instanceof Error ? error.message : String(error),
        operator,
        agentId
      );
    }

    task.metadata = {
      ...task.metadata,
      humanLoop: {
        ...(typeof task.metadata.humanLoop === "object" && task.metadata.humanLoop !== null
          ? task.metadata.humanLoop as Record<string, unknown>
          : {}),
        requestId,
        requestedAt: requestedAt.toISOString(),
        childIssue: {
          externalId: childIssue.externalId,
          title: childIssue.title,
          url: childIssue.url,
          idempotencyKey: childIssue.idempotencyKey,
          reused: childIssue.reused,
          failureHash,
          executionId: execution.id,
          evalResultId: evalResult.id
        }
      }
    };
    task.updatedAt = requestedAt;
    await this.deps.tasks.save(task);

    const nextGoal: RepairGoal = {
      ...goal,
      status: "needs_human",
      updatedAt: requestedAt
    };
    await this.deps.repairGoals.upsert(nextGoal);

    await this.support.appendExecutionLog(
      task,
      execution,
      "goal.child_issue_requested",
      "Child repair issue requested",
      {
        childExternalId: childIssue.externalId,
        idempotencyKey: childIssue.idempotencyKey,
        reused: childIssue.reused,
        failureHash,
        evalResultId: evalResult.id,
        executionId: execution.id
      },
      this.support.buildCorrelation({ task, execution, pluginId: integration.id, agentId })
    );
    await this.support.updateExecutionStatus(execution, task, "failed", "Human repair issue required", {
      childExternalId: childIssue.externalId,
      failureHash,
      evalResultId: evalResult.id
    });
    const needsHumanTask = await this.support.pauseForWait(
      task,
      {
        type: "external_reply",
        source: integration.id,
        message: "Child repair issue required",
        recoverableBy: "integration"
      },
      "Child repair issue required",
      operator,
      execution
    );
    needsHumanTask.completedAt = requestedAt;
    await this.deps.tasks.save(needsHumanTask);
    return { task: needsHumanTask, goal: nextGoal };
  }

  private async failClosedChildRepairIssue(
    task: TitingTask,
    execution: ExecutionRecord,
    goal: RepairGoal,
    failureHash: string,
    evalResult: EvalResult,
    message: string,
    operator: string,
    agentId: string
  ): Promise<{ task: TitingTask; goal: RepairGoal }> {
    const now = this.support.now();
    await this.support.appendExecutionLog(
      task,
      execution,
      "goal.child_issue_open_failed",
      message,
      {
        error: message,
        failureHash,
        evalResultId: evalResult.id,
        executionId: execution.id
      },
      this.support.buildCorrelation({ task, execution, pluginId: task.source, agentId })
    );
    const nextGoal: RepairGoal = {
      ...goal,
      status: "needs_human",
      updatedAt: now
    };
    await this.deps.repairGoals.upsert(nextGoal);
    await this.support.updateExecutionStatus(execution, task, "failed", message, {
      failureHash,
      evalResultId: evalResult.id,
      childRepairIssueFailed: true
    });
    const needsHumanTask = await this.support.pauseForWait(
      task,
      {
        type: "human_input",
        source: task.source,
        message,
        recoverableBy: "user"
      },
      message,
      operator,
      execution
    );
    needsHumanTask.completedAt = now;
    await this.deps.tasks.save(needsHumanTask);
    return { task: needsHumanTask, goal: nextGoal };
  }

  private async handleEnvironmentFailure(
    task: TitingTask,
    agent: AgentRecord,
    error: EnvironmentFailureShape
  ): Promise<TitingTask> {
    const reason = `[environment:${error.stage}] ${error.message}`;
    if (shouldRerouteInvalidSpecPackageToProduct(task, error) && canTransition(task.status, "ready")) {
      return this.rerouteInvalidSpecPackageToProduct(task, agent, error, reason);
    }

    const attempt = task.retryCount + 1;
    task.retryCount = attempt;
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);
    await this.support.appendExecutionLog(task, null, "environment.failed", reason, {
      agentId: agent.id,
      stage: error.stage,
      retryable: error.retryable,
      detail: error.detail,
      attempt,
      retryLimit: this.config.environmentRetryLimit
    }, this.support.buildCorrelation({ task, agentId: agent.id }));

    // 环境失败发生在 catch 中，循环已退出、无法内联重试；
    // 仅当当前状态允许回到 queued 时才交还调度器重试（修复轮的 repairing 不允许）。
    if (error.retryable && attempt <= this.config.environmentRetryLimit && canTransition(task.status, "ready")) {
      const requeuedTask = await this.support.transitionTask(
        task,
        "ready",
        `${reason}; retry scheduled (${attempt}/${this.config.environmentRetryLimit})`,
        "scheduler"
      );
      await this.support.publish("environment.retry_scheduled", "Environment failure scheduled for retry", requeuedTask, {
        agentId: agent.id,
        stage: error.stage,
        detail: error.detail,
        attempt,
        retryLimit: this.config.environmentRetryLimit
      }, { agentId: agent.id });
      return requeuedTask;
    }

    // 无法重试入队：优先 blocked；当前状态（如 repairing）不允许 blocked 时降级到 failed。
    const recorded = await this.support.recordFailureRepair({
      task,
      execution: null,
      kind: "environment",
      summary: reason,
      detail: {
        stage: error.stage,
        retryable: error.retryable,
        detail: error.detail,
        attempt,
        retryLimit: this.config.environmentRetryLimit,
        retryBudgetExhausted: true
      },
      agentId: agent.id
    });
    task = recorded.task;
    const blockedTask = await applyFailureTerminalStatus(
      this.support,
      task,
      recorded.decision.strategy,
      error.retryable
        ? `${reason}; retry budget exhausted`
        : `${reason}; manual intervention required`,
      "scheduler",
      null
    );
    if (blockedTask.status !== "waiting") {
      blockedTask.completedAt = this.support.now();
      await this.deps.tasks.save(blockedTask);
    }
    await this.support.publish(
      blockedTask.status === "waiting" ? "environment.blocked" : "environment.failed",
      "Environment failure ended task",
      blockedTask,
      {
        agentId: agent.id,
        stage: error.stage,
        detail: error.detail,
        retryable: error.retryable,
        status: blockedTask.status,
        attempt,
        retryLimit: this.config.environmentRetryLimit
      },
      { agentId: agent.id }
    );
    await this.support.reportTaskResultIfNeeded(blockedTask, reason);
    return blockedTask;
  }

  private async rerouteInvalidSpecPackageToProduct(
    task: TitingTask,
    agent: AgentRecord,
    error: EnvironmentFailureShape,
    reason: string
  ): Promise<TitingTask> {
    const now = this.support.now().toISOString();
    const previousMetadata = task.metadata;
    const {
      preflight: _preflight,
      preflightError: _preflightError,
      ...metadata
    } = previousMetadata;
    const previousAgentKind = task.agentKind ?? null;
    const previousDriverId = task.driverId ?? task.preferredDriver ?? null;
    const agentRequest = normalizeAgentRequest({ agentKind: "product" });
    task.executor = "product";
    task.agentKind = "product";
    task.preferredDriver = agentRequest.preferredDriver ?? "openspec-product";
    task.preferredRuntime = agentRequest.preferredRuntime ?? "codex";
    task.driverId = task.preferredDriver;
    task.runtimeProviderId = task.preferredRuntime;
    task.metadata = {
      ...metadata,
      workflowRole: "product_spec",
      openspecSourceState: "none",
      invalidSpecPackageFallback: {
        reason: error.message,
        detail: error.detail,
        previousWorkflowRole: typeof previousMetadata.workflowRole === "string" ? previousMetadata.workflowRole : null,
        previousOpenSpecSourceState: typeof previousMetadata.openspecSourceState === "string" ? previousMetadata.openspecSourceState : null,
        previousAgentKind,
        previousDriverId,
        specAttachments: Array.isArray(previousMetadata.specAttachments) ? previousMetadata.specAttachments : [],
        occurredAt: now
      },
      agentRequest
    };
    task.startedAt = null;
    task.completedAt = null;
    task.updatedAt = this.support.now();

    await this.support.completeRunAttempt(task.id, "completed", "invalid_spec_package_rerouted_to_product");
    const reroutedTask = await this.support.transitionTask(
      task,
      "ready",
      `${reason}; rerouted to product agent`,
      "scheduler"
    );
    await this.support.appendExecutionLog(
      reroutedTask,
      null,
      "environment.invalid_spec_package_rerouted",
      "Spec package missing openspec; rerouted to product agent",
      {
        agentId: agent.id,
        stage: error.stage,
        detail: error.detail,
        previousWorkflowRole: previousMetadata.workflowRole ?? null
      },
      this.support.buildCorrelation({ task: reroutedTask, agentId: agent.id })
    );
    await this.support.publish(
      "environment.invalid_spec_package_rerouted",
      "Spec package missing openspec; rerouted to product agent",
      reroutedTask,
      {
        agentId: agent.id,
        stage: error.stage,
        detail: error.detail
      },
      { agentId: agent.id }
    );
    return reroutedTask;
  }

  private async handleRetryableExecutionFailure(
    task: TitingTask,
    execution: ExecutionRecord,
    agent: AgentRecord,
    result: ExecutionResult
  ): Promise<RetryOutcome | null> {
    const retryDecision = getExecutionRetryDecision(result);
    if (!retryDecision.retryable) {
      return null;
    }

    const attempt = task.retryCount + 1;
    task.retryCount = attempt;
    task.updatedAt = this.support.now();
    await this.deps.tasks.save(task);

    const reason = `[execution:${retryDecision.reason}] ${result.summary}`;
    await this.support.updateExecutionStatus(execution, task, "failed", reason, {
      agentId: agent.id,
      attempt,
      retryLimit: this.config.executionRetryLimit,
      errorCategory: result.errorCategory,
      timeoutCategory: result.timeoutCategory
    });

    if (attempt <= this.config.executionRetryLimit) {
      const goal = await this.deps.repairGoals.getByTaskId(task.id);
      const inRepairLoop = Boolean(goal && goal.status === "repairing" && goal.currentIteration >= 1);
      // 修复轮内保持 `active` 并在当前管线内联重试，不交还调度器。
      if (inRepairLoop || !canTransition(task.status, "ready")) {
        await this.support.appendExecutionLog(
          task,
          execution,
          "execution.retry_inline",
          `${reason}; retry inline (${attempt}/${this.config.executionRetryLimit})`,
          {
            agentId: agent.id,
            attempt,
            retryLimit: this.config.executionRetryLimit,
            fromStatus: task.status,
            errorCategory: result.errorCategory,
            timeoutCategory: result.timeoutCategory
          },
          this.support.buildCorrelation({ task, execution, agentId: agent.id })
        );
        await this.support.publish("execution.retry_inline", "Execution failure retried within current pipeline", task, {
          agentId: agent.id,
          attempt,
          retryLimit: this.config.executionRetryLimit,
          fromStatus: task.status,
          errorCategory: result.errorCategory,
          timeoutCategory: result.timeoutCategory
        }, { execution, agentId: agent.id });
        return { action: "retry-inline", task };
      }

      const requeuedTask = await this.support.transitionTask(
        task,
        "ready",
        `${reason}; retry scheduled (${attempt}/${this.config.executionRetryLimit})`,
        "scheduler",
        execution
      );
      await this.support.publish("execution.retry_scheduled", "Execution failure scheduled for retry", requeuedTask, {
        agentId: agent.id,
        attempt,
        retryLimit: this.config.executionRetryLimit,
        errorCategory: result.errorCategory,
        timeoutCategory: result.timeoutCategory
      }, { execution, agentId: agent.id });
      return { action: "requeued", task: requeuedTask };
    }

    // 预算耗尽：按失败性质进入 blocked 或 auto_repair（后者由上层 repair loop 处理）。
    const recorded = await this.support.recordFailureRepair({
      task,
      execution,
      kind: "execution",
      summary: reason,
      executionResult: result,
      retryBudgetExhausted: true,
      agentId: agent.id
    });
    task = recorded.task;
    const exhaustedTask = await applyFailureTerminalStatus(
      this.support,
      task,
      recorded.decision.strategy,
      `${reason}; retry budget exhausted`,
      "scheduler",
      execution
    );
    if (exhaustedTask.status !== "waiting") {
      exhaustedTask.completedAt = this.support.now();
      await this.deps.tasks.save(exhaustedTask);
    }
    await this.support.publish(
      exhaustedTask.status === "waiting" ? "execution.blocked" : "execution.failed",
      "Execution failure ended task after retry budget exhausted",
      exhaustedTask,
      {
        agentId: agent.id,
        attempt,
        retryLimit: this.config.executionRetryLimit,
        status: exhaustedTask.status,
        errorCategory: result.errorCategory,
        timeoutCategory: result.timeoutCategory
      },
      { execution, agentId: agent.id }
    );
    await this.support.reportTaskResultIfNeeded(exhaustedTask, result.summary);
    return { action: "terminal", task: exhaustedTask };
  }
}

function isOpenSpecTask(task: TitingTask): boolean {
  const changeId = task.metadata.openspecChangeId;
  return typeof changeId === "string" && changeId.trim().length > 0;
}

function isProductOpenSpecTask(task: TitingTask): boolean {
  return task.agentKind === "product" && task.driverId === "openspec-product";
}

function shouldRerouteInvalidSpecPackageToProduct(task: TitingTask, error: EnvironmentFailureShape): boolean {
  if (error.stage !== "spec" || !error.message.includes("Spec package must include openspec/")) {
    return false;
  }
  const metadata = task.metadata;
  const specAttachments = metadata.specAttachments;
  return (
    task.agentKind === "programming"
    && (
      metadata.workflowRole === "programming_from_spec"
      || metadata.openspecSourceState === "provided"
    )
    && Array.isArray(specAttachments)
    && specAttachments.length > 0
  );
}

function isQualityOrchestrationTask(task: TitingTask): boolean {
  return task.agentKind === "quality" || task.driverId === "quality-orchestrator" || task.executor === "quality";
}

function isProgrammingImplementationTask(task: TitingTask): boolean {
  const qualityHandoffEnabled = task.metadata.qualityAgentHandoff === true
    || task.metadata.workflowRole === "programming_from_product"
    || task.metadata.workflowRole === "programming_from_spec"
    || (task.agentKind === "programming" && typeof task.metadata.openspecChangeId === "string" && task.metadata.openspecChangeId.trim().length > 0);
  if (!qualityHandoffEnabled) {
    return false;
  }
  if (task.agentKind === "quality" || task.agentKind === "product") {
    return false;
  }
  if (task.agentKind === "programming") {
    return true;
  }
  return task.executor === "programming" || task.executor === "codex" || task.executor === "cursor";
}

function shouldRunInlineQuality(task: TitingTask): boolean {
  return task.metadata.legacyInlineQuality === true || task.metadata.inlineQuality === true;
}

function isBlockingCodeReviewFinding(finding: CodeReviewReport["findings"][number]): boolean {
  return finding.severity === "CRITICAL" || finding.severity === "IMPORTANT";
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length === value.length ? items : null;
}

function readAutomationRequirements(value: unknown): {
  api?: "required" | "optional" | { status: "required" | "optional" | "not_applicable"; reason?: string };
  ui?: "required" | "optional" | { status: "required" | "optional" | "not_applicable"; reason?: string };
} {
  const requirements = readObject(value);
  const automation = readObject(requirements?.automation) ?? requirements;
  return {
    api: readAutomationRequirement(automation?.api),
    ui: readAutomationRequirement(automation?.ui)
  };
}

function readAutomationRequirement(value: unknown): "required" | "optional" | {
  status: "required" | "optional" | "not_applicable";
  reason?: string;
} | undefined {
  if (value === "required" || value === "optional") {
    return value;
  }
  const object = readObject(value);
  if (!object) {
    return undefined;
  }
  const status = object.status;
  if (status === "required" || status === "optional" || status === "not_applicable") {
    const reason = readNonEmptyString(object.reason);
    return reason ? { status, reason } : { status };
  }
  return undefined;
}

function readCodeReviewReport(value: unknown): CodeReviewReport | null {
  const report = readObject(value);
  if (!report || !Array.isArray(report.findings)) {
    return null;
  }
  const summary = readNonEmptyString(report.summary);
  const schemaVersion = readNonEmptyString(report.schemaVersion);
  if (!summary || !schemaVersion) {
    return null;
  }
  return {
    schemaVersion,
    reviewArtifactId: readNonEmptyString(report.reviewArtifactId) ?? undefined,
    executionId: readNonEmptyString(report.executionId) ?? undefined,
    findings: report.findings
      .map((finding) => readObject(finding))
      .filter((finding): finding is Record<string, unknown> => Boolean(finding))
      .map((finding) => ({
        severity: readNonEmptyString(finding.severity) ?? "INFO",
        title: readNonEmptyString(finding.title) ?? "Untitled finding",
        detail: readNonEmptyString(finding.detail) ?? undefined
      })),
    summary
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readOpenSpecReviewAttempt(value: unknown): number {
  const review = readObject(value);
  const attempt = typeof review?.attempt === "number" && Number.isSafeInteger(review.attempt) && review.attempt > 0
    ? review.attempt
    : 1;
  return attempt;
}

function buildOpenSpecReviewIdempotencyKey(task: TitingTask, changeId: string, revision: string, attempt: number): string {
  const scope = task.externalId ?? task.id;
  return `diting-openspec-review:${scope}:${changeId}:${revision}:attempt-${attempt}`;
}

function appendOpenSpecPathSummary(summary: string, openspecPath: string | null): string {
  if (!openspecPath) {
    return summary;
  }
  return `${summary}\n\nOpenSpec path: ${openspecPath}`;
}

function resolveFailureTerminalStatus(
  from: TitingTask["status"],
  strategy: import("./failure-repair-service").FailureRepairStrategy
): TitingTask["status"] {
  if ((strategy === "needs_human" || strategy === "blocked") && canTransition(from, "waiting")) {
    return "waiting";
  }
  if (canTransition(from, "failed")) {
    return "failed";
  }
  if (canTransition(from, "waiting")) {
    return "waiting";
  }
  return from;
}

function buildWaitReasonForStrategy(
  strategy: import("./failure-repair-service").FailureRepairStrategy,
  summary: string,
  source: string
): import("@diting/plugin-api").WaitReason {
  const createdAt = new Date().toISOString();
  if (strategy === "needs_human") {
    return { type: "human_input", source, message: summary, recoverableBy: "user", createdAt };
  }
  if (strategy === "blocked") {
    return { type: "environment_blocked", source, message: summary, recoverableBy: "operator", createdAt };
  }
  return { type: "policy_blocked", source, message: summary, recoverableBy: "system", createdAt };
}

async function applyFailureTerminalStatus(
  support: ServiceSupport,
  task: TitingTask,
  strategy: import("./failure-repair-service").FailureRepairStrategy,
  summary: string,
  operator: string,
  execution: ExecutionRecord | null
): Promise<TitingTask> {
  const terminalStatus = resolveFailureTerminalStatus(task.status, strategy);
  if (terminalStatus === "waiting") {
    const { createdAt: _createdAt, ...waitReasonInput } = buildWaitReasonForStrategy(strategy, summary, operator);
    return support.pauseForWait(task, waitReasonInput, summary, operator, execution);
  }
  if (terminalStatus === "failed") {
    await support.completeRunAttempt(task.id, "failed");
    const failed = await support.transitionTask(task, "failed", summary, operator, execution);
    failed.completedAt = support.now();
    return failed;
  }
  return task;
}

function buildCompletionGateFailureHash(result: ExecutionResult, gate: CompletionGateResult): string {
  return buildFailureHash(
    {
      ...result,
      metadata: {
        ...result.metadata,
        completionGate: gate.metadata,
        incompleteTasks: gate.incompleteTasks
      }
    },
    gate.checks.map((check) => ({
      name: check.name,
      passed: check.passed,
      detail: check.detail
    }))
  );
}
