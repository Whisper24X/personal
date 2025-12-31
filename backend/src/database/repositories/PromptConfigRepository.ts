/**
 * Prompt Config Repository
 * Data access layer for prompt configurations using native PostgreSQL
 */

import { query } from '../client';
import { logger } from '../../utils';

export type PromptType = 'requirement' | 'prd' | 'design' | 'code' | 'test' | 'task';
export type PromptKey = 'system_prompt' | 'template' | 'review_system_prompt' | string;

export interface PromptConfig {
  id: string;
  user_id: string;
  prompt_type: PromptType;
  prompt_key: string;
  content: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export class PromptConfigRepository {
  /**
   * Create or update prompt configuration
   */
  async upsert(data: {
    userId: string;
    promptType: PromptType;
    promptKey: string;
    content: string;
    description?: string;
    isActive?: boolean;
  }): Promise<PromptConfig> {
    const now = new Date();
    
    const result = await query<PromptConfig>(
      `INSERT INTO prompt_configs (
        user_id, prompt_type, prompt_key, content, description, is_active,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, prompt_type, prompt_key) 
      DO UPDATE SET
        content = EXCLUDED.content,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
      RETURNING *`,
      [
        data.userId,
        data.promptType,
        data.promptKey,
        data.content,
        data.description || null,
        data.isActive !== undefined ? data.isActive : true,
        now,
        now,
      ]
    );

    logger.info('PromptConfigRepository: Configuration upserted', {
      userId: data.userId,
      promptType: data.promptType,
      promptKey: data.promptKey,
    });

    return result.rows[0];
  }

  /**
   * Get prompt configuration by type and key
   */
  async findByTypeAndKey(
    userId: string,
    promptType: PromptType,
    promptKey: string
  ): Promise<PromptConfig | null> {
    const result = await query<PromptConfig>(
      `SELECT * FROM prompt_configs
       WHERE user_id = $1 
         AND prompt_type = $2 
         AND prompt_key = $3
         AND is_active = true
         AND deleted_at IS NULL
       LIMIT 1`,
      [userId, promptType, promptKey]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all prompt configurations for a type
   */
  async findByType(userId: string, promptType: PromptType): Promise<PromptConfig[]> {
    const result = await query<PromptConfig>(
      `SELECT * FROM prompt_configs
       WHERE user_id = $1 
         AND prompt_type = $2
         AND is_active = true
         AND deleted_at IS NULL
       ORDER BY prompt_key`,
      [userId, promptType]
    );

    return result.rows;
  }

  /**
   * Get all prompt configurations for a user
   */
  async findByUserId(userId: string): Promise<PromptConfig[]> {
    const result = await query<PromptConfig>(
      `SELECT * FROM prompt_configs
       WHERE user_id = $1
         AND is_active = true
         AND deleted_at IS NULL
       ORDER BY prompt_type, prompt_key`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get prompt configurations grouped by type
   */
  async findByUserIdGrouped(userId: string): Promise<Record<PromptType, Record<string, PromptConfig>>> {
    const configs = await this.findByUserId(userId);
    
    const grouped: Record<string, Record<string, PromptConfig>> = {};
    
    for (const config of configs) {
      if (!grouped[config.prompt_type]) {
        grouped[config.prompt_type] = {};
      }
      grouped[config.prompt_type][config.prompt_key] = config;
    }

    return grouped as Record<PromptType, Record<string, PromptConfig>>;
  }

  /**
   * Delete prompt configuration (soft delete)
   */
  async delete(userId: string, promptType: PromptType, promptKey: string): Promise<void> {
    await query(
      `UPDATE prompt_configs
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 
         AND prompt_type = $2 
         AND prompt_key = $3
         AND deleted_at IS NULL`,
      [userId, promptType, promptKey]
    );

    logger.info('PromptConfigRepository: Configuration deleted', {
      userId,
      promptType,
      promptKey,
    });
  }

  /**
   * Restore deleted prompt configuration
   */
  async restore(userId: string, promptType: PromptType, promptKey: string): Promise<void> {
    await query(
      `UPDATE prompt_configs
       SET deleted_at = NULL, updated_at = NOW()
       WHERE user_id = $1 
         AND prompt_type = $2 
         AND prompt_key = $3`,
      [userId, promptType, promptKey]
    );

    logger.info('PromptConfigRepository: Configuration restored', {
      userId,
      promptType,
      promptKey,
    });
  }
}

