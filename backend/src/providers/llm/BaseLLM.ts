/**
 * Base LLM class
 * Abstract interface for all LLM providers
 */

import { ILLMConfig, ILLMResponse, ILLMUsage } from '@mind2build/shared';
import { CostManager } from '../../core/context/CostManager';
import { logger } from '../../utils';

export abstract class BaseLLM {
  config: ILLMConfig;
  costManager?: CostManager;
  
  constructor(config: ILLMConfig) {
    this.config = config;
  }

  /**
   * Simple question-answer interface
   * @param prompt - The question/prompt
   * @param systemMsgs - Optional system messages
   * @param abortSignal - Optional abort signal for cancellation
   * @returns LLM response as string
   */
  async aask(prompt: string, systemMsgs?: string[], abortSignal?: AbortSignal): Promise<string> {
    // Check cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }
    
    const messages: any[] = [];
    
    // Add system messages
    if (systemMsgs && systemMsgs.length > 0) {
      messages.push({
        role: 'system',
        content: systemMsgs.join('\n\n'),
      });
    }
    
    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });
    
    const response = await this.acompletion(messages, abortSignal);
    
    // Check cancellation after completion
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }
    
    return response.content;
  }

  /**
   * Chat completion interface
   * @param messages - Array of chat messages
   * @param abortSignal - Optional abort signal for cancellation
   * @returns Full LLM response with usage info
   */
  abstract acompletion(messages: any[], abortSignal?: AbortSignal): Promise<ILLMResponse>;

  /**
   * Stream completion (optional, for future implementation)
   */
  async *acompletionStream(messages: any[], abortSignal?: AbortSignal): AsyncGenerator<string> {
    // Default implementation: return full response
    const response = await this.acompletion(messages, abortSignal);
    yield response.content;
  }

  /**
   * Update cost tracking
   */
  protected updateCost(usage: ILLMUsage): void {
    if (this.costManager) {
      this.costManager.updateCost(this.config.model, usage);
    }
  }

  /**
   * Log LLM call for debugging
   * @param messages - Chat messages
   * @param response - LLM response
   * @param context - Optional context with role and action info
   */
  protected logCall(messages: any[], response: ILLMResponse, context?: { role?: string; action?: string; status?: string }): void {
    logger.debug('LLM call', {
      provider: this.config.provider,
      model: this.config.model,
      ...(context || {}),
      messages: messages.length,
      responseLength: response.content.length,
      usage: response.usage,
    });
  }

  /**
   * Get provider name
   */
  get provider(): string {
    return this.config.provider;
  }

  /**
   * Get model name
   */
  get model(): string {
    return this.config.model;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      provider: this.config.provider,
      model: this.config.model,
      config: this.config,
    };
  }
}

export default BaseLLM;

