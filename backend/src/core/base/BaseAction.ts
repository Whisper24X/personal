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
import {
  ExecutorMode,
  ExecutorOptions,
  CLIProviderType,
  CLIProviderConfig,
} from '../../executors/types';
import { CLIExecutor } from '../../executors/CLIExecutor';
import * as fs from 'fs/promises';
import * as path from 'path';
// Handler types for mode encapsulation
import type {
  ReviewOptions,
  ReviewResult,
  ImproveOptions,
  ImproveResult,
  WriteOptions,
  WriteResult,
} from '../../utils/document/types';

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

  // Handler cache for lazy initialization
  private _handlerCache: Map<string, any> = new Map();

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
   * 支持双模式：根据配置自动选择 LLM 或 CLI 模式执行
   * @param messages - Chat messages
   */
  protected async acompletion(messages: any[]): Promise<any> {
    this.checkCancellation();

    // 从 messages 提取 prompt 和 system message
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const userMsg = messages.find(m => m.role === 'user')?.content || 
                   messages[messages.length - 1]?.content || '';

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

  // ============================================
  // 通用工具方法（减少子类重复代码）
  // ============================================

  /**
   * 验证并构建 WorkspaceOptions
   * 从 options 和 context 中提取 applicationId/projectId/version
   * @param options 可选的部分 WorkspaceOptions
   * @param documentType 可选的文档类型覆盖
   * @throws Error 如果缺少必需参数 applicationId 或 projectId
   * @returns 完整的 WorkspaceOptions
   */
  protected validateWorkspaceOptions(
    options?: Partial<WorkspaceOptions>,
    documentType?: string
  ): WorkspaceOptions {
    const applicationId = options?.applicationId || (this.context?.get('applicationId') as string | undefined);
    const projectId = options?.projectId || (this.context?.get('projectId') as string | undefined);
    const version = options?.version || (this.context?.get('version') as number | undefined) || 1;

    if (!applicationId) {
      throw new Error(`applicationId is required for ${this.name} action.`);
    }
    if (!projectId) {
      throw new Error(`projectId is required for ${this.name} action.`);
    }

    return {
      applicationId,
      projectId,
      version,
      documentType: documentType || options?.documentType,
      workspacePath: options?.workspacePath,
    };
  }

  /**
   * 加载系统提示词（带用户定制支持）
   * @param domain 域，如 'prd', 'design', 'test', 'mrd'
   * @param promptType 提示词类型，如 'system_prompt', 'review_system_prompt'
   * @param defaultPrompt 默认提示词（当数据库中没有定制时使用）
   * @returns 系统提示词
   */
  protected async loadSystemPrompt(
    domain: string,
    promptType: string,
    defaultPrompt: string
  ): Promise<string> {
    const userId = this.context?.get('userId');
    return loadPrompt(userId, domain, promptType, defaultPrompt);
  }

  /**
   * 从 workspace 读取指定类型的文档
   * @param filename 文件名，如 'PRD.md', 'DESIGN.md'
   * @param options workspace 选项
   * @param documentType 覆盖文档类型（可选）
   * @returns 文档内容，如果文件不存在或读取失败则返回空字符串
   */
  protected async loadDocumentFromWorkspace(
    filename: string,
    options: WorkspaceOptions,
    documentType?: string
  ): Promise<string> {
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
  protected async loadCodeFilesFromWorkspace(
    options: WorkspaceOptions
  ): Promise<string> {
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
        .filter(entry => entry.isFile() && codeFileExtensions.some(ext => entry.name.endsWith(ext)))
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
  protected async getCachedHandler<T>(
    key: string,
    initializer: () => Promise<T>
  ): Promise<T> {
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

