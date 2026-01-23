/**
 * LLM Config Controller
 * Handles LLM configuration-related HTTP requests
 * 
 * Uses LLMManager for centralized LLM configuration management.
 */

import { Request, Response } from 'express';
import { LLMConfigRepository, ProviderConfigRepository, LLMModelRepository } from '../../database';
import { logger } from '../../utils';
import { llmManager } from '../../providers/llm/LLMManager';
import { LLMProvider } from '@mind2build/shared';

const llmConfigRepo = new LLMConfigRepository();
const providerConfigRepo = new ProviderConfigRepository();
const llmModelRepo = new LLMModelRepository();
const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

export class LLMConfigController {
  /**
   * Get all LLM configurations for the user
   * GET /api/config/llm
   */
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const configs = await llmConfigRepo.findByUserId(userId);

      return res.json({
        success: true,
        configs: configs.map((config) => {
          const llmConfig = llmConfigRepo.toILLMConfig(config);
          return {
            id: config.id,
            provider: config.provider,
            model: config.model,
            baseURL: llmConfig.baseURL,
            temperature: config.temperature,
            maxTokens: config.max_tokens,
            isActive: config.is_active,
            createdAt: config.created_at,
            updatedAt: config.updated_at,
            // Don't expose API key in list
          };
        }),
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to list configs:', error);
      return res.status(500).json({
        error: 'Failed to list LLM configurations',
        message: error.message,
      });
    }
  }

  /**
   * Get active LLM configuration
   * GET /api/config/llm/active
   */
  static async getActive(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const config = await llmConfigRepo.findActive(userId);

      if (!config) {
        return res.json({
          success: true,
          config: null,
        });
      }

      const llmConfig = llmConfigRepo.toILLMConfig(config);
      return res.json({
        success: true,
        config: {
          id: config.id,
          provider: config.provider,
          apiKey: llmConfig.apiKey, // Include API key for active config
          baseURL: llmConfig.baseURL,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to get active config:', error);
      return res.status(500).json({
        error: 'Failed to get active LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Get LLM configuration by provider
   * GET /api/config/llm/:provider
   */
  static async getByProvider(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { provider } = req.params;

      if (!provider || !['openai', 'anthropic', 'gemini', 'zhipuai', 'qianfan', 'dashscope', 'ollama', 'ark', 'cursor', 'deepseek'].includes(provider)) {
        return res.status(400).json({
          error: 'Invalid provider',
        });
      }

      const config = await llmConfigRepo.findByProvider(userId, provider as LLMProvider);

      if (!config) {
        return res.status(404).json({
          error: 'Configuration not found',
        });
      }

      return res.json({
        success: true,
        config: {
          id: config.id,
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to get config by provider:', error);
      return res.status(500).json({
        error: 'Failed to get LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Create or update LLM configuration
   * POST /api/config/llm
   */
  static async upsert(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { provider, apiKey, baseURL, model, temperature, maxTokens, isActive } = req.body;

      if (!provider || !model) {
        return res.status(400).json({
          error: 'Missing required fields: provider and model',
        });
      }

      if (!['openai', 'anthropic', 'gemini', 'zhipuai', 'qianfan', 'dashscope', 'ollama', 'ark', 'cursor', 'deepseek'].includes(provider)) {
        return res.status(400).json({
          error: 'Invalid provider',
        });
      }

      // If apiKey or baseURL provided, update provider config separately
      if (apiKey !== undefined || baseURL !== undefined) {
        await providerConfigRepo.upsert({
          userId,
          provider: provider as LLMProvider,
          apiKey,
          baseURL,
        });
      }

      const config = await llmConfigRepo.upsert({
        userId,
        provider: provider as LLMProvider,
        model,
        temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
        maxTokens: maxTokens !== undefined ? parseInt(maxTokens, 10) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      });

      logger.info(`LLMConfigController: Configuration upserted`, {
        userId,
        provider,
        isActive: config.is_active,
      });

      // Refresh LLM manager to use new config immediately
      await llmManager.refresh(userId);

      // Fetch the config again to get provider config values
      const fullConfig = await llmConfigRepo.findByProvider(userId, config.provider);
      const llmConfig = fullConfig ? llmConfigRepo.toILLMConfig(fullConfig) : null;

      return res.json({
        success: true,
        config: {
          id: config.id,
          provider: config.provider,
          apiKey: llmConfig?.apiKey || '',
          baseURL: llmConfig?.baseURL,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to upsert config:', error);
      return res.status(500).json({
        error: 'Failed to save LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Set a configuration as active
   * POST /api/config/llm/:id/activate
   */
  static async activate(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { id } = req.params;

      const config = await llmConfigRepo.setActive(userId, id);

      logger.info(`LLMConfigController: Configuration activated`, {
        userId,
        configId: id,
      });

      // Refresh LLM manager to use new config immediately
      await llmManager.refresh(userId);

      // Fetch the config again to get provider config values
      const fullConfig = await llmConfigRepo.findByProvider(userId, config.provider);
      const llmConfig = fullConfig ? llmConfigRepo.toILLMConfig(fullConfig) : null;
      
      return res.json({
        success: true,
        config: {
          id: config.id,
          provider: config.provider,
          apiKey: llmConfig?.apiKey || '',
          baseURL: llmConfig?.baseURL,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to activate config:', error);
      return res.status(500).json({
        error: 'Failed to activate LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Delete LLM configuration
   * DELETE /api/config/llm/:id
   */
  static async delete(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { id } = req.params;

      await llmConfigRepo.softDelete(userId, id);

      logger.info(`LLMConfigController: Configuration deleted`, {
        userId,
        configId: id,
      });

      return res.json({
        success: true,
        message: 'Configuration deleted successfully',
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to delete config:', error);
      return res.status(500).json({
        error: 'Failed to delete LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Get all provider configurations for the user
   * GET /api/config/llm/providers
   */
  static async listProviders(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const providerConfigs = await providerConfigRepo.findByUserId(userId);

      return res.json({
        success: true,
        providers: providerConfigs.map((config) => ({
          provider: config.provider,
          apiKey: config.api_key,
          hasApiKey: !!config.api_key,
          baseURL: config.base_url,
          model: config.model,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to list provider configs:', error);
      return res.status(500).json({
        error: 'Failed to list provider configurations',
        message: error.message,
      });
    }
  }

  /**
   * Get provider configuration by provider
   * GET /api/config/llm/providers/:provider
   */
  static async getProvider(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { provider } = req.params;

      if (!provider || !['openai', 'anthropic', 'gemini', 'zhipuai', 'qianfan', 'dashscope', 'ollama', 'ark', 'cursor', 'deepseek'].includes(provider)) {
        return res.status(400).json({
          error: 'Invalid provider',
        });
      }

      const config = await providerConfigRepo.findByProvider(userId, provider as LLMProvider);

      if (!config) {
        return res.status(404).json({
          error: 'Provider configuration not found',
        });
      }

      return res.json({
        success: true,
        provider: {
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to get provider config:', error);
      return res.status(500).json({
        error: 'Failed to get provider configuration',
        message: error.message,
      });
    }
  }

  /**
   * Create or update provider configuration
   * POST /api/config/llm/providers
   */
  static async upsertProvider(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { provider, apiKey, baseURL, model } = req.body;

      if (!provider) {
        return res.status(400).json({
          error: 'Missing required field: provider',
        });
      }

      if (!['openai', 'anthropic', 'gemini', 'zhipuai', 'qianfan', 'dashscope', 'ollama', 'ark', 'cursor', 'deepseek'].includes(provider)) {
        return res.status(400).json({
          error: 'Invalid provider',
        });
      }

      const config = await providerConfigRepo.upsert({
        userId,
        provider: provider as LLMProvider,
        apiKey,
        baseURL,
        model,
      });

      logger.info(`LLMConfigController: Provider configuration upserted`, {
        userId,
        provider,
      });

      // Refresh LLM manager to use new config immediately
      await llmManager.refresh(userId);

      return res.json({
        success: true,
        provider: {
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to upsert provider config:', error);
      return res.status(500).json({
        error: 'Failed to save provider configuration',
        message: error.message,
      });
    }
  }

  // ============================================================================
  // LLM Model Management (Global Model Registry)
  // ============================================================================

  /**
   * Get all models grouped by provider
   * GET /api/config/llm/models
   */
  static async listModels(req: Request, res: Response) {
    try {
      const models = await llmModelRepo.findAllGrouped();

      return res.json({
        success: true,
        models,
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to list models:', error);
      return res.status(500).json({
        error: 'Failed to list LLM models',
        message: error.message,
      });
    }
  }

  /**
   * Get models for a specific provider
   * GET /api/config/llm/models/:provider
   */
  static async listModelsByProvider(req: Request, res: Response) {
    try {
      const { provider } = req.params;

      if (!provider) {
        return res.status(400).json({
          error: 'Provider is required',
        });
      }

      const models = await llmModelRepo.findByProvider(provider);

      return res.json({
        success: true,
        models: models.map((model) => ({
          id: model.id,
          provider: model.provider,
          modelName: model.model_name,
          displayName: model.display_name,
          isDefault: model.is_default,
          sortOrder: model.sort_order,
          createdAt: model.created_at,
          updatedAt: model.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to list models by provider:', error);
      return res.status(500).json({
        error: 'Failed to list LLM models',
        message: error.message,
      });
    }
  }

  /**
   * Create a new model
   * POST /api/config/llm/models
   */
  static async createModel(req: Request, res: Response) {
    try {
      const { provider, modelName, displayName, isDefault, sortOrder } = req.body;

      if (!provider || !modelName) {
        return res.status(400).json({
          error: 'Missing required fields: provider and modelName',
        });
      }

      // Check if model already exists
      const existing = await llmModelRepo.findByProviderAndName(provider, modelName);
      if (existing) {
        return res.status(409).json({
          error: 'Model already exists for this provider',
        });
      }

      const model = await llmModelRepo.create({
        provider,
        modelName,
        displayName,
        isDefault,
        sortOrder,
      });

      logger.info('LLMConfigController: Model created', {
        provider,
        modelName,
      });

      return res.json({
        success: true,
        model: {
          id: model.id,
          provider: model.provider,
          modelName: model.model_name,
          displayName: model.display_name,
          isDefault: model.is_default,
          sortOrder: model.sort_order,
          createdAt: model.created_at,
          updatedAt: model.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to create model:', error);
      return res.status(500).json({
        error: 'Failed to create LLM model',
        message: error.message,
      });
    }
  }

  /**
   * Update a model
   * PUT /api/config/llm/models/:id
   */
  static async updateModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { displayName, isDefault, sortOrder } = req.body;

      const model = await llmModelRepo.update(id, {
        displayName,
        isDefault,
        sortOrder,
      });

      logger.info('LLMConfigController: Model updated', { id });

      return res.json({
        success: true,
        model: {
          id: model.id,
          provider: model.provider,
          modelName: model.model_name,
          displayName: model.display_name,
          isDefault: model.is_default,
          sortOrder: model.sort_order,
          createdAt: model.created_at,
          updatedAt: model.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to update model:', error);
      return res.status(500).json({
        error: 'Failed to update LLM model',
        message: error.message,
      });
    }
  }

  /**
   * Delete a model
   * DELETE /api/config/llm/models/:id
   */
  static async deleteModel(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await llmModelRepo.delete(id);

      logger.info('LLMConfigController: Model deleted', { id });

      return res.json({
        success: true,
        message: 'Model deleted successfully',
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to delete model:', error);
      return res.status(500).json({
        error: 'Failed to delete LLM model',
        message: error.message,
      });
    }
  }

  /**
   * Update sort order for multiple models
   * PUT /api/config/llm/models/sort
   */
  static async updateModelSortOrder(req: Request, res: Response) {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
          error: 'Missing required field: updates (array of {id, sortOrder})',
        });
      }

      await llmModelRepo.updateSortOrder(updates);

      logger.info('LLMConfigController: Model sort order updated', {
        count: updates.length,
      });

      return res.json({
        success: true,
        message: 'Sort order updated successfully',
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to update model sort order:', error);
      return res.status(500).json({
        error: 'Failed to update model sort order',
        message: error.message,
      });
    }
  }
}

