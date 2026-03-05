import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import path from 'path';
import { AgentToolConfig } from '../business-lines/domain/agent-tool-config';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { Project } from '../projects/domain/project';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';

type AgentAdapter = 'codex' | 'cursor' | 'claude' | 'gemini' | 'opencode';

type AgentRunnerConfig = {
  adapter: AgentAdapter;
  command: string;
  args: string[];
  timeoutMs: number;
  cwd: string;
  env: Record<string, string>;
};

type RunnerConfigInput = {
  command?: string;
  args?: string[];
  timeoutSeconds?: number;
  env?: Record<string, string>;
};

type AgentToolConfigEntry = {
  id?: string;
  name?: string;
  adapter: AgentAdapter;
  businessLineId?: string;
  isDefault: boolean;
  config: Record<string, unknown>;
};

type ResolvedAgentToolConfig = {
  runnerConfig: RunnerConfigInput;
  configId?: string;
  configName?: string;
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
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );
  private readonly toolConfigAllowedKeys: Record<AgentAdapter, Set<string>> = {
    codex: new Set([
      'command',
      'args',
      'timeoutSeconds',
      'timeout_seconds',
      'base_command_override',
      'additional_params',
      'env',
    ]),
    cursor: new Set([
      'command',
      'args',
      'timeoutSeconds',
      'timeout_seconds',
      'base_command_override',
      'additional_params',
      'env',
    ]),
    claude: new Set([
      'command',
      'args',
      'timeoutSeconds',
      'timeout_seconds',
      'base_command_override',
      'additional_params',
      'env',
    ]),
    gemini: new Set([
      'command',
      'args',
      'timeoutSeconds',
      'timeout_seconds',
      'base_command_override',
      'additional_params',
      'env',
    ]),
    opencode: new Set([
      'command',
      'args',
      'timeoutSeconds',
      'timeout_seconds',
      'base_command_override',
      'additional_params',
      'env',
    ]),
  };

  constructor(
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly configService: ConfigService = new ConfigService(),
  ) {}

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
    const config = await this.resolveRunnerConfig(project, task, node);
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

    return this.readTrimmedEnv('AINATIVE_AGENT_RUNNER_ENABLED') === 'true';
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
      cwd: task.gitWorktree?.trim() || process.cwd(),
      durationMs: 10,
      stdout: 'Agent runner disabled; simulated execution completed.',
      stderr: '',
      prompt,
    };
  }

  private async resolveRunnerConfig(
    project: Project,
    task: Task,
    node: TaskNode,
  ): Promise<AgentRunnerConfig> {
    const taskToolConfig = this.resolveTaskToolConfig(task);
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};

    const adapter = this.resolveAdapter({
      ...configJson,
      ...taskToolConfig,
    });
    const baseRunnerConfig = this.readRunnerConfig(configJson);
    const agentToolConfig = await this.resolveAgentToolConfig(
      configJson,
      task,
      project,
      adapter,
    );
    const runnerConfigFromTool = this.mergeRunnerConfig(
      baseRunnerConfig,
      agentToolConfig?.runnerConfig,
    );
    const runnerConfig = runnerConfigFromTool;

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
      AINATIVE_BUSINESS_LINE_ID: project.businessLineId,
      AINATIVE_NODE_ID: node.id,
      AINATIVE_AGENT_ADAPTER: adapter,
      ...(agentToolConfig?.configId
        ? { AINATIVE_AGENT_TOOL_CONFIG_ID: agentToolConfig.configId }
        : {}),
      ...(agentToolConfig?.configName
        ? { AINATIVE_AGENT_TOOL_CONFIG_NAME: agentToolConfig.configName }
        : {}),
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
    if (!task.gitWorktree?.trim()) {
      return process.cwd();
    }

    const cwd = path.resolve(task.gitWorktree.trim());
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

    const worktreeAllowedRoot = this.readTrimmedEnv(
      'AINATIVE_WORKTREE_ALLOWED_ROOT',
    );
    if (worktreeAllowedRoot) {
      return path.resolve(worktreeAllowedRoot);
    }

    if (
      typeof config.worktreeBaseDir === 'string' &&
      config.worktreeBaseDir.trim()
    ) {
      return path.resolve(config.worktreeBaseDir.trim());
    }

    const worktreeBaseDir = this.readTrimmedEnv('AINATIVE_WORKTREE_BASE_DIR');
    if (worktreeBaseDir) {
      return path.resolve(worktreeBaseDir);
    }

    return this.resolveProjectWorktreeBaseDir(project);
  }

  private resolveProjectStorageBaseDir(project: Project): string {
    const businessLineId =
      project.businessLineId?.trim() || 'unknown-business-line';
    const projectId = project.id?.trim() || 'unknown-project';

    return path.resolve(
      this.defaultDataRootDir,
      businessLineId,
      'projects',
      projectId,
    );
  }

  private resolveProjectWorktreeBaseDir(project: Project): string {
    const businessLineId =
      project.businessLineId?.trim() || 'unknown-business-line';
    const projectId = project.id?.trim() || 'unknown-project';

    return path.resolve(
      this.defaultDataRootDir,
      businessLineId,
      'worktrees',
      projectId,
    );
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

  private resolveTaskToolConfig(task: Task): Record<string, unknown> {
    return {
      ...(task.cliToolId ? { cliToolId: task.cliToolId } : {}),
      ...(task.agentToolConfigId
        ? { agentToolConfigId: task.agentToolConfigId }
        : {}),
    };
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

    return this.readRunnerConfigFromRaw(runner as Record<string, unknown>);
  }

  private readRunnerConfigFromRaw(
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    const args =
      this.resolveStringArray(raw.args) ??
      this.resolveStringArray(raw.additional_params);

    const command =
      typeof raw.command === 'string'
        ? raw.command
        : typeof raw.base_command_override === 'string'
          ? raw.base_command_override
          : undefined;

    const timeoutSeconds = this.resolveTimeoutSeconds(
      raw.timeoutSeconds ?? raw.timeout_seconds,
    );

    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      command,
      args,
      timeoutSeconds,
      env,
    };
  }

  private resolveStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const parsed = value
      .filter((item) => typeof item === 'string')
      .map((item) => String(item).trim())
      .filter(Boolean);

    return parsed.length ? parsed : undefined;
  }

  private resolveTimeoutSeconds(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return undefined;
  }

  private mergeRunnerConfig(
    baseConfig: RunnerConfigInput,
    overrideConfig?: RunnerConfigInput,
  ): RunnerConfigInput {
    if (!overrideConfig) {
      return baseConfig;
    }

    const mergedEnv =
      baseConfig.env || overrideConfig.env
        ? {
            ...(baseConfig.env ?? {}),
            ...(overrideConfig.env ?? {}),
          }
        : undefined;

    return {
      command: overrideConfig.command ?? baseConfig.command,
      args: overrideConfig.args ?? baseConfig.args,
      timeoutSeconds:
        overrideConfig.timeoutSeconds ?? baseConfig.timeoutSeconds,
      env: mergedEnv,
    };
  }

  private async resolveAgentToolConfig(
    configJson: Record<string, unknown>,
    task: Task,
    project: Project,
    adapter: AgentAdapter,
  ): Promise<ResolvedAgentToolConfig | null> {
    const persistedById = await this.resolvePersistedAgentToolConfigById(
      configJson,
      task,
      project,
      adapter,
    );
    if (persistedById) {
      return persistedById;
    }

    const persistedDefault = await this.resolvePersistedDefaultAgentToolConfig(
      project,
      adapter,
    );
    if (persistedDefault) {
      return persistedDefault;
    }

    return this.resolveLegacyAgentToolConfig(configJson, project, adapter);
  }

  private async resolvePersistedAgentToolConfigById(
    configJson: Record<string, unknown>,
    task: Task,
    project: Project,
    adapter: AgentAdapter,
  ): Promise<ResolvedAgentToolConfig | null> {
    const requestedConfigId =
      this.normalizeOptionalString(task.agentToolConfigId) ??
      this.resolveAgentToolConfigId(configJson);

    if (!requestedConfigId) {
      return null;
    }

    const config =
      await this.agentToolConfigRepository.findById(requestedConfigId);
    if (!config || config.businessLineId !== project.businessLineId) {
      return null;
    }

    if (this.toAgentAdapter(config.toolId) !== adapter) {
      return null;
    }

    return this.toResolvedPersistedAgentToolConfig(adapter, config);
  }

  private resolveAgentToolConfigId(
    configJson: Record<string, unknown>,
  ): string | null {
    if (
      typeof configJson.agentToolConfigId === 'string' &&
      configJson.agentToolConfigId.trim()
    ) {
      return configJson.agentToolConfigId.trim();
    }

    if (
      typeof configJson.agent_tool_config_id === 'string' &&
      configJson.agent_tool_config_id.trim()
    ) {
      return configJson.agent_tool_config_id.trim();
    }

    return null;
  }

  private async resolvePersistedDefaultAgentToolConfig(
    project: Project,
    adapter: AgentAdapter,
  ): Promise<ResolvedAgentToolConfig | null> {
    const toolIdCandidates = this.resolveToolIdCandidates(adapter);

    for (const toolId of toolIdCandidates) {
      const config =
        await this.agentToolConfigRepository.findDefaultByBusinessLineIdAndToolId(
          project.businessLineId,
          toolId,
        );

      if (!config) {
        continue;
      }

      const resolved = this.toResolvedPersistedAgentToolConfig(adapter, config);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  private toResolvedPersistedAgentToolConfig(
    adapter: AgentAdapter,
    config: AgentToolConfig,
  ): ResolvedAgentToolConfig | null {
    const parsedConfig = this.parsePersistedConfigJson(config.configJson);
    if (!parsedConfig) {
      return null;
    }

    const sanitizedConfig = this.sanitizeAgentToolConfig(adapter, parsedConfig);

    return {
      runnerConfig: this.readRunnerConfigFromRaw(sanitizedConfig),
      configId: config.id,
      configName: config.name,
    };
  }

  private parsePersistedConfigJson(
    configJson: string,
  ): Record<string, unknown> | null {
    if (!configJson.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(configJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }

    return null;
  }

  private resolveLegacyAgentToolConfig(
    configJson: Record<string, unknown>,
    project: Project,
    adapter: AgentAdapter,
  ): ResolvedAgentToolConfig | null {
    const rawList = configJson.agentToolConfigs;
    if (!Array.isArray(rawList)) {
      return null;
    }

    const entries = rawList
      .map((item) => this.normalizeAgentToolConfigEntry(item))
      .filter(
        (item): item is AgentToolConfigEntry =>
          item !== null && item.adapter === adapter,
      );

    if (!entries.length) {
      return null;
    }

    const exactMatches = entries.filter(
      (item) =>
        item.businessLineId && item.businessLineId === project.businessLineId,
    );
    const globalMatches = entries.filter((item) => !item.businessLineId);
    const selected =
      this.pickAgentToolConfig(exactMatches) ??
      this.pickAgentToolConfig(globalMatches);

    if (!selected) {
      return null;
    }

    const sanitizedConfig = this.sanitizeAgentToolConfig(
      adapter,
      selected.config,
    );

    return {
      runnerConfig: this.readRunnerConfigFromRaw(sanitizedConfig),
      configId: selected.id,
      configName: selected.name,
    };
  }

  private resolveToolIdCandidates(adapter: AgentAdapter): string[] {
    if (adapter === 'codex') {
      return ['codex', 'codex-cli'];
    }

    if (adapter === 'cursor') {
      return ['cursor', 'cursor-agent'];
    }

    if (adapter === 'claude') {
      return ['claude', 'claude-code'];
    }

    if (adapter === 'gemini') {
      return ['gemini', 'gemini-cli'];
    }

    return ['opencode'];
  }

  private normalizeAgentToolConfigEntry(
    raw: unknown,
  ): AgentToolConfigEntry | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const source = raw as Record<string, unknown>;
    const adapter = this.toAgentAdapter(
      typeof source.toolId === 'string'
        ? source.toolId
        : typeof source.tool_id === 'string'
          ? source.tool_id
          : typeof source.adapter === 'string'
            ? source.adapter
            : undefined,
    );

    if (!adapter) {
      return null;
    }

    const config = this.resolveAgentToolConfigObject(source);
    if (!config) {
      return null;
    }

    const businessLineId =
      typeof source.businessLineId === 'string' && source.businessLineId.trim()
        ? source.businessLineId.trim()
        : typeof source.business_line_id === 'string' &&
            source.business_line_id.trim()
          ? source.business_line_id.trim()
          : undefined;

    const id =
      typeof source.id === 'string' && source.id.trim()
        ? source.id.trim()
        : undefined;
    const name =
      typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : undefined;

    return {
      id,
      name,
      adapter,
      businessLineId,
      isDefault: source.isDefault === true || source.is_default === 1,
      config,
    };
  }

  private resolveAgentToolConfigObject(
    source: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const rawConfig =
      source.config ?? source.configJson ?? source.config_json ?? null;

    if (!rawConfig) {
      return {};
    }

    if (typeof rawConfig === 'object' && !Array.isArray(rawConfig)) {
      return rawConfig as Record<string, unknown>;
    }

    if (typeof rawConfig === 'string' && rawConfig.trim()) {
      try {
        const parsed = JSON.parse(rawConfig);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  private pickAgentToolConfig(
    entries: AgentToolConfigEntry[],
  ): AgentToolConfigEntry | null {
    if (!entries.length) {
      return null;
    }

    return entries.find((item) => item.isDefault) ?? entries[0];
  }

  private sanitizeAgentToolConfig(
    adapter: AgentAdapter,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const allowedKeys = this.toolConfigAllowedKeys[adapter];
    if (!allowedKeys) {
      return config;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (allowedKeys.has(key)) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private toAgentAdapter(value?: string): AgentAdapter | null {
    if (!value?.trim()) {
      return null;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'codex' || normalized === 'codex-cli') {
      return 'codex';
    }

    if (normalized === 'cursor' || normalized === 'cursor-agent') {
      return 'cursor';
    }

    if (normalized === 'claude' || normalized === 'claude-code') {
      return 'claude';
    }

    if (normalized === 'gemini' || normalized === 'gemini-cli') {
      return 'gemini';
    }

    if (normalized === 'opencode') {
      return 'opencode';
    }

    return null;
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
    if (typeof rawAdapter === 'string') {
      const normalized = this.toAgentAdapter(rawAdapter);
      if (normalized) {
        return normalized;
      }
    }

    return 'codex';
  }

  private resolveDefaultCommand(adapter: AgentAdapter): string {
    const envCommandMap: Record<AgentAdapter, string | undefined> = {
      codex: this.readTrimmedEnv('AINATIVE_CODEX_RUNNER_COMMAND'),
      cursor: this.readTrimmedEnv('AINATIVE_CURSOR_RUNNER_COMMAND'),
      claude: this.readTrimmedEnv('AINATIVE_CLAUDE_RUNNER_COMMAND'),
      gemini: this.readTrimmedEnv('AINATIVE_GEMINI_RUNNER_COMMAND'),
      opencode: this.readTrimmedEnv('AINATIVE_OPENCODE_RUNNER_COMMAND'),
    };

    const envCommand = envCommandMap[adapter];
    if (envCommand && envCommand.trim()) {
      return envCommand.trim();
    }

    const defaultCommandMap: Record<AgentAdapter, string> = {
      codex: 'codex',
      cursor: 'agent',
      claude: 'claude',
      gemini: 'gemini',
      opencode: 'opencode',
    };

    return defaultCommandMap[adapter];
  }

  private resolveDefaultArgs(adapter: AgentAdapter): string[] {
    const defaultArgsMap: Record<AgentAdapter, string[]> = {
      codex: ['exec', '--skip-git-repo-check', '-'],
      cursor: ['-p', '--trust', '--force'],
      claude: ['-p'],
      gemini: [],
      opencode: [],
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

    const sections = [
      nodePrompt,
      `Task Title: ${task.title}`,
      task.prompt ? `Task Prompt:\n${task.prompt}` : '',
      `Node Name: ${node.name}`,
      `Node Order: ${node.nodeOrder}`,
      '---',
      'Output requirement: After completing the task, please output an execution summary to stdout, including: 1) What was done; 2) Which files were modified (if any); 3) Any issues encountered (if any).',
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

      const spawnArgs =
        config.adapter === 'cursor'
          ? [...config.args, prompt]
          : config.args;

      const childProcess = spawn(config.command, spawnArgs, {
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

      if (config.adapter !== 'cursor') {
        childProcess.stdin?.write(prompt);
        childProcess.stdin?.end();
      }

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

  private normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
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
        const value = this.configService.get<string>(key, { infer: true });

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

  private readTrimmedEnv(key: string): string | undefined {
    return this.configService.get<string>(key, { infer: true })?.trim();
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
