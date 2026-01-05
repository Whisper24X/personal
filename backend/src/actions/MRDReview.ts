/**
 * MRDReview Action
 * Reviews Market Research Document (MRD) for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_REVIEW_SYSTEM_PROMPT,
  buildMRDReviewPrompt,
} from '../prompts/mrd';
import { logger, loadPrompt } from '../utils';

export interface MRDReviewOptions {
  outline?: string;
}

export class MRDReview extends BaseAction {
  constructor() {
    super('MRDReview', 'Review Market Research Document (MRD) for completeness and quality');
  }

  async run(mrdContent: string, options?: MRDReviewOptions): Promise<IActionOutput> {
    logger.info('MRDReview: Starting MRD review', {
      contentLength: mrdContent.length,
      hasOutline: !!options?.outline,
    });

    try {
      const outline = options?.outline || this.extractOutline(mrdContent);
      const prompt = buildMRDReviewPrompt(mrdContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'mrd', 'review_system_prompt', MRD_REVIEW_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      logger.info('MRDReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      return {
        content: reviewResult,
        data: {
          type: 'mrd_review',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('MRDReview: Failed to review MRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from MRD content
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

    return outline.join('\n') || '## 1. 需求背景与目标价值分析\n## 2. 需求价值分析\n## 3. 用户分析\n## 4. 业务流程分析\n## 5. 市场分析\n## 6. 可行性分析\n## 7. 项目范围';
  }
}

export default MRDReview;

