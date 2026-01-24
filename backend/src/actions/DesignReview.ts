/**
 * DesignReview Action
 * Reviews Design Document for completeness and quality
 * 
 * 使用 DocumentReviewHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_REVIEW_SYSTEM_PROMPT,
  buildDesignReviewPrompt,
} from '../prompts/design';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentReviewHandler,
  DOCUMENT_CONFIGS,
  ReviewConfig,
  extractOutline,
} from '../utils/document';

export interface DesignReviewOptions extends WorkspaceOptions {
  outline?: string;
}

export class DesignReview extends BaseAction {
  constructor() {
    super('DesignReview', 'Review Design Document for completeness and quality');
  }

  /**
   * 创建 ReviewHandler
   */
  private async createReviewHandler(): Promise<DocumentReviewHandler> {
    const systemPrompt = await this.loadSystemPrompt('design', 'review_system_prompt', DESIGN_REVIEW_SYSTEM_PROMPT);

    const config: ReviewConfig = {
      ...DOCUMENT_CONFIGS.DESIGN,
      buildReviewPrompt: buildDesignReviewPrompt,
      systemPrompt,
      extractOutline: (content: string) => this.extractOutline(content),
    };

    return new DocumentReviewHandler(this, config);
  }

  async run(designContent: string, options?: DesignReviewOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'DESIGN');
    const { applicationId, projectId, version } = workspaceOptions;

    logger.info('DesignReview: Starting design review', {
      designLength: designContent?.length || 0,
      hasOutline: !!options?.outline,
      applicationId,
      projectId,
      version,
      isCLIMode: this.isCLIMode(),
    });

    try {
      // 使用缓存的 handler
      const handler = await this.getCachedHandler('review', () => this.createReviewHandler());

      // 使用 BaseAction 封装的执行方法
      return await this.executeReviewHandler(handler, designContent, {
        ...workspaceOptions,
        outline: options?.outline,
      }, {
        type: 'design_review',
        filename: 'DESIGN_REVIEW.md',
      });
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
  private extractOutline(content: string): string {
    const outline = extractOutline(content);
    return outline || '## 1. 系统概述\n## 2. 系统总体架构设计\n## 3. 技术选型总览\n## 4. 前端技术方案设计\n## 5. 后端技术方案设计\n## 6. 数据模型设计\n## 7. 安全性设计\n## 8. 性能与扩展性\n## 9. 日志、错误与监控\n## 10. 测试策略\n## 11. 部署与 DevOps\n## 12. 未来演进方向';
  }
}

export default DesignReview;
