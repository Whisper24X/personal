/**
 * MRDReview Action
 * Reviews Market Research Document (MRD) for completeness and quality
 * 
 * 使用 DocumentReviewHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_REVIEW_SYSTEM_PROMPT,
  buildMRDReviewPrompt,
} from '../prompts/mrd';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentReviewHandler,
  DOCUMENT_CONFIGS,
  ReviewConfig,
  extractOutline,
} from '../utils/document';

export interface MRDReviewOptions extends WorkspaceOptions {
  outline?: string;
}

export class MRDReview extends BaseAction {
  constructor() {
    super('MRDReview', 'Review Market Research Document (MRD) for completeness and quality');
  }

  /**
   * 创建 ReviewHandler
   */
  private async createReviewHandler(): Promise<DocumentReviewHandler> {
    const systemPrompt = await this.loadSystemPrompt('mrd', 'review_system_prompt', MRD_REVIEW_SYSTEM_PROMPT);

    const config: ReviewConfig = {
      ...DOCUMENT_CONFIGS.MRD,
      buildReviewPrompt: buildMRDReviewPrompt,
      systemPrompt,
      extractOutline: (content: string) => this.extractOutline(content),
    };

    return new DocumentReviewHandler(this, config);
  }

  async run(mrdContent: string, options?: MRDReviewOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'MRD');
    const { applicationId, projectId, version } = workspaceOptions;

    logger.info('MRDReview: Starting MRD review', {
      contentLength: mrdContent?.length || 0,
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
      return await this.executeReviewHandler(handler, mrdContent, {
        ...workspaceOptions,
        outline: options?.outline,
      }, {
        type: 'mrd_review',
        filename: 'MRD_REVIEW.md',
      });
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
    const outline = extractOutline(content);
    return outline || '## 1. Requirement Background and Target Value Analysis\n## 2. Requirement Value Analysis\n## 3. User Analysis\n## 4. Business Process Analysis\n## 5. Market Analysis\n## 6. Feasibility Analysis\n## 7. Project Scope';
  }
}

export default MRDReview;
