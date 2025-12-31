/**
 * RequirementSpecReview Action
 * Reviews Requirement Specification document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  REQUIREMENT_SPEC_REVIEW_SYSTEM_PROMPT,
  buildRequirementSpecReviewPrompt,
} from '../prompts/requirement';
import { logger, loadPrompt } from '../utils';

export interface RequirementSpecReviewOptions {
  outline?: string;
}

export class RequirementSpecReview extends BaseAction {
  constructor() {
    super('RequirementSpecReview', 'Review Requirement Specification document for completeness and quality');
  }

  async run(requirementSpecContent: string, options?: RequirementSpecReviewOptions): Promise<IActionOutput> {
    logger.info('RequirementSpecReview: Starting requirement spec review', {
      contentLength: requirementSpecContent.length,
      hasOutline: !!options?.outline,
    });

    try {
      const outline = options?.outline || this.extractOutline(requirementSpecContent);
      const prompt = buildRequirementSpecReviewPrompt(requirementSpecContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'requirement', 'review_system_prompt', REQUIREMENT_SPEC_REVIEW_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      logger.info('RequirementSpecReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      return {
        content: reviewResult,
        data: {
          type: 'requirement_spec_review',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('RequirementSpecReview: Failed to review requirement spec', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from Requirement Spec content
   */
  private extractOutline(content: string): string {
    const lines = content.split('\n');
    const outline: string[] = [];
    
    for (const line of lines) {
      // Match ## X. Title format
      const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
      if (match) {
        outline.push(line);
      }
    }

    return outline.join('\n') || '## 1. 需求概述\n## 2. 用户分析\n## 3. 功能需求概述\n## 4. 市场分析\n## 5. 可行性分析\n## 6. 项目范围';
  }
}

export default RequirementSpecReview;

