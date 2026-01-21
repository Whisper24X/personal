/**
 * LLM Factory
 * Creates LLM instances based on configuration
 * 
 * Uses a unified OpenAICompatibleLLM class for all OpenAI-compatible providers,
 * with provider-specific baseURL configuration handled internally.
 */

import { ILLMConfig, LLMProvider } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { OpenAICompatibleLLM } from './OpenAICompatibleLLM';
import { CursorLLM } from './CursorLLM';

/**
 * Create an LLM instance based on provider type
 * 
 * - CursorLLM: Uses Cursor Agent API (non-OpenAI compatible)
 * - All other providers: Uses OpenAICompatibleLLM with appropriate baseURL
 */
export function createLLM(config: ILLMConfig): BaseLLM {
  // CursorLLM uses a completely different API (Cursor Agent API)
  if (config.provider === 'cursor') {
    return new CursorLLM(config);
  }
  
  // All other providers use OpenAI-compatible API
  // Provider-specific baseURL is handled internally by OpenAICompatibleLLM
  return new OpenAICompatibleLLM(config);
}

/**
 * Get list of supported providers
 * All providers except 'cursor' use the unified OpenAICompatibleLLM class
 */
export function getSupportedProviders(): LLMProvider[] {
  return ['openai', 'anthropic', 'gemini', 'zhipuai', 'qianfan', 'dashscope', 'ollama', 'ark', 'cursor'];
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): boolean {
  return getSupportedProviders().includes(provider as LLMProvider);
}

export default createLLM;

