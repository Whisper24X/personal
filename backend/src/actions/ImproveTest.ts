/**
 * ImproveTest Action
 * Improves test cases document based on review reports
 * 
 * 使用 DocumentImproveHandler 统一处理 CLI 和 LLM 双模式逻辑
 * 保留读取 PRD 和代码的自定义逻辑（LLM模式）
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TEST_IMPROVE_SYSTEM_PROMPT,
  buildTestImprovePrompt,
} from '../prompts/test';
import { logger, WorkspaceOptions } from '../utils';
import {
  DocumentImproveHandler,
  DOCUMENT_CONFIGS,
  ImproveConfig,
  looksLikeReviewReport,
  removeReviewReport,
  cleanCodeBlockMarkers,
} from '../utils/document';

export interface ImproveTestOptions extends WorkspaceOptions {
  reviewReport?: string; // 审查报告内容，如果不提供则从workspace读取
}

export class ImproveTest extends BaseAction {
  constructor() {
    super('ImproveTest', 'Improve test cases document based on review reports');
  }

  /**
   * 创建 ImproveHandler
   */
  private async createImproveHandler(): Promise<DocumentImproveHandler> {
    const systemPrompt = await this.loadSystemPrompt('test', 'improve_system_prompt', TEST_IMPROVE_SYSTEM_PROMPT);

    const config: ImproveConfig = {
      ...DOCUMENT_CONFIGS.TEST,
      buildImprovePrompt: (document: string, reviewReport: string) => {
        // 在 CLI 模式下，这个函数不会被调用，因为使用路径模式
        return buildTestImprovePrompt(document, reviewReport, '', '');
      },
      systemPrompt,
      reviewReportPattern: /#\s*测试用例\s*审查报告/,
    };

    return new DocumentImproveHandler(this, config);
  }

  async run(
    input: string, // 审查报告内容或测试用例内容
    options?: ImproveTestOptions
  ): Promise<IActionOutput> {
    // 使用 BaseAction 提供的验证方法
    const workspaceOptions = this.validateWorkspaceOptions(options, 'TEST');
    const { applicationId, projectId, version } = workspaceOptions;

    const isCLIMode = this.isCLIMode();

    logger.info('ImproveTest: Starting test cases improvement', {
      applicationId,
      projectId,
      version,
      hasReviewReport: !!options?.reviewReport,
      inputLength: input.length,
      isCLIMode,
    });

    try {
      // CLI模式：使用 BaseAction 封装的执行方法
      if (isCLIMode) {
        const handler = await this.getCachedHandler('improve', () => this.createImproveHandler());
        return await this.executeImproveHandler(handler, input, {
          ...workspaceOptions,
          reviewReport: options?.reviewReport,
        }, {
          type: 'test_improved',
          documentType: 'TEST',
          filename: 'TEST.md',
        });
      }

      // LLM模式：手动处理，支持读取PRD和代码作为额外上下文
      const inputIsReviewReport = looksLikeReviewReport(input);

      // Step 1: 读取当前测试用例文档
      let currentTestCases = await this.loadDocumentFromWorkspace('TEST.md', workspaceOptions);
      if (!currentTestCases && !inputIsReviewReport && input.trim().length > 0) {
        currentTestCases = input;
        logger.info('ImproveTest: Using input as test cases content', {
          inputLength: input.length,
        });
      }

      if (!currentTestCases) {
        throw new Error(
          'Cannot find test cases document in workspace. Please generate it first.'
        );
      }

      // Step 2: 读取审查报告
      let reviewReport = options?.reviewReport;
      
      if (!reviewReport) {
        if (inputIsReviewReport) {
          reviewReport = input;
          logger.info('ImproveTest: Using input as review report', {
            inputLength: input.length,
          });
        } else {
          reviewReport = await this.readReviewReport(workspaceOptions, currentTestCases) || undefined;
        }
      }

      if (!reviewReport) {
        throw new Error(
          'Cannot find review report for test cases. Please provide review report as input or run TestReview first.'
        );
      }

      // Step 3: 读取 PRD 和代码作为参考（LLM模式特有）
      const prd = await this.loadDocumentFromWorkspace('PRD.md', workspaceOptions, 'PRD');
      const code = await this.loadCodeFilesFromWorkspace(workspaceOptions);

      logger.info('ImproveTest: LLM mode - loaded documents', {
        testCasesLength: currentTestCases.length,
        reviewReportLength: reviewReport.length,
        hasPRD: !!prd,
        hasCode: !!code,
      });

      // Step 4: 从当前文档中移除审查报告部分
      const reviewTitlePattern = /#\s*测试用例\s*审查报告/;
      const cleanTestCases = removeReviewReport(currentTestCases, reviewTitlePattern);
      
      // Step 5: 根据审查报告改进文档（带PRD和代码上下文）
      const improvedTestCases = await this.improveTestCasesWithContext(
        cleanTestCases,
        reviewReport,
        prd,
        code
      );

      // Step 6: 确保改进后的文档不包含审查报告部分
      const finalTestCases = removeReviewReport(improvedTestCases, reviewTitlePattern);

      // Step 7: 保存改进后的文档
      await this.saveToWorkspace('TEST.md', finalTestCases, workspaceOptions);

      logger.info('ImproveTest: Test cases improved and saved', {
        improvedLength: finalTestCases.length,
      });

      return this.createActionOutput(finalTestCases, {
        type: 'test_improved',
        documentType: 'TEST',
        filename: 'TEST.md',
        originalLength: currentTestCases.length,
        improvedLength: finalTestCases.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
    } catch (error: any) {
      logger.error('ImproveTest: Failed to improve test cases', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 读取审查报告
   */
  private async readReviewReport(
    options: WorkspaceOptions,
    currentTestCases?: string
  ): Promise<string | null> {
    // 尝试读取审查报告文件
    let reviewReport = await this.readWorkspaceFile('TEST_REVIEW.md', options);
    if (!reviewReport) {
      reviewReport = await this.readWorkspaceFile('TEST-review.md', options);
    }
    
    // 如果找不到审查报告文件，尝试从主文档末尾提取
    if (!reviewReport) {
      const mainDocument = currentTestCases || await this.readWorkspaceFile('TEST.md', options);
      if (mainDocument) {
        const reviewPattern = /---\s*\n\s*#\s*测试用例\s*审查报告[\s\S]*$/;
        const simplePattern = /#\s*测试用例\s*审查报告[\s\S]*$/;
        
        const reviewMatch = mainDocument.match(reviewPattern);
        if (reviewMatch) {
          reviewReport = reviewMatch[0].replace(/^---\s*\n\s*/, '');
        } else {
          const simpleMatch = mainDocument.match(simplePattern);
          if (simpleMatch) {
            reviewReport = simpleMatch[0];
          }
        }
      }
    }
    
    return reviewReport;
  }

  /**
   * 改进测试用例文档（带PRD和代码上下文，LLM模式专用）
   */
  private async improveTestCasesWithContext(
    currentTestCases: string,
    reviewReport: string,
    prd: string,
    code: string
  ): Promise<string> {
    // Load system prompt
    const systemPrompt = await this.loadSystemPrompt('test', 'improve_system_prompt', TEST_IMPROVE_SYSTEM_PROMPT);

    // 构建改进提示词（带PRD和代码上下文）
    const prompt = buildTestImprovePrompt(currentTestCases, reviewReport, prd, code);

    // 调用LLM改进文档
    const output = await this.aask(prompt, [systemPrompt]);

    // 清理代码块标记
    const content = cleanCodeBlockMarkers(output);

    logger.info('ImproveTest: Test cases improved', {
      improvedLength: content.length,
    });

    return content;
  }
}

export default ImproveTest;
