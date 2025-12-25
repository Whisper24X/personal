/**
 * Zhipu AI LLM Provider
 * Integrates with Zhipu AI (GLM-4, GLM-4-Flash, etc.)
 */

import axios, { AxiosInstance } from 'axios';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';

export class ZhipuLLM extends BaseLLM {
  private client: AxiosInstance;

  constructor(config: ILLMConfig) {
    super(config);

    this.client = axios.create({
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
      timeout: 60000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Chat completion using Zhipu AI API
   */
  async acompletion(messages: any[]): Promise<ILLMResponse> {
    try {
      const response = await retry(
        async () => {
          return await this.client.post('/chat/completions', {
            model: this.config.model,
            messages: messages,
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 8000,
            top_p: this.config.topP || 0.7,
          });
        },
        3, // max attempts
        1000 // initial delay ms
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

      // Update cost tracking
      this.updateCost(llmResponse.usage);
      this.logCall(messages, llmResponse);

      return llmResponse;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown Zhipu AI error';
      const statusCode = error.response?.status;

      throw new LLMAPIError(
        `Zhipu AI API error: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Stream completion (for future implementation)
   */
  async *acompletionStream(messages: any[]): AsyncGenerator<string> {
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

