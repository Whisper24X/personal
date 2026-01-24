/**
 * TestReview Action
 * Reviews test cases document for completeness and quality
 * 
 * 使用 DocumentReviewHandler 统一处理 CLI 和 LLM 双模式逻辑
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TEST_REVIEW_SYSTEM_PROMPT,
  buildTestReviewPrompt,
} from '../prompts/test';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentReviewHandler,
  DOCUMENT_CONFIGS,
  ReviewConfig,
  isReviewPassed,
} from '../utils/document';

export interface TestReviewOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class TestReview extends BaseAction {
  constructor() {
    super('TestReview', 'Review test cases document for completeness and quality');
  }

  /**
   * 创建 ReviewHandler
   */
  private async createReviewHandler(): Promise<DocumentReviewHandler> {
    const systemPrompt = await this.loadSystemPrompt('test', 'review_system_prompt', TEST_REVIEW_SYSTEM_PROMPT);

    const config: ReviewConfig = {
      ...DOCUMENT_CONFIGS.TEST,
      buildReviewPrompt: (content: string, _outline: string) => {
        // TestReview 不需要 outline，而是需要 PRD 和 code 作为上下文
        // 在 CLI 模式下，这个函数不会被调用，因为使用路径模式
        return buildTestReviewPrompt(content, '', '');
      },
      systemPrompt,
    };

    return new DocumentReviewHandler(this, config);
  }

  async run(testCasesContent: string, options?: TestReviewOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const { applicationId, projectId, version } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('TestReview: Starting test cases review', {
      applicationId,
      projectId,
      version,
      isCLIMode,
      contentLength: testCasesContent?.length || 0,
    });

    try {
      // CLI模式：使用 BaseAction 封装的执行方法
      if (isCLIMode) {
        const handler = await this.getCachedHandler('review', () => this.createReviewHandler());
        return await this.executeReviewHandler(handler, testCasesContent, workspaceOptions, {
          type: 'test_review',
          filename: 'TEST_REVIEW.md',
        });
      }

      // LLM模式：读取文件内容并带上PRD和代码作为上下文
      let actualTestCasesContent = testCasesContent;
      if (!testCasesContent || testCasesContent.trim().length < 100) {
        const testCasesFromWorkspace = await this.loadDocumentFromWorkspace('TEST.md', workspaceOptions);
        if (testCasesFromWorkspace) {
          actualTestCasesContent = testCasesFromWorkspace;
        }
      }

      if (!actualTestCasesContent || actualTestCasesContent.trim().length === 0) {
        throw new Error('Cannot find test cases content for review. Please generate test cases first.');
      }

      // 读取 PRD 和代码作为参考（LLM模式特有）
      const prd = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
      const code = await this.loadCodeFilesFromWorkspace(workspaceOptions);

      logger.info('TestReview: LLM mode - loaded context', {
        testCasesLength: actualTestCasesContent.length,
        hasPRD: !!prd,
        hasCode: !!code,
      });

      // 构建审核提示词（带PRD和代码上下文）
      const prompt = buildTestReviewPrompt(actualTestCasesContent, prd, code);

      // Load system prompt
      const systemPrompt = await this.loadSystemPrompt('test', 'review_system_prompt', TEST_REVIEW_SYSTEM_PROMPT);

      // Call LLM
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      // 保存审核报告
      await this.saveToWorkspace('TEST_REVIEW.md', reviewResult, workspaceOptions);

      const passed = isReviewPassed(reviewResult);

      logger.info('TestReview: Review completed', {
        reviewLength: reviewResult.length,
        passed,
      });

      return this.createActionOutput(reviewResult, {
        type: 'test_review',
        filename: 'TEST_REVIEW.md',
        passed,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('TestReview: Failed to review test cases', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default TestReview;
