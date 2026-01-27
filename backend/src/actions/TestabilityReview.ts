/**
 * TestabilityReview Action
 * Reviews PRD and code for testability
 * 
 * 使用 DocumentReviewHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger } from '../utils';
import {
  DocumentReviewHandler,
  DOCUMENT_CONFIGS,
  ReviewConfig,
  isReviewPassed,
} from '../utils/document';
import {
  TESTABILITY_REVIEW_SYSTEM_PROMPT,
  buildTestabilityReviewPrompt,
} from '../prompts/test';

export interface TestabilityReviewOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class TestabilityReview extends BaseAction {
  constructor() {
    super(
      'TestabilityReview',
      'Review PRD and code for testability, identifying untestable or difficult-to-test requirements'
    );
  }

  /**
   * 创建 ReviewHandler
   */
  private async createReviewHandler(): Promise<DocumentReviewHandler> {
    const systemPrompt = await this.loadSystemPrompt('test', 'testability_review_system_prompt', TESTABILITY_REVIEW_SYSTEM_PROMPT);

    const config: ReviewConfig = {
      ...DOCUMENT_CONFIGS.TESTABILITY,
      buildReviewPrompt: (content: string, _outline: string) => {
        // TestabilityReview 审核 PRD 的可测试性，content 为 PRD 内容
        return buildTestabilityReviewPrompt(content, '');
      },
      systemPrompt,
    };

    return new DocumentReviewHandler(this, config);
  }

  async run(input: string, options?: TestabilityReviewOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const { applicationId, projectId, version } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('TestabilityReview: Starting testability review', {
      applicationId,
      projectId,
      version,
      isCLIMode,
      inputLength: input?.length || 0,
    });

    try {
      // CLI模式：使用 BaseAction 封装的执行方法
      if (isCLIMode) {
        const handler = await this.getCachedHandler('review', () => this.createReviewHandler());
        return await this.executeReviewHandler(handler, input, workspaceOptions, {
          type: 'testability_review',
          filename: 'TESTABILITY_REVIEW.md',
        });
      }

      // LLM模式：读取 PRD 和代码内容进行可测试性审核
      let prd = '';
      let code = '';

      // 解析输入
      if (input.includes('PRD文档：') && input.includes('代码实现：')) {
        const parts = input.split('代码实现：');
        prd = parts[0].replace('PRD文档：', '').trim();
        code = parts[1]?.trim() || '';
      } else if (input.includes('PRD文档：')) {
        prd = input.replace('PRD文档：', '').trim();
      } else {
        code = input;
      }

      // 从 workspace 读取 PRD（如果输入中没有）
      if (!prd) {
        prd = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
      }

      if (!prd && !code) {
        throw new Error('Neither PRD nor code found for testability review');
      }

      logger.info('TestabilityReview: LLM mode - loaded context', {
        prdLength: prd.length,
        codeLength: code.length,
      });

      // 构建审核提示词
      const prompt = buildTestabilityReviewPrompt(prd, code);

      // Load system prompt
      const systemPrompt = await this.loadSystemPrompt('test', 'testability_review_system_prompt', TESTABILITY_REVIEW_SYSTEM_PROMPT);

      // Call LLM
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      // 保存审核报告
      await this.saveToWorkspace('TESTABILITY_REVIEW.md', reviewResult, workspaceOptions);

      const passed = isReviewPassed(reviewResult);

      logger.info('TestabilityReview: Review completed', {
        reviewLength: reviewResult.length,
        passed,
      });

      return this.createActionOutput(reviewResult, {
        type: 'testability_review',
        filename: 'TESTABILITY_REVIEW.md',
        passed,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('TestabilityReview: Failed to generate testability review', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default TestabilityReview;
