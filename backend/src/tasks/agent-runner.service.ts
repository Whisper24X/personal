import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import path from 'path';
import { Project } from '../projects/domain/project';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';

type AgentAdapter = 'codex' | 'cursor' | 'claude';

type AgentRunnerConfig = {
  adapter: AgentAdapter;
  command: string;
  args: string[];
  timeoutMs: number;
  cwd: string;
  env: Record<string, string>;
};

export type AgentRunnerResult = {
  success: boolean;
  timedOut: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  command: string;
  args: string[];
  cwd: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  prompt: string;
  errorMessage?: string;
};

@Injectable()
export class AgentRunnerService {
  private readonly defaultTimeoutMs = 10 * 60 * 1000;
  private readonly maxOutputLength = 100_000;
  private readonly defaultWorktreeBaseDir = path.resolve(
    process.cwd(),
    'tmp',
    'worktrees',
  );

  async executeAgentNode({
    task,
    node,
    project,
  }: {
    task: Task;
    node: TaskNode;
    project: Project;
  }): Promise<AgentRunnerResult> {
    if (!this.isAgentRunnerEnabled(project)) {
      return this.buildSimulatedResult(task, node);
    }

    const prompt = this.resolvePrompt(task, node);
    const config = this.resolveRunnerConfig(project, task, node);
    return this.runWithConfig(config, prompt);
  }

  private isAgentRunnerEnabled(project: Project): boolean {
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};

    if (typeof configJson.agentRunnerEnabled === 'boolean') {
      return configJson.agentRunnerEnabled;
    }

    return process.env.AINATIVE_AGENT_RUNNER_ENABLED === 'true';
  }

  private buildSimulatedResult(task: Task, node: TaskNode): AgentRunnerResult {
    const prompt = this.resolvePrompt(task, node);

    return {
      success: true,
      timedOut: false,
      exitCode: 0,
      signal: null,
      command: 'simulated-agent',
      args: [],
      cwd: task.gitWorktreePath?.trim() || process.cwd(),
      durationMs: 10,
      stdout: 'Agent runner disabled; simulated execution completed.',
      stderr: '',
      prompt,
    };
  }

  private resolveRunnerConfig(
    project: Project,
    task: Task,
    node: TaskNode,
  ): AgentRunnerConfig {
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};

    const adapter = this.resolveAdapter(configJson);
    const runnerConfig = this.readRunnerConfig(configJson);

    const command =
      runnerConfig.command?.trim() || this.resolveDefaultCommand(adapter);
    const args = runnerConfig.args ?? this.resolveDefaultArgs(adapter);
    const timeoutMs = Math.max(
      5_000,
      Math.floor(
        (runnerConfig.timeoutSeconds ?? this.defaultTimeoutMs / 1000) * 1000,
      ),
    );

    const env: Record<string, string> = {
      ...(runnerConfig.env ? this.resolveStringEnv(runnerConfig.env) : {}),
      AINATIVE_TASK_ID: task.id,
      AINATIVE_PROJECT_ID: project.id,
      AINATIVE_NODE_ID: node.id,
      AINATIVE_AGENT_ADAPTER: adapter,
    };

    const cwd = this.resolveRunnerCwd(task, project);

    return {
      adapter,
      command,
      args,
      timeoutMs,
      cwd,
      env,
    };
  }

  private resolveRunnerCwd(task: Task, project: Project): string {
    if (!task.gitWorktreePath?.trim()) {
      return process.cwd();
    }

    const cwd = path.resolve(task.gitWorktreePath.trim());
    const allowedRoot = this.resolveWorktreeAllowedRoot(project);

    if (!this.isPathWithinAllowedRoot(cwd, allowedRoot)) {
      throw new Error(
        `Task worktree path ${cwd} is outside allowed root ${allowedRoot}`,
      );
    }

    return cwd;
  }

  private resolveWorktreeAllowedRoot(project: Project): string {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.worktreeAllowedRoot === 'string' &&
      config.worktreeAllowedRoot.trim()
    ) {
      return path.resolve(config.worktreeAllowedRoot.trim());
    }

    if (process.env.AINATIVE_WORKTREE_ALLOWED_ROOT?.trim()) {
      return path.resolve(process.env.AINATIVE_WORKTREE_ALLOWED_ROOT.trim());
    }

    if (
      typeof config.worktreeBaseDir === 'string' &&
      config.worktreeBaseDir.trim()
    ) {
      return path.resolve(config.worktreeBaseDir.trim());
    }

    if (process.env.AINATIVE_WORKTREE_BASE_DIR?.trim()) {
      return path.resolve(process.env.AINATIVE_WORKTREE_BASE_DIR.trim());
    }

    return this.defaultWorktreeBaseDir;
  }

  private isPathWithinAllowedRoot(
    targetPath: string,
    allowedRoot: string,
  ): boolean {
    const normalizedRoot = path.resolve(allowedRoot);
    const normalizedTarget = path.resolve(targetPath);
    const relativePath = path.relative(normalizedRoot, normalizedTarget);

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  private readRunnerConfig(configJson: Record<string, unknown>): {
    command?: string;
    args?: string[];
    timeoutSeconds?: number;
    env?: Record<string, string>;
  } {
    const runner = configJson.agentRunner;

    if (!runner || typeof runner !== 'object') {
      return {};
    }

    const rawRunner = runner as Record<string, unknown>;

    const args = Array.isArray(rawRunner.args)
      ? rawRunner.args
          .filter((item) => typeof item === 'string')
          .map((item) => String(item))
      : undefined;

    return {
      command:
        typeof rawRunner.command === 'string' ? rawRunner.command : undefined,
      args: args?.length ? args : undefined,
      timeoutSeconds:
        typeof rawRunner.timeoutSeconds === 'number'
          ? rawRunner.timeoutSeconds
          : undefined,
      env:
        rawRunner.env && typeof rawRunner.env === 'object'
          ? this.resolveStringEnv(rawRunner.env as Record<string, unknown>)
          : undefined,
    };
  }

  private resolveStringEnv(
    input: Record<string, unknown> | Record<string, string>,
  ): Record<string, string> {
    return Object.entries(input).reduce<Record<string, string>>(
      (result, [key, value]) => {
        if (typeof value === 'string') {
          result[key] = value;
        }
        return result;
      },
      {},
    );
  }

  private resolveAdapter(configJson: Record<string, unknown>): AgentAdapter {
    const rawAdapter = configJson.agentAdapter;

    if (
      rawAdapter === 'codex' ||
      rawAdapter === 'cursor' ||
      rawAdapter === 'claude'
    ) {
      return rawAdapter;
    }

    return 'codex';
  }

  private resolveDefaultCommand(adapter: AgentAdapter): string {
    const envCommandMap: Record<AgentAdapter, string | undefined> = {
      codex: process.env.AINATIVE_CODEX_RUNNER_COMMAND,
      cursor: process.env.AINATIVE_CURSOR_RUNNER_COMMAND,
      claude: process.env.AINATIVE_CLAUDE_RUNNER_COMMAND,
    };

    const envCommand = envCommandMap[adapter];
    if (envCommand && envCommand.trim()) {
      return envCommand.trim();
    }

    const defaultCommandMap: Record<AgentAdapter, string> = {
      codex: 'codex',
      cursor: 'cursor-agent',
      claude: 'claude',
    };

    return defaultCommandMap[adapter];
  }

  private resolveDefaultArgs(adapter: AgentAdapter): string[] {
    const defaultArgsMap: Record<AgentAdapter, string[]> = {
      codex: ['exec', '--skip-git-repo-check', '-'],
      cursor: [],
      claude: ['-p'],
    };

    return defaultArgsMap[adapter];
  }

  private resolvePrompt(task: Task, node: TaskNode): string {
    const input =
      node.input && typeof node.input === 'object'
        ? (node.input as Record<string, unknown>)
        : {};

    const nodePrompt =
      typeof input.prompt === 'string' && input.prompt.trim()
        ? input.prompt.trim()
        : typeof input.instructions === 'string' && input.instructions.trim()
          ? input.instructions.trim()
          : '';

    const acceptanceCriteria = Array.isArray(task.acceptanceCriteria)
      ? task.acceptanceCriteria
      : [];

    const acceptanceText = acceptanceCriteria.length
      ? acceptanceCriteria
          .map((item, index) => `- [ ] ${index + 1}. ${String(item)}`)
          .join('\n')
      : '';

    const sections = [
      nodePrompt,
      `Task Title: ${task.title}`,
      task.description ? `Task Description:\n${task.description}` : '',
      acceptanceText ? `Acceptance Criteria:\n${acceptanceText}` : '',
      `Node Name: ${node.name}`,
      `Node Order: ${node.nodeOrder}`,
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  private async runWithConfig(
    config: AgentRunnerConfig,
    prompt: string,
  ): Promise<AgentRunnerResult> {
    const startAt = Date.now();

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timeoutRef: NodeJS.Timeout | null = null;
    let killTimerRef: NodeJS.Timeout | null = null;

    try {
      const mergedEnv = this.buildRunnerEnvironment(config.env);

      const childProcess = spawn(config.command, config.args, {
        cwd: config.cwd,
        env: mergedEnv,
        stdio: 'pipe',
      });

      childProcess.stdout?.on('data', (chunk: Buffer | string) => {
        stdout = this.concatWithLimit(stdout, this.toChunkText(chunk));
      });

      childProcess.stderr?.on('data', (chunk: Buffer | string) => {
        stderr = this.concatWithLimit(stderr, this.toChunkText(chunk));
      });

      timeoutRef = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');

        killTimerRef = setTimeout(() => {
          childProcess.kill('SIGKILL');
        }, 2_000);
      }, config.timeoutMs);

      childProcess.stdin?.write(prompt);
      childProcess.stdin?.end();

      const closeResult = await new Promise<{
        exitCode: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve, reject) => {
        childProcess.once('error', (error) => {
          reject(error);
        });

        childProcess.once('close', (exitCode, signal) => {
          resolve({
            exitCode,
            signal,
          });
        });
      });

      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      if (killTimerRef) {
        clearTimeout(killTimerRef);
      }

      const durationMs = Date.now() - startAt;
      const success = !timedOut && closeResult.exitCode === 0;

      return {
        success,
        timedOut,
        exitCode: closeResult.exitCode,
        signal: closeResult.signal,
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        durationMs,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        prompt,
        ...(success
          ? {}
          : {
              errorMessage: timedOut
                ? `Agent execution timed out after ${Math.floor(config.timeoutMs / 1000)}s`
                : `Agent execution exited with code ${closeResult.exitCode ?? 'null'}`,
            }),
      };
    } catch (error) {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      if (killTimerRef) {
        clearTimeout(killTimerRef);
      }

      return {
        success: false,
        timedOut,
        exitCode: null,
        signal: null,
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        durationMs: Date.now() - startAt,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        prompt,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to execute agent runner process',
      };
    }
  }

  private buildRunnerEnvironment(
    envOverrides: Record<string, string>,
  ): NodeJS.ProcessEnv {
    const allowedBaseEnvKeys = [
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
    ];
    const baseEnv = allowedBaseEnvKeys.reduce<NodeJS.ProcessEnv>(
      (result, key) => {
        const value = process.env[key];

        if (value) {
          result[key] = value;
        }

        return result;
      },
      {},
    );

    return {
      ...baseEnv,
      ...envOverrides,
    };
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
