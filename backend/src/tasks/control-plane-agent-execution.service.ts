import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Project } from '../projects/domain/project';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';
import { TaskMode } from './dto/task-mode.enum';
import { TaskStatus } from './dto/task-status.enum';
import { AgentExecutionConfigResolverService } from './agent-execution-config-resolver.service';
import {
  AgentExecutionConfig,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentExecutionStreamCallbacks,
} from './agent-execution.types';
import { LocalProcessLauncherService } from './local-process-launcher.service';
import { PromptTemplateRuntimeContext } from './prompt-template.service';

@Injectable()
export class ControlPlaneAgentExecutionService {
  private readonly logger = new Logger(ControlPlaneAgentExecutionService.name);
  private readonly maxOutputLength = 100_000;

  constructor(
    private readonly configResolver: AgentExecutionConfigResolverService,
    private readonly localProcessLauncher: LocalProcessLauncherService,
    private readonly configService: ConfigService = new ConfigService(),
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry = new AgentCliAdapterRegistry(),
  ) {}

  async executeCustomPrompt({
    task,
    node,
    project,
    runtimeContext,
    prompt,
    callbacks,
  }: {
    task: Task;
    node: TaskNode;
    project: Project;
    runtimeContext?: PromptTemplateRuntimeContext;
    prompt: string;
    callbacks?: AgentExecutionStreamCallbacks;
  }): Promise<AgentExecutionResult> {
    const config = await this.configResolver.resolveExecutionConfig(
      project,
      task,
      node,
      runtimeContext,
    );
    await callbacks?.onPrepared?.({
      adapter: config.adapter,
      prompt,
      preparedAt: new Date(),
    });

    return this.runWithConfig(
      config,
      prompt,
      {
        taskId: task.id,
        nodeId: node.id,
        projectId: project.id,
        businessLineId: project.businessLineId,
      },
      callbacks,
    );
  }

  async executeProjectPrompt({
    project,
    repositoryRoot,
    prompt,
    agentCliId,
    agentCliConfigId,
    callbacks,
  }: {
    project: Project;
    repositoryRoot: string;
    prompt: string;
    agentCliId?: string;
    agentCliConfigId?: string;
    callbacks?: AgentExecutionStreamCallbacks;
  }): Promise<AgentExecutionResult> {
    const now = new Date();
    const taskId = `control-plane-${randomUUID()}`;
    const nodeId = randomUUID();
    const syntheticTask: Task = {
      id: taskId,
      projectId: project.id,
      businessLineId: project.businessLineId,
      goalId: null,
      mode: TaskMode.conversation,
      title: 'Control plane agent execution',
      prompt: null,
      status: TaskStatus.todo,
      gitBranch: null,
      gitBaseBranch: null,
      gitWorktree: null,
      configJson: null,
      createdBy: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const syntheticNode: TaskNode = {
      id: nodeId,
      taskId,
      nodeOrder: 1,
      name: 'control-plane-agent-node',
      input: null,
      agentClioutput: null,
      agentCliSessionId: null,
      agentCliId: agentCliId?.trim() || null,
      agentCliConfigId: agentCliConfigId?.trim() || null,
      configJson: null,
      loopJson: null,
      runtimeJson: null,
      status: TaskStatus.todo,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.executeCustomPrompt({
      task: syntheticTask,
      node: syntheticNode,
      project,
      runtimeContext: { gitWorktreePath: repositoryRoot },
      prompt,
      callbacks,
    });
  }

  private async runWithConfig(
    config: AgentExecutionConfig,
    prompt: string,
    executionContext: AgentExecutionContext,
    callbacks?: AgentExecutionStreamCallbacks,
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
      const mergedEnv = this.buildLocalEnvironment(config.env);
      const spawnArgs =
        config.adapter === 'cursor' ? [...config.args, prompt] : config.args;

      this.logger.log(
        `control_plane_agent_spawn ${JSON.stringify(
          this.buildExecutionLogPayload({
            executionContext,
            config,
            prompt,
            mergedEnv,
          }),
        )}`,
      );

      const childProcess = this.localProcessLauncher.spawn({
        command: config.command,
        args: spawnArgs,
        cwd: config.cwd,
        env: mergedEnv,
      });

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
            `control_plane_agent_stdout_first_chunk ${JSON.stringify(
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
            `control_plane_agent_stderr_first_chunk ${JSON.stringify(
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
            `control_plane_agent_process_error ${JSON.stringify(
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

      this.flushTrailingStreamBuffer(stdoutLineBuffer, captureStdoutLine);
      this.flushTrailingStreamBuffer(stderrLineBuffer, captureStderrLine);

      extractedSessionId ??= cliAdapter.extractSessionId(stdout);
      extractedSessionId ??= cliAdapter.extractSessionId(stderr);

      const durationMs = Date.now() - startAt;
      const success = closeResult.exitCode === 0;
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
        exitCode: closeResult.exitCode,
        signal: closeResult.signal,
      });

      if (success) {
        this.logger.log(
          `control_plane_agent_completed ${JSON.stringify(resultLogPayload)}`,
        );
      } else {
        this.logger.warn(
          `control_plane_agent_failed ${JSON.stringify(resultLogPayload)}`,
        );
      }

      return {
        success,
        interrupted: false,
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
              errorMessage: `Agent execution exited with code ${closeResult.exitCode ?? 'null'}`,
            }),
      };
    } catch (error) {
      this.flushTrailingStreamBuffer(stdoutLineBuffer, captureStdoutLine);
      this.flushTrailingStreamBuffer(stderrLineBuffer, captureStderrLine);

      extractedSessionId ??= cliAdapter.extractSessionId(stdout);
      extractedSessionId ??= cliAdapter.extractSessionId(stderr);

      const durationMs = Date.now() - startAt;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to execute control plane agent process';
      this.logger.error(
        `control_plane_agent_exception ${JSON.stringify(
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
            errorMessage,
          }),
        )}`,
      );

      return {
        success: false,
        interrupted: false,
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
    }
  }

  private buildLocalEnvironment(
    envOverrides: Record<string, string>,
  ): NodeJS.ProcessEnv {
    const baseEnv = this.pickBaseEnvironment([
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

  private pickBaseEnvironment(keys: string[]): NodeJS.ProcessEnv {
    return keys.reduce<NodeJS.ProcessEnv>((result, key) => {
      const value = this.configService.get<string>(key, { infer: true });
      if (value) {
        result[key] = value;
      }
      return result;
    }, {});
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
      args: config.args,
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
    exitCode?: number | null;
    signal?: NodeJS.Signals | null;
    errorMessage?: string;
  }): Record<string, unknown> {
    return {
      ...executionContext,
      adapter: config.adapter,
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      durationMs,
      interrupted: false,
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
