/**
 * WriteSubProjectDesign Action
 * Generates sub-project design documents based on task breakdown
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  SUB_PROJECT_DESIGN_SYSTEM_PROMPT,
  buildSubProjectDesignPrompt,
} from '../prompts/task';
import { logger, WorkspaceOptions, loadPrompt } from '../utils';

export interface WriteSubProjectDesignOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class WriteSubProjectDesign extends BaseAction {
  constructor() {
    super('WriteSubProjectDesign', 'Generate sub-project design documents');
  }

  async run(
    taskBreakdown: string,
    design: string,
    options?: WriteSubProjectDesignOptions
  ): Promise<IActionOutput> {
    logger.info('WriteSubProjectDesign: Starting sub-project design generation');
    
    try {
      // Build the prompt
      const prompt = buildSubProjectDesignPrompt(taskBreakdown, design);
      
      // Load system prompt from database or use default
      // Note: SUB_PROJECT_DESIGN_SYSTEM_PROMPT uses design type as it's a design-related prompt
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'system_prompt', SUB_PROJECT_DESIGN_SYSTEM_PROMPT);
      
      // Call LLM with system message and prompt
      const subProjectDesignContent = await this.aask(prompt, [systemPrompt]);
      
      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'DESIGN',
      };
      await this.saveToWorkspace('SUB_PROJECT_DESIGN.md', subProjectDesignContent, workspaceOptions);
      
      logger.info('WriteSubProjectDesign: Sub-project design generation completed', {
        contentLength: subProjectDesignContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
      
      return {
        content: subProjectDesignContent,
        data: {
          type: 'sub_project_design',
          filename: 'SUB_PROJECT_DESIGN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('WriteSubProjectDesign: Failed to generate sub-project design', error);
      throw error;
    }
  }
}

export default WriteSubProjectDesign;

