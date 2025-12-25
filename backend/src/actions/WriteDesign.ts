/**
 * WriteDesign Action
 * Generates System Design Document from PRD
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { DESIGN_SYSTEM_PROMPT, buildDesignPrompt } from '../prompts/design';
import { logger } from '../utils';

export class WriteDesign extends BaseAction {
  constructor() {
    super('WriteDesign', 'Generate System Design Document from PRD');
  }

  async run(prd: string): Promise<IActionOutput> {
    logger.info('WriteDesign: Starting design generation');
    
    try {
      // Build the prompt
      const prompt = buildDesignPrompt(prd);
      
      // Call LLM with system message and prompt
      const designContent = await this.aask(prompt, [DESIGN_SYSTEM_PROMPT]);
      
      logger.info('WriteDesign: Design generation completed', {
        contentLength: designContent.length,
      });
      
      return {
        content: designContent,
        data: {
          type: 'design',
          filename: 'DESIGN.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WriteDesign: Failed to generate design', error);
      throw error;
    }
  }
}

export default WriteDesign;

