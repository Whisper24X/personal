/**
 * PRDReview Action
 * Reviews PRD document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_REVIEW_SYSTEM_PROMPT,
  buildPRDReviewPrompt,
} from '../prompts/prd';
import { logger, loadPrompt } from '../utils';

export interface PRDReviewOptions {
  outline?: string;
}

export class PRDReview extends BaseAction {
  constructor() {
    super('PRDReview', 'Review PRD document for completeness and quality');
  }

  async run(prdContent: string, options?: PRDReviewOptions): Promise<IActionOutput> {
    logger.info('PRDReview: Starting PRD review', {
      prdLength: prdContent.length,
      hasOutline: !!options?.outline,
    });

    try {
      const outline = options?.outline || this.extractOutline(prdContent);
      const prompt = buildPRDReviewPrompt(prdContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'prd', 'review_system_prompt', PRD_REVIEW_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      logger.info('PRDReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      return {
        content: reviewResult,
        data: {
          type: 'prd_review',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('PRDReview: Failed to review PRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from PRD content
   */
  private extractOutline(prdContent: string): string {
    const lines = prdContent.split('\n');
    const outline: string[] = [];
    
    for (const line of lines) {
      // Match ## X. Title format
      const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);
      if (match) {
        outline.push(line);
      }
    }

    return outline.join('\n') || '## 0. 版本说明\n## 1. 产品概述\n## 2. 目标与成功指标\n## 3. 用户故事\n## 4. 功能需求\n## 5. 页面与交互设计说明\n## 6. 非功能需求\n## 7. 技术实现建议\n## 8. 验收与交付标准\n## 9. 风险与应对\n## 10. 附录';
  }
}

export default PRDReview;

