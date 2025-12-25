/**
 * LLM Factory
 * Creates LLM instances based on configuration
 */

import { ILLMConfig, LLMProvider } from '@mind2build/shared';
import { BaseLLM } from './BaseLLM';
import { OpenAILLM } from './OpenAILLM';
import { ZhipuLLM } from './ZhipuLLM';

/**
 * Create an LLM instance based on provider type
 */
export function createLLM(config: ILLMConfig): BaseLLM {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLM(config);
    
    case 'zhipuai':
      return new ZhipuLLM(config);
    
    // Add more providers as needed
    case 'anthropic':
      throw new Error('Anthropic provider not yet implemented');
    
    case 'gemini':
      throw new Error('Gemini provider not yet implemented');
    
    case 'qianfan':
      throw new Error('Qianfan provider not yet implemented');
    
    case 'dashscope':
      throw new Error('DashScope provider not yet implemented');
    
    case 'ollama':
      throw new Error('Ollama provider not yet implemented');
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): LLMProvider[] {
  return ['openai', 'zhipuai'];
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): boolean {
  return getSupportedProviders().includes(provider as LLMProvider);
}

export default createLLM;

