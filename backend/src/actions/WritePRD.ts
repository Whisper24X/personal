/**
 * WritePRD Action
 * Generates Product Requirements Document from user idea
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { PRD_SYSTEM_PROMPT, buildPRDPrompt } from '../prompts/prd';
import { logger } from '../utils';

export class WritePRD extends BaseAction {
  constructor() {
    super('WritePRD', 'Generate Product Requirements Document from user idea');
  }

  async run(input: string): Promise<IActionOutput> {
    logger.info('WritePRD: Starting PRD generation');
    
    try {
      // input 可以是用户需求或需求说明文档
      const prompt = buildPRDPrompt(input);
      
      // Call LLM with system message and prompt
      const prdContent = await this.aask(prompt, [PRD_SYSTEM_PROMPT]);
      
      logger.info('WritePRD: PRD generation completed', {
        contentLength: prdContent.length,
      });
      
      return {
        content: prdContent,
        data: {
          type: 'prd',
          filename: 'PRD.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WritePRD: Failed to generate PRD', error);
      throw error;
    }
  }
}

export default WritePRD;

