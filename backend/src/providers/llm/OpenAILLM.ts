/**
 * OpenAI LLM Provider
 * Integrates with OpenAI API (GPT-4, GPT-3.5, etc.)
 */

import OpenAI from 'openai';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';
import { logger } from '../../utils';

export class OpenAILLM extends BaseLLM {
  private client: OpenAI;

  constructor(config: ILLMConfig) {
    super(config);
    
    // 从环境变量读取超时时间，默认 5 分钟（300000ms）
    const timeout = parseInt(process.env.REQUEST_TIMEOUT || '300') * 1000;

    logger.info('OpenAILLM: Initializing client', {
      model: config.model,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      timeout: timeout,
      timeoutSeconds: timeout / 1000,
    });
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: timeout,
    });
  }

  /**
   * Ensure numeric type for API parameters
   */
  private ensureNumber(value: number | string | undefined, defaultValue: number): number {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'number') {
      return value;
    }
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Chat completion using OpenAI API
   */
  async acompletion(messages: any[], abortSignal?: AbortSignal): Promise<ILLMResponse> {
    // Check cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }
    
    try {
      // Ensure numeric types for API parameters
      const temperature = this.ensureNumber(this.config.temperature, 0.7);
      const maxTokens = this.ensureNumber(this.config.maxTokens, 8000);
      const topP = this.ensureNumber(this.config.topP, 1.0);

      const completion = await retry(
        async () => {
          // Check cancellation before each retry attempt
          if (abortSignal?.aborted) {
            throw new Error('LLM call was cancelled');
          }
          
          return await this.client.chat.completions.create({
            model: this.config.model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            top_p: topP,
          });
        },
        3, // max attempts
        1000 // initial delay ms
      );
      
      // Check cancellation after completion
      if (abortSignal?.aborted) {
        throw new Error('LLM call was cancelled');
      }

      // Validate response structure
      if (!completion || !completion.choices || completion.choices.length === 0) {
        throw new Error(
          `Invalid API response: missing choices. Response: ${JSON.stringify(completion)}`
        );
      }

      const firstChoice = completion.choices[0];
      if (!firstChoice || !firstChoice.message) {
        throw new Error(
          `Invalid API response: missing message in choice. Response: ${JSON.stringify(completion)}`
        );
      }

      const response: ILLMResponse = {
        content: firstChoice.message.content || '',
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        model: completion.model || this.config.model,
      };

      // Update cost tracking
      this.updateCost(response.usage);
      this.logCall(messages, response);

      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown OpenAI API error';
      const statusCode = error.status || error.statusCode;
      
      throw new LLMAPIError(
        `OpenAI API error: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Stream completion (for future implementation)
   */
  async *acompletionStream(messages: any[], abortSignal?: AbortSignal): AsyncGenerator<string> {
    // Check cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }

    try {
      // Ensure numeric types for API parameters
      const temperature = this.ensureNumber(this.config.temperature, 0.7);
      const maxTokens = this.ensureNumber(this.config.maxTokens, 8000);

      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        // Check cancellation during streaming
        if (abortSignal?.aborted) {
          throw new Error('LLM call was cancelled');
        }

        const content = chunk.choices?.[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      if (abortSignal?.aborted || error.message === 'LLM call was cancelled') {
        throw new Error('LLM call was cancelled');
      }
      throw new LLMAPIError(`OpenAI streaming error: ${error.message}`);
    }
  }
}

export default OpenAILLM;

