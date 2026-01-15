/**
 * Zhipu AI LLM Provider
 * Integrates with Zhipu AI (GLM-4, GLM-4-Flash, etc.)
 */

import axios, { AxiosInstance } from 'axios';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';
import { logger } from '../../utils';

export class ZhipuLLM extends BaseLLM {
  private client: AxiosInstance;
  private timeout: number;

  constructor(config: ILLMConfig) {
    super(config);

    // 从环境变量读取超时时间，默认 5 分钟（300000ms）
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT || '300') * 1000;

    logger.info('ZhipuLLM: Initializing with timeout', {
      timeout: this.timeout,
      timeoutSeconds: this.timeout / 1000,
      envValue: process.env.REQUEST_TIMEOUT,
    });

    this.client = axios.create({
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Chat completion using Zhipu AI API
   */
  async acompletion(messages: any[], abortSignal?: AbortSignal): Promise<ILLMResponse> {
    // Check cancellation before starting
    if (abortSignal?.aborted) {
      throw new Error('LLM call was cancelled');
    }
    
    const startTime = Date.now();
    const promptLength = JSON.stringify(messages).length;

    logger.info('ZhipuLLM: Starting completion request', {
      model: this.config.model,
      promptLength,
      timeout: this.timeout,
      timeoutSeconds: this.timeout / 1000,
      // Note: role and action context will be logged by BaseAction layer
    });

    try {
      const response = await retry(
        async () => {
          // Check cancellation before each retry attempt
          if (abortSignal?.aborted) {
            throw new Error('LLM call was cancelled');
          }
          
          try {
            return await this.client.post('/chat/completions', {
              model: this.config.model,
              messages: messages,
              temperature: this.config.temperature || 0.7,
              max_tokens: this.config.maxTokens || 8000,
              top_p: this.config.topP || 0.7,
            }, {
              signal: abortSignal, // Pass abortSignal to axios
            });
          } catch (retryError: any) {
            // If cancelled, don't retry
            if (abortSignal?.aborted || retryError.name === 'AbortError' || retryError.message === 'LLM call was cancelled') {
              throw new Error('LLM call was cancelled');
            }
            
            // 记录重试时的错误信息
            if (retryError.code === 'ECONNABORTED' || retryError.message?.includes('timeout')) {
              logger.warn('ZhipuLLM: Request timeout during retry', {
                timeout: this.timeout,
                elapsedTime: Date.now() - startTime,
                error: retryError.message,
              });
            }
            throw retryError;
          }
        },
        3, // max attempts
        2000 // initial delay ms (增加初始延迟)
      );

      const data = response.data;

      if (data.error) {
        throw new Error(data.error.message || 'Zhipu AI API error');
      }

      const llmResponse: ILLMResponse = {
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || this.config.model,
      };

      // Check cancellation after completion
      if (abortSignal?.aborted) {
        throw new Error('LLM call was cancelled');
      }
      
      const elapsedTime = Date.now() - startTime;
      logger.info('ZhipuLLM: Completion request successful', {
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        contentLength: llmResponse.content.length,
        usage: llmResponse.usage,
      });

      // Update cost tracking
      this.updateCost(llmResponse.usage);
      // Note: logCall context will be set by BaseAction if available
      this.logCall(messages, llmResponse);

      return llmResponse;
    } catch (error: any) {
      const elapsedTime = Date.now() - startTime;
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown Zhipu AI error';
      const statusCode = error.response?.status;
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      logger.error('ZhipuLLM: Completion request failed', {
        error: errorMessage,
        statusCode,
        isTimeout,
        elapsedTime,
        elapsedSeconds: elapsedTime / 1000,
        configuredTimeout: this.timeout,
        configuredTimeoutSeconds: this.timeout / 1000,
        promptLength,
      });

      // 如果是超时错误，提供更详细的错误信息
      if (isTimeout) {
        throw new LLMAPIError(
          `Zhipu AI API timeout: Request exceeded ${this.timeout / 1000}s timeout. ` +
          `Elapsed: ${elapsedTime / 1000}s. ` +
          `Please increase REQUEST_TIMEOUT environment variable (current: ${process.env.REQUEST_TIMEOUT || '300'}s). ` +
          `For large PRD generation, recommend setting REQUEST_TIMEOUT=600 or higher.`,
          statusCode || 408
        );
      }

      throw new LLMAPIError(
        `Zhipu AI API error: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Stream completion (for future implementation)
   */
  async *acompletionStream(messages: any[], abortSignal?: AbortSignal): AsyncGenerator<string> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 4000,
        stream: true,
      }, {
        responseType: 'stream',
      });

      // Parse SSE stream
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content || '';
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      throw new LLMAPIError(`Zhipu AI streaming error: ${error.message}`);
    }
  }
}

export default ZhipuLLM;

