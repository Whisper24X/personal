/**
 * DesignReview Action
 * Reviews Design Document for completeness and quality
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_REVIEW_SYSTEM_PROMPT,
  buildDesignReviewPrompt,
} from '../prompts/design';
import { logger, loadPrompt } from '../utils';

export interface DesignReviewOptions {
  outline?: string;
}

export class DesignReview extends BaseAction {
  constructor() {
    super('DesignReview', 'Review Design Document for completeness and quality');
  }

  async run(designContent: string, options?: DesignReviewOptions): Promise<IActionOutput> {
    logger.info('DesignReview: Starting design review', {
      designLength: designContent.length,
      hasOutline: !!options?.outline,
    });

    try {
      const outline = options?.outline || this.extractOutline(designContent);
      const prompt = buildDesignReviewPrompt(designContent, outline);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'design', 'review_system_prompt', DESIGN_REVIEW_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      logger.info('DesignReview: Review completed', {
        reviewLength: reviewResult.length,
      });

      return {
        content: reviewResult,
        data: {
          type: 'design_review',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('DesignReview: Failed to review design', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Extract outline from Design content
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

    return outline.join('\n') || '## 1. 系统概述\n## 2. 系统总体架构设计\n## 3. 技术选型总览\n## 4. 前端技术方案设计\n## 5. 后端技术方案设计\n## 6. 数据模型设计\n## 7. 安全性设计\n## 8. 性能与扩展性\n## 9. 日志、错误与监控\n## 10. 测试策略\n## 11. 部署与 DevOps\n## 12. 未来演进方向';
  }
}

export default DesignReview;

