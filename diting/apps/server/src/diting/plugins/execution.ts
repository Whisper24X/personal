import { join } from "node:path";
import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import {
  AgentPlugin,
  AgentKind,
  ExecutionContext,
  ExecutionResult,
  ObservabilityGovernancePlugin,
  PluginHealth,
  PreparedWorkspace,
  RepairGoal,
  TitingTask
} from "@diting/plugin-api";
import type { CodingRuntimeDescriptor } from "./coding-runtime-discovery";
import {
  appendJsonLine,
  classifyExecutionError,
  CODING_AGENT_AUTH_FAILURE_MESSAGE,
  CommandLifecycleEvent,
  CommandResult,
  detectCodingAgentAuthFailure,
  extractCursorSummary,
  extractJsonSessionId,
  extractUuid,
  readOptionalFile,
  redactCommand,
  runCommand
} from "./shared";
import { loadWorkflowDefinition, renderWorkflowTemplate, WorkflowNodeDefinition } from "./workflow";

type WorkflowNodeExecutionRecord = {
  node: string;
  iteration: number;
  loopCount: number;
  exitCode: number;
  stdoutLength: number;
  stderrLength: number;
  timedOut: boolean;
};

/**
 * Raised when the native executor session (e.g. Cursor `create-chat`) cannot be established —
 * auth failure, timeout, or non-zero exit. Carries pre-rendered fields so the failure surfaces a
 * concrete, actionable cause instead of being collapsed into a generic workflow error.
 */
class ExecutorSessionError extends Error {
  constructor(
    readonly summary: string,
    readonly detail: string,
    readonly timedOut: boolean
  ) {
    super(summary);
    this.name = "ExecutorSessionError";
  }
}

/**
 * Shared CLI execution flow: load project workflow → render prompt variables → execute each workflow node with shared
 * session continuity → aggregate result/metadata → governance wraps each CLI command invocation.
 */
abstract class CodingAgentDriver implements AgentPlugin {
  readonly id: string;
  readonly kind = "agent" as const;
  readonly agentKind: AgentKind = "programming";
  readonly driverId: string = "coding";
  readonly priority: number;
  readonly capabilities: string[];
  readonly runtimeSource: CodingRuntimeDescriptor["source"];
  readonly binaryPath: string;
  readonly displayName: string;
  readonly runtimeKind: CodingRuntimeDescriptor["runtime"];
  readonly runtimeProviderId: string;
  readonly available: boolean;

  constructor(
    protected readonly bin: string,
    protected readonly timeoutMs: number,
    private readonly governance?: ObservabilityGovernancePlugin,
    protected readonly idleTimeoutMs?: number,
    descriptor?: Partial<CodingRuntimeDescriptor>
  ) {
    const runtimeKind = descriptor?.runtime ?? this.getDefaultRuntimeKind();
    this.runtimeKind = runtimeKind;
    this.runtimeProviderId = runtimeKind;
    this.binaryPath = descriptor?.resolvedBin ?? descriptor?.bin ?? bin;
    this.runtimeSource = descriptor?.source ?? "config";
    this.id = descriptor?.id ?? runtimeKind;
    this.priority = descriptor?.priority ?? this.getDefaultPriority(runtimeKind);
    this.displayName = descriptor?.displayName ?? this.getDefaultDisplayName(runtimeKind, this.binaryPath);
    this.available = descriptor?.available ?? true;
    this.capabilities = descriptor?.runtime
      ? ["programming", descriptor.runtime]
      : ["programming", runtimeKind];
  }

  protected abstract getDefaultRuntimeKind(): CodingRuntimeDescriptor["runtime"];

  protected getDefaultPriority(runtimeKind: CodingRuntimeDescriptor["runtime"]): number {
    return runtimeKind === "codex" ? 100 : 80;
  }

  protected getDefaultDisplayName(runtimeKind: CodingRuntimeDescriptor["runtime"], bin: string): string {
    return `${runtimeKind === "codex" ? "Codex" : "Cursor"} (${bin})`;
  }

  async health(): Promise<PluginHealth> {
    if (!this.available) {
      return { healthy: false, message: `${this.displayName} is unavailable` };
    }
    return { healthy: true, message: `${this.displayName} configured with binary ${this.binaryPath}` };
  }

  async execute(
    task: TitingTask,
    workspace: PreparedWorkspace,
    goal: RepairGoal | null,
    context?: ExecutionContext
  ): Promise<ExecutionResult> {
    try {
      const workflow = await loadWorkflowDefinition(workspace.workspacePath, workspace.workflowPromptsPath);
      const nativeSessionId = await this.createNativeSession(workspace, task, context);
      return this.runWorkflow(task, workspace, goal, workflow.path, workflow.nodes, nativeSessionId, false, context);
    } catch (error) {
      return this.buildWorkflowFailureResult(workspace, error);
    }
  }

  async continueSession(
    sessionId: string,
    task: TitingTask,
    workspace: PreparedWorkspace,
    goal: RepairGoal,
    context?: ExecutionContext
  ): Promise<ExecutionResult> {
    try {
      const workflow = await loadWorkflowDefinition(workspace.workspacePath, workspace.workflowPromptsPath);
      return this.runWorkflow(
        task,
        workspace,
        goal,
        workflow.path,
        workflow.nodes,
        this.parseUnifiedSessionId(sessionId),
        true,
        context
      );
    } catch (error) {
      return this.buildWorkflowFailureResult(workspace, error);
    }
  }

  protected abstract buildExecuteArgs(
    prompt: string,
    workspace: PreparedWorkspace,
    outputPath: string,
    nativeSessionId: string | null
  ): string[];

  protected abstract buildResumeArgs(
    prompt: string,
    workspace: PreparedWorkspace,
    outputPath: string,
    nativeSessionId: string | null
  ): string[];

  protected async createNativeSession(
    _workspace: PreparedWorkspace,
    _task?: TitingTask,
    _context?: ExecutionContext
  ): Promise<string | null> {
    return null;
  }

  protected formatUnifiedSessionId(nativeSessionId: string | null): string | null {
    if (!nativeSessionId) {
      return null;
    }
    return `${this.id}:${nativeSessionId}`;
  }

  protected parseUnifiedSessionId(sessionId: string): string | null {
    const prefix = `${this.id}:`;
    if (!sessionId.startsWith(prefix)) {
      return sessionId;
    }
    return sessionId.slice(prefix.length);
  }

  protected extractSessionId(_result: CommandResult, nativeSessionId: string | null): string | null {
    return this.formatUnifiedSessionId(nativeSessionId);
  }

  protected buildSummary(result: CommandResult, outputMessage: string): string {
    return outputMessage || result.summary;
  }

  private async runWorkflow(
    task: TitingTask,
    workspace: PreparedWorkspace,
    goal: RepairGoal | null,
    workflowPromptsPath: string,
    nodes: WorkflowNodeDefinition[],
    initialNativeSessionId: string | null,
    resumeWorkflow: boolean,
    context?: ExecutionContext
  ): Promise<ExecutionResult> {
    const nodeExecutions: WorkflowNodeExecutionRecord[] = [];
    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    const summaries: Array<{ label: string; summary: string }> = [];
    const workflowNodes = isProductOpenSpecExecution(task) ? nodes.slice(0, 1) : nodes;
    const runnableNodes = selectWorkflowNodesForAgent(task, this.agentKind, workflowNodes);
    let nativeSessionId = initialNativeSessionId;
    let latestSessionId = this.formatUnifiedSessionId(nativeSessionId);
    let latestMetadata: Record<string, unknown> = {};
    let isFirstInvocation = true;

    for (const node of runnableNodes) {
      const loopCount = node.loopEnabled ? node.maxLoops : 1;
      for (let iteration = 1; iteration <= loopCount; iteration += 1) {
        const prompt = this.buildWorkflowPrompt(task, workspace, goal, node, workflowPromptsPath);
        const outputPath = join(workspace.artifactsPath, `${this.id}-last-message.txt`);
        const args = isFirstInvocation
          ? (resumeWorkflow
            ? this.buildResumeArgs(prompt, workspace, outputPath, nativeSessionId)
            : this.buildExecuteArgs(prompt, workspace, outputPath, nativeSessionId))
          : this.buildResumeArgs(prompt, workspace, outputPath, nativeSessionId);
        const result = await this.runCli(args, workspace, outputPath, nativeSessionId, context);
        const nextNativeSessionId = result.sessionId ? this.parseUnifiedSessionId(result.sessionId) : nativeSessionId;
        nativeSessionId = nextNativeSessionId;
        latestSessionId = result.sessionId ?? latestSessionId;
        latestMetadata = { ...latestMetadata, ...result.metadata };
        isFirstInvocation = false;

        nodeExecutions.push({
          node: node.name,
          iteration,
          loopCount,
          exitCode: result.exitCode,
          stdoutLength: result.stdout.length,
          stderrLength: result.stderr.length,
          timedOut: result.timedOut
        });
        if (result.stdout) {
          stdoutParts.push(this.labelOutput(node.name, iteration, loopCount, "stdout", result.stdout));
        }
        if (result.stderr) {
          stderrParts.push(this.labelOutput(node.name, iteration, loopCount, "stderr", result.stderr));
        }
        if (result.summary) {
          summaries.push({
            label: this.labelNodeRun(node.name, iteration, loopCount),
            summary: result.summary
          });
        }

        if (result.exitCode !== 0) {
          return {
            ...result,
            sessionId: latestSessionId,
            stdout: stdoutParts.join("\n\n"),
            stderr: stderrParts.join("\n\n"),
            summary: this.buildAggregateSummary(summaries, result.summary),
            metadata: {
              ...latestMetadata,
              workflowStage: "execute",
              workflowPromptsPath,
              workflowNodeNames: runnableNodes.map((item) => item.name),
              skippedWorkflowNodeNames: nodes
                .map((item) => item.name)
                .filter((name) => !runnableNodes.some((node) => node.name === name)),
              nodeExecutions
            }
          };
        }
      }
    }

    const productMetadata = isProductOpenSpecExecution(task)
      ? await this.buildProductOpenSpecMetadata(task, workspace)
      : {};
    const qualityMetadata = isQualityOrchestrationExecution(task, this.agentKind)
      ? await buildQualityOrchestratorMetadata(workspace)
      : {};

    return {
      exitCode: 0,
      stdout: stdoutParts.join("\n\n"),
      stderr: stderrParts.join("\n\n"),
      summary: this.buildAggregateSummary(summaries, "Workflow completed"),
      sessionId: latestSessionId,
      timedOut: false,
      errorCategory: "none",
      timeoutCategory: "none",
      metadata: {
        ...latestMetadata,
        ...productMetadata,
        ...qualityMetadata,
        workflowStage: "execute",
        workflowPromptsPath,
        workflowNodeNames: runnableNodes.map((item) => item.name),
        skippedWorkflowNodeNames: nodes
          .map((item) => item.name)
          .filter((name) => !runnableNodes.some((node) => node.name === name)),
        nodeExecutions
      }
    };
  }

  private buildWorkflowPrompt(
    task: TitingTask,
    workspace: PreparedWorkspace,
    goal: RepairGoal | null,
    node: WorkflowNodeDefinition,
    workflowPromptsPath: string
  ): string {
    const variables = this.buildWorkflowVariables(task, workspace, goal, workflowPromptsPath);
    const basePrompt = renderWorkflowTemplate(node.promptTemplate, variables);
    const promptWithServicesGuide = isProductOpenSpecExecution(task)
      ? basePrompt
      : appendTargetServicesGuidance(basePrompt, workspace);
    if (!goal) {
      return promptWithServicesGuide;
    }
    const repairOnlyNote = isRepairOnlyExecution(task, goal)
      ? "\n\nRepair-only mode:\n不要重新实现完整需求。只根据 Repair goal、失败检查项和人工方案进行最小修复。"
      : "";
    return `${promptWithServicesGuide}${repairOnlyNote}\n\nRepair goal:\n${goal.objective}\n${goal.doneWhen.join("\n")}\n${goal.constraints.join("\n")}`.trim();
  }

  private buildWorkflowVariables(
    task: TitingTask,
    workspace: PreparedWorkspace,
    goal: RepairGoal | null,
    workflowPromptsPath: string
  ): Record<string, string> {
    const projectName = task.repo.split("/").filter(Boolean).at(-1)?.replace(/\.git$/, "") ?? "repo";
    const reposRoot = join(workspace.workspacePath, "repos");
    const reposList = workspace.repos
      .map((repo) => `${repo.key}=${repo.path}`)
      .join("\n");
    const repairOnly = isRepairOnlyExecution(task, goal);
    const taskPrompt = repairOnly
      ? "Do not reimplement the whole request; only repair the current failure from the repair goal, failed checks, and human guidance."
      : isProductOpenSpecExecution(task)
        ? buildProductOpenSpecPrompt(task)
        : task.instruction;
    return {
      taskId: task.id,
      taskTitle: task.title,
      taskPrompt,
      gitBranch: workspace.branch,
      gitBaseBranch: "main",
      gitWorktreePath: workspace.repoPath,
      projectName,
      projectDefaultBranch: "main",
      repoPath: workspace.repoPath,
      reposRoot,
      reposList,
      workspacePath: workspace.workspacePath,
      artifactsPath: workspace.artifactsPath,
      acceptanceCriteria: repairOnly ? goal?.doneWhen.join("\n") ?? "" : task.acceptanceCriteria.join("\n"),
      taskConstraints: task.constraints.join("\n"),
      repairObjective: goal?.objective ?? "",
      repairDoneWhen: goal?.doneWhen.join("\n") ?? "",
      workflowPromptsPath
    };
  }

  private buildAggregateSummary(summaries: Array<{ label: string; summary: string }>, fallback: string): string {
    if (summaries.length === 0) {
      return fallback;
    }
    if (summaries.length === 1) {
      return summaries[0].summary;
    }
    return summaries.map((item) => `${item.label}: ${item.summary}`).join("\n");
  }

  private async buildProductOpenSpecMetadata(task: TitingTask, workspace: PreparedWorkspace): Promise<Record<string, unknown>> {
    const changeId = readString(task.metadata.openspecChangeId) ?? await inferOpenSpecChangeId(workspace.workspacePath);
    const revision = readString(task.metadata.openspecRevision) ?? new Date().toISOString();
    const validation = await writeOpenSpecValidationArtifact(workspace.workspacePath, workspace.artifactsPath, changeId);
    const summary = changeId
      ? `OpenSpec change ${changeId} is ready for review`
      : "OpenSpec review package is ready";
    const reviewPath = join(workspace.artifactsPath, "product-review.md");
    await writeFile(reviewPath, [
      `# Product OpenSpec Review`,
      "",
      `Task: ${task.id}`,
      `Change: ${changeId ?? "unknown"}`,
      `Revision: ${revision}`,
      "",
      summary,
      ""
    ].join("\n"));
    return {
      ...(changeId ? { openspecChangeId: changeId } : {}),
      openspecRevision: revision,
      openspecValidation: validation,
      productReview: {
        summary,
        reviewPackagePath: reviewPath
      }
    };
  }

  private labelOutput(nodeName: string, iteration: number, loopCount: number, stream: "stdout" | "stderr", content: string): string {
    return `${this.labelNodeRun(nodeName, iteration, loopCount)} ${stream}:\n${content}`;
  }

  private labelNodeRun(nodeName: string, iteration: number, loopCount: number): string {
    return loopCount > 1 ? `${nodeName} iteration ${iteration}/${loopCount}` : nodeName;
  }

  private buildWorkflowFailureResult(workspace: PreparedWorkspace, error: unknown): ExecutionResult {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof ExecutorSessionError) {
      return {
        exitCode: error.timedOut ? 124 : 1,
        stdout: "",
        stderr: error.detail || error.summary,
        summary: error.summary,
        sessionId: null,
        timedOut: error.timedOut,
        errorCategory: error.timedOut ? "timeout" : "launch_error",
        timeoutCategory: error.timedOut ? "execution_timeout" : "none",
        metadata: {
          cwd: workspace.workspacePath,
          executorStage: "session-create",
          executorError: error.detail || error.summary
        }
      };
    }
    return {
      exitCode: 1,
      stdout: "",
      stderr: message,
      summary: "Project WORKFLOW_PROMPTS.md is missing or invalid",
      sessionId: null,
      timedOut: false,
      errorCategory: "command_failed",
      timeoutCategory: "none",
      metadata: {
        cwd: workspace.workspacePath,
        workflowStage: "workflow-prompts",
        workflowError: message
      }
    };
  }

  private async runCli(
    args: string[],
    workspace: PreparedWorkspace,
    outputPath: string,
    nativeSessionId: string | null,
    context?: ExecutionContext
  ): Promise<ExecutionResult> {
    const runtimeLogPath = join(workspace.artifactsPath, "executor-runtime.jsonl");
    try {
      await this.governance?.beforeCommand?.([this.bin, ...args]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordRuntimeEvent(workspace, context, {
        phase: "before_command",
        event: "blocked",
        executor: this.id,
        occurredAt: new Date().toISOString(),
        command: redactCommand([this.bin, ...args]),
        nativeSessionId,
        message
      });
      return {
        exitCode: 126,
        stdout: "",
        stderr: message,
        summary: message,
        sessionId: this.extractSessionId({ exitCode: 126, stdout: "", stderr: message, summary: message, timedOut: false }, nativeSessionId),
        timedOut: false,
        errorCategory: "governance_blocked",
        timeoutCategory: "none",
        metadata: {
          command: redactCommand([this.bin, ...args]),
          cwd: workspace.workspacePath,
          nativeSessionId,
          runtimeLogPath,
          governance: [{
            pluginId: this.governance?.id,
            phase: "before_command",
            outcome: "blocked",
            message,
            findings: [message],
            metadata: {
              command: redactCommand([this.bin, ...args])
            }
          }]
        }
      };
    }
    await this.recordRuntimeEvent(workspace, context, {
      phase: "command",
      event: "start",
      executor: this.id,
      occurredAt: new Date().toISOString(),
      command: redactCommand([this.bin, ...args]),
      cwd: workspace.workspacePath,
      outputPath,
      nativeSessionId
    });
    const result = await runCommand(
      this.bin,
      args,
      workspace.workspacePath,
      this.timeoutMs,
      workspace.env,
      (event) => {
        void this.recordRuntimeEvent(workspace, context, this.toRuntimeLogEntry(event, args, workspace, nativeSessionId));
      },
      this.idleTimeoutMs
    );
    const outputMessage = await readOptionalFile(outputPath);
    const sessionId = this.extractSessionId(result, nativeSessionId);
    const redactedStdout = this.governance?.redact?.(result.stdout) ?? result.stdout;
    const redactedStderr = this.governance?.redact?.(result.stderr) ?? result.stderr;
    // The agent CLI may print an invalid-key/not-logged-in warning yet still exit 0, producing no
    // real work; treat it as a launch failure with a concrete cause instead of an opaque empty run.
    const authFailed = detectCodingAgentAuthFailure(`${result.stdout}\n${result.stderr}`);
    const builtSummary = authFailed ? CODING_AGENT_AUTH_FAILURE_MESSAGE : this.buildSummary(result, outputMessage);
    const redactedSummary = this.governance?.redact?.(builtSummary) ?? builtSummary;
    const errorCategory = authFailed && result.exitCode === 0 ? "launch_error" : classifyExecutionError(result);
    const executionResult: ExecutionResult = {
      exitCode: result.exitCode,
      stdout: redactedStdout,
      stderr: redactedStderr,
      summary: redactedSummary,
      sessionId,
      timedOut: result.timedOut,
      errorCategory,
      timeoutCategory: result.timedOut ? "execution_timeout" : "none",
      metadata: {
        command: redactCommand([this.bin, ...args]),
        cwd: workspace.workspacePath,
        nativeSessionId,
        outputMessage,
        outputPath,
        runtimeLogPath
      }
    };
    await this.governance?.afterCommand?.([this.bin, ...args], executionResult);
    await this.recordRuntimeEvent(workspace, context, {
      phase: "command",
      event: "result",
      executor: this.id,
      occurredAt: new Date().toISOString(),
      command: redactCommand([this.bin, ...args]),
      nativeSessionId,
      sessionId,
      exitCode: executionResult.exitCode,
      timedOut: executionResult.timedOut,
      errorCategory: executionResult.errorCategory,
      timeoutCategory: executionResult.timeoutCategory,
      stdoutLength: executionResult.stdout.length,
      stderrLength: executionResult.stderr.length,
      summary: executionResult.summary
    });
    return executionResult;
  }

  private async recordRuntimeEvent(
    workspace: PreparedWorkspace,
    context: ExecutionContext | undefined,
    event: Record<string, unknown>
  ): Promise<void> {
    await appendJsonLine(join(workspace.artifactsPath, "executor-runtime.jsonl"), event);
    await context?.runtimeLogger?.(this.toExecutionRuntimeEvent(event, workspace.repoPath));
  }

  private toExecutionRuntimeEvent(event: Record<string, unknown>, cwd: string) {
    const command = Array.isArray(event.command) ? event.command.filter((item): item is string => typeof item === "string") : [];
    const occurredAt = typeof event.occurredAt === "string" ? event.occurredAt : new Date().toISOString();
    const nativeSessionId = typeof event.nativeSessionId === "string" || event.nativeSessionId === null
      ? event.nativeSessionId as string | null
      : undefined;
    const eventName = typeof event.event === "string" ? event.event : "";
    switch (eventName) {
      case "start":
        return { type: "command_start", command, cwd, outputPath: typeof event.outputPath === "string" ? event.outputPath : undefined, nativeSessionId, occurredAt } as const;
      case "spawn":
        return { type: "spawn", command, cwd, pid: typeof event.pid === "number" ? event.pid : undefined, nativeSessionId, occurredAt } as const;
      case "stdout":
      case "stderr":
        return { type: eventName, command, cwd, bytes: typeof event.bytes === "number" ? event.bytes : 0, chunk: typeof event.preview === "string" ? event.preview : "", nativeSessionId, occurredAt } as const;
      case "timeout":
      case "idle_timeout":
        return {
          type: eventName === "idle_timeout" ? "idle_timeout" : "timeout",
          command,
          cwd,
          signal: typeof event.signal === "string" ? event.signal : "SIGTERM",
          timeoutMs: typeof event.timeoutMs === "number" ? event.timeoutMs : 0,
          reason: typeof event.reason === "string" ? event.reason as "wall_clock" | "idle" : undefined,
          nativeSessionId,
          occurredAt
        } as const;
      case "error":
        return { type: "error", command, cwd, error: typeof event.error === "string" ? event.error : "unknown error", nativeSessionId, occurredAt } as const;
      case "close":
        return { type: "close", command, cwd, exitCode: typeof event.exitCode === "number" ? event.exitCode : null, stdoutBytes: typeof event.stdoutBytes === "number" ? event.stdoutBytes : 0, stderrBytes: typeof event.stderrBytes === "number" ? event.stderrBytes : 0, timedOut: event.timedOut === true, nativeSessionId, occurredAt } as const;
      case "result":
        return {
          type: "result",
          command,
          cwd,
          exitCode: typeof event.exitCode === "number" ? event.exitCode : 1,
          timedOut: event.timedOut === true,
          errorCategory: typeof event.errorCategory === "string" ? event.errorCategory : "none",
          timeoutCategory: typeof event.timeoutCategory === "string" ? event.timeoutCategory : "none",
          stdoutLength: typeof event.stdoutLength === "number" ? event.stdoutLength : 0,
          stderrLength: typeof event.stderrLength === "number" ? event.stderrLength : 0,
          summary: typeof event.summary === "string" ? event.summary : "",
          sessionId: typeof event.sessionId === "string" || event.sessionId === null ? event.sessionId as string | null : undefined,
          nativeSessionId,
          occurredAt
        } as const;
      case "create_chat_start":
        return { type: "session_create_start", command, cwd, occurredAt } as const;
      case "create_chat_result":
        return {
          type: "session_create_result",
          command,
          cwd,
          exitCode: typeof event.exitCode === "number" ? event.exitCode : undefined,
          stdoutLength: typeof event.stdoutLength === "number" ? event.stdoutLength : undefined,
          stderrLength: typeof event.stderrLength === "number" ? event.stderrLength : undefined,
          sessionId: typeof event.sessionId === "string" || event.sessionId === null ? event.sessionId as string | null : undefined,
          occurredAt
        } as const;
      default:
        return { type: "error", command, cwd, error: `unknown runtime event: ${eventName}`, nativeSessionId, occurredAt } as const;
    }
  }

  private toRuntimeLogEntry(
    event: CommandLifecycleEvent,
    args: string[],
    workspace: PreparedWorkspace,
    nativeSessionId: string | null
  ): Record<string, unknown> {
    if (event.type === "stdout" || event.type === "stderr") {
      return {
        phase: "command",
        event: event.type,
        executor: this.id,
        occurredAt: event.occurredAt,
        command: redactCommand([this.bin, ...args]),
        cwd: workspace.workspacePath,
        nativeSessionId,
        bytes: event.bytes,
        preview: event.chunk.slice(0, 2000)
      };
    }
    return {
      phase: "command",
      event: event.type,
      executor: this.id,
      occurredAt: event.occurredAt,
      command: "command" in event ? redactCommand(event.command) : redactCommand([this.bin, ...args]),
      cwd: workspace.workspacePath,
      nativeSessionId,
      ...("pid" in event ? { pid: event.pid } : {}),
      ...("timeoutMs" in event ? { timeoutMs: event.timeoutMs, signal: event.signal, ...("reason" in event && event.reason ? { reason: event.reason } : {}) } : {}),
      ...("error" in event ? { error: event.error } : {}),
      ...("exitCode" in event
        ? {
            exitCode: event.exitCode,
            stdoutBytes: event.stdoutBytes,
            stderrBytes: event.stderrBytes,
            timedOut: event.timedOut
          }
        : {})
    };
  }
}

export class CodexExecutionPlugin extends CodingAgentDriver {
  protected getDefaultRuntimeKind(): CodingRuntimeDescriptor["runtime"] {
    return "codex";
  }

  protected buildExecuteArgs(
    prompt: string,
    workspace: PreparedWorkspace,
    outputPath: string
  ): string[] {
    return [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "-C",
      workspace.workspacePath,
      "-o",
      outputPath,
      prompt
    ];
  }

  protected buildResumeArgs(
    prompt: string,
    _workspace: PreparedWorkspace,
    outputPath: string,
    nativeSessionId: string | null
  ): string[] {
    return [
      "exec",
      "resume",
      ...(nativeSessionId && nativeSessionId !== "last" ? [nativeSessionId] : ["--last"]),
      "--json",
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "-o",
      outputPath,
      prompt
    ];
  }

  protected extractSessionId(result: CommandResult, nativeSessionId: string | null): string | null {
    const parsed = extractJsonSessionId(result.stdout) ?? extractUuid(result.stdout) ?? extractUuid(result.stderr) ?? nativeSessionId ?? "last";
    return this.formatUnifiedSessionId(parsed);
  }
}

export class ProductCodexExecutionPlugin extends CodexExecutionPlugin {
  override readonly agentKind = "product" as const;
  override readonly driverId = "openspec-product" as const;
  override readonly capabilities = ["product", "openspec", "codex"];
}

export class QualityCodexExecutionPlugin extends CodexExecutionPlugin {
  override readonly agentKind = "quality" as const;
  override readonly driverId = "quality-orchestrator" as const;
  override readonly capabilities = ["quality", "review", "codex"];
}

export class CursorExecutionPlugin extends CodingAgentDriver {
  protected getDefaultRuntimeKind(): CodingRuntimeDescriptor["runtime"] {
    return "cursor";
  }

  override async health(): Promise<PluginHealth> {
    if (!this.available) {
      return { healthy: false, message: `${this.displayName} is unavailable` };
    }
    try {
      const result = await runCommand(this.binaryPath, ["status"], process.cwd(), 10_000);
      const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
      const notLoggedIn =
        result.exitCode !== 0 ||
        output.includes("not logged in") ||
        output.includes("api key") ||
        output.includes("invalid") ||
        output.includes("unauthenticated");
      if (notLoggedIn) {
        return {
          healthy: false,
          message: `Cursor Agent not authenticated — run \`${this.binaryPath} login\` in your terminal to sign in`
        };
      }
      const emailMatch = `${result.stdout}\n${result.stderr}`.match(/logged in as (\S+)/i);
      const email = emailMatch?.[1] ?? "unknown";
      return { healthy: true, message: `${this.displayName} authenticated as ${email}` };
    } catch {
      return {
        healthy: false,
        message: `Cursor Agent not authenticated — run \`${this.binaryPath} login\` in your terminal to sign in`
      };
    }
  }

  protected async createNativeSession(
    workspace: PreparedWorkspace,
    task?: TitingTask,
    context?: ExecutionContext
  ): Promise<string | null> {
    const runtimeLogPath = join(workspace.artifactsPath, "executor-runtime.jsonl");
    const startEvent = {
      phase: "session",
      event: "create_chat_start",
      executor: this.id,
      occurredAt: new Date().toISOString(),
      taskId: task?.id,
      command: [this.bin, "create-chat"],
      cwd: workspace.repoPath
    };
    await appendJsonLine(runtimeLogPath, startEvent);
    await context?.runtimeLogger?.({
      type: "session_create_start",
      command: [this.bin, "create-chat"],
      cwd: workspace.workspacePath,
      occurredAt: startEvent.occurredAt
    });
    const result = await runCommand(
      this.bin,
      ["create-chat"],
      workspace.workspacePath,
      this.timeoutMs,
      workspace.env,
      (event) => {
        void appendJsonLine(runtimeLogPath, {
          phase: "session",
          executor: this.id,
          taskId: task?.id,
          ...this.toSessionRuntimeLogEntry(event)
        });
      },
      // Without an idle timeout a hung `create-chat` (e.g. invalid key with no output)
      // would spin until the wall-clock timeout instead of failing fast with a cause.
      this.idleTimeoutMs
    );
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    if (detectCodingAgentAuthFailure(combinedOutput)) {
      throw new ExecutorSessionError(
        CODING_AGENT_AUTH_FAILURE_MESSAGE,
        result.stderr || result.stdout || result.summary,
        false
      );
    }
    if (result.timedOut) {
      throw new ExecutorSessionError(
        "Cursor session creation stalled — `create-chat` produced no output before the timeout",
        result.stderr || result.stdout || result.summary,
        true
      );
    }
    if (result.exitCode !== 0) {
      throw new ExecutorSessionError(
        `Failed to create Cursor chat (exit ${result.exitCode})`,
        result.stderr || result.stdout || result.summary,
        false
      );
    }
    const sessionId = result.stdout.trim().split(/\s+/).at(-1) ?? null;
    const resultEvent = {
      phase: "session",
      event: "create_chat_result",
      executor: this.id,
      occurredAt: new Date().toISOString(),
      taskId: task?.id,
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
      sessionId
    };
    await appendJsonLine(runtimeLogPath, resultEvent);
    await context?.runtimeLogger?.({
      type: "session_create_result",
      command: [this.bin, "create-chat"],
      cwd: workspace.workspacePath,
      exitCode: result.exitCode,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
      sessionId,
      occurredAt: resultEvent.occurredAt
    });
    return sessionId;
  }

  protected buildExecuteArgs(
    prompt: string,
    workspace: PreparedWorkspace,
    _outputPath: string,
    nativeSessionId: string | null
  ): string[] {
    return [
      "agent",
      "--print",
      "--output-format",
      "stream-json",
      "--force",
      "--trust",
      "--workspace",
      workspace.workspacePath,
      ...(nativeSessionId ? ["--resume", nativeSessionId] : []),
      prompt
    ];
  }

  protected buildResumeArgs(
    prompt: string,
    workspace: PreparedWorkspace,
    _outputPath: string,
    nativeSessionId: string | null
  ): string[] {
    return [
      "agent",
      "--print",
      "--output-format",
      "stream-json",
      "--force",
      "--trust",
      "--workspace",
      workspace.workspacePath,
      ...(nativeSessionId ? ["--resume", nativeSessionId] : ["--continue"]),
      prompt
    ];
  }

  protected extractSessionId(_result: CommandResult, nativeSessionId: string | null): string | null {
    return this.formatUnifiedSessionId(nativeSessionId);
  }

  protected buildSummary(result: CommandResult, outputMessage: string): string {
    return outputMessage || extractCursorSummary(result.stdout) || result.summary;
  }

  private toSessionRuntimeLogEntry(event: CommandLifecycleEvent): Record<string, unknown> {
    if (event.type === "stdout" || event.type === "stderr") {
      return {
        event: `create_chat_${event.type}`,
        occurredAt: event.occurredAt,
        bytes: event.bytes,
        preview: event.chunk.slice(0, 2000)
      };
    }
    return {
      event: `create_chat_${event.type}`,
      occurredAt: event.occurredAt,
      ...("pid" in event ? { pid: event.pid } : {}),
      ...("timeoutMs" in event ? { timeoutMs: event.timeoutMs, signal: event.signal, ...("reason" in event && event.reason ? { reason: event.reason } : {}) } : {}),
      ...("error" in event ? { error: event.error } : {}),
      ...("exitCode" in event
        ? {
            exitCode: event.exitCode,
            stdoutBytes: event.stdoutBytes,
            stderrBytes: event.stderrBytes,
            timedOut: event.timedOut
          }
        : {})
    };
  }
}

export class ProductCursorExecutionPlugin extends CursorExecutionPlugin {
  override readonly agentKind = "product" as const;
  override readonly driverId = "openspec-product" as const;
  override readonly capabilities = ["product", "openspec", "cursor"];
}

export class QualityCursorExecutionPlugin extends CursorExecutionPlugin {
  override readonly agentKind = "quality" as const;
  override readonly driverId = "quality-orchestrator" as const;
  override readonly capabilities = ["quality", "review", "cursor"];
}

const PROGRAMMING_WORKFLOW_NODES = new Set(["PreflightAndSpec", "Implement"]);
const QUALITY_WORKFLOW_NODES = new Set(["VerifyAndReview"]);
const OPEN_SPEC_SPLIT_WORKFLOW_NODES = new Set([
  ...PROGRAMMING_WORKFLOW_NODES,
  ...QUALITY_WORKFLOW_NODES,
  "Archive"
]);

function selectWorkflowNodesForAgent(
  task: TitingTask,
  agentKind: AgentKind,
  nodes: WorkflowNodeDefinition[]
): WorkflowNodeDefinition[] {
  if (!isSplitOpenSpecWorkflow(task, nodes)) {
    return nodes;
  }
  const allowedNodes = agentKind === "quality"
    ? QUALITY_WORKFLOW_NODES
    : agentKind === "programming"
      ? PROGRAMMING_WORKFLOW_NODES
      : null;
  if (!allowedNodes) {
    return nodes;
  }
  const selected = nodes.filter((node) => allowedNodes.has(node.name));
  return selected.length > 0 ? selected : nodes;
}

function isSplitOpenSpecWorkflow(task: TitingTask, nodes: WorkflowNodeDefinition[]): boolean {
  const hasKnownSplitNode = nodes.some((node) => OPEN_SPEC_SPLIT_WORKFLOW_NODES.has(node.name));
  if (!hasKnownSplitNode) {
    return false;
  }
  return Boolean(
    task.agentKind === "quality"
    || task.driverId === "quality-orchestrator"
    || task.metadata.workflowRole === "programming_from_spec"
    || task.metadata.workflowRole === "programming_from_product"
    || typeof task.metadata.sourceProductTaskId === "string"
  );
}

function isQualityOrchestrationExecution(task: TitingTask, agentKind: AgentKind): boolean {
  return agentKind === "quality" || task.agentKind === "quality" || task.driverId === "quality-orchestrator";
}

async function buildQualityOrchestratorMetadata(workspace: PreparedWorkspace): Promise<Record<string, unknown>> {
  const reportPath = join(workspace.artifactsPath, "code-review-report.json");
  try {
    const rawContent = await readFile(reportPath, "utf8");
    return {
      codeReviewReport: JSON.parse(rawContent),
      reviewArtifactId: reportPath
    };
  } catch {
    return {};
  }
}

function isRepairOnlyExecution(task: TitingTask, goal: RepairGoal | null): boolean {
  if (!goal) {
    return false;
  }
  const humanLoop = task.metadata.humanLoop;
  return Boolean(
    humanLoop
    && typeof humanLoop === "object"
    && (humanLoop as Record<string, unknown>).executionMode === "repair_only"
  );
}

function isProductOpenSpecExecution(task: TitingTask): boolean {
  return task.agentKind === "product" || task.driverId === "openspec-product" || task.executor === "product";
}

function buildProductOpenSpecPrompt(task: TitingTask): string {
  return [
    task.instruction,
    "",
    "Product OpenSpec workflow:",
    "- Use the openspec-superpowers-workflow skill as the required process for this product phase.",
    "- Complete only product stage 1 / PreflightAndSpec: brainstorming, OpenSpec artifact generation or revision, validation, and review package output.",
    "- Update openspec/changes/<change-id>/workflow-state.md only through phase-1-brainstorming, phase-1-preflight-spec, and phase-1-report.",
    "- Do not enter product stage 2 or later, including implementation, completion gate, verification, code review, PR, archive, or closeout.",
    "- Work in the workspace root as the OpenSpec workflow carrier.",
    "- Generate or revise only OpenSpec change artifacts and review artifacts.",
    "- Do not modify application source code or create pull requests in this product phase.",
    "- Preserve legacy spec attachment contents when present; otherwise generate the OpenSpec change from task.md and task metadata.",
    "- Human brainstorming is mandatory before the first OpenSpec artifact pass. If no human reply is already present in the task instructions or metadata, post exactly one clarifying question with 2-3 candidate approaches to Feishu comments, ask the reviewer to reply with the `【回复】` prefix, then stop with a needs-human/fail-closed result.",
    "- Do not create or update OpenSpec artifacts before the first human reply, and do not substitute assumptions for that first interaction.",
    "- Do not mark phase-1-brainstorming or phase-1-report complete before the first human reply.",
    "- After a `【回复】` human reply is appended to the task, consume that reply, continue the product workflow, and record any remaining low-risk assumptions explicitly.",
    "- When review-ready, leave a concise review summary in stdout and workspace artifacts, and ensure openspec/changes/<change-id>/ exists.",
    "- Do not call `meegle comment add` for review-ready output, and do not create review-ready Feishu comments yourself.",
    "- Diting will create the OpenSpec review child task after this executor exits successfully; duplicate comments make the review state ambiguous.",
    "",
    "Acceptance criteria:",
    ...(task.acceptanceCriteria.length > 0 ? task.acceptanceCriteria.map((item) => `- ${item}`) : ["- OpenSpec change is ready for human review"])
  ].join("\n");
}

function appendTargetServicesGuidance(prompt: string, workspace: PreparedWorkspace): string {
  const repos = workspace.repos.length > 0 ? workspace.repos : [{
    key: "Repo1",
    path: workspace.repoPath
  }];
  const reposList = repos.map((repo) => `- ${repo.key}: ${repo.path}`).join("\n");
  const primaryRepoKey = repos[0]?.key ?? "Repo1";
  const repoKeyNote = repos.length > 1
    ? "For multi-repo workspaces, each repository should keep its own `.diting/services.yaml`; every service must set repoKey to the repository key for that file."
    : `For single-repo workspaces, repoKey may be omitted or set to ${primaryRepoKey}.`;
  const schemaExample = repos.length > 1
    ? repos.flatMap((repo) => [
        `# In ${repo.key}/.diting/services.yaml`,
        "schemaVersion: 1",
        "services:",
        `  - id: ${repo.key.toLowerCase()}`,
        `    repoKey: ${repo.key}`,
        "    cwd: .",
        "    command: [\"npm\", \"run\", \"start:dev\"]",
        "    healthUrl: http://127.0.0.1:3000/health",
        ""
      ])
    : [
        "schemaVersion: 1",
        "services:",
        "  - id: app",
        `    repoKey: ${primaryRepoKey}`,
        "    cwd: .",
        "    command: [\"npm\", \"run\", \"start:dev\"]",
        "    healthUrl: http://127.0.0.1:3000/health"
      ];
  return [
    prompt.trim(),
    "",
    "Target service startup configuration:",
    "- Before finishing, inspect `.diting/services.yaml` in the target repo. The Environment plugin may have scaffolded this file when it was missing.",
    "- For multi-repo tasks, inspect each repository's `.diting/services.yaml`; the service lifecycle plugin merges these files before quality evaluation.",
    "- If a file is a scaffold, replace TODO/template values with commands that actually start that repository's services.",
    "- If it already existed, verify and fix `cwd`, `command`, `healthUrl`, `repoKey`, and `dependsOn` so the service lifecycle plugin can start it before quality evaluation.",
    "- Keep each `.diting/services.yaml` as a tracked target-repo change when you create or modify it.",
    `- ${repoKeyNote}`,
    "Repository keys:",
    reposList,
    "Minimal schema example:",
    "```yaml",
    ...schemaExample,
    "```"
  ].join("\n");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function inferOpenSpecChangeId(workspacePath: string): Promise<string | null> {
  const changesPath = join(workspacePath, "openspec", "changes");
  try {
    const entries = await readdir(changesPath, { withFileTypes: true });
    const directories = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const name = entry.name.trim();
        if (!isActiveOpenSpecChangeDirectory(name)) {
          return null;
        }
        const path = join(changesPath, name);
        const stats = await stat(path);
        return { name, mtimeMs: stats.mtimeMs };
      }));
    return directories
      .filter((entry): entry is { name: string; mtimeMs: number } => Boolean(entry))
      .sort((left, right) => right.mtimeMs - left.mtimeMs || left.name.localeCompare(right.name))
      .at(0)?.name ?? null;
  } catch {
    return null;
  }
}

function isActiveOpenSpecChangeDirectory(name: string): boolean {
  if (!name || name.startsWith(".")) {
    return false;
  }
  return name !== "archive";
}

async function writeOpenSpecValidationArtifact(
  workspacePath: string,
  artifactsPath: string,
  changeId: string | null
): Promise<Record<string, unknown>> {
  const validation = changeId
    ? await validateOpenSpecChange(workspacePath, changeId)
    : { changeId: null, passed: false, errors: ["OpenSpec change id was not found"] };
  const payload = {
    mode: "internal",
    checkedAt: new Date().toISOString(),
    ...validation
  };
  await writeFile(join(artifactsPath, "openspec-validation.json"), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function validateOpenSpecChange(workspacePath: string, changeId: string): Promise<Record<string, unknown>> {
  const changePath = join(workspacePath, "openspec", "changes", changeId);
  const requiredFiles = ["proposal.md", "design.md", "tasks.md", "workflow-state.md"];
  const errors: string[] = [];
  for (const file of requiredFiles) {
    try {
      await access(join(changePath, file));
    } catch {
      errors.push(`Missing ${file}`);
    }
  }
  await validateProductWorkflowState(changePath, errors);
  const specsPath = join(changePath, "specs");
  try {
    const specFiles = await collectSpecFiles(specsPath);
    if (specFiles.length === 0) {
      errors.push("Missing specs/<capability>/spec.md");
    }
    for (const specFile of specFiles) {
      const content = await readFile(specFile, "utf8");
      if (!/^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements/m.test(content)) {
        errors.push(`${specFile} missing requirements section`);
      }
      if (!/^### Requirement:/m.test(content)) {
        errors.push(`${specFile} missing requirement`);
      }
      if (!/^#### Scenario:/m.test(content)) {
        errors.push(`${specFile} missing scenario`);
      }
    }
    return { changeId, passed: errors.length === 0, errors, specFiles };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { changeId, passed: false, errors, specFiles: [] };
  }
}

async function validateProductWorkflowState(changePath: string, errors: string[]): Promise<void> {
  let content = "";
  try {
    content = await readFile(join(changePath, "workflow-state.md"), "utf8");
  } catch {
    return;
  }
  const disallowedPhases = [
    "phase-2-openspec-artifacts",
    "phase-2-implementation",
    "phase-2-completion-gate",
    "phase-2-report",
    "phase-2.4-user-confirmation",
    "phase-3-implementation",
    "phase-3-report",
    "phase-3.5-completion-gate",
    "phase-3.5-report",
    "phase-4-verification",
    "phase-4-report",
    "phase-5-code-review",
    "phase-5-report",
    "phase-6-closeout",
    "phase-6-report"
  ];
  for (const phase of disallowedPhases) {
    if (new RegExp(`^- \\[x\\] ${escapeRegExp(phase)}\\b`, "im").test(content)) {
      errors.push(`Product OpenSpec workflow-state must not mark ${phase} complete`);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectSpecFiles(specsPath: string): Promise<string[]> {
  const entries = await readdir(specsPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const specFile = join(specsPath, entry.name, "spec.md");
    try {
      await access(specFile);
      files.push(specFile);
    } catch {
      // OpenSpec delta specs are only valid at specs/<capability>/spec.md.
    }
  }
  return files.sort();
}
