/**
 * Provider Config Repository
 * Data access layer for LLM provider-level configurations (API keys and base URLs)
 */

import { query } from '../client';
import { logger } from '../../utils';
import { LLMProvider } from '@mind2build/shared';

export interface ProviderConfig {
  id: string;
  user_id: string;
  provider: LLMProvider;
  api_key: string | null;
  base_url: string | null;
  model: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class ProviderConfigRepository {
  /**
   * Create or update provider configuration
   */
  async upsert(data: {
    userId: string;
    provider: LLMProvider;
    apiKey?: string;
    baseURL?: string;
    model?: string;
  }): Promise<ProviderConfig> {
    try {
      // Check if config exists for this user and provider
      const existing = await query<ProviderConfig>(
        `SELECT * FROM llm_provider_configs 
         WHERE user_id = $1 AND provider = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [data.userId, data.provider]
      );

      let result: any;
      if (existing.rows.length > 0) {
        // Update existing config
        result = await query<ProviderConfig>(
          `UPDATE llm_provider_configs 
           SET api_key = $3,
               base_url = $4,
               model = $5,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
           RETURNING *`,
          [
            existing.rows[0].id,
            data.userId,
            data.apiKey || null,
            data.baseURL || null,
            data.model || null,
          ]
        );
      } else {
        // Insert new config
        result = await query<ProviderConfig>(
          `INSERT INTO llm_provider_configs (
            user_id, provider, api_key, base_url, model
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *`,
          [
            data.userId,
            data.provider,
            data.apiKey || null,
            data.baseURL || null,
            data.model || null,
          ]
        );
      }

      if (!result.rows[0]) {
        throw new Error('Failed to upsert provider config: no row returned');
      }

      logger.info(`Successfully upserted provider config`, {
        userId: data.userId,
        provider: data.provider,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to upsert provider config:', {
        userId: data.userId,
        provider: data.provider,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find provider configuration by provider for a user
   */
  async findByProvider(userId: string, provider: LLMProvider): Promise<ProviderConfig | null> {
    const result = await query<ProviderConfig>(
      `SELECT * FROM llm_provider_configs 
       WHERE user_id = $1 AND provider = $2 AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, provider]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all provider configurations for a user
   */
  async findByUserId(userId: string): Promise<ProviderConfig[]> {
    const result = await query<ProviderConfig>(
      `SELECT * FROM llm_provider_configs 
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY provider ASC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Delete provider configuration (soft delete)
   */
  async softDelete(userId: string, provider: LLMProvider): Promise<ProviderConfig> {
    try {
      const result = await query<ProviderConfig>(
        `UPDATE llm_provider_configs 
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND provider = $2 AND deleted_at IS NULL
         RETURNING *`,
        [userId, provider]
      );

      if (!result.rows[0]) {
        throw new Error('Provider config not found or already deleted');
      }

      logger.info(`Successfully soft deleted provider config`, {
        userId,
        provider,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to soft delete provider config:', {
        userId,
        provider,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ProviderConfigRepository;

