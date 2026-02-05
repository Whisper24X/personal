/**
 * Base Action class
 * Abstract interface for all actions that agents can perform
 *
 * 支持两种执行模式：
 * - LLM 模式：使用大模型 API 执行（默认，向后兼容）
 * - CLI 模式：使用命令行工具执行（如 Cursor CLI, Aider）
 */

import { IActionOutput, ActionStatus } from '@mind2build/shared';
import { WorkspaceManager, WorkspaceOptions } from '../../utils/WorkspaceManager';
import { Context } from '../context/Context';
import { logger, loadPrompt } from '../../utils';
import { ExecutorMode, ExecutorOptions, CLIProviderType, CLIProviderConfig, CLIExecutionResult, StreamJSONEvent } from '../../executors/types';
import { CLIExecutor } from '../../executors/CLIExecutor';
import { CLIProviderFactory } from '../../executors/cli/CLIProviderFactory';
import { createDefaultFallbackStrategy } from '../../executors/cli/CLIModelFallbackStrategy';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import * as fs from 'fs/promises';
import * as path from 'path';
import { cliLogStreamService } from '../../services/CliLogStreamService';
// Handler types for mode encapsulation
import type { ReviewOptions, ReviewResult, ImproveOptions, ImproveResult, WriteOptions, WriteResult } from '../../utils/document/types';

export abstract class BaseAction {
  name: string;
  description?: string;

  // Action status - used for in-memory tracking during execution
  // Note: Primary status management is handled by StateManager (database)
  // This field is used for quick status checks during workflow execution
  status?: ActionStatus;

  // Custom LLM instance (only for role-specific config or special scenarios)
  // If not set, LLM is dynamically obtained from Context
  protected _customLLM?: any;

  // Context instance will be injected by Role
  protected context?: Context;

  // AbortSignal for cancellation support
  protected abortSignal?: AbortSignal;

  // Role instance (set by Role.setActions)
  protected role?: any;

  // Handler cache for lazy initialization
  private _handlerCache: Map<string, any> = new Map();
  private _cliLogMissingWarned: boolean = false;

  constructor(name?: string, description?: string) {
    this.name = name || this.constructor.name;
    this.description = description;
  }

  /**
   * Get LLM instance
   * Priority: custom LLM > Context.llm (dynamic, supports hot-reload)
   * This getter ensures that LLM configuration changes take effect immediately
   */
  protected get llm(): any {
    // If custom LLM is set (role-specific config), use it
    if (this._customLLM) {
      return this._customLLM;
    }
    // Otherwise, get from Context dynamically (supports hot-reload)
    if (!this.context) {
      return undefined;
    }
    return this.context.llm;
  }

  /**
   * Execute the action
   * @param args - Input arguments
   * @returns Action output
   */
  abstract run(...args: any[]): Promise<IActionOutput>;

  /**
   * Execute the action with logging wrapper
   * This method wraps the run() method with unified logging
   * @param args - Input arguments
   * @returns Action output
   */
  async executeWithLogging(...args: any[]): Promise<IActionOutput> {
    const startTime = Date.now();
    const actionName = this.name;
    const logContext = this.getLogContext();

    // Log action start
    logger.info(`Action [${actionName}]: Starting execution`, {
      ...logContext,
      actionName,
      description: this.description,
      argsCount: args.length,
      argsPreview: args.length > 0 ? this.serializeArgsForLog(args) : undefined,
    });

    try {
      // Execute the actual run method
      const result = await this.run(...args);

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      const logContext = this.getLogContext();

      // Log success
      logger.info(`Action [${actionName}]: Execution completed successfully`, {
        ...logContext,
        actionName,
        executionTimeMs: executionTime,
        outputType: result.data?.type,
        contentLength: result.content?.length || 0,
      });

      return result;
    } catch (error: any) {
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      const logContext = this.getLogContext();

      // Log failure
      logger.error(`Action [${actionName}]: Execution failed`, {
        ...logContext,
        actionName,
        executionTimeMs: executionTime,
        error: error.message,
        errorStack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Serialize arguments for logging (avoid logging sensitive or very large data)
   */
  private serializeArgsForLog(args: any[]): any {
    return args.map((arg) => {
      if (arg === null || arg === undefined) {
        return arg;
      }

      const argType = typeof arg;

      // For strings, show length and preview
      if (argType === 'string') {
        const length = arg.length;
        const preview = length > 100 ? arg.substring(0, 100) + '...' : arg;
        return {
          type: 'string',
          length,
          preview: preview.substring(0, 100),
        };
      }

      // For objects, show keys and basic info
      if (argType === 'object' && !Array.isArray(arg)) {
        const keys = Object.keys(arg);
        return {
          type: 'object',
          keys,
          keysCount: keys.length,
        };
      }

      // For arrays, show length
      if (Array.isArray(arg)) {
        return {
          type: 'array',
          length: arg.length,
        };
      }

      // For other types, return as is
      return {
        type: argType,
        value: String(arg).substring(0, 100),
      };
    });
  }

  /**
   * Set custom LLM instance for this action
   * Use this only for role-specific LLM config or special scenarios
   * If not set, LLM will be obtained dynamically from Context
   */
  setLLM(llm: any): void {
    this._customLLM = llm;
  }

  /**
   * Clear custom LLM to use Context's LLM (supports hot-reload)
   */
  clearCustomLLM(): void {
    this._customLLM = undefined;
  }

  /**
   * Set Context instance for this action
   */
  setContext(context: Context): void {
    this.context = context;
  }

  /**
   * Set AbortSignal for cancellation support
   */
  setAbortSignal(signal: AbortSignal): void {
    this.abortSignal = signal;
  }

  /**
   * Check if action execution is cancelled
   */
  protected checkCancellation(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('Action was cancelled');
    }
  }

  /**
   * Get log context (role and action name)
   */
  protected getLogContext(): { role?: string; action: string } {
    const roleName = (this as any).role?.profile || (this.context?.get?.('currentRole') as string) || undefined;
    return {
      role: roleName,
      action: this.name,
    };
  }

  private getCliLogContext(): { projectId?: string; versionId?: string; prefix: string } {
    const logContext = this.getLogContext();
    const projectId = this.context?.get?.('projectId') as string | undefined;
    const versionId = this.context?.get?.('versionId') as string | undefined;
    const roleLabel = logContext.role ? `${logContext.role}/` : '';
    const prefix = `[${roleLabel}${logContext.action}]`;
    return { projectId, versionId, prefix };
  }

  private pushCliLog(projectId: string | undefined, versionId: string | undefined, payload: { type: string; message: string; ts: string }): void {
    if (!projectId || !versionId) {
      if (!this._cliLogMissingWarned) {
        this._cliLogMissingWarned = true;
        logger.warn('BaseAction: Missing projectId/versionId, CLI logs will not be streamed', {
          hasProjectId: !!projectId,
          hasVersionId: !!versionId,
          action: this.name,
          role: (this as any).role?.profile,
        });
      }
      return;
    }
    cliLogStreamService.push(projectId, versionId, payload);
  }

  /**
   * Helper method to call LLM with a prompt
   * 支持双模式：根据配置自动选择 LLM 或 CLI 模式执行
   * @param prompt - The prompt to send to LLM
   * @param systemMsgs - Optional system messages
   */
  protected async aask(prompt: string, systemMsgs?: string[]): Promise<string> {
    this.checkCancellation();

    return await this.execute(prompt, {
      systemPrompt: systemMsgs?.[0],
      workDir: this.getDefaultWorkDir(),
    });
  }

  /**
   * Helper method for chat completion
   * 支持双模式：根据配置自动选择 LLM 或 CLI 模式执行
   * @param messages - Chat messages
   */
  protected async acompletion(messages: any[]): Promise<any> {
    this.checkCancellation();

    // 从 messages 提取 prompt 和 system message
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMsg = messages.find((m) => m.role === 'user')?.content || messages[messages.length - 1]?.content || '';

    const content = await this.execute(userMsg, {
      systemPrompt: systemMsg,
      workDir: this.getDefaultWorkDir(),
    });

    // 包装成 completion 响应格式
    return {
      content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  // ============================================
  // 执行模式相关方法（支持 LLM 和 CLI 模式切换）
  // ============================================

  /**
   * 统一执行入口
   * 根据配置自动选择 LLM 或 CLI 模式执行
   *
   * @param prompt 提示词
   * @param options 执行选项
   * @returns 执行结果
   */
  protected async execute(prompt: string, options?: ExecutorOptions): Promise<string> {
    this.checkCancellation();

    const mode = this.getExecutorMode();
    const logContext = this.getLogContext();

    logger.info('BaseAction: execute() called', {
      ...logContext,
      mode,
      promptLength: prompt.length,
      hasSystemPrompt: !!options?.systemPrompt,
      hasWorkDir: !!options?.workDir,
    });

    try {
      if (mode === 'cli') {
        return await this.executeCLI(prompt, options);
      } else {
        return await this.executeLLM(prompt, options);
      }
    } catch (error: any) {
      logger.error('BaseAction: execute() failed', {
        ...logContext,
        mode,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 使用 LLM 模式执行
   * 直接调用 LLM API，避免通过 aask() 形成循环调用
   */
  protected async executeLLM(prompt: string, options?: ExecutorOptions): Promise<string> {
    const currentLLM = this.llm;
    if (!currentLLM) {
      throw new Error('LLM not available: Context not set for action');
    }

    const logContext = this.getLogContext();
    const { projectId, versionId, prefix } = this.getCliLogContext();
    const systemMsgs = options?.systemPrompt ? [options.systemPrompt] : undefined;

    logger.info('BaseAction: executeLLM calling LLM API', {
      ...logContext,
      promptLength: prompt.length,
      hasSystemPrompt: !!options?.systemPrompt,
    });

    this.pushCliLog(projectId, versionId, {
      type: 'status',
      message: `${prefix} LLM start`,
      ts: new Date().toISOString(),
    });

    try {
      const result = await currentLLM.aask(prompt, systemMsgs, this.abortSignal);

      this.checkCancellation();

      logger.info('BaseAction: executeLLM completed', {
        ...logContext,
        resultLength: result.length,
      });

      this.pushCliLog(projectId, versionId, {
        type: 'status',
        message: `${prefix} LLM done`,
        ts: new Date().toISOString(),
      });

      if (result) {
        this.pushCliLog(projectId, versionId, {
          type: 'output',
          message: `${prefix} ${result.substring(0, 500)}`,
          ts: new Date().toISOString(),
        });
      }

      return result;
    } catch (error: any) {
      this.pushCliLog(projectId, versionId, {
        type: 'error',
        message: `${prefix} LLM error: ${error.message || 'unknown error'}`,
        ts: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * 使用 CLI 模式执行
   * 模型降级能力由CLIExecutor提供
   */
  protected async executeCLI(prompt: string, options?: ExecutorOptions): Promise<string> {
    const workDir = options?.workDir || this.getDefaultWorkDir();

    if (!workDir) {
      throw new Error('BaseAction: workDir is required for CLI mode execution');
    }

    const cliConfig = await this.getCLIConfig();
    const roleProfile = this.role?.profile;

    const logContext = this.getLogContext();
    const { projectId, versionId, prefix } = this.getCliLogContext();

    logger.info('BaseAction: executeCLI starting', {
      ...logContext,
      provider: cliConfig.provider,
      model: cliConfig.config?.model,
      workDir,
      promptLength: prompt.length,
    });

    this.pushCliLog(projectId, versionId, {
      type: 'status',
      message: `${prefix} CLI start`,
      ts: new Date().toISOString(),
    });

    // 创建降级策略（如果角色配置了角色级别的CLI模型）
    const fallbackStrategy = roleProfile ? createDefaultFallbackStrategy(roleProfile) : null;

    const executor = new CLIExecutor({
      providerType: cliConfig.provider,
      providerConfig: cliConfig.config,
      defaultWorkDir: workDir,
      fallbackStrategy,
    });

    const upstreamOnProgress = options?.onProgress;
    const onProgress = (event: StreamJSONEvent) => {
      const text = cliLogStreamService.formatStreamEvent(event);
      if (text) {
        this.pushCliLog(projectId, versionId, {
          type: 'output',
          message: `${prefix} ${text}`,
          ts: new Date().toISOString(),
        });
      }
      if (upstreamOnProgress) {
        upstreamOnProgress(event);
      }
    };

    try {
      const output = await executor.execute(prompt, {
        ...options,
        workDir,
        abortSignal: this.abortSignal,
        enableStreamProgress: true,
        onProgress,
      });
      this.pushCliLog(projectId, versionId, {
        type: 'status',
        message: `${prefix} CLI done`,
        ts: new Date().toISOString(),
      });
      return output;
    } catch (error: any) {
      this.pushCliLog(projectId, versionId, {
        type: 'error',
        message: `${prefix} CLI error: ${error.message || 'unknown error'}`,
        ts: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * 使用 CLI 模式执行带重试
   * 模型降级能力由CLIExecutor提供
   */
  protected async executeCLIWithRetry(
    prompt: string,
    checkPrompt: string,
    options?: ExecutorOptions & { maxRetries?: number; isComplete?: (output: string) => boolean }
  ): Promise<{ output: string; iterations: number; isCompleted: boolean }> {
    const workDir = options?.workDir || this.getDefaultWorkDir();

    if (!workDir) {
      throw new Error('BaseAction: workDir is required for CLI mode execution');
    }

    const cliConfig = await this.getCLIConfig();
    const roleProfile = this.role?.profile;
    const { projectId, versionId, prefix } = this.getCliLogContext();

    // 创建降级策略（如果角色配置了角色级别的CLI模型）
    const fallbackStrategy = roleProfile ? createDefaultFallbackStrategy(roleProfile) : null;

    const executor = new CLIExecutor({
      providerType: cliConfig.provider,
      providerConfig: cliConfig.config,
      defaultWorkDir: workDir,
      fallbackStrategy,
    });

    const upstreamOnProgress = options?.onProgress;
    const onProgress = (event: StreamJSONEvent) => {
      const text = cliLogStreamService.formatStreamEvent(event);
      if (text) {
        this.pushCliLog(projectId, versionId, {
          type: 'output',
          message: `${prefix} ${text}`,
          ts: new Date().toISOString(),
        });
      }
      if (upstreamOnProgress) {
        upstreamOnProgress(event);
      }
    };

    this.pushCliLog(projectId, versionId, {
      type: 'status',
      message: `${prefix} CLI start`,
      ts: new Date().toISOString(),
    });

    try {
      const result = await executor.executeWithRetry(prompt, checkPrompt, {
        ...options,
        workDir,
        abortSignal: this.abortSignal,
        enableStreamProgress: true,
        onProgress,
      });
      this.pushCliLog(projectId, versionId, {
        type: 'status',
        message: `${prefix} CLI done`,
        ts: new Date().toISOString(),
      });
      return result;
    } catch (error: any) {
      this.pushCliLog(projectId, versionId, {
        type: 'error',
        message: `${prefix} CLI error: ${error.message || 'unknown error'}`,
        ts: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * 获取当前执行模式
   * 优先级: 角色配置 > 环境变量 > 默认(llm)
   */
  protected getExecutorMode(): ExecutorMode {
    // 1. 检查角色配置
    const roleConfig = this.role?.getExecutorConfig?.();
    if (roleConfig) {
      const modeSync = roleConfig.getModeSync?.();
      if (modeSync) {
        return modeSync;
      }
    }

    // 2. 检查角色特定的环境变量
    const roleProfile = this.role?.profile;
    if (roleProfile) {
      const roleEnvMode = process.env[`ROLE_${roleProfile.toUpperCase()}_EXECUTOR_MODE`];
      if (roleEnvMode === 'cli') {
        return 'cli';
      }
      if (roleEnvMode === 'llm') {
        return 'llm';
      }
    }

    // 3. 检查全局环境变量
    const envMode = process.env.DEFAULT_EXECUTOR_MODE;
    if (envMode === 'cli') {
      return 'cli';
    }
    if (envMode === 'llm') {
      return 'llm';
    }

    // 4. 默认 LLM 模式（保持向后兼容）
    return 'llm';
  }

  /**
   * 从环境变量收集多个 API key
   * 支持格式：CURSOR_API_KEY_0, CURSOR_API_KEY_1, CURSOR_API_KEY_2 等
   */
  private collectApiKeysFromEnv(prefix: string = 'CURSOR_API_KEY'): string[] {
    const apiKeys: string[] = [];
    let index = 0;

    // 收集所有 CURSOR_API_KEY_N 格式的环境变量
    let hasMoreKeys = true;
    while (hasMoreKeys) {
      const envKey = `${prefix}_${index}`;
      const apiKey = process.env[envKey];
      if (apiKey) {
        apiKeys.push(apiKey);
        index++;
      } else {
        hasMoreKeys = false;
      }
    }

    // 如果没有找到带索引的，检查是否有默认的 CURSOR_API_KEY
    if (apiKeys.length === 0 && process.env[prefix]) {
      apiKeys.push(process.env[prefix]);
    }

    return apiKeys;
  }

  /**
   * 获取 CLI 配置
   * 优先级：平台绑定的API key > 角色配置 > 环境变量
   */
  protected async getCLIConfig(): Promise<{ provider: CLIProviderType; config?: Partial<CLIProviderConfig> }> {
    // 优先级1: 检查平台绑定的API key
    const projectId = this.context?.get('projectId') as string | undefined;
    if (projectId) {
      try {
        const projectRepo = new ProjectRepository();
        const platformApiKey = await projectRepo.getCliApiKey(projectId);

        if (platformApiKey) {
          // 如果平台配置了API key，优先使用
          const roleConfig = this.role?.getExecutorConfig?.();
          const configSync = roleConfig?.getConfigSync?.();
          const cliProvider = configSync?.cliProvider || (process.env.DEFAULT_CLI_PROVIDER as CLIProviderType) || 'cursor';

          return {
            provider: cliProvider,
            config: {
              ...(configSync?.cliConfig || {}),
              apiKey: platformApiKey, // 使用平台API key，优先级最高
            },
          };
        }
      } catch (error: any) {
        // 如果查询失败，继续使用其他优先级
        // 不抛出错误，允许fallback到其他配置
      }
    }

    // 优先级2: 从角色配置获取
    const roleConfig = this.role?.getExecutorConfig?.();
    if (roleConfig) {
      const configSync = roleConfig.getConfigSync?.();
      if (configSync?.cliProvider) {
        // 如果角色配置中没有 apiKeys，尝试从环境变量补充
        const cliConfig = configSync.cliConfig || {};
        if (!cliConfig.apiKeys && !cliConfig.apiKey) {
          const apiKeys = this.collectApiKeysFromEnv();
          if (apiKeys.length > 0) {
            const apiKeyIndex = process.env.CURSOR_API_KEY_INDEX ? parseInt(process.env.CURSOR_API_KEY_INDEX, 10) : 0;
            return {
              provider: configSync.cliProvider,
              config: {
                ...cliConfig,
                apiKeys,
                apiKeyIndex: isNaN(apiKeyIndex) ? 0 : apiKeyIndex,
              },
            };
          }
        }
        return {
          provider: configSync.cliProvider,
          config: cliConfig,
        };
      }
    }

    // 从环境变量获取
    const roleProfile = this.role?.profile;
    if (roleProfile) {
      const providerEnv = process.env[`ROLE_${roleProfile.toUpperCase()}_CLI_PROVIDER`];
      if (providerEnv && ['cursor', 'aider', 'cline', 'custom'].includes(providerEnv)) {
        const modelEnv = process.env[`ROLE_${roleProfile.toUpperCase()}_CLI_MODEL`];
        const apiKeys = this.collectApiKeysFromEnv(`ROLE_${roleProfile.toUpperCase()}_CLI_API_KEY`);
        const apiKeyIndexEnv = process.env[`ROLE_${roleProfile.toUpperCase()}_CLI_API_KEY_INDEX`];
        const apiKeyIndex = apiKeyIndexEnv ? parseInt(apiKeyIndexEnv, 10) : 0;

        const config: Partial<CLIProviderConfig> = {};
        if (modelEnv) {
          config.model = modelEnv;
        }
        if (apiKeys.length > 0) {
          config.apiKeys = apiKeys;
          config.apiKeyIndex = isNaN(apiKeyIndex) ? 0 : apiKeyIndex;
        }

        return {
          provider: providerEnv as CLIProviderType,
          config: Object.keys(config).length > 0 ? config : undefined,
        };
      }
    }

    // 全局默认
    const defaultProvider = process.env.DEFAULT_CLI_PROVIDER;
    const defaultModel = process.env.CURSOR_CLI_MODEL;
    const apiKeys = this.collectApiKeysFromEnv();
    const apiKeyIndexEnv = process.env.CURSOR_API_KEY_INDEX;
    const apiKeyIndex = apiKeyIndexEnv ? parseInt(apiKeyIndexEnv, 10) : 0;

    const config: Partial<CLIProviderConfig> = {};
    if (defaultModel) {
      config.model = defaultModel;
    }
    if (apiKeys.length > 0) {
      config.apiKeys = apiKeys;
      config.apiKeyIndex = isNaN(apiKeyIndex) ? 0 : apiKeyIndex;
    }

    return {
      provider: (defaultProvider as CLIProviderType) || 'cursor',
      config: Object.keys(config).length > 0 ? config : undefined,
    };
  }

  /**
   * 获取默认工作目录
   * 优先使用版本化路径（如果有 versionId）
   */
  protected getDefaultWorkDir(): string | undefined {
    // 尝试从 context 获取
    if (this.context) {
      const applicationId = this.context.get('applicationId') as string | undefined;
      const projectId = this.context.get('projectId') as string | undefined;
      const versionId = this.context.get('versionId') as string | undefined;

      if (applicationId && projectId && versionId) {
        try {
          return WorkspaceManager.getProjectWorkspacePath({
            applicationId,
            projectId,
            versionId,
          });
        } catch {
          // 忽略错误
        }
      }
    }

    return undefined;
  }

  /**
   * 检查当前是否为 CLI 模式
   */
  protected isCLIMode(): boolean {
    return this.getExecutorMode() === 'cli';
  }

  /**
   * 检查当前是否为 LLM 模式
   */
  protected isLLMMode(): boolean {
    return this.getExecutorMode() === 'llm';
  }

  /**
   * 运行 CLI 命令（使用配置的提供商和模型）
   * 统一的 CLI 执行方法，自动从环境变量读取角色级别或全局配置
   * 返回完整的执行结果，包括 exitCode、stderr 等信息
   *
   * @param prompt 提示词
   * @param workDir 工作目录
   * @param options 执行选项
   * @returns CLI 执行结果（包含 output、exitCode、executionTime、stderr）
   */
  protected async runCLICommand(
    prompt: string,
    workDir: string,
    options?: { timeout?: number; abortSignal?: AbortSignal }
  ): Promise<CLIExecutionResult> {
    const cliConfig = await this.getCLIConfig();

    logger.info('BaseAction.runCLICommand: Executing CLI command', {
      action: this.name,
      provider: cliConfig.provider,
      model: cliConfig.config?.model,
      workDir,
      promptLength: prompt.length,
      hasAbortSignal: !!options?.abortSignal,
    });

    const provider = CLIProviderFactory.createProvider(cliConfig.provider, {
      ...cliConfig.config,
      timeout: options?.timeout,
      abortSignal: options?.abortSignal,
    });

    return provider.execute(prompt, workDir, {
      ...cliConfig.config,
      timeout: options?.timeout,
      abortSignal: options?.abortSignal,
    });
  }

  // ============================================
  // CLI 知识输入支持方法
  // 简化后直接利用 Cursor CLI 的原生上下文能力
  // ============================================

  /**
   * 构建知识输入引用指令
   * 指示 CLI 参考工作目录中的历史文档和代码
   *
   * 使用方式：在 prompt 中包含此引用，CLI 会自动读取相关文件
   *
   * @returns 知识输入引用文本
   */
  protected buildKnowledgeInputReference(): string {
    return `
【重要：知识输入】
请参考工作目录中的以下内容作为知识输入（这些是重要依据）：

1. 归档历史文档：docs-archive/mrd/, docs-archive/prd/
   - 已归档的历史版本，了解产品演进历史

2. 业务知识库：docs/business-knowledge/
   - 业务方上传的产品规范、业务流程等知识文档
   - 这些是重要的业务背景和约束条件

3. 当前文档：docs/mrd/, docs/prd/
   - 当前正在生成的文档

4. 开发规范：docs/dev-spec/
   - 各子项目的开发规范和架构说明

5. 代码实现：
   - ainative-app/src/: 移动端代码实现
   - ainative-backend/: 后端 API 和业务逻辑
   - ainative-shadow/src/: 管理后台功能
   - ainative-pc/src/: PC端代码实现

【功能冲突检测】
如果发现新需求/功能与现有实现存在冲突，请明确指出：
- 冲突点描述
- 影响范围
- 需要修改的现有功能
- 建议解决方案
`;
  }

  /**
   * 构建带知识输入的完整 prompt
   *
   * @param basePrompt 基础 prompt
   * @param includeKnowledgeInput 是否包含知识输入引用（默认 true）
   * @returns 完整的 prompt
   */
  protected buildPromptWithKnowledgeInput(basePrompt: string, includeKnowledgeInput: boolean = true): string {
    if (!includeKnowledgeInput || !this.isCLIMode()) {
      return basePrompt;
    }
    return `${this.buildKnowledgeInputReference()}\n\n${basePrompt}`;
  }

  /**
   * 保存文件到workspace（统一方法）
   * @param filePath 相对路径
   * @param content 文件内容
   * @param options workspace选项
   */
  protected async saveToWorkspace(filePath: string, content: string, options?: WorkspaceOptions): Promise<void> {
    // 使用 validateWorkspaceOptions 确保从 context 中获取必要的 ID
    const validatedOptions = this.validateWorkspaceOptions(options, options?.documentType);
    return WorkspaceManager.saveToWorkspace(filePath, content, validatedOptions);
  }

  /**
   * 批量保存文件到workspace
   * @param files 文件数组
   * @param options workspace选项
   */
  protected async saveFilesToWorkspace(files: Array<{ path: string; content: string }>, options?: WorkspaceOptions): Promise<void> {
    // 使用 validateWorkspaceOptions 确保从 context 中获取必要的 ID
    const validatedOptions = this.validateWorkspaceOptions(options, options?.documentType);
    return WorkspaceManager.saveFilesToWorkspace(files, validatedOptions);
  }

  /**
   * 获取workspace目录路径
   * @param options workspace选项
   */
  protected getWorkspaceDir(options?: WorkspaceOptions): string {
    return WorkspaceManager.getWorkspaceDir(options);
  }

  /**
   * 读取workspace文件
   * @param filePath 相对路径
   * @param options workspace选项
   */
  protected async readWorkspaceFile(filePath: string, options?: WorkspaceOptions): Promise<string | null> {
    return WorkspaceManager.readFile(filePath, options);
  }

  /**
   * 读取workspace所有文件
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   */
  protected async readAllFromWorkspace(options?: WorkspaceOptions, filter?: (filename: string) => boolean): Promise<string> {
    return WorkspaceManager.readAllFromWorkspace(options, filter);
  }

  /**
   * 删除workspace文件
   * @param filePath 相对路径
   * @param options workspace选项
   * @returns 是否成功删除
   */
  protected async deleteWorkspaceFile(filePath: string, options?: WorkspaceOptions): Promise<boolean> {
    return WorkspaceManager.deleteFile(filePath, options);
  }

  /**
   * 删除匹配模式的多个workspace文件
   * @param pattern 文件名匹配模式（正则表达式）
   * @param options workspace选项
   * @returns 删除的文件数量
   */
  protected async deleteWorkspaceFilesByPattern(pattern: RegExp, options?: WorkspaceOptions): Promise<number> {
    return WorkspaceManager.deleteFilesByPattern(pattern, options);
  }

  /**
   * 列出workspace文件
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   * @returns 文件名数组
   */
  protected async listWorkspaceFiles(options?: WorkspaceOptions, filter?: (filename: string) => boolean): Promise<string[]> {
    return WorkspaceManager.listFiles(options, filter);
  }

  // ============================================
  // 通用工具方法（减少子类重复代码）
  // ============================================

  /**
   * 验证并构建 WorkspaceOptions
   * 从 options 和 context 中提取 applicationId/projectId/versionId
   * @param options 可选的部分 WorkspaceOptions
   * @param documentType 可选的文档类型覆盖
   * @throws Error 如果缺少必需参数 applicationId、projectId 或 versionId
   * @returns 完整的 WorkspaceOptions
   */
  protected validateWorkspaceOptions(options?: Partial<WorkspaceOptions>, documentType?: string): WorkspaceOptions {
    const applicationId = options?.applicationId || (this.context?.get('applicationId') as string | undefined);
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const versionId = options?.versionId || (this.context?.get('versionId') as string | undefined);

    if (!applicationId) {
      throw new Error(`applicationId is required for ${this.name} action.`);
    }
    if (!projectId) {
      throw new Error(`projectId is required for ${this.name} action.`);
    }
    if (!versionId) {
      throw new Error(`versionId is required for ${this.name} action.`);
    }

    return {
      applicationId,
      projectId,
      versionId,
      documentType: documentType || options?.documentType,
    };
  }

  /**
   * 获取版本化的工作空间目录
   * 自动从 context 获取 applicationId, projectId, versionId
   * @param documentType 文档类型，如 'MRD', 'PRD', 'DESIGN', 'TEST'
   * @returns 完整的工作空间目录路径
   */
  protected getVersionedWorkspaceDir(documentType: string): string {
    const options = this.validateWorkspaceOptions(undefined, documentType);
    return this.getWorkspaceDir(options);
  }

  /**
   * 加载系统提示词（带用户定制支持）
   * @param domain 域，如 'prd', 'design', 'test', 'mrd'
   * @param promptType 提示词类型，如 'system_prompt', 'review_system_prompt'
   * @param defaultPrompt 默认提示词（当数据库中没有定制时使用）
   * @returns 系统提示词
   */
  protected async loadSystemPrompt(domain: string, promptType: string, defaultPrompt: string): Promise<string> {
    const userId = this.context?.get('userId');
    // Cast domain to PromptType - valid values are: 'mrd', 'prd', 'design', 'code', 'test', 'task'
    return loadPrompt(userId, domain as any, promptType, defaultPrompt);
  }

  /**
   * 从 workspace 读取指定类型的文档
   * @param filename 文件名，如 'PRD.md', 'DESIGN.md'
   * @param options workspace 选项
   * @param documentType 覆盖文档类型（可选）
   * @returns 文档内容，如果文件不存在或读取失败则返回空字符串
   */
  protected async loadDocumentFromWorkspace(filename: string, options: WorkspaceOptions, documentType?: string): Promise<string> {
    try {
      const content = await this.readWorkspaceFile(filename, {
        ...options,
        documentType: documentType || options.documentType,
      });
      if (content) {
        logger.info(`${this.name}: Loaded ${filename} from workspace`, {
          contentLength: content.length,
        });
        return content;
      }
    } catch (error: any) {
      logger.warn(`${this.name}: Failed to read ${filename} from workspace`, {
        error: error.message,
      });
    }
    return '';
  }

  /**
   * 从 workspace 读取所有代码文件
   * 支持的文件扩展名：.ts, .js, .tsx, .jsx, .py, .java, .go, .rs, .cpp, .c
   * @param options workspace 选项
   * @returns 合并后的代码内容，每个文件以 "// File: filename" 开头
   */
  protected async loadCodeFilesFromWorkspace(options: WorkspaceOptions): Promise<string> {
    const codeFileExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];

    try {
      const workspaceDir = this.getWorkspaceDir({
        ...options,
        documentType: 'CODE',
      });

      // 检查目录是否存在
      try {
        await fs.access(workspaceDir);
      } catch {
        logger.warn(`${this.name}: Code workspace directory does not exist`, {
          workspaceDir,
        });
        return '';
      }

      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
      const codeEntries = entries
        .filter((entry) => entry.isFile() && codeFileExtensions.some((ext) => entry.name.endsWith(ext)))
        .sort((a, b) => a.name.localeCompare(b.name));

      const codeFiles: string[] = [];
      for (const entry of codeEntries) {
        const filePath = path.join(workspaceDir, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        codeFiles.push(`// File: ${entry.name}\n${content}`);
      }

      const mergedCode = codeFiles.join('\n\n---\n\n');

      if (codeEntries.length > 0) {
        logger.info(`${this.name}: Read ${codeEntries.length} code files from workspace`, {
          workspaceDir,
          fileCount: codeEntries.length,
          totalLength: mergedCode.length,
        });
      }

      return mergedCode;
    } catch (error: any) {
      logger.warn(`${this.name}: Failed to read code files from workspace`, {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * 创建标准化的 Action 输出
   * 自动添加 timestamp 字段
   * @param content 输出内容
   * @param data 输出数据，必须包含 type 和 filename
   * @returns 标准化的 IActionOutput
   */
  protected createActionOutput(
    content: string,
    data: {
      type: string;
      filename: string;
      workspaceDir?: string;
      passed?: boolean;
      [key: string]: any;
    }
  ): IActionOutput {
    return {
      content,
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ============================================
  // Handler 模式封装方法（统一 CLI/LLM 模式处理）
  // ============================================

  /**
   * 获取 Handler 选项，自动添加 useFilePath
   * 根据当前执行模式自动设置 useFilePath 参数
   * @param options 原始选项
   * @returns 带有 useFilePath 的选项
   */
  protected getHandlerOptions<T extends WorkspaceOptions>(options: T): T & { useFilePath: boolean } {
    return {
      ...options,
      useFilePath: this.isCLIMode(),
    };
  }

  /**
   * 获取缓存的 Handler 实例
   * 使用 Map 管理多个 handler 实例的缓存，支持延迟初始化
   * @param key 缓存键名，如 'review', 'improve', 'write'
   * @param initializer Handler 初始化函数
   * @returns Handler 实例
   */
  protected async getCachedHandler<T>(key: string, initializer: () => Promise<T>): Promise<T> {
    if (this._handlerCache.has(key)) {
      return this._handlerCache.get(key) as T;
    }
    const handler = await initializer();
    this._handlerCache.set(key, handler);
    return handler;
  }

  /**
   * 执行 Review Handler 并创建标准输出
   * 封装 DocumentReviewHandler 的执行流程
   * @param handler ReviewHandler 实例
   * @param content 文档内容
   * @param options Review 选项
   * @param outputConfig 输出配置
   * @returns 标准化的 Action 输出
   */
  protected async executeReviewHandler(
    handler: { execute: (content: string, options: ReviewOptions) => Promise<ReviewResult> },
    content: string,
    options: ReviewOptions,
    outputConfig: { type: string; filename: string; [key: string]: any }
  ): Promise<IActionOutput> {
    const handlerOptions = this.getHandlerOptions(options);
    const { reviewResult, passed } = await handler.execute(content, handlerOptions);

    return this.createActionOutput(reviewResult, {
      ...outputConfig,
      passed,
      workspaceDir: this.getWorkspaceDir(options),
    });
  }

  /**
   * 执行 Improve Handler 并创建标准输出
   * 封装 DocumentImproveHandler 的执行流程
   * @param handler ImproveHandler 实例
   * @param input 输入内容
   * @param options Improve 选项
   * @param outputConfig 输出配置
   * @returns 标准化的 Action 输出
   */
  protected async executeImproveHandler(
    handler: { execute: (input: string, options: ImproveOptions) => Promise<ImproveResult> },
    input: string,
    options: ImproveOptions,
    outputConfig: { type: string; filename: string; documentType: string; [key: string]: any }
  ): Promise<IActionOutput> {
    const handlerOptions = this.getHandlerOptions(options);
    const result = await handler.execute(input, handlerOptions);

    return this.createActionOutput(result.content, {
      ...outputConfig,
      improvedSectionCount: result.improvedSectionCount,
      totalSectionCount: result.totalSectionCount,
      hasImprovement: result.improvedSectionCount > 0,
      needsReReview: result.needsReReview,
      workspaceDir: this.getWorkspaceDir(options),
    });
  }

  /**
   * 执行 Write Handler 并创建标准输出
   * 封装 DocumentWriteHandler 的执行流程
   * @param handler WriteHandler 实例
   * @param input 输入内容
   * @param options Write 选项
   * @param outputConfig 输出配置
   * @returns 标准化的 Action 输出
   */
  protected async executeWriteHandler(
    handler: { execute: (input: string, options: WriteOptions) => Promise<WriteResult> },
    input: string,
    options: WriteOptions,
    outputConfig: { type: string; [key: string]: any }
  ): Promise<IActionOutput> {
    const handlerOptions = this.getHandlerOptions(options);
    const result = await handler.execute(input, handlerOptions);

    return this.createActionOutput(result.content, {
      ...outputConfig,
      filename: result.filename,
      workspaceDir: result.workspaceDir,
    });
  }

  /**
   * Convert action to string representation
   */
  toString(): string {
    return `${this.name}${this.description ? ` - ${this.description}` : ''}`;
  }

  /**
   * Serialize action to JSON
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      type: this.constructor.name,
      status: ActionStatus.PENDING, // Status is managed by StateManager, not stored in memory
    };
  }
}

export default BaseAction;
