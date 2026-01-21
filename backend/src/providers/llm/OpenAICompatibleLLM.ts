/**
 * OpenAI Compatible LLM Provider
 * 
 * A unified LLM class that supports all OpenAI-compatible providers
 * by configuring different baseURLs. Supports:
 * - OpenAI (GPT-4, GPT-3.5, etc.)
 * - ARK (ByteDance Doubao)
 * - ZhipuAI (GLM-4, GLM-4-Flash)
 * - Anthropic, Gemini, Ollama, and other OpenAI-compatible providers
 */

import OpenAI from 'openai';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';
import { logger } from '../../utils';

/**
 * Default baseURL mapping for known providers
 * Providers not listed here will use the configured baseURL or OpenAI SDK default
 */
const PROVIDER_BASE_URLS: Record<string, string> = {
  ark: 'https://ark.cn-beijing.volces.com/api/v3',
  zhipuai: 'https://open.bigmodel.cn/api/paas/v4',
  // OpenAI uses SDK default, no need to specify
  // Other providers (anthropic, gemini, ollama, etc.) use user-configured baseURL
};

/**
 * Default max tokens for different providers
 */
const PROVIDER_DEFAULT_MAX_TOKENS: Record<string, number> = {
  ark: 32000,
  zhipuai: 8000,
  openai: 8000,
};

export class OpenAICompatibleLLM extends BaseLLM {
  private client: OpenAI;
  private timeout: number;

  constructor(config: ILLMConfig) {
    super(config);

    // Get timeout from environment variable, default 5 minutes (300000ms)
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT || '300') * 1000;

    // Determine baseURL: use config.baseURL if provided, otherwise use provider default
    const baseURL = config.baseURL || PROVIDER_BASE_URLS[config.provider];

    logger.info('OpenAICompatibleLLM: Initializing client', {
      provider: config.provider,
      model: config.model,
      baseURL: baseURL || 'OpenAI default',
      timeout: this.timeout,
      timeoutSeconds: this.timeout / 1000,
    });

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: baseURL,
      timeout: this.timeout,
    });
  }

  /**
   * Ensure numeric type for API parameters
   * Handles string values that may come from database or config files
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
   * Get default max tokens for the current provider
   */
  private getDefaultMaxTokens(): number {
    return PROVIDER_DEFAULT_MAX_TOKENS[this.config.provider] || 8000;
  }

  /**
   * Chat completion using OpenAI-compatible API
   */
  async acompletion(messages: any[], abortSignal?: AbortSignal): Promise<ILLMResponse> {
    // Check cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }

    const startTime = Date.now();
    const promptLength = JSON.stringify(messages).length;

    logger.info('OpenAICompatibleLLM: Starting completion request', {
      provider: this.config.provider,
      model: this.config.model,
      promptLength,
      timeout: this.timeout,
      timeoutSeconds: this.timeout / 1000,
    });

    try {
      // Ensure numeric types for API parameters
      const temperature = this.ensureNumber(this.config.temperature, 0.7);
      const maxTokens = this.ensureNumber(this.config.maxTokens, this.getDefaultMaxTokens());
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
        2000 // initial delay ms
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

      const elapsedTime = Date.now() - startTime;
      logger.info('OpenAICompatibleLLM: Completion request successful', {
        provider: this.config.provider,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        contentLength: response.content.length,
        usage: response.usage,
      });

      // Update cost tracking
      this.updateCost(response.usage);
      this.logCall(messages, response);

      return response;
    } catch (error: any) {
      const elapsedTime = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown API error';
      const statusCode = error.status || error.statusCode;
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      logger.error('OpenAICompatibleLLM: Completion request failed', {
        provider: this.config.provider,
        error: errorMessage,
        statusCode,
        isTimeout,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        configuredTimeout: this.timeout,
        configuredTimeoutSeconds: this.timeout / 1000,
        promptLength,
      });

      // Provide more detailed error message for timeout
      if (isTimeout) {
        throw new LLMAPIError(
          `${this.config.provider} API timeout: Request exceeded ${this.timeout / 1000}s timeout. ` +
          `Elapsed: ${elapsedTime / 1000}s. ` +
          `Please increase REQUEST_TIMEOUT environment variable (current: ${process.env.REQUEST_TIMEOUT || '300'}s). ` +
          `For large document generation, recommend setting REQUEST_TIMEOUT=600 or higher.`,
          statusCode || 408
        );
      }

      throw new LLMAPIError(
        `${this.config.provider} API error: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Stream completion using OpenAI-compatible API
   */
  async *acompletionStream(messages: any[], abortSignal?: AbortSignal): AsyncGenerator<string> {
    // Check cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }

    try {
      // Ensure numeric types for API parameters
      const temperature = this.ensureNumber(this.config.temperature, 0.7);
      const maxTokens = this.ensureNumber(this.config.maxTokens, this.getDefaultMaxTokens());

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
      throw new LLMAPIError(`${this.config.provider} streaming error: ${error.message}`);
    }
  }
}

export default OpenAICompatibleLLM;
