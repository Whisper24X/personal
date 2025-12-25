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
   * @returns LLM response as string
   */
  async aask(prompt: string, systemMsgs?: string[]): Promise<string> {
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
    
    const response = await this.acompletion(messages);
    return response.content;
  }

  /**
   * Chat completion interface
   * @param messages - Array of chat messages
   * @returns Full LLM response with usage info
   */
  abstract acompletion(messages: any[]): Promise<ILLMResponse>;

  /**
   * Stream completion (optional, for future implementation)
   */
  async *acompletionStream(messages: any[]): AsyncGenerator<string> {
    // Default implementation: return full response
    const response = await this.acompletion(messages);
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
   */
  protected logCall(messages: any[], response: ILLMResponse): void {
    logger.debug('LLM call', {
      provider: this.config.provider,
      model: this.config.model,
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

