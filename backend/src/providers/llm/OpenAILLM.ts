/**
 * OpenAI LLM Provider
 * Integrates with OpenAI API (GPT-4, GPT-3.5, etc.)
 */

import OpenAI from 'openai';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';

export class OpenAILLM extends BaseLLM {
  private client: OpenAI;

  constructor(config: ILLMConfig) {
    super(config);
    
    // 从环境变量读取超时时间，默认 5 分钟（300000ms）
    const timeout = parseInt(process.env.REQUEST_TIMEOUT || '300') * 1000;
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: timeout,
    });
  }

  /**
   * Chat completion using OpenAI API
   */
  async acompletion(messages: any[]): Promise<ILLMResponse> {
    try {
      const completion = await retry(
        async () => {
          return await this.client.chat.completions.create({
            model: this.config.model,
            messages: messages,
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 8000,
            top_p: this.config.topP || 1.0,
          });
        },
        3, // max attempts
        1000 // initial delay ms
      );

      const response: ILLMResponse = {
        content: completion.choices[0]?.message?.content || '',
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        model: completion.model,
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
  async *acompletionStream(messages: any[]): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 8000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      throw new LLMAPIError(`OpenAI streaming error: ${error.message}`);
    }
  }
}

export default OpenAILLM;

