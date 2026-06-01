/**
 * Role LLM Config Repository (Backward Compatibility)
 * Schema V2: Merged into unified LLMConfigRepository
 * @deprecated Use LLMConfigRepository instead
 */

import { LLMConfigRepository, LLMConfig } from './LLMConfigRepository';
import { LLMProvider } from '@mind2build/shared';

// Re-export for backward compatibility
export type RoleLLMConfig = LLMConfig;

export class RoleLLMConfigRepository {
  private llmConfigRepo: LLMConfigRepository;

  constructor() {
    this.llmConfigRepo = new LLMConfigRepository();
  }

  /**
   * @deprecated Use LLMConfigRepository.upsertRole instead
   */
  async upsert(data: {
    userId: string;
    roleProfile: string;
    provider: LLMProvider;
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    repository?: string;
    branchName?: string;
    autoCreatePr?: boolean;
  }): Promise<LLMConfig> {
    return this.llmConfigRepo.upsertRole(data);
  }

  /**
   * @deprecated Use LLMConfigRepository.findRoleConfigs instead
   */
  async findByUserId(userId: string): Promise<LLMConfig[]> {
    return this.llmConfigRepo.findRoleConfigs(userId);
  }

  /**
   * @deprecated Use LLMConfigRepository.findByRole instead
   */
  async findByProfile(userId: string, roleProfile: string): Promise<LLMConfig | null> {
    return this.llmConfigRepo.findByRole(userId, roleProfile);
  }

  /**
   * @deprecated Use LLMConfigRepository.deleteRoleConfig instead
   */
  async delete(userId: string, roleProfile: string): Promise<boolean> {
    return this.llmConfigRepo.deleteRoleConfig(userId, roleProfile);
  }
}

export default RoleLLMConfigRepository;
