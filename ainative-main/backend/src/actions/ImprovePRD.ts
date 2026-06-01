/**
 * ImprovePRD Action
 * Improves Product Requirements Document (PRD) based on review reports
 * 
 * 使用 DocumentImproveHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  PRD_IMPROVE_SYSTEM_PROMPT,
  buildPRDImprovePrompt,
  buildPRDSectionImprovePrompt,
} from '../prompts/prd';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentImproveHandler,
  DOCUMENT_CONFIGS,
  ImproveConfig,
} from '../utils/document';

export interface ImprovePRDOptions extends WorkspaceOptions {
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
}

export class ImprovePRD extends BaseAction {
  constructor() {
    super('ImprovePRD', 'Improve Product Requirements Document (PRD) based on review reports');
  }

  /**
   * 创建 ImproveHandler
   */
  private async createImproveHandler(): Promise<DocumentImproveHandler> {
    const systemPrompt = await this.loadSystemPrompt('prd', 'improve_system_prompt', PRD_IMPROVE_SYSTEM_PROMPT);

    const config: ImproveConfig = {
      ...DOCUMENT_CONFIGS.PRD,
      buildImprovePrompt: buildPRDImprovePrompt,
      buildSectionImprovePrompt: buildPRDSectionImprovePrompt,
      systemPrompt,
      reviewReportPattern: /#\s*PRD\s*审查报告/,
    };

    return new DocumentImproveHandler(this, config);
  }

  async run(
    input: string, // 审查报告内容或PRD内容
    options?: ImprovePRDOptions
  ): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'PRD');
    const { applicationId, projectId, version } = workspaceOptions;

    logger.info('ImprovePRD: Starting PRD improvement', {
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
        type: 'prd_improved',
        documentType: 'PRD',
        filename: 'PRD.md',
      });
    } catch (error: any) {
      logger.error('ImprovePRD: Failed to improve PRD', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ImprovePRD;
