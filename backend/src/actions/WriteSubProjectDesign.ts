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
import { logger } from '../utils';

export class WriteSubProjectDesign extends BaseAction {
  constructor() {
    super('WriteSubProjectDesign', 'Generate sub-project design documents');
  }

  async run(taskBreakdown: string, design: string): Promise<IActionOutput> {
    logger.info('WriteSubProjectDesign: Starting sub-project design generation');
    
    try {
      // Build the prompt
      const prompt = buildSubProjectDesignPrompt(taskBreakdown, design);
      
      // Call LLM with system message and prompt
      const subProjectDesignContent = await this.aask(prompt, [SUB_PROJECT_DESIGN_SYSTEM_PROMPT]);
      
      logger.info('WriteSubProjectDesign: Sub-project design generation completed', {
        contentLength: subProjectDesignContent.length,
      });
      
      return {
        content: subProjectDesignContent,
        data: {
          type: 'sub_project_design',
          filename: 'SUB_PROJECT_DESIGN.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WriteSubProjectDesign: Failed to generate sub-project design', error);
      throw error;
    }
  }
}

export default WriteSubProjectDesign;

