/**
 * Prompt Config Controller
 * Handles prompt configuration-related HTTP requests
 */

import { Request, Response } from 'express';
import { PromptConfigRepository } from '../../database';
import { PromptType } from '../../database/repositories/PromptConfigRepository';
import { logger, clearPromptCacheForType } from '../../utils';

const promptConfigRepo = new PromptConfigRepository();
const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

export class PromptConfigController {
  /**
   * Get all prompt configurations for the user
   * GET /api/config/prompts
   */
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const configs = await promptConfigRepo.findByUserId(userId);

      return res.json({
        success: true,
        configs: configs.map((config) => ({
          id: config.id,
          promptType: config.prompt_type,
          promptKey: config.prompt_key,
          content: config.content,
          description: config.description,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('PromptConfigController: Failed to list configs:', error);
      return res.status(500).json({
        error: 'Failed to list prompt configurations',
        message: error.message,
      });
    }
  }

  /**
   * Get prompt configurations grouped by type
   * GET /api/config/prompts/grouped
   */
  static async listGrouped(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;

      const grouped = await promptConfigRepo.findByUserIdGrouped(userId);

      // Convert to frontend-friendly format
      const result: Record<string, Record<string, any>> = {};
      for (const [type, configs] of Object.entries(grouped)) {
        result[type] = {};
        for (const [key, config] of Object.entries(configs)) {
          result[type][key] = {
            id: config.id,
            content: config.content,
            description: config.description,
            isActive: config.is_active,
            createdAt: config.created_at,
            updatedAt: config.updated_at,
          };
        }
      }

      return res.json({
        success: true,
        configs: result,
      });
    } catch (error: any) {
      logger.error('PromptConfigController: Failed to list grouped configs:', error);
      return res.status(500).json({
        error: 'Failed to list grouped prompt configurations',
        message: error.message,
      });
    }
  }

  /**
   * Get prompt configurations by type
   * GET /api/config/prompts/:type
   */
  static async getByType(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { type } = req.params;

      if (!['prd', 'design', 'code', 'test', 'task'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid prompt type',
          message: 'Prompt type must be one of: prd, design, code, test, task',
        });
      }

      const configs = await promptConfigRepo.findByType(userId, type as PromptType);

      return res.json({
        success: true,
        configs: configs.map((config) => ({
          id: config.id,
          promptType: config.prompt_type,
          promptKey: config.prompt_key,
          content: config.content,
          description: config.description,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('PromptConfigController: Failed to get configs by type:', error);
      return res.status(500).json({
        error: 'Failed to get prompt configurations',
        message: error.message,
      });
    }
  }

  /**
   * Get specific prompt configuration
   * GET /api/config/prompts/:type/:key
   */
  static async get(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { type, key } = req.params;

      if (!['prd', 'design', 'code', 'test', 'task'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid prompt type',
          message: 'Prompt type must be one of: prd, design, code, test, task',
        });
      }

      const config = await promptConfigRepo.findByTypeAndKey(userId, type as PromptType, key);

      if (!config) {
        return res.status(404).json({
          error: 'Prompt configuration not found',
        });
      }

      return res.json({
        success: true,
        config: {
          id: config.id,
          promptType: config.prompt_type,
          promptKey: config.prompt_key,
          content: config.content,
          description: config.description,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('PromptConfigController: Failed to get config:', error);
      return res.status(500).json({
        error: 'Failed to get prompt configuration',
        message: error.message,
      });
    }
  }

  /**
   * Create or update prompt configuration
   * POST /api/config/prompts
   */
  static async upsert(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { promptType, promptKey, content, description, isActive } = req.body;

      if (!promptType || !promptKey || !content) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'promptType, promptKey, and content are required',
        });
      }

      if (!['requirement', 'prd', 'design', 'code', 'test', 'task'].includes(promptType)) {
        return res.status(400).json({
          error: 'Invalid prompt type',
          message: 'Prompt type must be one of: requirement, prd, design, code, test, task',
        });
      }

      const config = await promptConfigRepo.upsert({
        userId,
        promptType: promptType as PromptType,
        promptKey,
        content,
        description,
        isActive,
      });

      // Clear cache for this prompt type
      clearPromptCacheForType(promptType as PromptType);

      return res.json({
        success: true,
        config: {
          id: config.id,
          promptType: config.prompt_type,
          promptKey: config.prompt_key,
          content: config.content,
          description: config.description,
          isActive: config.is_active,
          createdAt: config.created_at,
          updatedAt: config.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('PromptConfigController: Failed to upsert config:', error);
      return res.status(500).json({
        error: 'Failed to save prompt configuration',
        message: error.message,
      });
    }
  }

  /**
   * Delete prompt configuration
   * DELETE /api/config/prompts/:type/:key
   */
  static async delete(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const { type, key } = req.params;

      if (!['prd', 'design', 'code', 'test', 'task'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid prompt type',
          message: 'Prompt type must be one of: prd, design, code, test, task',
        });
      }

      await promptConfigRepo.delete(userId, type as PromptType, key);

      // Clear cache for this prompt type
      clearPromptCacheForType(type as PromptType);

      return res.json({
        success: true,
        message: 'Prompt configuration deleted',
      });
    } catch (error: any) {
      logger.error('PromptConfigController: Failed to delete config:', error);
      return res.status(500).json({
        error: 'Failed to delete prompt configuration',
        message: error.message,
      });
    }
  }
}

