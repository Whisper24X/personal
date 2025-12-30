/**
 * Role LLM Config Repository
 * Data access layer for role-specific LLM configurations
 */

import { query } from '../client';
import { logger } from '../../utils';
import { LLMProvider } from '@mind2build/shared';

export interface RoleLLMConfig {
  id: string;
  user_id: string;
  role_profile: string;
  provider: LLMProvider;
  api_key: string | null;
  base_url: string | null;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  repository: string | null;
  branch_name: string | null;
  auto_create_pr: boolean;
  created_at: Date;
  updated_at: Date;
}

export class RoleLLMConfigRepository {
  /**
   * Create or update role LLM configuration
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
  }): Promise<RoleLLMConfig> {
    const now = new Date();
    
    const result = await query<RoleLLMConfig>(
      `INSERT INTO role_llm_configs (
        user_id, role_profile, provider, api_key, base_url, model,
        temperature, max_tokens, repository, branch_name, auto_create_pr,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id, role_profile) 
      DO UPDATE SET
        provider = EXCLUDED.provider,
        api_key = EXCLUDED.api_key,
        base_url = EXCLUDED.base_url,
        model = EXCLUDED.model,
        temperature = EXCLUDED.temperature,
        max_tokens = EXCLUDED.max_tokens,
        repository = EXCLUDED.repository,
        branch_name = EXCLUDED.branch_name,
        auto_create_pr = EXCLUDED.auto_create_pr,
        updated_at = EXCLUDED.updated_at
      RETURNING *`,
      [
        data.userId,
        data.roleProfile,
        data.provider,
        data.apiKey || null,
        data.baseURL || null,
        data.model,
        data.temperature !== undefined ? data.temperature : null,
        data.maxTokens !== undefined ? data.maxTokens : null,
        data.repository || null,
        data.branchName || null,
        data.autoCreatePr !== undefined ? data.autoCreatePr : true,
        now,
        now,
      ]
    );

    logger.info('RoleLLMConfigRepository: Configuration upserted', {
      userId: data.userId,
      roleProfile: data.roleProfile,
      provider: data.provider,
    });

    return result.rows[0];
  }

  /**
   * Get all role LLM configurations for a user
   */
  async findByUserId(userId: string): Promise<RoleLLMConfig[]> {
    const result = await query<RoleLLMConfig>(
      `SELECT * FROM role_llm_configs 
       WHERE user_id = $1 
       ORDER BY role_profile`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get role LLM configuration by profile
   */
  async findByProfile(userId: string, roleProfile: string): Promise<RoleLLMConfig | null> {
    const result = await query<RoleLLMConfig>(
      `SELECT * FROM role_llm_configs 
       WHERE user_id = $1 AND role_profile = $2`,
      [userId, roleProfile]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete role LLM configuration
   */
  async delete(userId: string, roleProfile: string): Promise<boolean> {
    const result = await query<RoleLLMConfig>(
      `DELETE FROM role_llm_configs 
       WHERE user_id = $1 AND role_profile = $2
       RETURNING *`,
      [userId, roleProfile]
    );

    logger.info('RoleLLMConfigRepository: Configuration deleted', {
      userId,
      roleProfile,
      deleted: result.rows.length > 0,
    });

    return result.rows.length > 0;
  }
}

