import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { AgentToolConfig } from '../business-lines/domain/agent-tool-config';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { Project } from '../projects/domain/project';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { Task } from './domain/task';
import { TaskNode } from './domain/task-node';
import {
  PromptTemplateRuntimeContext,
  PromptTemplateService,
} from './prompt-template.service';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import {
  AgentCliAdapterId,
  AgentCliRunnerConfigInput,
} from './agent-cli/agent-cli-adapter.interface';

type AgentAdapter = AgentCliAdapterId;

type AgentRunnerConfig = {
  adapter: AgentAdapter;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  agentToolConfigId?: string;
  agentToolConfigName?: string;
};

type RunnerConfigInput = AgentCliRunnerConfigInput;

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
  rawConfig?: Record<string, unknown>;
  configId?: string;
  configName?: string;
};

type AgentExecutionContext = {
  taskId: string;
  nodeId: string;
  projectId: string;
  businessLineId: string;
};

type AgentRunnerStreamCallbacks = {
  onPrepared?: (input: {
    adapter: AgentCliAdapterId;
    prompt: string;
    preparedAt: Date;
  }) => Promise<void> | void;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
};

type ActiveAgentExecution = {
  childProcess: ChildProcess;
  stopReason: 'interrupt' | null;
  killTimerRef: NodeJS.Timeout | null;
};

export type AgentRunnerResult = {
  success: boolean;
  interrupted: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  command: string;
  args: string[];
  cwd: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  prompt: string;
  sessionId?: string | null;
  errorMessage?: string;
};

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly maxOutputLength = 100_000;
  private readonly forcedKillDelayMs = 2_000;
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );
  private readonly activeExecutions = new Map<string, ActiveAgentExecution>();

  constructor(
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly configService: ConfigService = new ConfigService(),
    private readonly promptTemplateService: PromptTemplateService = new PromptTemplateService(),
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry = new AgentCliAdapterRegistry(),
  ) {}

  async executeAgentNode({
    task,
    node,
    project,
    runtimeContext,
    callbacks,
  }: {
    task: Task;
    node: TaskNode;
    project: Project;
    runtimeContext?: PromptTemplateRuntimeContext;
    callbacks?: AgentRunnerStreamCallbacks;
  }): Promise<AgentRunnerResult> {
    const config = await this.resolveRunnerConfig(
      project,
      task,
      node,
      runtimeContext,
    );
    const prompt = this.resolvePrompt(
      task,
      node,
      project,
      config,
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

  interruptExecution(nodeId: string): boolean {
    const activeExecution = this.activeExecutions.get(nodeId);

    if (!activeExecution) {
      return false;
    }

    this.requestProcessStop(activeExecution, 'interrupt');
    return true;
  }

  private async resolveRunnerConfig(
    project: Project,
    task: Task,
    node: TaskNode,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): Promise<AgentRunnerConfig> {
    const executionToolConfig = this.resolveExecutionToolConfig(task, node);
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};

    const adapter = this.resolveAdapter({
      ...configJson,
      ...executionToolConfig,
    });
    const baseRunnerConfig = this.readRunnerConfig(configJson);
    const agentToolConfig = await this.resolveAgentToolConfig(
      {
        ...configJson,
        ...executionToolConfig,
      },
      executionToolConfig,
      project,
      adapter,
    );
    const runnerConfigFromTool = this.mergeRunnerConfig(
      baseRunnerConfig,
      agentToolConfig?.runnerConfig,
    );
    const runnerConfig = runnerConfigFromTool;

    const continuationConfig = {
      ...configJson,
      ...executionToolConfig,
      ...(agentToolConfig?.rawConfig ?? {}),
    };
    const command =
      runnerConfig.command?.trim() || this.resolveDefaultCommand(adapter);
    const normalizedArgs = this.normalizeRunnerArgs(
      adapter,
      runnerConfig.args ?? this.resolveDefaultArgs(adapter),
    );
    const args = this.applyContinuationArgs({
      adapter,
      args: normalizedArgs,
      sessionId: this.normalizeOptionalString(node.agentCliSessionId),
      continuationConfig,
    });

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

    const cwd = this.resolveRunnerCwd(task, project, runtimeContext);

    return {
      adapter,
      command,
      args,
      cwd,
      env,
      ...(agentToolConfig?.configId
        ? { agentToolConfigId: agentToolConfig.configId }
        : {}),
      ...(agentToolConfig?.configName
        ? { agentToolConfigName: agentToolConfig.configName }
        : {}),
    };
  }

  private resolveRunnerCwd(
    task: Task,
    project: Project,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): string {
    const worktreePath =
      this.normalizeOptionalString(runtimeContext?.gitWorktreePath) ??
      this.normalizeOptionalString(task.gitWorktree);

    if (!worktreePath) {
      return process.cwd();
    }

    const cwd = path.resolve(worktreePath);
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
    return path.resolve(
      this.resolveProjectStorageBaseDir(project),
      'worktrees',
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

  private toObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private resolveExecutionToolConfig(
    task: Task,
    node: TaskNode,
  ): Record<string, unknown> {
    return {
      ...this.toObjectRecord(task.configJson),
      ...(node.agentCliId
        ? {
            agentCliId: node.agentCliId,
            toolId: node.agentCliId,
            agentAdapter: node.agentCliId,
          }
        : {}),
      ...(node.agentCliConfigId
        ? {
            agentCliConfigId: node.agentCliConfigId,
          }
        : {}),
    };
  }

  private readRunnerConfig(configJson: Record<string, unknown>): {
    command?: string;
    args?: string[];
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

    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    const apiKey =
      typeof raw.api_key === 'string' && raw.api_key.trim()
        ? raw.api_key.trim()
        : undefined;

    return {
      command,
      args,
      env: apiKey ? { ...(env ?? {}), CURSOR_API_KEY: apiKey } : env,
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
      env: mergedEnv,
    };
  }

  private normalizeRunnerArgs(adapter: AgentAdapter, args: string[]): string[] {
    return this.agentCliAdapterRegistry.getById(adapter).normalizeArgs(args);
  }

  private async resolveAgentToolConfig(
    projectExecutionConfig: Record<string, unknown>,
    executionConfig: Record<string, unknown>,
    project: Project,
    adapter: AgentAdapter,
  ): Promise<ResolvedAgentToolConfig | null> {
    const persistedById = await this.resolvePersistedAgentToolConfigById(
      executionConfig,
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

    return this.resolveLegacyAgentToolConfig(
      projectExecutionConfig,
      project,
      adapter,
    );
  }

  private async resolvePersistedAgentToolConfigById(
    executionConfig: Record<string, unknown>,
    project: Project,
    adapter: AgentAdapter,
  ): Promise<ResolvedAgentToolConfig | null> {
    const requestedConfigId = this.resolveAgentToolConfigId(executionConfig);

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
      typeof configJson.agentCliConfigId === 'string' &&
      configJson.agentCliConfigId.trim()
    ) {
      return configJson.agentCliConfigId.trim();
    }

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
      runnerConfig: this.resolveToolRunnerConfig(adapter, sanitizedConfig),
      rawConfig: sanitizedConfig,
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
      runnerConfig: this.resolveToolRunnerConfig(adapter, sanitizedConfig),
      rawConfig: sanitizedConfig,
      configId: selected.id,
      configName: selected.name,
    };
  }

  private resolveToolIdCandidates(adapter: AgentAdapter): string[] {
    return this.agentCliAdapterRegistry.resolveToolIdCandidates(adapter);
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
    const allowedKeys =
      this.agentCliAdapterRegistry.getById(adapter).toolConfigAllowedKeys;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (allowedKeys.has(key)) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private resolveToolRunnerConfig(
    adapter: AgentAdapter,
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    return this.agentCliAdapterRegistry
      .getById(adapter)
      .buildToolRunnerConfig(raw);
  }

  private toAgentAdapter(value?: string): AgentAdapter | null {
    return this.agentCliAdapterRegistry.resolve(value);
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

  private readCodexRunnerConfigFromRaw(
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      args: this.buildCodexExecArgs(raw),
      env,
    };
  }

  private readClaudeRunnerConfigFromRaw(
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      args: this.buildClaudePrintArgs(raw),
      env,
    };
  }

  private readCursorRunnerConfigFromRaw(
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;
    const apiKey =
      typeof raw.api_key === 'string' && raw.api_key.trim()
        ? raw.api_key.trim()
        : undefined;

    return {
      args: this.buildCursorPrintArgs(raw),
      env: apiKey ? { ...(env ?? {}), CURSOR_API_KEY: apiKey } : env,
    };
  }

  private buildCodexExecArgs(raw: Record<string, unknown>): string[] {
    const args = ['exec', '--json', '--skip-git-repo-check'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const localProvider = this.normalizeOptionalString(
      typeof raw.local_provider === 'string' ? raw.local_provider : null,
    );
    const profile = this.normalizeOptionalString(
      typeof raw.profile === 'string' ? raw.profile : null,
    );
    const sandbox = this.resolveCodexSandbox(raw.sandbox);
    const executionMode = this.resolveCodexExecutionMode(raw.execution_mode);
    const configOverrides = this.resolveStringArray(raw.config_overrides) ?? [];

    if (model) {
      args.push('--model', model);
    }

    if (raw.oss === true) {
      args.push('--oss');
    }

    if (localProvider) {
      args.push('--local-provider', localProvider);
    }

    if (profile) {
      args.push('--profile', profile);
    }

    if (executionMode === 'full-auto') {
      args.push('--full-auto');
    } else if (executionMode === 'dangerously-bypass-approvals-and-sandbox') {
      args.push('--dangerously-bypass-approvals-and-sandbox');
    } else if (sandbox) {
      args.push('--sandbox', sandbox);
    }

    for (const override of configOverrides) {
      args.push('-c', override);
    }

    args.push('-');

    return args;
  }

  private buildClaudePrintArgs(raw: Record<string, unknown>): string[] {
    const args = ['-p', '--output-format', 'stream-json', '--verbose'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const effort = this.resolveClaudeEffort(raw.effort);
    const permissionMode = this.resolveClaudePermissionMode(
      raw.permission_mode,
    );
    const allowedTools = this.resolveStringArray(raw.allowed_tools) ?? [];
    const disallowedTools = this.resolveStringArray(raw.disallowed_tools) ?? [];
    const mcpConfig = this.resolveStringArray(raw.mcp_config) ?? [];
    const settings = this.normalizeOptionalString(
      typeof raw.settings === 'string' ? raw.settings : null,
    );
    const dangerouslySkipPermissions =
      raw.dangerously_skip_permissions === true;

    if (model) {
      args.push('--model', model);
    }

    if (effort) {
      args.push('--effort', effort);
    }

    if (dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    } else if (permissionMode) {
      args.push('--permission-mode', permissionMode);
    }

    if (allowedTools.length > 0) {
      args.push('--allowed-tools', ...allowedTools);
    }

    if (disallowedTools.length > 0) {
      args.push('--disallowed-tools', ...disallowedTools);
    }

    if (settings) {
      args.push('--settings', settings);
    }

    if (mcpConfig.length > 0) {
      args.push('--mcp-config', ...mcpConfig);
    }

    return args;
  }

  private buildCursorPrintArgs(raw: Record<string, unknown>): string[] {
    const args = ['-p', '--output-format', 'stream-json'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const headers = this.resolveStringArray(raw.headers) ?? [];
    const sandbox = this.resolveCursorSandbox(raw.sandbox);

    if (model) {
      args.push('--model', model);
    }

    for (const header of headers) {
      args.push('--header', header);
    }

    if (raw.trust === true) {
      args.push('--trust');
    }

    if (raw.force === true) {
      args.push('--force');
    }

    if (sandbox) {
      args.push('--sandbox', sandbox);
    }

    if (raw.approve_mcps === true) {
      args.push('--approve-mcps');
    }

    return args;
  }

  private readGeminiRunnerConfigFromRaw(
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      args: this.buildGeminiExecArgs(raw),
      env,
    };
  }

  private buildGeminiExecArgs(raw: Record<string, unknown>): string[] {
    const args = ['--output-format', 'stream-json'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const approvalMode = this.resolveGeminiApprovalMode(raw.approval_mode);
    const policy = this.resolveStringArray(raw.policy) ?? [];
    const allowedMcpServerNames =
      this.resolveStringArray(raw.allowed_mcp_server_names) ?? [];
    const extensions = this.resolveStringArray(raw.extensions) ?? [];

    if (model) {
      args.push('--model', model);
    }

    if (raw.sandbox === true) {
      args.push('--sandbox');
    }

    if (raw.yolo === true) {
      args.push('--yolo');
    } else if (approvalMode) {
      args.push('--approval-mode', approvalMode);
    }

    for (const item of policy) {
      args.push('--policy', item);
    }

    for (const item of allowedMcpServerNames) {
      args.push('--allowed-mcp-server-names', item);
    }

    for (const item of extensions) {
      args.push('--extensions', item);
    }

    return args;
  }

  private readOpenCodeRunnerConfigFromRaw(
    raw: Record<string, unknown>,
  ): RunnerConfigInput {
    const env =
      raw.env && typeof raw.env === 'object'
        ? this.resolveStringEnv(raw.env as Record<string, unknown>)
        : undefined;

    return {
      args: this.buildOpenCodeRunArgs(raw),
      env,
    };
  }

  private buildOpenCodeRunArgs(raw: Record<string, unknown>): string[] {
    const args = ['run', '--format', 'json'];
    const model = this.normalizeOptionalString(
      typeof raw.model === 'string' ? raw.model : null,
    );
    const agent = this.normalizeOptionalString(
      typeof raw.agent === 'string' ? raw.agent : null,
    );
    const prompt = this.normalizeOptionalString(
      typeof raw.prompt === 'string' ? raw.prompt : null,
    );

    if (model) {
      args.push('--model', model);
    }

    if (agent) {
      args.push('--agent', agent);
    }

    if (prompt) {
      args.push('--prompt', prompt);
    }

    return args;
  }

  private resolveCodexExecutionMode(
    value: unknown,
  ): 'standard' | 'full-auto' | 'dangerously-bypass-approvals-and-sandbox' {
    if (value === 'full-auto') {
      return 'full-auto';
    }

    if (value === 'dangerously-bypass-approvals-and-sandbox') {
      return 'dangerously-bypass-approvals-and-sandbox';
    }

    return 'standard';
  }

  private resolveCodexSandbox(
    value: unknown,
  ): 'read-only' | 'workspace-write' | 'danger-full-access' | null {
    if (
      value === 'read-only' ||
      value === 'workspace-write' ||
      value === 'danger-full-access'
    ) {
      return value;
    }

    return null;
  }

  private resolveClaudeEffort(
    value: unknown,
  ): 'low' | 'medium' | 'high' | 'max' | null {
    if (
      value === 'low' ||
      value === 'medium' ||
      value === 'high' ||
      value === 'max'
    ) {
      return value;
    }

    return null;
  }

  private resolveClaudePermissionMode(
    value: unknown,
  ):
    | 'acceptEdits'
    | 'bypassPermissions'
    | 'default'
    | 'dontAsk'
    | 'plan'
    | 'auto'
    | null {
    if (
      value === 'acceptEdits' ||
      value === 'bypassPermissions' ||
      value === 'default' ||
      value === 'dontAsk' ||
      value === 'plan' ||
      value === 'auto'
    ) {
      return value;
    }

    return null;
  }

  private resolveCursorSandbox(value: unknown): 'enabled' | 'disabled' | null {
    if (value === 'enabled' || value === 'disabled') {
      return value;
    }

    return null;
  }

  private resolveGeminiApprovalMode(
    value: unknown,
  ): 'default' | 'auto_edit' | 'yolo' | 'plan' | null {
    if (
      value === 'default' ||
      value === 'auto_edit' ||
      value === 'yolo' ||
      value === 'plan'
    ) {
      return value;
    }

    return null;
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
    const cliAdapter = this.agentCliAdapterRegistry.getById(adapter);
    const envCommand = this.readTrimmedEnv(cliAdapter.runnerCommandEnvKey);
    if (envCommand && envCommand.trim()) {
      return envCommand.trim();
    }

    return cliAdapter.defaultCommand;
  }

  private applyContinuationArgs({
    adapter,
    args,
    sessionId,
    continuationConfig,
  }: {
    adapter: AgentAdapter;
    args: string[];
    sessionId?: string | null;
    continuationConfig: Record<string, unknown>;
  }): string[] {
    const normalizedSessionId = this.normalizeOptionalString(
      sessionId ??
        this.resolveConfiguredContinuationSession(adapter, continuationConfig),
    );

    if (!normalizedSessionId) {
      return args;
    }

    return this.agentCliAdapterRegistry
      .getById(adapter)
      .applyContinuation(args, {
        sessionId: normalizedSessionId,
        continuationConfig,
      });
  }

  private resolveConfiguredContinuationSession(
    adapter: AgentAdapter,
    continuationConfig: Record<string, unknown>,
  ): string | null {
    if (adapter === 'claude') {
      return typeof continuationConfig.resume === 'string'
        ? continuationConfig.resume
        : null;
    }

    return null;
  }

  private resolveDefaultArgs(adapter: AgentAdapter): string[] {
    return this.agentCliAdapterRegistry.getById(adapter).defaultArgs();
  }

  private resolvePrompt(
    task: Task,
    node: TaskNode,
    project: Project,
    config: Pick<
      AgentRunnerConfig,
      'adapter' | 'agentToolConfigId' | 'agentToolConfigName'
    >,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): string {
    const input =
      node.input && typeof node.input === 'object'
        ? (node.input as Record<string, unknown>)
        : {};
    const pendingUserMessage = this.readPendingUserMessage(node);

    if (
      pendingUserMessage &&
      this.normalizeOptionalString(node.agentCliSessionId)
    ) {
      return pendingUserMessage;
    }

    const nodePrompt =
      typeof input.nodeInput === 'string' && input.nodeInput.trim()
        ? input.nodeInput.trim()
        : typeof input.prompt === 'string' && input.prompt.trim()
          ? input.prompt.trim()
          : typeof input.instructions === 'string' && input.instructions.trim()
            ? input.instructions.trim()
            : '';

    const templateRuntimeContext: PromptTemplateRuntimeContext = {
      ...runtimeContext,
      agentAdapter: config.adapter,
      agentToolConfigId: config.agentToolConfigId ?? null,
      agentToolConfigName: config.agentToolConfigName ?? null,
    };
    const renderedNodePrompt = nodePrompt
      ? this.promptTemplateService.renderPromptTemplate(nodePrompt, {
          task,
          node,
          project,
          runtime: templateRuntimeContext,
        })
      : '';

    const sections = [renderedNodePrompt, pendingUserMessage].filter(Boolean);

    return sections.join('\n\n');
  }

  private readPendingUserMessage(node: TaskNode): string | null {
    const runtime =
      node.runtimeJson && typeof node.runtimeJson === 'object'
        ? (node.runtimeJson as Record<string, unknown>)
        : null;

    if (!runtime) {
      return null;
    }

    return this.normalizeOptionalString(
      typeof runtime.pendingUserMessage === 'string'
        ? runtime.pendingUserMessage
        : null,
    );
  }

  private async runWithConfig(
    config: AgentRunnerConfig,
    prompt: string,
    executionContext: AgentExecutionContext,
    callbacks?: AgentRunnerStreamCallbacks,
  ): Promise<AgentRunnerResult> {
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
        `agent_runner_spawn ${JSON.stringify(
          this.buildExecutionLogPayload({
            executionContext,
            config,
            prompt,
            mergedEnv,
          }),
        )}`,
      );

      const childProcess = spawn(config.command, spawnArgs, {
        cwd: config.cwd,
        env: mergedEnv,
        stdio: 'pipe',
      });
      const activeExecution: ActiveAgentExecution = {
        childProcess,
        stopReason: null,
        killTimerRef: null,
      };
      this.activeExecutions.set(executionContext.nodeId, activeExecution);

      childProcess.stdout?.on('data', (chunk: Buffer | string) => {
        const chunkText = this.toChunkText(chunk);
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
            `agent_runner_stdout_first_chunk ${JSON.stringify(
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
            `agent_runner_stderr_first_chunk ${JSON.stringify(
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
            `agent_runner_process_error ${JSON.stringify(
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
      // A user-triggered interruption must never be treated as a successful
      // completion, even if the CLI exits cleanly with code 0 after SIGTERM.
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
          `agent_runner_completed ${JSON.stringify(resultLogPayload)}`,
        );
      } else {
        this.logger.warn(
          `agent_runner_failed ${JSON.stringify(resultLogPayload)}`,
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
          : 'Failed to execute agent runner process';
      this.logger.error(
        `agent_runner_exception ${JSON.stringify(
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
      'GEMINI_API_KEY',
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

  private buildExecutionLogPayload({
    executionContext,
    config,
    prompt,
    mergedEnv,
  }: {
    executionContext: AgentExecutionContext;
    config: AgentRunnerConfig;
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
    interrupted,
    exitCode,
    signal,
    errorMessage,
  }: {
    executionContext: AgentExecutionContext;
    config: AgentRunnerConfig;
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
      args: config.args,
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

  private extractAgentSessionId(content: string): string | null {
    return this.agentCliAdapterRegistry
      .getById('codex')
      .extractSessionId(content);
  }
}
