/**
 * ARK (Doubao) LLM Provider
 * Integrates with ByteDance ARK API (Doubao models)
 */

import axios, { AxiosInstance } from 'axios';
import { ILLMConfig, ILLMResponse, LLMAPIError } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { retry } from '@mind2build/shared';
import { logger } from '../../utils';

export class ArkLLM extends BaseLLM {
    private client: AxiosInstance;
    private timeout: number;

    constructor(config: ILLMConfig) {
        super(config);

        // 从环境变量读取超时时间，默认 5 分钟（300000ms）
        this.timeout = parseInt(process.env.REQUEST_TIMEOUT || '300') * 1000;

        logger.info('ArkLLM: Initializing with timeout', {
            timeout: this.timeout,
            timeoutSeconds: this.timeout / 1000,
            envValue: process.env.REQUEST_TIMEOUT,
            baseURL: config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
        });

        this.client = axios.create({
            baseURL: config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3',
            timeout: this.timeout,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Chat completion using ARK API
     */
    async acompletion(messages: any[]): Promise<ILLMResponse> {
        const startTime = Date.now();
        const promptLength = JSON.stringify(messages).length;

        logger.info('ArkLLM: Starting completion request', {
            model: this.config.model,
            promptLength,
            timeout: this.timeout,
            timeoutSeconds: this.timeout / 1000,
        });

        try {
            const response = await retry(
                async () => {
                    try {
                        return await this.client.post('/chat/completions', {
                            model: this.config.model,
                            messages: messages,
                            temperature: this.config.temperature || 0.7,
                            max_tokens: this.config.maxTokens || 32000,
                            top_p: this.config.topP || 0.7,
                        });
                    } catch (retryError: any) {
                        // 记录重试时的错误信息
                        if (retryError.code === 'ECONNABORTED' || retryError.message?.includes('timeout')) {
                            logger.warn('ArkLLM: Request timeout during retry', {
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
                throw new Error(data.error.message || 'ARK API error');
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

            const elapsedTime = Date.now() - startTime;
            logger.info('ArkLLM: Completion request successful', {
                elapsedTime,
                elapsedSeconds: elapsedTime / 1000,
                contentLength: llmResponse.content.length,
                usage: llmResponse.usage,
            });

            // Update cost tracking
            this.updateCost(llmResponse.usage);
            this.logCall(messages, llmResponse);

            return llmResponse;
        } catch (error: any) {
            const elapsedTime = Date.now() - startTime;
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown ARK API error';
            const statusCode = error.response?.status;
            const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

            logger.error('ArkLLM: Completion request failed', {
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
                    `ARK API timeout: Request exceeded ${this.timeout / 1000}s timeout. ` +
                    `Elapsed: ${elapsedTime / 1000}s. ` +
                    `Please increase REQUEST_TIMEOUT environment variable (current: ${process.env.REQUEST_TIMEOUT || '300'}s). ` +
                    `For large PRD generation, recommend setting REQUEST_TIMEOUT=600 or higher.`,
                    statusCode || 408
                );
            }

            throw new LLMAPIError(
                `ARK API error: ${errorMessage}`,
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
            throw new LLMAPIError(`ARK streaming error: ${error.message}`);
        }
    }
}

export default ArkLLM;

