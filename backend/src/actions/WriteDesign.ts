/**
 * WriteDesign Action
 * Generates System Design Document from PRD
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { DESIGN_SYSTEM_PROMPT, buildDesignPrompt } from '../prompts/design';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';

export interface WriteDesignOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class WriteDesign extends BaseAction {
  constructor() {
    super('WriteDesign', 'Generate System Design Document from PRD');
  }

  async run(prd: string, options?: WriteDesignOptions): Promise<IActionOutput> {
    logger.info('WriteDesign: Starting design generation');
    
    try {
      // Build the prompt
      const prompt = buildDesignPrompt(prd);
      
      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'system_prompt', DESIGN_SYSTEM_PROMPT);
      
      // Call LLM with system message and prompt
      const designContent = await this.aask(prompt, [systemPrompt]);
      
      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'DESIGN',
      };
      await this.saveToWorkspace('DESIGN.md', designContent, workspaceOptions);
      
      logger.info('WriteDesign: Design generation completed', {
        contentLength: designContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
      
      return {
        content: designContent,
        data: {
          type: 'design',
          filename: 'DESIGN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('WriteDesign: Failed to generate design', error);
      throw error;
    }
  }
}

export default WriteDesign;

