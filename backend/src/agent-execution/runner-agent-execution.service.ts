import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess } from 'child_process';
import { ContainerExecutionConfigService } from '../containers/container-execution-config.service';
import { DockerExecProcessLauncherService } from '../containers/docker-exec-process-launcher.service';
import { IsolatedRunnerContainerService } from '../containers/isolated-runner-container.service';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';
import { TaskNode } from '../tasks/domain/task-node';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { AgentExecutionConfigResolverService } from './agent-execution-config-resolver.service';
import { summarizeAgentCliArgsForLog } from './runner-agent-cli-args-log';
import {
  AgentExecutionConfig,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentExecutionStreamCallbacks,
} from './agent-execution.types';
import { PromptTemplateRuntimeContext } from './agent-prompt-template.service';
import { MemoryHostService } from '../memory/memory-host.service';

type ActiveAgentExecution = {
  childProcess: ChildProcess;
  stopReason: 'interrupt' | null;
  killTimerRef: NodeJS.Timeout | null;
};

@Injectable()
export class RunnerAgentExecutionService {
  private readonly logger = new Logger(RunnerAgentExecutionService.name);
  private readonly maxOutputLength = 100_000;
  private readonly forcedKillDelayMs = 2_000;
  private readonly activeExecutions = new Map<string, ActiveAgentExecution>();

  constructor(
    private readonly configResolver: AgentExecutionConfigResolverService,
    private readonly configService: ConfigService,
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry,
    @Optional()
    private readonly containerExecutionConfig?: ContainerExecutionConfigService,
    @Optional()
    private readonly dockerExecProcessLauncher?: DockerExecProcessLauncherService,
    @Optional()
    private readonly isolatedRunnerContainer?: IsolatedRunnerContainerService,
    @Optional()
    private readonly memoryHost?: MemoryHostService,
  ) {}

  async executeAgentNode({
    task,
    node,
    project,
    runtimeContext,
    callbacks,
    containerExecRef,
    additionalRunnerEnv,
  }: {
    task: Task;
    node: TaskNode;
    project: Project;
    runtimeContext?: PromptTemplateRuntimeContext;
    callbacks?: AgentExecutionStreamCallbacks;
    containerExecRef?: string;
    /** Merged into runner Agent `docker exec` env after resolution (e.g. ephemeral MCP base URLs). */
    additionalRunnerEnv?: Record<string, string>;
  }): Promise<AgentExecutionResult> {
    const executionContext = {
      taskId: task.id,
      nodeId: node.id,
      projectId: project.id,
      businessLineId: project.businessLineId,
    };
    const preparedExecution = await this.prepareExecution(
      project,
      task,
      node,
      runtimeContext,
      callbacks,
      additionalRunnerEnv,
    );
    const resolvedRef =
      containerExecRef ?? (await this.resolveContainerExecRefForTask(task));
    const firstResult = await this.runWithConfig(
      preparedExecution.config,
      preparedExecution.prompt,
      executionContext,
      callbacks,
      resolvedRef ?? undefined,
    );

    if (
      !this.shouldFallbackCodexInvalidResume({
        node,
        config: preparedExecution.config,
        result: firstResult,
      })
    ) {
      return firstResult;
    }

    this.logger.warn(
      `runner_agent_invalid_resume_fallback ${JSON.stringify({
        ...executionContext,
        staleSessionId: node.agentCliSessionId ?? null,
        stderrPreview: this.truncateForLog(firstResult.stderr),
      })}`,
    );
    const fallbackExecution = await this.prepareExecution(
      project,
      task,
      {
        ...node,
        agentCliSessionId: null,
      },
      runtimeContext,
      callbacks,
      additionalRunnerEnv,
    );
    const fallbackResult = await this.runWithConfig(
      fallbackExecution.config,
      fallbackExecution.prompt,
      executionContext,
      callbacks,
      resolvedRef ?? undefined,
    );

    return {
      ...fallbackResult,
      clearPreviousSessionId: true,
    };
  }

  interruptExecution(nodeId: string): boolean {
    const activeExecution = this.activeExecutions.get(nodeId);
    if (!activeExecution) {
      return false;
    }

    this.requestProcessStop(activeExecution, 'interrupt');
    return true;
  }

  protected async resolveRunnerConfig(
    project: Project,
    task: Task,
    node: TaskNode,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): Promise<AgentExecutionConfig> {
    return this.configResolver.resolveRunnerConfig(
      project,
      task,
      node,
      runtimeContext,
    );
  }

  protected resolvePrompt(
    task: Task,
    node: TaskNode,
    project: Project,
    config: Pick<
      AgentExecutionConfig,
      'adapter' | 'agentToolConfigId' | 'agentToolConfigName'
    >,
    runtimeContext?: PromptTemplateRuntimeContext,
    dependencyStatusReportText?: string,
  ): string {
    return this.configResolver.resolvePrompt(
      task,
      node,
      project,
      config,
      runtimeContext,
      dependencyStatusReportText,
    );
  }

  protected extractAgentSessionId(content: string): string | null {
    return this.configResolver.extractAgentSessionId(content);
  }

  protected async resolveContainerExecRefForTask(
    task: Task,
  ): Promise<string | null> {
    if (!this.containerExecutionConfig || !this.isolatedRunnerContainer) {
      return null;
    }

    const containerName =
      this.containerExecutionConfig.resolveContainerName(task);
    const inspection =
      await this.isolatedRunnerContainer.inspect(containerName);
    return inspection?.running ? inspection.id : null;
  }

  protected async runWithConfig(
    config: AgentExecutionConfig,
    prompt: string,
    executionContext: AgentExecutionContext,
    callbacks?: AgentExecutionStreamCallbacks,
    containerExecRef?: string,
  ): Promise<AgentExecutionResult> {
    const startAt = Date.now();
    const cliAdapter = this.agentCliAdapterRegistry.getById(config.adapter);

    let stdout = '';
    let stderr = '';
    let stdoutLineBuffer = '';
    let stderrLineBuffer = '';
    let stdoutChunkCount = 0;
    let stderrChunkCount = 0;
    let stdoutByteLength = 0;
    let stderrByteLength = 0;
    let interrupted = false;
    let extractedSessionId: string | null = null;

    const captureStdoutLine = (line: string): void => {
      extractedSessionId ??= cliAdapter.extractSessionId(line);
      callbacks?.onStdoutLine?.(line);
    };
    const captureStderrLine = (line: string): void => {
      extractedSessionId ??= cliAdapter.extractSessionId(line);
      callbacks?.onStderrLine?.(line);
    };

    try {
      const mergedEnv = this.buildRunnerEnvironment(config.env);
      const spawnArgs =
        config.adapter === 'cursor' ? [...config.args, prompt] : config.args;

      this.logger.log(
        `runner_agent_spawn ${JSON.stringify(
          this.buildExecutionLogPayload({
            executionContext,
            config,
            prompt,
            mergedEnv,
          }),
        )}`,
      );

      const useDockerExec =
        !!containerExecRef &&
        !!this.containerExecutionConfig &&
        !!this.dockerExecProcessLauncher;

      if (!useDockerExec) {
        const missingReasons: string[] = [];
        if (!containerExecRef) {
          missingReasons.push('containerExecRef is missing');
        }
        if (!this.containerExecutionConfig) {
          missingReasons.push('ContainerExecutionConfigService is unavailable');
        }
        if (!this.dockerExecProcessLauncher) {
          missingReasons.push(
            'DockerExecProcessLauncherService is unavailable',
          );
        }
        throw new Error(
          `Runner execution requires docker exec handoff, but ${missingReasons.join(', ') || 'the task container is not runnable'} (taskId=${executionContext.taskId}, nodeId=${executionContext.nodeId}, cwd=${config.cwd})`,
        );
      }

      const childProcess = this.dockerExecProcessLauncher!.spawn({
        containerRef: containerExecRef,
        command: config.command,
        args: spawnArgs,
        cwd:
          config.runnerContainerCwd ??
          this.containerExecutionConfig!.getRunnerWorkspace(),
        env: this.buildDockerExecEnvironment(config.env),
      });
      const activeExecution: ActiveAgentExecution = {
        childProcess,
        stopReason: null,
        killTimerRef: null,
      };
      this.activeExecutions.set(executionContext.nodeId, activeExecution);

      childProcess.stdout?.on('data', (chunk: Buffer | string) => {
        const chunkText = this.toChunkText(chunk);
        callbacks?.onStdoutChunk?.(chunkText);
        stdout = this.concatWithLimit(stdout, chunkText);
        const stdoutConsumeResult = this.consumeStreamChunkLines(
          stdoutLineBuffer,
          chunkText,
          captureStdoutLine,
        );
        stdoutLineBuffer = stdoutConsumeResult.remainingBuffer;
        stdoutChunkCount += 1;
        stdoutByteLength += Buffer.byteLength(chunkText, 'utf-8');

        if (stdoutChunkCount === 1) {
          this.logger.debug(
            `runner_agent_stdout_first_chunk ${JSON.stringify(
              this.buildChunkLogPayload({
                executionContext,
                stream: 'stdout',
                chunkText,
              }),
            )}`,
          );
        }
      });

      childProcess.stderr?.on('data', (chunk: Buffer | string) => {
        const chunkText = this.toChunkText(chunk);
        callbacks?.onStderrChunk?.(chunkText);
        stderr = this.concatWithLimit(stderr, chunkText);
        const stderrConsumeResult = this.consumeStreamChunkLines(
          stderrLineBuffer,
          chunkText,
          captureStderrLine,
        );
        stderrLineBuffer = stderrConsumeResult.remainingBuffer;
        stderrChunkCount += 1;
        stderrByteLength += Buffer.byteLength(chunkText, 'utf-8');

        if (stderrChunkCount === 1) {
          this.logger.warn(
            `runner_agent_stderr_first_chunk ${JSON.stringify(
              this.buildChunkLogPayload({
                executionContext,
                stream: 'stderr',
                chunkText,
              }),
            )}`,
          );
        }
      });

      if (config.adapter !== 'cursor') {
        childProcess.stdin?.write(prompt);
        childProcess.stdin?.end();
      }

      const closeResult = await new Promise<{
        exitCode: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve, reject) => {
        childProcess.once('error', (error) => {
          this.logger.error(
            `runner_agent_process_error ${JSON.stringify(
              this.buildResultLogPayload({
                executionContext,
                config,
                durationMs: Date.now() - startAt,
                stdout,
                stderr,
                stdoutChunkCount,
                stderrChunkCount,
                stdoutByteLength,
                stderrByteLength,
                errorMessage: error.message,
              }),
            )}`,
          );
          reject(error);
        });

        childProcess.once('close', (exitCode, signal) => {
          resolve({
            exitCode,
            signal,
          });
        });
      });

      this.clearForcedKillTimer(activeExecution);
      this.flushTrailingStreamBuffer(stdoutLineBuffer, captureStdoutLine);
      this.flushTrailingStreamBuffer(stderrLineBuffer, captureStderrLine);

      extractedSessionId ??= cliAdapter.extractSessionId(stdout);
      extractedSessionId ??= cliAdapter.extractSessionId(stderr);

      const durationMs = Date.now() - startAt;
      interrupted = activeExecution.stopReason === 'interrupt';
      const success = !interrupted && closeResult.exitCode === 0;
      const resultLogPayload = this.buildResultLogPayload({
        executionContext,
        config,
        durationMs,
        stdout,
        stderr,
        stdoutChunkCount,
        stderrChunkCount,
        stdoutByteLength,
        stderrByteLength,
        interrupted,
        exitCode: closeResult.exitCode,
        signal: closeResult.signal,
      });

      if (success) {
        this.logger.log(
          `runner_agent_completed ${JSON.stringify(resultLogPayload)}`,
        );
      } else {
        this.logger.warn(
          `runner_agent_failed ${JSON.stringify(resultLogPayload)}`,
        );
      }

      return {
        success,
        interrupted,
        exitCode: closeResult.exitCode,
        signal: closeResult.signal,
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        durationMs,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        prompt,
        sessionId: extractedSessionId,
        ...(success
          ? {}
          : {
              errorMessage: interrupted
                ? 'Agent execution interrupted'
                : `Agent execution exited with code ${closeResult.exitCode ?? 'null'}`,
            }),
      };
    } catch (error) {
      const activeExecution = this.activeExecutions.get(
        executionContext.nodeId,
      );
      if (activeExecution) {
        interrupted = activeExecution.stopReason === 'interrupt';
        this.clearForcedKillTimer(activeExecution);
      }

      this.flushTrailingStreamBuffer(stdoutLineBuffer, captureStdoutLine);
      this.flushTrailingStreamBuffer(stderrLineBuffer, captureStderrLine);

      extractedSessionId ??= cliAdapter.extractSessionId(stdout);
      extractedSessionId ??= cliAdapter.extractSessionId(stderr);

      const durationMs = Date.now() - startAt;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to execute runner agent process';
      this.logger.error(
        `runner_agent_exception ${JSON.stringify(
          this.buildResultLogPayload({
            executionContext,
            config,
            durationMs,
            stdout,
            stderr,
            stdoutChunkCount,
            stderrChunkCount,
            stdoutByteLength,
            stderrByteLength,
            interrupted,
            errorMessage,
          }),
        )}`,
      );

      return {
        success: false,
        interrupted,
        exitCode: null,
        signal: null,
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        durationMs,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        prompt,
        sessionId: extractedSessionId,
        errorMessage,
      };
    } finally {
      const activeExecution = this.activeExecutions.get(
        executionContext.nodeId,
      );
      if (activeExecution) {
        this.clearForcedKillTimer(activeExecution);
        this.activeExecutions.delete(executionContext.nodeId);
      }
    }
  }

  private async prepareExecution(
    project: Project,
    task: Task,
    node: TaskNode,
    runtimeContext: PromptTemplateRuntimeContext | undefined,
    callbacks: AgentExecutionStreamCallbacks | undefined,
    additionalRunnerEnv?: Record<string, string>,
  ): Promise<{
    config: AgentExecutionConfig;
    prompt: string;
  }> {
    const resolved = await this.resolveRunnerConfig(
      project,
      task,
      node,
      runtimeContext,
    );
    const config: AgentExecutionConfig = {
      ...resolved,
      env: {
        ...resolved.env,
        ...(additionalRunnerEnv ?? {}),
      },
    };
    const depReportText =
      await this.configResolver.buildDependencyStatusReportForNode(
        task,
        node,
        runtimeContext,
      );
    let prompt = this.resolvePrompt(
      task,
      node,
      project,
      config,
      runtimeContext,
      depReportText,
    );
    if (this.memoryHost) {
      const memoryBlock = await this.memoryHost.buildInjectBlock({
        projectId: project.id,
        taskId: task.id,
        nodeId: node.id,
        taskTitle: task.title,
        nodeName: node.name,
        userIntentSummary: (task.prompt ?? '').trim().slice(0, 800),
        taskPromptExcerpt: task.prompt?.trim().slice(0, 500),
        recentTurnsSummary: undefined,
      });
      if (memoryBlock.trim()) {
        prompt = `${prompt}\n\n${memoryBlock}`;
      }
    }
    await callbacks?.onPrepared?.({
      adapter: config.adapter,
      prompt,
      preparedAt: new Date(),
    });

    return {
      config,
      prompt,
    };
  }

  private shouldFallbackCodexInvalidResume({
    node,
    config,
    result,
  }: {
    node: TaskNode;
    config: AgentExecutionConfig;
    result: AgentExecutionResult;
  }): boolean {
    if (
      config.adapter !== 'codex' ||
      !config.args.includes('resume') ||
      !this.normalizeOptionalString(node.agentCliSessionId) ||
      result.success ||
      result.interrupted
    ) {
      return false;
    }

    const diagnostic = `${result.stderr}\n${result.errorMessage ?? ''}`;
    return this.isInvalidCodexResumeError(diagnostic);
  }

  private isInvalidCodexResumeError(value: string): boolean {
    const normalizedValue = value.toLowerCase();
    return (
      normalizedValue.includes('thread/resume failed') &&
      normalizedValue.includes('no rollout found for thread id')
    );
  }

  private requestProcessStop(
    activeExecution: ActiveAgentExecution,
    reason: 'interrupt',
  ): void {
    if (activeExecution.stopReason) {
      return;
    }

    activeExecution.stopReason = reason;

    try {
      activeExecution.childProcess.kill('SIGTERM');
    } catch {
      return;
    }

    activeExecution.killTimerRef = setTimeout(() => {
      try {
        activeExecution.childProcess.kill('SIGKILL');
      } catch {
        return;
      }
    }, this.forcedKillDelayMs);
    activeExecution.killTimerRef.unref?.();
  }

  private clearForcedKillTimer(activeExecution: ActiveAgentExecution): void {
    if (!activeExecution.killTimerRef) {
      return;
    }

    clearTimeout(activeExecution.killTimerRef);
    activeExecution.killTimerRef = null;
  }

  private normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private consumeStreamChunkLines(
    currentBuffer: string,
    chunkText: string,
    onLine?: (line: string) => void,
  ): { remainingBuffer: string } {
    if (!onLine) {
      return {
        remainingBuffer: currentBuffer,
      };
    }

    const combined = `${currentBuffer}${chunkText}`;
    const normalized = combined.replace(/\r\n/g, '\n');
    const segments = normalized.split('\n');
    const remainingBuffer = segments.pop() ?? '';

    for (const segment of segments) {
      const line = segment.trim();
      if (!line) {
        continue;
      }

      onLine(line);
    }

    return {
      remainingBuffer,
    };
  }

  private flushTrailingStreamBuffer(
    buffer: string,
    onLine?: (line: string) => void,
  ): void {
    if (!onLine) {
      return;
    }

    const line = buffer.trim();
    if (!line) {
      return;
    }

    onLine(line);
  }

  private buildRunnerEnvironment(
    envOverrides: Record<string, string>,
  ): NodeJS.ProcessEnv {
    const baseEnv = this.pickBaseRunnerEnvironment([
      'PATH',
      'HOME',
      'USER',
      'SHELL',
      'TMPDIR',
      'TMP',
      'TEMP',
      'LANG',
      'LC_ALL',
      'TERM',
      'GEMINI_API_KEY',
    ]);

    return {
      ...baseEnv,
      ...envOverrides,
    };
  }

  private buildDockerExecEnvironment(
    envOverrides: Record<string, string>,
  ): NodeJS.ProcessEnv {
    const baseEnv = this.pickBaseRunnerEnvironment([
      'LANG',
      'LC_ALL',
      'TERM',
      'GEMINI_API_KEY',
    ]);

    return {
      ...baseEnv,
      ...envOverrides,
    };
  }

  private pickBaseRunnerEnvironment(keys: string[]): NodeJS.ProcessEnv {
    return keys.reduce<NodeJS.ProcessEnv>((result, key) => {
      const value = this.configService.get<string>(key, { infer: true });
      if (value) {
        result[key] = value;
      }
      return result;
    }, {});
  }

  private buildExecutionLogPayload({
    executionContext,
    config,
    prompt,
    mergedEnv,
  }: {
    executionContext: AgentExecutionContext;
    config: AgentExecutionConfig;
    prompt: string;
    mergedEnv: NodeJS.ProcessEnv;
  }): Record<string, unknown> {
    return {
      ...executionContext,
      adapter: config.adapter,
      command: config.command,
      args: summarizeAgentCliArgsForLog(config.args),
      cwd: config.cwd,
      promptLength: prompt.length,
      envKeys: Object.keys(mergedEnv)
        .filter((key) => typeof mergedEnv[key] === 'string')
        .sort(),
      hasCursorApiKey:
        typeof mergedEnv.CURSOR_API_KEY === 'string' &&
        mergedEnv.CURSOR_API_KEY.length > 0,
    };
  }

  private buildChunkLogPayload({
    executionContext,
    stream,
    chunkText,
  }: {
    executionContext: AgentExecutionContext;
    stream: 'stdout' | 'stderr';
    chunkText: string;
  }): Record<string, unknown> {
    return {
      ...executionContext,
      stream,
      chunkLength: chunkText.length,
      preview: this.truncateForLog(chunkText),
    };
  }

  private buildResultLogPayload({
    executionContext,
    config,
    durationMs,
    stdout,
    stderr,
    stdoutChunkCount,
    stderrChunkCount,
    stdoutByteLength,
    stderrByteLength,
    interrupted,
    exitCode,
    signal,
    errorMessage,
  }: {
    executionContext: AgentExecutionContext;
    config: AgentExecutionConfig;
    durationMs: number;
    stdout: string;
    stderr: string;
    stdoutChunkCount: number;
    stderrChunkCount: number;
    stdoutByteLength: number;
    stderrByteLength: number;
    interrupted?: boolean;
    exitCode?: number | null;
    signal?: NodeJS.Signals | null;
    errorMessage?: string;
  }): Record<string, unknown> {
    return {
      ...executionContext,
      adapter: config.adapter,
      command: config.command,
      args: summarizeAgentCliArgsForLog(config.args),
      cwd: config.cwd,
      durationMs,
      interrupted: interrupted ?? false,
      exitCode: exitCode ?? null,
      signal: signal ?? null,
      stdoutChunkCount,
      stderrChunkCount,
      stdoutByteLength,
      stderrByteLength,
      stdoutJsonLineCount: this.countJsonLines(stdout),
      stderrPreview: this.truncateForLog(stderr),
      stdoutPreview: this.truncateForLog(stdout),
      errorMessage: errorMessage ?? null,
    };
  }

  private countJsonLines(value: string): number {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => this.isJsonLine(line)).length;
  }

  private isJsonLine(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  private truncateForLog(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
  }

  private concatWithLimit(current: string, next: string): string {
    if (!next) {
      return current;
    }

    const merged = current + next;
    if (merged.length <= this.maxOutputLength) {
      return merged;
    }

    return merged.slice(merged.length - this.maxOutputLength);
  }

  private toChunkText(chunk: Buffer | string): string {
    if (typeof chunk === 'string') {
      return chunk;
    }

    return chunk.toString('utf-8');
  }
}
