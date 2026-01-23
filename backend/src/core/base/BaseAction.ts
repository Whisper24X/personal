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
import { logger } from '../../utils';
import {
  ExecutorMode,
  ExecutorOptions,
  CLIProviderType,
  CLIProviderConfig,
} from '../../executors/types';
import { CLIExecutor } from '../../executors/CLIExecutor';

export abstract class BaseAction {
  name: string;
  description?: string;

  // Action status is now managed by StateManager (database-only)
  // Removed in-memory status field - status is read from database via StateManager

  // Custom LLM instance (only for role-specific config or special scenarios)
  // If not set, LLM is dynamically obtained from Context
  protected _customLLM?: any;
  
  // Context instance will be injected by Role
  protected context?: Context;

  // AbortSignal for cancellation support
  protected abortSignal?: AbortSignal;

  // Role instance (set by Role.setActions)
  protected role?: any;

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
   * @param messages - Chat messages
   */
  protected async acompletion(messages: any[]): Promise<any> {
    this.checkCancellation();
    
    const currentLLM = this.llm;
    if (!currentLLM) {
      throw new Error('LLM not available: Context not set for action');
    }
    
    const logContext = this.getLogContext();
    logger.info('BaseAction: Calling LLM acompletion', {
      ...logContext,
      messagesCount: messages.length,
    });
    
    const result = await currentLLM.acompletion(messages, this.abortSignal);
    
    this.checkCancellation();
    
    logger.info('BaseAction: LLM acompletion completed', {
      ...logContext,
      contentLength: result.content?.length || 0,
      usage: result.usage,
    });
    
    return result;
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
    const systemMsgs = options?.systemPrompt ? [options.systemPrompt] : undefined;

    logger.info('BaseAction: executeLLM calling LLM API', {
      ...logContext,
      promptLength: prompt.length,
      hasSystemPrompt: !!options?.systemPrompt,
    });

    const result = await currentLLM.aask(prompt, systemMsgs, this.abortSignal);

    this.checkCancellation();

    logger.info('BaseAction: executeLLM completed', {
      ...logContext,
      resultLength: result.length,
    });

    return result;
  }

  /**
   * 使用 CLI 模式执行
   */
  protected async executeCLI(prompt: string, options?: ExecutorOptions): Promise<string> {
    const workDir = options?.workDir || this.getDefaultWorkDir();
    
    if (!workDir) {
      throw new Error('BaseAction: workDir is required for CLI mode execution');
    }

    const cliConfig = this.getCLIConfig();
    const executor = new CLIExecutor({
      providerType: cliConfig.provider,
      providerConfig: cliConfig.config,
      defaultWorkDir: workDir,
    });

    return await executor.execute(prompt, {
      ...options,
      workDir,
      abortSignal: this.abortSignal,
    });
  }

  /**
   * 使用 CLI 模式执行带重试
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

    const cliConfig = this.getCLIConfig();
    const executor = new CLIExecutor({
      providerType: cliConfig.provider,
      providerConfig: cliConfig.config,
      defaultWorkDir: workDir,
    });

    return await executor.executeWithRetry(prompt, checkPrompt, {
      ...options,
      workDir,
      abortSignal: this.abortSignal,
    });
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
      if (roleEnvMode === 'cli' || roleEnvMode === 'llm') {
        return roleEnvMode;
      }
    }

    // 3. 检查全局环境变量
    const envMode = process.env.DEFAULT_EXECUTOR_MODE;
    if (envMode === 'cli' || envMode === 'llm') {
      return envMode;
    }

    // 4. 默认 LLM 模式（保持向后兼容）
    return 'llm';
  }

  /**
   * 获取 CLI 配置
   */
  protected getCLIConfig(): { provider: CLIProviderType; config?: Partial<CLIProviderConfig> } {
    // 从角色配置获取
    const roleConfig = this.role?.getExecutorConfig?.();
    if (roleConfig) {
      const configSync = roleConfig.getConfigSync?.();
      if (configSync?.cliProvider) {
        return {
          provider: configSync.cliProvider,
          config: configSync.cliConfig,
        };
      }
    }

    // 从环境变量获取
    const roleProfile = this.role?.profile;
    if (roleProfile) {
      const providerEnv = process.env[`ROLE_${roleProfile.toUpperCase()}_CLI_PROVIDER`];
      if (providerEnv && ['cursor', 'aider', 'cline', 'custom'].includes(providerEnv)) {
        const modelEnv = process.env[`ROLE_${roleProfile.toUpperCase()}_CLI_MODEL`];
        return {
          provider: providerEnv as CLIProviderType,
          config: modelEnv ? { model: modelEnv } : undefined,
        };
      }
    }

    // 全局默认
    const defaultProvider = process.env.DEFAULT_CLI_PROVIDER;
    const defaultModel = process.env.CURSOR_CLI_MODEL;
    
    return {
      provider: (defaultProvider as CLIProviderType) || 'cursor',
      config: defaultModel ? { model: defaultModel } : undefined,
    };
  }

  /**
   * 获取默认工作目录
   */
  protected getDefaultWorkDir(): string | undefined {
    // 尝试从 context 获取
    if (this.context) {
      const applicationId = this.context.get('applicationId') as string | undefined;
      const projectId = this.context.get('projectId') as string | undefined;
      
      if (applicationId && projectId) {
        try {
          return WorkspaceManager.getProjectWorkspacePath({
            applicationId,
            projectId,
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
   * 保存文件到workspace（统一方法）
   * @param filePath 相对路径
   * @param content 文件内容
   * @param options workspace选项
   */
  protected async saveToWorkspace(
    filePath: string,
    content: string,
    options?: WorkspaceOptions
  ): Promise<void> {
    return WorkspaceManager.saveToWorkspace(filePath, content, options);
  }

  /**
   * 批量保存文件到workspace
   * @param files 文件数组
   * @param options workspace选项
   */
  protected async saveFilesToWorkspace(
    files: Array<{ path: string; content: string }>,
    options?: WorkspaceOptions
  ): Promise<void> {
    return WorkspaceManager.saveFilesToWorkspace(files, options);
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
  protected async readWorkspaceFile(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<string | null> {
    return WorkspaceManager.readFile(filePath, options);
  }

  /**
   * 读取workspace所有文件
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   */
  protected async readAllFromWorkspace(
    options?: WorkspaceOptions,
    filter?: (filename: string) => boolean
  ): Promise<string> {
    return WorkspaceManager.readAllFromWorkspace(options, filter);
  }

  /**
   * 删除workspace文件
   * @param filePath 相对路径
   * @param options workspace选项
   * @returns 是否成功删除
   */
  protected async deleteWorkspaceFile(
    filePath: string,
    options?: WorkspaceOptions
  ): Promise<boolean> {
    return WorkspaceManager.deleteFile(filePath, options);
  }

  /**
   * 删除匹配模式的多个workspace文件
   * @param pattern 文件名匹配模式（正则表达式）
   * @param options workspace选项
   * @returns 删除的文件数量
   */
  protected async deleteWorkspaceFilesByPattern(
    pattern: RegExp,
    options?: WorkspaceOptions
  ): Promise<number> {
    return WorkspaceManager.deleteFilesByPattern(pattern, options);
  }

  /**
   * 列出workspace文件
   * @param options workspace选项
   * @param filter 可选的文件过滤函数
   * @returns 文件名数组
   */
  protected async listWorkspaceFiles(
    options?: WorkspaceOptions,
    filter?: (filename: string) => boolean
  ): Promise<string[]> {
    return WorkspaceManager.listFiles(options, filter);
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

