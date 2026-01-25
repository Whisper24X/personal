/**
 * LLM Config Repository
 * Data access layer for unified LLM configurations using native PostgreSQL
 * Schema V2: Unified table merging llm_configs, llm_provider_configs, and role_llm_configs
 */

import { query } from '../client';
import { logger } from '../../utils';
import { ILLMConfig, LLMProvider } from '@mind2build/shared';

export type ConfigScope = 'provider' | 'role';

export interface LLMConfig {
  id: string;
  user_id: string;
  config_scope: ConfigScope;
  provider: LLMProvider;
  role_profile: string | null;
  api_key: string | null;
  base_url: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  repository: string | null;
  branch_name: string | null;
  auto_create_pr: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class LLMConfigRepository {
  /**
   * Create or update provider-level LLM configuration
   */
  async upsertProvider(data: {
    userId: string;
    provider: LLMProvider;
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    isActive?: boolean;
  }): Promise<LLMConfig> {
    return this.upsert({
      ...data,
      configScope: 'provider',
    });
  }

  /**
   * Create or update role-specific LLM configuration
   */
  async upsertRole(data: {
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
    return this.upsert({
      ...data,
      configScope: 'role',
    });
  }

  /**
   * Core upsert method
   */
  async upsert(data: {
    userId: string;
    configScope: ConfigScope;
    provider: LLMProvider;
    roleProfile?: string;
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    isActive?: boolean;
    repository?: string;
    branchName?: string;
    autoCreatePr?: boolean;
  }): Promise<LLMConfig> {
    try {
      // If setting as active provider config, deactivate others first
      if (data.isActive && data.configScope === 'provider') {
        await query(
          `UPDATE llm_configs 
           SET is_active = false, updated_at = NOW()
           WHERE user_id = $1 AND config_scope = 'provider' AND deleted_at IS NULL`,
          [data.userId]
        );
      }

      // Check if config exists
      const existingQuery = data.configScope === 'role' 
        ? `SELECT * FROM llm_configs 
           WHERE user_id = $1 AND provider = $2 AND role_profile = $3 AND deleted_at IS NULL
           LIMIT 1`
        : `SELECT * FROM llm_configs 
           WHERE user_id = $1 AND provider = $2 AND role_profile IS NULL AND deleted_at IS NULL
           LIMIT 1`;

      const existingParams = data.configScope === 'role'
        ? [data.userId, data.provider, data.roleProfile]
        : [data.userId, data.provider];

      const existing = await query<LLMConfig>(existingQuery, existingParams);

      let result: any;
      if (existing.rows.length > 0) {
        // Update existing config
        result = await query<LLMConfig>(
          `UPDATE llm_configs SET
            api_key = COALESCE($1, api_key),
            base_url = COALESCE($2, base_url),
            model = $3,
            temperature = $4,
            max_tokens = $5,
            is_active = $6,
            repository = COALESCE($7, repository),
            branch_name = COALESCE($8, branch_name),
            auto_create_pr = $9,
            updated_at = NOW()
          WHERE id = $10
          RETURNING *`,
          [
            data.apiKey || null,
            data.baseURL || null,
            data.model,
            data.temperature ?? 0.7,
            data.maxTokens ?? 8000,
            data.isActive ?? false,
            data.repository || null,
            data.branchName || null,
            data.autoCreatePr ?? true,
            existing.rows[0].id,
          ]
        );
      } else {
        // Insert new config
        result = await query<LLMConfig>(
          `INSERT INTO llm_configs (
            user_id, config_scope, provider, role_profile,
            api_key, base_url, model, temperature, max_tokens,
            is_active, repository, branch_name, auto_create_pr
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            data.userId,
            data.configScope,
            data.provider,
            data.roleProfile || null,
            data.apiKey || null,
            data.baseURL || null,
            data.model,
            data.temperature ?? 0.7,
            data.maxTokens ?? 8000,
            data.isActive ?? false,
            data.repository || null,
            data.branchName || null,
            data.autoCreatePr ?? true,
          ]
        );
      }

      logger.info('LLMConfigRepository: Config upserted', {
        userId: data.userId,
        provider: data.provider,
        configScope: data.configScope,
        roleProfile: data.roleProfile,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('LLMConfigRepository: Failed to upsert', {
        userId: data.userId,
        provider: data.provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find active provider configuration for a user
   */
  async findActive(userId: string): Promise<LLMConfig | null> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND config_scope = 'provider' AND is_active = true AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find configuration by provider
   */
  async findByProvider(userId: string, provider: LLMProvider): Promise<LLMConfig | null> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND provider = $2 AND config_scope = 'provider' AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, provider]
    );

    return result.rows[0] || null;
  }

  /**
   * Find role-specific configuration
   */
  async findByRole(userId: string, roleProfile: string): Promise<LLMConfig | null> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND role_profile = $2 AND config_scope = 'role' AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, roleProfile]
    );

    return result.rows[0] || null;
  }

  /**
   * Get effective LLM config for a role
   * Priority: role-specific > active provider > null
   */
  async getEffectiveConfig(userId: string, roleProfile: string): Promise<LLMConfig | null> {
    // First try role-specific config
    const roleConfig = await this.findByRole(userId, roleProfile);
    if (roleConfig) {
      return roleConfig;
    }

    // Fall back to active provider config
    return this.findActive(userId);
  }

  /**
   * Find all configurations for a user
   */
  async findByUserId(userId: string): Promise<LLMConfig[]> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY config_scope ASC, is_active DESC, updated_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Find all provider configurations for a user
   */
  async findProviderConfigs(userId: string): Promise<LLMConfig[]> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND config_scope = 'provider' AND deleted_at IS NULL
       ORDER BY is_active DESC, updated_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Find all role configurations for a user
   */
  async findRoleConfigs(userId: string): Promise<LLMConfig[]> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND config_scope = 'role' AND deleted_at IS NULL
       ORDER BY role_profile ASC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Set a configuration as active (only for provider configs)
   */
  async setActive(userId: string, configId: string): Promise<LLMConfig> {
    try {
      // Deactivate all provider configs for this user
      await query(
        `UPDATE llm_configs 
         SET is_active = false, updated_at = NOW()
         WHERE user_id = $1 AND config_scope = 'provider' AND deleted_at IS NULL`,
        [userId]
      );

      // Activate the specified config
      const result = await query<LLMConfig>(
        `UPDATE llm_configs 
         SET is_active = true, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND config_scope = 'provider' AND deleted_at IS NULL
         RETURNING *`,
        [configId, userId]
      );

      if (!result.rows[0]) {
        throw new Error('LLM config not found or not a provider config');
      }

      logger.info('LLMConfigRepository: Set active config', { userId, configId });
      return result.rows[0];
    } catch (error: any) {
      logger.error('LLMConfigRepository: Failed to set active', {
        userId,
        configId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete configuration (soft delete)
   */
  async softDelete(userId: string, configId: string): Promise<LLMConfig> {
    const result = await query<LLMConfig>(
      `UPDATE llm_configs 
       SET deleted_at = NOW(), is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [configId, userId]
    );

    if (!result.rows[0]) {
      throw new Error('LLM config not found or already deleted');
    }

    logger.info('LLMConfigRepository: Soft deleted config', { userId, configId });
    return result.rows[0];
  }

  /**
   * Delete role configuration
   */
  async deleteRoleConfig(userId: string, roleProfile: string): Promise<boolean> {
    const result = await query(
      `UPDATE llm_configs 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND role_profile = $2 AND config_scope = 'role' AND deleted_at IS NULL`,
      [userId, roleProfile]
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Convert database row to ILLMConfig
   */
  toILLMConfig(row: LLMConfig): ILLMConfig {
    return {
      provider: row.provider,
      apiKey: row.api_key || '',
      baseURL: row.base_url || undefined,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      repository: row.repository || undefined,
      branchName: row.branch_name || undefined,
      autoCreatePr: row.auto_create_pr,
    };
  }
}

export default LLMConfigRepository;
