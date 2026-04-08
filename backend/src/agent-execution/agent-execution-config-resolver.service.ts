import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import { AgentToolConfig } from '../business-lines/domain/agent-tool-config';
import { AgentToolConfigRepository } from '../business-lines/infrastructure/persistence/agent-tool-config.repository';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { Project } from '../projects/domain/project';
import { Task } from '../tasks/domain/task';
import { TaskNode } from '../tasks/domain/task-node';
import { AgentCliAdapterRegistry } from './agent-cli/agent-cli-adapter.registry';
import {
  AgentCliAdapterId,
  AgentCliRunnerConfigInput,
} from './agent-cli/agent-cli-adapter.interface';
import {
  AgentPromptTemplateService,
  PromptTemplateRuntimeContext,
} from './agent-prompt-template.service';
import { AgentExecutionConfig } from './agent-execution.types';

type AgentAdapter = AgentCliAdapterId;
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

@Injectable()
export class AgentExecutionConfigResolverService {
  constructor(
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly configService: ConfigService,
    private readonly promptTemplateService: AgentPromptTemplateService,
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry,
    private readonly projectWorkspacePathsService: ProjectWorkspacePathsService,
  ) {}

  async resolveExecutionConfig(
    project: Project,
    task: Task,
    node: TaskNode,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): Promise<AgentExecutionConfig> {
    const executionToolConfig = this.resolveExecutionToolConfig(task, node);
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};

    const adapter = this.resolveAdapterForExecution(
      configJson,
      executionToolConfig,
      node,
    );
    const baseRunnerConfig = node.agentCliId
      ? {}
      : this.readRunnerConfig(configJson);
    const agentToolConfig = await this.resolveAgentToolConfig(
      {
        ...configJson,
        ...executionToolConfig,
      },
      executionToolConfig,
      project,
      adapter,
    );
    const runnerConfig = this.mergeRunnerConfig(
      baseRunnerConfig,
      agentToolConfig?.runnerConfig,
    );

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

  async resolveRunnerConfig(
    project: Project,
    task: Task,
    node: TaskNode,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): Promise<AgentExecutionConfig> {
    return this.resolveExecutionConfig(project, task, node, runtimeContext);
  }

  resolvePrompt(
    task: Task,
    node: TaskNode,
    project: Project,
    config: Pick<
      AgentExecutionConfig,
      'adapter' | 'agentToolConfigId' | 'agentToolConfigName'
    >,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): string {
    const input =
      node.input && typeof node.input === 'object'
        ? (node.input as Record<string, unknown>)
        : {};
    const pendingUserMessage = this.readPendingUserMessage(node);

    const hasExplicitNodeInput =
      input.nodeInput !== undefined && input.nodeInput !== null;
    const nodePrompt = hasExplicitNodeInput
      ? typeof input.nodeInput === 'string' && input.nodeInput.trim()
        ? input.nodeInput.trim()
        : ''
      : typeof input.taskInput === 'string' && input.taskInput.trim()
        ? input.taskInput.trim()
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
    const renderedPendingUserMessage = pendingUserMessage
      ? this.promptTemplateService.renderPromptTemplate(pendingUserMessage, {
          task,
          node,
          project,
          runtime: templateRuntimeContext,
        })
      : '';

    const renderedNodePrompt = nodePrompt
      ? this.promptTemplateService.renderPromptTemplate(nodePrompt, {
          task,
          node,
          project,
          runtime: templateRuntimeContext,
        })
      : '';

    if (
      renderedPendingUserMessage &&
      this.normalizeOptionalString(node.agentCliSessionId)
    ) {
      return renderedPendingUserMessage;
    }

    return [renderedNodePrompt, renderedPendingUserMessage]
      .filter(Boolean)
      .join('\n\n');
  }

  extractAgentSessionId(content: string): string | null {
    return this.agentCliAdapterRegistry
      .getById('codex')
      .extractSessionId(content);
  }

  private resolveRunnerCwd(
    task: Task,
    project: Project,
    runtimeContext?: PromptTemplateRuntimeContext,
  ): string {
    const runtimeWorktreePath = this.normalizeOptionalString(
      runtimeContext?.gitWorktreePath,
    );
    if (runtimeWorktreePath) {
      const cwd = path.resolve(runtimeWorktreePath);
      const allowedRoots = [
        this.resolveWorktreeAllowedRoot(project),
        this.resolveProjectStorageBaseDir(project),
      ];
      const ok = allowedRoots.some((root) =>
        this.isPathWithinAllowedRoot(cwd, root),
      );
      if (!ok) {
        throw new Error(
          `Task worktree path ${cwd} is outside allowed roots: ${allowedRoots.join(' | ')}`,
        );
      }
      return cwd;
    }

    const taskWorktree = this.normalizeOptionalString(task.gitWorktree);
    if (!taskWorktree) {
      return process.cwd();
    }

    const cwd = this.projectWorkspacePathsService.resolveTaskWorktreePath(
      task,
      project,
    );

    const allowedRoot = this.resolveWorktreeAllowedRoot(project);
    if (!this.isPathWithinAllowedRoot(cwd, allowedRoot)) {
      throw new Error(
        `Task worktree path ${cwd} is outside allowed root ${allowedRoot}`,
      );
    }

    return cwd;
  }

  private resolveWorktreeAllowedRoot(project: Project): string {
    return this.projectWorkspacePathsService.resolveWorktreeAllowedRoot(
      project,
    );
  }

  private resolveProjectStorageBaseDir(project: Project): string {
    return this.projectWorkspacePathsService.resolveProjectStorageBaseDir(
      project,
    );
  }

  private resolveProjectWorktreeBaseDir(project: Project): string {
    return this.projectWorkspacePathsService.resolveProjectWorktreeBaseDir(
      project,
    );
  }

  private isPathWithinAllowedRoot(
    targetPath: string,
    allowedRoot: string,
  ): boolean {
    return this.projectWorkspacePathsService.isPathWithinAllowedRoot(
      targetPath,
      allowedRoot,
      { allowEqual: true },
    );
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

  private resolveAdapter(configJson: Record<string, unknown>): AgentAdapter {
    for (const key of ['agentAdapter', 'toolId', 'agentCliId'] as const) {
      const raw = configJson[key];
      if (typeof raw === 'string') {
        const normalized = this.toAgentAdapter(raw);
        if (normalized) {
          return normalized;
        }
      }
    }

    return 'codex';
  }

  private resolveAdapterForExecution(
    projectConfigJson: Record<string, unknown>,
    executionToolConfig: Record<string, unknown>,
    node: TaskNode,
  ): AgentAdapter {
    const nodeCli = this.normalizeOptionalString(node.agentCliId);
    if (nodeCli) {
      const fromNode = this.toAgentAdapter(nodeCli);
      if (fromNode) {
        return fromNode;
      }
    }

    return this.resolveAdapter({
      ...projectConfigJson,
      ...executionToolConfig,
    });
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

  private normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private readTrimmedEnv(key: string): string | undefined {
    return this.configService.get<string>(key, { infer: true })?.trim();
  }
}
