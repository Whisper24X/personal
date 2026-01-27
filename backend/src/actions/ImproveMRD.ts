/**
 * ImproveMRD Action
 * Improves Market Research Document (MRD) based on review reports
 * 
 * 使用 DocumentImproveHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  MRD_IMPROVE_SYSTEM_PROMPT,
  buildMRDImprovePrompt,
} from '../prompts/mrd';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentImproveHandler,
  DOCUMENT_CONFIGS,
  ImproveConfig,
} from '../utils/document';

export interface ImproveMRDOptions extends WorkspaceOptions {
  reviewReport?: string; // Review report content, if not provided, will be read from workspace
}

export class ImproveMRD extends BaseAction {
  constructor() {
    super('ImproveMRD', 'Improve Market Research Document (MRD) based on review reports');
  }

  /**
   * 创建 ImproveHandler
   */
  private async createImproveHandler(): Promise<DocumentImproveHandler> {
    const systemPrompt = await this.loadSystemPrompt('mrd', 'improve_system_prompt', MRD_IMPROVE_SYSTEM_PROMPT);

    const config: ImproveConfig = {
      ...DOCUMENT_CONFIGS.MRD,
      buildImprovePrompt: buildMRDImprovePrompt,
      systemPrompt,
      reviewReportPattern: /#\s*市场研究文档\s*审查报告/,
    };

    return new DocumentImproveHandler(this, config);
  }

  async run(
    input: string, // Review report content or MRD content
    options?: ImproveMRDOptions
  ): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'MRD');
    const { applicationId, projectId, version } = workspaceOptions;

    logger.info('ImproveMRD: Starting MRD improvement', {
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
        type: 'mrd_improved',
        documentType: 'MRD',
        filename: 'MRD.md',
      });
    } catch (error: any) {
      logger.error('ImproveMRD: Failed to improve MRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ImproveMRD;
