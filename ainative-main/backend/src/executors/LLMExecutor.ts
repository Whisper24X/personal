/**
 * LLM Executor
 * LLM 执行器实现
 * 
 * 使用大模型 API 执行任务，包装现有的 LLM 调用逻辑
 */

import { IExecutor, ExecutorMode, ExecutorOptions, LLMExecutorContext } from './types';
import { logger } from '../utils/logger';

/**
 * LLM 执行器
 */
export class LLMExecutor implements IExecutor {
  private context: LLMExecutorContext;

  constructor(context: LLMExecutorContext) {
    this.context = context;
  }

  /**
   * 获取执行模式
   */
  getMode(): ExecutorMode {
    return 'llm';
  }

  /**
   * 执行提示词
   * @param prompt 提示词内容
   * @param options 执行选项
   */
  async execute(prompt: string, options?: ExecutorOptions): Promise<string> {
    const { llm, abortSignal } = this.context;

    if (!llm) {
      throw new Error('LLMExecutor: LLM instance not available');
    }

    // 检查取消信号
    if (abortSignal?.aborted) {
      throw new Error('LLMExecutor: Execution was cancelled');
    }

    const startTime = Date.now();
    const logContext = {
      mode: 'llm',
      promptLength: prompt.length,
      hasSystemPrompt: !!options?.systemPrompt,
    };

    logger.info('LLMExecutor: Starting execution', logContext);

    try {
      let result: string;

      if (options?.systemPrompt) {
        // 使用 aask 方法（带系统提示词）
        result = await llm.aask(prompt, [options.systemPrompt], abortSignal);
      } else {
        // 使用 aask 方法（不带系统提示词）
        result = await llm.aask(prompt, undefined, abortSignal);
      }

      // 再次检查取消信号
      if (abortSignal?.aborted) {
        throw new Error('LLMExecutor: Execution was cancelled');
      }

      const executionTime = Date.now() - startTime;

      logger.info('LLMExecutor: Execution completed', {
        ...logContext,
        executionTimeMs: executionTime,
        resultLength: result.length,
      });

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('LLMExecutor: Execution failed', {
        ...logContext,
        executionTimeMs: executionTime,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 使用聊天补全方式执行
   * @param messages 聊天消息数组
   * @param _options 执行选项（预留参数）
   */
  async executeCompletion(
    messages: Array<{ role: string; content: string }>,
    _options?: ExecutorOptions
  ): Promise<any> {
    const { llm, abortSignal } = this.context;

    if (!llm) {
      throw new Error('LLMExecutor: LLM instance not available');
    }

    // 检查取消信号
    if (abortSignal?.aborted) {
      throw new Error('LLMExecutor: Execution was cancelled');
    }

    const startTime = Date.now();
    const logContext = {
      mode: 'llm',
      messagesCount: messages.length,
    };

    logger.info('LLMExecutor: Starting completion execution', logContext);

    try {
      const result = await llm.acompletion(messages, abortSignal);

      // 再次检查取消信号
      if (abortSignal?.aborted) {
        throw new Error('LLMExecutor: Execution was cancelled');
      }

      const executionTime = Date.now() - startTime;

      logger.info('LLMExecutor: Completion execution completed', {
        ...logContext,
        executionTimeMs: executionTime,
        contentLength: result.content?.length || 0,
      });

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('LLMExecutor: Completion execution failed', {
        ...logContext,
        executionTimeMs: executionTime,
        error: error.message,
      });

      throw error;
    }
  }
}

export default LLMExecutor;
