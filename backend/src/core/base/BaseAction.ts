/**
 * Base Action class
 * Abstract interface for all actions that agents can perform
 */

import { IActionOutput, ActionStatus } from '@mind2build/shared';
import { WorkspaceManager, WorkspaceOptions } from '../../utils/WorkspaceManager';
import { Context } from '../context/Context';
import { logger } from '../../utils';

export abstract class BaseAction {
  name: string;
  description?: string;

  // Action status is now managed by StateManager (database-only)
  // Removed in-memory status field - status is read from database via StateManager

  // LLM instance will be injected by Role
  protected llm?: any;
  
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
   * Set LLM instance for this action
   */
  setLLM(llm: any): void {
    this.llm = llm;
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
   * @param prompt - The prompt to send to LLM
   * @param systemMsgs - Optional system messages
   */
  protected async aask(prompt: string, systemMsgs?: string[]): Promise<string> {
    this.checkCancellation();
    
    if (!this.llm) {
      throw new Error('LLM not set for action');
    }
    
    const logContext = this.getLogContext();
    logger.info('BaseAction: Calling LLM aask', {
      ...logContext,
      promptLength: prompt.length,
      systemMsgsCount: systemMsgs?.length || 0,
    });
    
    const result = await this.llm.aask(prompt, systemMsgs, this.abortSignal);
    
    this.checkCancellation();
    
    logger.info('BaseAction: LLM aask completed', {
      ...logContext,
      resultLength: result.length,
    });
    
    return result;
  }

  /**
   * Helper method for chat completion
   * @param messages - Chat messages
   */
  protected async acompletion(messages: any[]): Promise<any> {
    this.checkCancellation();
    
    if (!this.llm) {
      throw new Error('LLM not set for action');
    }
    
    const logContext = this.getLogContext();
    logger.info('BaseAction: Calling LLM acompletion', {
      ...logContext,
      messagesCount: messages.length,
    });
    
    const result = await this.llm.acompletion(messages, this.abortSignal);
    
    this.checkCancellation();
    
    logger.info('BaseAction: LLM acompletion completed', {
      ...logContext,
      contentLength: result.content?.length || 0,
      usage: result.usage,
    });
    
    return result;
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

