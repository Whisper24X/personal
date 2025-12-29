/**
 * LLM Config Repository
 * Data access layer for LLM configurations using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';
import { ILLMConfig, LLMProvider } from '@mind2build/shared';

export interface LLMConfig {
  id: string;
  user_id: string;
  provider: LLMProvider;
  api_key: string | null;
  base_url: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class LLMConfigRepository {
  /**
   * Create or update LLM configuration
   */
  async upsert(data: {
    userId: string;
    provider: LLMProvider;
    apiKey?: string;
    baseURL?: string;
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

      let result: any;
      if (existing.rows.length > 0) {
        // Update existing config
        result = await query<LLMConfig>(
          `UPDATE llm_configs 
           SET api_key = $3,
               base_url = $4,
               model = $5,
               temperature = $6,
               max_tokens = $7,
               is_active = $8,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
           RETURNING *`,
          [
            existing.rows[0].id,
            data.userId,
            data.apiKey || null,
            data.baseURL || null,
            data.model,
            data.temperature ?? 0.7,
            data.maxTokens ?? 8000,
            data.isActive ?? false,
          ]
        );
      } else {
        // Insert new config
        result = await query<LLMConfig>(
          `INSERT INTO llm_configs (
            user_id, provider, api_key, base_url, model, 
            temperature, max_tokens, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [
            data.userId,
            data.provider,
            data.apiKey || null,
            data.baseURL || null,
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
   */
  async findActive(userId: string): Promise<LLMConfig | null> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find LLM configuration by provider for a user
   */
  async findByProvider(userId: string, provider: LLMProvider): Promise<LLMConfig | null> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND provider = $2 AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, provider]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all LLM configurations for a user
   */
  async findByUserId(userId: string): Promise<LLMConfig[]> {
    const result = await query<LLMConfig>(
      `SELECT * FROM llm_configs 
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY is_active DESC, updated_at DESC`,
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
   */
  toILLMConfig(row: LLMConfig): ILLMConfig {
    return {
      provider: row.provider,
      apiKey: row.api_key || '',
      baseURL: row.base_url || undefined,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
    };
  }
}

export default LLMConfigRepository;

