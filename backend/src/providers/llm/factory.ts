/**
 * LLM Factory
 * Creates LLM instances based on configuration
 */

import { ILLMConfig, LLMProvider } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { OpenAILLM } from './OpenAILLM';
import { ZhipuLLM } from './ZhipuLLM';
import { ArkLLM } from './ArkLLM';
import { CursorLLM } from './CursorLLM';

/**
 * Create an LLM instance based on provider type
 */
export function createLLM(config: ILLMConfig): BaseLLM {
  switch (config.provider) {
    case 'zhipuai':
      return new ZhipuLLM(config);
    
    case 'ark':
      return new ArkLLM(config);
    
    case 'cursor':
      return new CursorLLM(config);
      
    default:
      return new OpenAILLM(config);
  }
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): LLMProvider[] {
  return ['openai', 'zhipuai', 'ark', 'cursor', 'gemini'];
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): boolean {
  return getSupportedProviders().includes(provider as LLMProvider);
}

export default createLLM;

