/**
 * TestCaseReview Action
 * Reviews and supplements test cases with boundary, exception, and negative test cases
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
  TEST_CASE_REVIEW_SYSTEM_PROMPT,
  buildTestCaseReviewPrompt,
} from '../prompts/test';

export interface TestCaseReviewOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class TestCaseReview extends BaseAction {
  constructor() {
    super(
      'TestCaseReview',
      'Review test cases and supplement with boundary, exception, and negative test cases'
    );
  }

  /**
   * 创建 ReviewHandler
   */
  private async createReviewHandler(): Promise<DocumentReviewHandler> {
    const systemPrompt = await this.loadSystemPrompt('test', 'test_case_review_system_prompt', TEST_CASE_REVIEW_SYSTEM_PROMPT);

    const config: ReviewConfig = {
      ...DOCUMENT_CONFIGS.TEST_CASE,
      buildReviewPrompt: (content: string, _outline: string) => {
        // TestCaseReview 不需要 outline，使用简化的 prompt
        return buildTestCaseReviewPrompt(content, '', '');
      },
      systemPrompt,
    };

    return new DocumentReviewHandler(this, config);
  }

  async run(input: string, options?: TestCaseReviewOptions): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const { applicationId, projectId, version } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('TestCaseReview: Starting test case review', {
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
          type: 'test_case_review',
          filename: 'TEST_CASE_REVIEW.md',
        });
      }

      // LLM模式：读取文件内容并带上PRD和代码作为上下文
      let testCases = input;
      if (!input || input.trim().length < 100) {
        const testCasesFromWorkspace = await this.loadDocumentFromWorkspace('TEST.md', workspaceOptions);
        if (testCasesFromWorkspace) {
          testCases = testCasesFromWorkspace;
        }
      }

      if (!testCases || testCases.trim() === '') {
        throw new Error('Test cases not found for review. Please generate test cases first.');
      }

      // 读取 PRD 和代码作为参考（LLM模式特有）
      const prd = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
      const code = await this.loadCodeFilesFromWorkspace(workspaceOptions);

      logger.info('TestCaseReview: LLM mode - loaded context', {
        testCasesLength: testCases.length,
        hasPRD: !!prd,
        hasCode: !!code,
      });

      // 构建审核提示词（带PRD和代码上下文）
      const prompt = buildTestCaseReviewPrompt(testCases, prd, code);

      // Load system prompt
      const systemPrompt = await this.loadSystemPrompt('test', 'test_case_review_system_prompt', TEST_CASE_REVIEW_SYSTEM_PROMPT);

      // Call LLM
      const reviewResult = await this.aask(prompt, [systemPrompt]);

      // 保存审核报告
      await this.saveToWorkspace('TEST_CASE_REVIEW.md', reviewResult, workspaceOptions);

      const passed = isReviewPassed(reviewResult);

      logger.info('TestCaseReview: Review completed', {
        reviewLength: reviewResult.length,
        passed,
      });

      return this.createActionOutput(reviewResult, {
        type: 'test_case_review',
        filename: 'TEST_CASE_REVIEW.md',
        passed,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('TestCaseReview: Failed to review test cases', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default TestCaseReview;
