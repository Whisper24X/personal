/**
 * Provider Config Repository (Backward Compatibility)
 * Schema V2: Merged into unified LLMConfigRepository
 * @deprecated Use LLMConfigRepository instead
 */

import { LLMConfigRepository, LLMConfig } from './LLMConfigRepository';
import { LLMProvider } from '@mind2build/shared';

// Re-export for backward compatibility
export type ProviderConfig = LLMConfig;

export class ProviderConfigRepository {
  private llmConfigRepo: LLMConfigRepository;

  constructor() {
    this.llmConfigRepo = new LLMConfigRepository();
  }

  /**
   * @deprecated Use LLMConfigRepository.upsertProvider instead
   */
  async upsert(data: {
    userId: string;
    provider: LLMProvider;
    apiKey?: string;
    baseURL?: string;
    model?: string;
  }): Promise<LLMConfig> {
    return this.llmConfigRepo.upsertProvider({
      userId: data.userId,
      provider: data.provider,
      apiKey: data.apiKey,
      baseURL: data.baseURL,
      model: data.model || 'default',
    });
  }

  /**
   * @deprecated Use LLMConfigRepository.findByProvider instead
   */
  async findByProvider(userId: string, provider: LLMProvider): Promise<LLMConfig | null> {
    return this.llmConfigRepo.findByProvider(userId, provider);
  }

  /**
   * @deprecated Use LLMConfigRepository.findProviderConfigs instead
   */
  async findByUserId(userId: string): Promise<LLMConfig[]> {
    return this.llmConfigRepo.findProviderConfigs(userId);
  }

  /**
   * @deprecated Use LLMConfigRepository.softDelete instead
   */
  async softDelete(userId: string, provider: LLMProvider): Promise<LLMConfig | null> {
    const config = await this.llmConfigRepo.findByProvider(userId, provider);
    if (config) {
      return this.llmConfigRepo.softDelete(userId, config.id);
    }
    return null;
  }
}

export default ProviderConfigRepository;
