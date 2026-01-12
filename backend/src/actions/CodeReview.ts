/**
 * CodeReview Action
 * Reviews code and provides feedback for engineers
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  buildCodeReviewPrompt,
} from '../prompts/code';
import { logger } from '../utils';

export class CodeReview extends BaseAction {
  constructor() {
    super('CodeReview', 'Review code and provide feedback');
  }

  async run(code: string, taskDescription: string, design?: string): Promise<IActionOutput> {
    logger.info('CodeReview: Starting code review');
    
    try {
      // Build the prompt
      const prompt = buildCodeReviewPrompt(code, taskDescription, design);
      
      // Call LLM with system message and prompt
      const reviewContent = await this.aask(prompt, [CODE_REVIEW_SYSTEM_PROMPT]);
      
      logger.info('CodeReview: Code review completed', {
        contentLength: reviewContent.length,
      });
      
      return {
        content: reviewContent,
        data: {
          type: 'code_review',
          filename: 'CODE_REVIEW.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('CodeReview: Failed to review code', error);
      throw error;
    }
  }
}

export default CodeReview;

