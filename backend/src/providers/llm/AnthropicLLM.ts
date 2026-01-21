/**
 * Anthropic LLM Provider
 * Integrates with Anthropic Claude API
 */

import axios, { AxiosInstance } from 'axios';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';
import { logger } from '../../utils';

export class AnthropicLLM extends BaseLLM {
  private client: AxiosInstance;
  private timeout: number;

  constructor(config: ILLMConfig) {
    super(config);

    // 从环境变量读取超时时间，默认 5 分钟（300000ms）
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT || '300') * 1000;

    logger.info('AnthropicLLM: Initializing with timeout', {
      timeout: this.timeout,
      timeoutSeconds: this.timeout / 1000,
      envValue: process.env.REQUEST_TIMEOUT,
    });

    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.anthropic.com/v1',
      timeout: this.timeout,
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Chat completion using Anthropic API
   */
  async acompletion(messages: any[]): Promise<ILLMResponse> {
    const startTime = Date.now();
    const promptLength = JSON.stringify(messages).length;

    logger.info('AnthropicLLM: Starting completion request', {
      model: this.config.model,
      promptLength,
      timeout: this.timeout,
      timeoutSeconds: this.timeout / 1000,
    });

    try {
      // 转换消息格式（Anthropic 使用不同的格式）
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');

      const response = await retry(
        async () => {
          try {
            // Ensure numeric values are properly typed
            const maxTokens = typeof this.config.maxTokens === 'string' 
              ? parseInt(this.config.maxTokens, 10) 
              : (this.config.maxTokens || 8000);
            
            const temperature = typeof this.config.temperature === 'string'
              ? parseFloat(this.config.temperature)
              : (this.config.temperature || 0.7);

            return await this.client.post('/messages', {
              model: this.config.model,
              system: systemMessage?.content,
              messages: userMessages,
              max_tokens: maxTokens,
              temperature: temperature,
            });
          } catch (retryError: any) {
            // 记录重试时的错误信息
            if (retryError.code === 'ECONNABORTED' || retryError.message?.includes('timeout')) {
              logger.warn('AnthropicLLM: Request timeout during retry', {
                timeout: this.timeout,
                elapsedTime: Date.now() - startTime,
                error: retryError.message,
              });
            }
            throw retryError;
          }
        },
        3, // max attempts
        2000 // initial delay ms
      );

      const data = response.data;

      if (data.error) {
        throw new Error(data.error.message || 'Anthropic API error');
      }

      const llmResponse: ILLMResponse = {
        content: data.content[0]?.text || '',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        model: data.model || this.config.model,
      };

      const elapsedTime = Date.now() - startTime;
      logger.info('AnthropicLLM: Completion request successful', {
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        contentLength: llmResponse.content.length,
        usage: llmResponse.usage,
      });

      // Update cost tracking
      this.updateCost(llmResponse.usage);
      
      // Log call for debugging
      this.logCall(messages, llmResponse);

      return llmResponse;
    } catch (error: any) {
      const elapsedTime = Date.now() - startTime;
      
      logger.error('AnthropicLLM: Completion request failed', {
        error: error.message,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        isTimeout: error.code === 'ECONNABORTED' || error.message?.includes('timeout'),
        errorCode: error.code,
        errorResponse: error.response?.data,
      });

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new LLMAPIError(
          `Request timeout after ${this.timeout / 1000} seconds. ` +
          `Consider increasing REQUEST_TIMEOUT in .env file.`,
          408
        );
      }

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.message;
        throw new LLMAPIError(`Anthropic API error (${status}): ${message}`, status);
      }

      throw new LLMAPIError(`Anthropic API error: ${error.message}`);
    }
  }
}

export default AnthropicLLM;

