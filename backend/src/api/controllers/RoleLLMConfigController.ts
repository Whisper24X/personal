/**
 * Role LLM Config Controller
 * Handles role-specific LLM configuration-related HTTP requests
 */

import { Request, Response } from 'express';
import { RoleLLMConfigRepository } from '../../database';
import { logger } from '../../utils';
import { LLMProvider } from '@mind2build/shared';

const roleLLMConfigRepo = new RoleLLMConfigRepository();
const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

export class RoleLLMConfigController {
  /**
   * Get all role LLM configurations for the user
   * GET /api/config/role-llm
   */
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const configs = await roleLLMConfigRepo.findByUserId(userId);

      // Convert to map format for frontend
      const configsMap: Record<string, any> = {};
      configs.forEach((config) => {
        configsMap[config.role_profile] = {
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          repository: config.repository,
          branchName: config.branch_name,
          autoCreatePr: config.auto_create_pr,
        };
      });

      return res.json({
        success: true,
        configs: configsMap,
      });
    } catch (error: any) {
      logger.error('RoleLLMConfigController: Failed to list configs:', error);
      return res.status(500).json({
        error: 'Failed to list role LLM configurations',
        message: error.message,
      });
    }
  }

  /**
   * Get role LLM configuration by profile
   * GET /api/config/role-llm/:profile
   */
  static async getByProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { profile } = req.params;

      const config = await roleLLMConfigRepo.findByProfile(userId, profile);

      if (!config) {
        return res.status(404).json({
          error: 'Role LLM configuration not found',
        });
      }

      return res.json({
        success: true,
        config: {
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          repository: config.repository,
          branchName: config.branch_name,
          autoCreatePr: config.auto_create_pr,
        },
      });
    } catch (error: any) {
      logger.error('RoleLLMConfigController: Failed to get config:', error);
      return res.status(500).json({
        error: 'Failed to get role LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Create or update role LLM configuration
   * POST /api/config/role-llm/:profile
   */
  static async upsert(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { profile } = req.params;
      const {
        provider,
        apiKey,
        baseURL,
        model,
        temperature,
        maxTokens,
        repository,
        branchName,
        autoCreatePr,
      } = req.body;

      if (!provider || !model) {
        return res.status(400).json({
          error: 'Missing required fields: provider and model',
        });
      }

      // Validate provider
      const validProviders: LLMProvider[] = [
        'openai',
        'anthropic',
        'gemini',
        'zhipuai',
        'qianfan',
        'dashscope',
        'ollama',
        'ark',
        'cursor',
        'deepseek',
      ];
      if (!validProviders.includes(provider as LLMProvider)) {
        return res.status(400).json({
          error: 'Invalid provider',
        });
      }

      // Validate Cursor-specific fields
      if (provider === 'cursor' && !repository) {
        return res.status(400).json({
          error: 'Cursor provider requires repository field',
        });
      }

      const config = await roleLLMConfigRepo.upsert({
        userId,
        roleProfile: profile,
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

      logger.info('RoleLLMConfigController: Configuration upserted', {
        userId,
        roleProfile: profile,
        provider,
      });

      return res.json({
        success: true,
        config: {
          provider: config.provider,
          apiKey: config.api_key,
          baseURL: config.base_url,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          repository: config.repository,
          branchName: config.branch_name,
          autoCreatePr: config.auto_create_pr,
        },
      });
    } catch (error: any) {
      logger.error('RoleLLMConfigController: Failed to upsert config:', error);
      return res.status(500).json({
        error: 'Failed to save role LLM configuration',
        message: error.message,
      });
    }
  }

  /**
   * Delete role LLM configuration
   * DELETE /api/config/role-llm/:profile
   */
  static async delete(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { profile } = req.params;

      const deleted = await roleLLMConfigRepo.delete(userId, profile);

      if (!deleted) {
        return res.status(404).json({
          error: 'Role LLM configuration not found',
        });
      }

      logger.info('RoleLLMConfigController: Configuration deleted', {
        userId,
        roleProfile: profile,
      });

      return res.json({
        success: true,
        message: 'Configuration deleted',
      });
    } catch (error: any) {
      logger.error('RoleLLMConfigController: Failed to delete config:', error);
      return res.status(500).json({
        error: 'Failed to delete role LLM configuration',
        message: error.message,
      });
    }
  }
}

