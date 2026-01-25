/**
 * LLM Config Controller
 * Handles LLM configuration-related HTTP requests
 * 
 * Uses LLMManager for centralized LLM configuration management.
 * Schema V2: Uses unified LLMConfigRepository
 */

import { Request, Response } from 'express';
import { LLMConfigRepository } from '../../database';
import { logger } from '../../utils';
import { llmManager } from '../../providers/llm/LLMManager';
import { LLMProvider } from '@mind2build/shared';

const llmConfigRepo = new LLMConfigRepository();
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

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
        configs: configs.map((config) => ({
          id: config.id,
          configScope: config.config_scope,
          provider: config.provider,
          roleProfile: config.role_profile,
          model: config.model,
          baseURL: config.base_url,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
          // Don't expose API key in list
        })),
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

      return res.json({
        success: true,
        config: {
          id: config.id,
          configScope: config.config_scope,
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
          configScope: config.config_scope,
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

      const config = await llmConfigRepo.upsertProvider({
        userId,
        provider: provider as LLMProvider,
        apiKey,
        baseURL,
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

      return res.json({
        success: true,
        config: {
          id: config.id,
          configScope: config.config_scope,
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
      
      return res.json({
        success: true,
        config: {
          id: config.id,
          configScope: config.config_scope,
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

      const providerConfigs = await llmConfigRepo.findProviderConfigs(userId);

      return res.json({
        success: true,
        providers: providerConfigs.map((config) => ({
          id: config.id,
          provider: config.provider,
          apiKey: config.api_key,
          hasApiKey: !!config.api_key,
          baseURL: config.base_url,
          model: config.model,
          isActive: config.is_active,
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

      const config = await llmConfigRepo.findByProvider(userId, provider as LLMProvider);

      if (!config) {
        return res.status(404).json({
          error: 'Provider configuration not found',
        });
      }

      return res.json({
        success: true,
        provider: {
          id: config.id,
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          isActive: config.is_active,
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

      const config = await llmConfigRepo.upsertProvider({
        userId,
        provider: provider as LLMProvider,
        apiKey,
        baseURL,
        model: model || 'default',
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
          id: config.id,
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          isActive: config.is_active,
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

  /**
   * Get role-specific LLM configurations
   * GET /api/config/llm/roles
   */
  static async listRoleConfigs(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const roleConfigs = await llmConfigRepo.findRoleConfigs(userId);

      return res.json({
        success: true,
        roleConfigs: roleConfigs.map((config) => ({
          id: config.id,
          roleProfile: config.role_profile,
          provider: config.provider,
          model: config.model,
          baseURL: config.base_url,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          repository: config.repository,
          branchName: config.branch_name,
          autoCreatePr: config.auto_create_pr,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to list role configs:', error);
      return res.status(500).json({
        error: 'Failed to list role configurations',
        message: error.message,
      });
    }
  }

  /**
   * Upsert role-specific LLM configuration
   * POST /api/config/llm/roles
   */
  static async upsertRoleConfig(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { roleProfile, provider, apiKey, baseURL, model, temperature, maxTokens, repository, branchName, autoCreatePr } = req.body;

      if (!roleProfile || !provider || !model) {
        return res.status(400).json({
          error: 'Missing required fields: roleProfile, provider, and model',
        });
      }

      const config = await llmConfigRepo.upsertRole({
        userId,
        roleProfile,
        provider: provider as LLMProvider,
        apiKey,
        baseURL,
        model,
        temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
        maxTokens: maxTokens !== undefined ? parseInt(maxTokens, 10) : undefined,
        repository,
        branchName,
        autoCreatePr: autoCreatePr !== undefined ? Boolean(autoCreatePr) : undefined,
      });

      logger.info(`LLMConfigController: Role configuration upserted`, {
        userId,
        roleProfile,
        provider,
      });

      return res.json({
        success: true,
        roleConfig: {
          id: config.id,
          roleProfile: config.role_profile,
          provider: config.provider,
          model: config.model,
          baseURL: config.base_url,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          repository: config.repository,
          branchName: config.branch_name,
          autoCreatePr: config.auto_create_pr,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('LLMConfigController: Failed to upsert role config:', error);
      return res.status(500).json({
        error: 'Failed to save role configuration',
        message: error.message,
      });
    }
  }
}
