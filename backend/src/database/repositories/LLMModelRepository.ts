/**
 * LLM Model Repository
 * Data access layer for global LLM model registry
 */

import { query } from '../client';
import { logger } from '../../utils';

export interface LLMModel {
  id: string;
  provider: string;
  model_name: string;
  display_name: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLLMModelData {
  provider: string;
  modelName: string;
  displayName?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export class LLMModelRepository {
  /**
   * Get all models for all providers
   */
  async findAll(): Promise<LLMModel[]> {
    const result = await query<LLMModel>(
      `SELECT * FROM llm_models 
       ORDER BY provider, sort_order, model_name`
    );
    return result.rows;
  }

  /**
   * Get all models for a specific provider
   */
  async findByProvider(provider: string): Promise<LLMModel[]> {
    const result = await query<LLMModel>(
      `SELECT * FROM llm_models 
       WHERE provider = $1 
       ORDER BY sort_order, model_name`,
      [provider]
    );
    return result.rows;
  }

  /**
   * Get models grouped by provider
   */
  async findAllGrouped(): Promise<Record<string, LLMModel[]>> {
    const models = await this.findAll();
    const grouped: Record<string, LLMModel[]> = {};
    
    for (const model of models) {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    }
    
    return grouped;
  }

  /**
   * Find a model by ID
   */
  async findById(id: string): Promise<LLMModel | null> {
    const result = await query<LLMModel>(
      `SELECT * FROM llm_models WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a model by provider and model name
   */
  async findByProviderAndName(provider: string, modelName: string): Promise<LLMModel | null> {
    const result = await query<LLMModel>(
      `SELECT * FROM llm_models 
       WHERE provider = $1 AND model_name = $2`,
      [provider, modelName]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new model
   */
  async create(data: CreateLLMModelData): Promise<LLMModel> {
    try {
      // If this model should be the default, unset other defaults for this provider
      if (data.isDefault) {
        await query(
          `UPDATE llm_models 
           SET is_default = false, updated_at = NOW()
           WHERE provider = $1`,
          [data.provider]
        );
      }

      // Get max sort order for this provider
      let sortOrder = data.sortOrder;
      if (sortOrder === undefined) {
        const maxResult = await query<{ max_order: number }>(
          `SELECT COALESCE(MAX(sort_order), 0) + 1 as max_order 
           FROM llm_models WHERE provider = $1`,
          [data.provider]
        );
        sortOrder = maxResult.rows[0]?.max_order || 1;
      }

      const result = await query<LLMModel>(
        `INSERT INTO llm_models (provider, model_name, display_name, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.provider,
          data.modelName,
          data.displayName || null,
          data.isDefault || false,
          sortOrder,
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create LLM model: no row returned');
      }

      logger.info('Successfully created LLM model', {
        provider: data.provider,
        modelName: data.modelName,
      });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create LLM model:', {
        provider: data.provider,
        modelName: data.modelName,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update a model
   */
  async update(
    id: string,
    data: Partial<Omit<CreateLLMModelData, 'provider' | 'modelName'>>
  ): Promise<LLMModel> {
    try {
      // Get the existing model first
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error('LLM model not found');
      }

      // If this model should be the default, unset other defaults for this provider
      if (data.isDefault) {
        await query(
          `UPDATE llm_models 
           SET is_default = false, updated_at = NOW()
           WHERE provider = $1 AND id != $2`,
          [existing.provider, id]
        );
      }

      const result = await query<LLMModel>(
        `UPDATE llm_models 
         SET display_name = COALESCE($2, display_name),
             is_default = COALESCE($3, is_default),
             sort_order = COALESCE($4, sort_order),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          data.displayName !== undefined ? data.displayName : null,
          data.isDefault,
          data.sortOrder,
        ]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to update LLM model: no row returned');
      }

      logger.info('Successfully updated LLM model', { id });

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update LLM model:', {
        id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Delete a model
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await query(
        `DELETE FROM llm_models WHERE id = $1`,
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('LLM model not found');
      }

      logger.info('Successfully deleted LLM model', { id });
    } catch (error: any) {
      logger.error('Failed to delete LLM model:', {
        id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update sort order for multiple models
   */
  async updateSortOrder(updates: { id: string; sortOrder: number }[]): Promise<void> {
    try {
      for (const update of updates) {
        await query(
          `UPDATE llm_models 
           SET sort_order = $2, updated_at = NOW()
           WHERE id = $1`,
          [update.id, update.sortOrder]
        );
      }

      logger.info('Successfully updated sort order for models', {
        count: updates.length,
      });
    } catch (error: any) {
      logger.error('Failed to update sort order:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get distinct providers that have models
   */
  async getProviders(): Promise<string[]> {
    const result = await query<{ provider: string }>(
      `SELECT DISTINCT provider FROM llm_models ORDER BY provider`
    );
    return result.rows.map(row => row.provider);
  }
}

export default LLMModelRepository;
