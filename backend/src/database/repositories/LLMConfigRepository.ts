/**
 * LLM Config Repository
 * Data access layer for LLM configurations using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';
import { ILLMConfig, LLMProvider } from '@mind2build/shared';
import { ProviderConfigRepository } from './ProviderConfigRepository';

export interface LLMConfig {
  id: string;
  user_id: string;
  provider: LLMProvider;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class LLMConfigRepository {
  private providerConfigRepo: ProviderConfigRepository;

  constructor() {
    this.providerConfigRepo = new ProviderConfigRepository();
  }

  /**
   * Create or update LLM configuration
   * Note: apiKey and baseURL should be managed separately via ProviderConfigRepository
   */
  async upsert(data: {
    userId: string;
    provider: LLMProvider;
    apiKey?: string; // Deprecated: kept for backward compatibility
    baseURL?: string; // Deprecated: kept for backward compatibility
    model: string;
    temperature?: number;
    maxTokens?: number;
    isActive?: boolean;
  }): Promise<LLMConfig> {
    try {
      // First, deactivate all other configs for this user if this one is active
      if (data.isActive) {
        await query(
          `UPDATE llm_configs 
           SET is_active = false, updated_at = NOW()
           WHERE user_id = $1 AND deleted_at IS NULL`,
          [data.userId]
        );
      }

      // Check if config exists for this user and provider
      const existing = await query<LLMConfig>(
        `SELECT * FROM llm_configs 
         WHERE user_id = $1 AND provider = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [data.userId, data.provider]
      );

      // If apiKey or baseURL provided, update provider config (for backward compatibility)
      if (data.apiKey !== undefined || data.baseURL !== undefined) {
        await this.providerConfigRepo.upsert({
          userId: data.userId,
          provider: data.provider,
          apiKey: data.apiKey,
          baseURL: data.baseURL,
        });
      }

      let result: any;
      if (existing.rows.length > 0) {
        // Update existing config (without api_key and base_url)
        result = await query<LLMConfig>(
          `UPDATE llm_configs 
           SET model = $3,
               temperature = $4,
               max_tokens = $5,
               is_active = $6,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
           RETURNING *`,
          [
            existing.rows[0].id,
            data.userId,
            data.model,
            data.temperature ?? 0.7,
            data.maxTokens ?? 8000,
            data.isActive ?? false,
          ]
        );
      } else {
        // Insert new config (without api_key and base_url)
        result = await query<LLMConfig>(
          `INSERT INTO llm_configs (
            user_id, provider, model, 
            temperature, max_tokens, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            data.userId,
            data.provider,
            data.model,
            data.temperature ?? 0.7,
            data.maxTokens ?? 8000,
            data.isActive ?? false,
          ]
        );
      }

      if (!result.rows[0]) {
        throw new Error('Failed to upsert LLM config: no row returned');
      }

      logger.info(`Successfully upserted LLM config`, {
        userId: data.userId,
        provider: data.provider,
        isActive: data.isActive,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to upsert LLM config:', {
        userId: data.userId,
        provider: data.provider,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find active LLM configuration for a user
   * Automatically joins with provider_configs to get apiKey and baseURL
   */
  async findActive(userId: string): Promise<LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null } | null> {
    const result = await query<LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null }>(
      `SELECT 
         lc.*,
         pc.api_key as provider_api_key,
         pc.base_url as provider_base_url
       FROM llm_configs lc
       LEFT JOIN llm_provider_configs pc 
         ON lc.user_id = pc.user_id 
         AND lc.provider = pc.provider 
         AND pc.deleted_at IS NULL
       WHERE lc.user_id = $1 AND lc.is_active = true AND lc.deleted_at IS NULL
       ORDER BY lc.updated_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find LLM configuration by provider for a user
   * Automatically joins with provider_configs to get apiKey and baseURL
   */
  async findByProvider(userId: string, provider: LLMProvider): Promise<LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null } | null> {
    const result = await query<LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null }>(
      `SELECT 
         lc.*,
         pc.api_key as provider_api_key,
         pc.base_url as provider_base_url
       FROM llm_configs lc
       LEFT JOIN llm_provider_configs pc 
         ON lc.user_id = pc.user_id 
         AND lc.provider = pc.provider 
         AND pc.deleted_at IS NULL
       WHERE lc.user_id = $1 AND lc.provider = $2 AND lc.deleted_at IS NULL
       ORDER BY lc.updated_at DESC
       LIMIT 1`,
      [userId, provider]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all LLM configurations for a user
   * Automatically joins with provider_configs to get apiKey and baseURL
   */
  async findByUserId(userId: string): Promise<(LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null })[]> {
    const result = await query<LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null }>(
      `SELECT 
         lc.*,
         pc.api_key as provider_api_key,
         pc.base_url as provider_base_url
       FROM llm_configs lc
       LEFT JOIN llm_provider_configs pc 
         ON lc.user_id = pc.user_id 
         AND lc.provider = pc.provider 
         AND pc.deleted_at IS NULL
       WHERE lc.user_id = $1 AND lc.deleted_at IS NULL
       ORDER BY lc.is_active DESC, lc.updated_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Set a configuration as active (deactivates others)
   */
  async setActive(userId: string, configId: string): Promise<LLMConfig> {
    try {
      // Deactivate all configs for this user
      await query(
        `UPDATE llm_configs 
         SET is_active = false, updated_at = NOW()
         WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId]
      );

      // Activate the specified config
      const result = await query<LLMConfig>(
        `UPDATE llm_configs 
         SET is_active = true, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [configId, userId]
      );

      if (!result.rows[0]) {
        throw new Error('LLM config not found or already deleted');
      }

      logger.info(`Successfully activated LLM config`, {
        userId,
        configId,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to set active LLM config:', {
        userId,
        configId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Delete LLM configuration (soft delete)
   */
  async softDelete(userId: string, configId: string): Promise<LLMConfig> {
    try {
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

      logger.info(`Successfully soft deleted LLM config`, {
        userId,
        configId,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to soft delete LLM config:', {
        userId,
        configId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Convert database row to ILLMConfig
   * Uses provider_api_key and provider_base_url from joined llm_provider_configs table
   */
  toILLMConfig(row: LLMConfig & { provider_api_key?: string | null; provider_base_url?: string | null }): ILLMConfig {
    return {
      provider: row.provider,
      apiKey: row.provider_api_key || '',
      baseURL: row.provider_base_url || undefined,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
    };
  }
}

export default LLMConfigRepository;

