/**
 * ImproveDesign Action
 * Improves System Design Document based on review reports
 * 
 * 使用 DocumentImproveHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  DESIGN_IMPROVE_SYSTEM_PROMPT,
  buildDesignImprovePrompt,
} from '../prompts/design';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentImproveHandler,
  DOCUMENT_CONFIGS,
  ImproveConfig,
} from '../utils/document';

export interface ImproveDesignOptions extends WorkspaceOptions {
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
}

export class ImproveDesign extends BaseAction {
  constructor() {
    super('ImproveDesign', 'Improve System Design Document based on review reports');
  }

  /**
   * 创建 ImproveHandler
   */
  private async createImproveHandler(): Promise<DocumentImproveHandler> {
    const systemPrompt = await this.loadSystemPrompt('design', 'improve_system_prompt', DESIGN_IMPROVE_SYSTEM_PROMPT);

    const config: ImproveConfig = {
      ...DOCUMENT_CONFIGS.DESIGN,
      buildImprovePrompt: buildDesignImprovePrompt,
      systemPrompt,
      reviewReportPattern: /#\s*系统设计文档\s*审查报告/,
    };

    return new DocumentImproveHandler(this, config);
  }

  async run(
    input: string, // 审查报告内容或Design内容
    options?: ImproveDesignOptions
  ): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'DESIGN');
    const { applicationId, projectId, version } = workspaceOptions;

    logger.info('ImproveDesign: Starting design improvement', {
      applicationId,
      projectId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
      isCLIMode: this.isCLIMode(),
    });

    try {
      // 使用缓存的 handler 和封装的执行方法
      const handler = await this.getCachedHandler('improve', () => this.createImproveHandler());
      return await this.executeImproveHandler(handler, input, {
        ...workspaceOptions,
        reviewReport: options?.reviewReport,
      }, {
        type: 'design_improved',
        documentType: 'DESIGN',
        filename: 'DESIGN.md',
      });
    } catch (error: any) {
      logger.error('ImproveDesign: Failed to improve design', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ImproveDesign;
