/**
 * SubProjectDesignReview Action
 * Reviews Sub-Project Design Document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  SUB_PROJECT_DESIGN_REVIEW_SYSTEM_PROMPT,
  buildSubProjectDesignReviewPrompt,
} from '../prompts/task';
import { logger, loadPrompt } from '../utils';

export interface SubProjectDesignReviewOptions {
  outline?: string;
}

export class SubProjectDesignReview extends BaseAction {
  constructor() {
    super('SubProjectDesignReview', 'Review Sub-Project Design Document for completeness and quality');
  }

  async run(designContent: string, options?: SubProjectDesignReviewOptions): Promise<IActionOutput> {
    logger.info('SubProjectDesignReview: Starting sub-project design review', {
      designLength: designContent.length,
      hasOutline: !!options?.outline,
    });

    try {
      const outline = options?.outline || this.extractOutline(designContent);
      const prompt = buildSubProjectDesignReviewPrompt(designContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'design',
        'review_system_prompt',
        SUB_PROJECT_DESIGN_REVIEW_SYSTEM_PROMPT
      );

      // Call LLM with system message and prompt
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      logger.info('SubProjectDesignReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      return {
        content: reviewResult,
        data: {
          type: 'sub_project_design_review',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('SubProjectDesignReview: Failed to review sub-project design', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from Sub-Project Design content
   */
  private extractOutline(designContent: string): string {
    const lines = designContent.split('\n');
    const outline: string[] = [];
    
    for (const line of lines) {
      // Match ## X. Title or ## X Title format
      const match = line.match(/^##\s+(\d+)\.?\s+(.+)$/);
      if (match) {
        outline.push(line);
      }
    }

    return outline.join('\n') || '## 1. 子项目概述\n## 2. 技术架构设计\n## 3. API接口设计\n## 4. 数据模型设计\n## 5. 前端组件设计\n## 6. 依赖关系说明\n## 7. 开发指南';
  }
}

export default SubProjectDesignReview;

