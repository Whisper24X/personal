/**
 * TestCaseReview Action
 * Reviews and supplements test cases with boundary, exception, and negative test cases
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  buildCLISaveInstruction,
  isCLISummaryOutput,
  tryReadActualReviewFromWorkspace,
} from '../utils/stepwise';
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

  async run(input: string, options?: TestCaseReviewOptions): Promise<IActionOutput> {
    logger.info('TestCaseReview: Starting test case review');

    if (!input || input.trim() === '') {
      throw new Error('Input content not found');
    }

    try {
      // Read test cases from workspace (from WriteTest action)
      let testCases = '';
      let prd = '';
      let code = '';

      if (options) {
        try {
          const testCasesFromWorkspace = await this.readWorkspaceFile('TEST.md', {
            ...options,
            documentType: 'TEST',
          });
          if (testCasesFromWorkspace) {
            testCases = testCasesFromWorkspace;
            logger.info('TestCaseReview: Loaded test cases from workspace', {
              testCasesLength: testCases.length,
            });
          } else {
            // Use input as test cases if not found in workspace
            testCases = input;
          }
        } catch (error: any) {
          logger.warn('TestCaseReview: Failed to read test cases from workspace, using input', {
            error: error.message,
          });
          testCases = input;
        }

        // Try to read PRD and code from workspace
        try {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', {
            ...options,
            documentType: 'PRD',
          });
          if (prdFromWorkspace) {
            prd = prdFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('TestCaseReview: Failed to read PRD from workspace', {
            error: error.message,
          });
        }

        // Try to read code from workspace (read all code files)
        try {
          const codeFromWorkspace = await this.readAllFromWorkspace(
            {
              ...options,
              documentType: 'CODE',
            },
            (filename: string) => {
              return (
                filename.endsWith('.ts') ||
                filename.endsWith('.js') ||
                filename.endsWith('.py') ||
                filename.endsWith('.java')
              );
            }
          );
          if (codeFromWorkspace) {
            code = codeFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('TestCaseReview: Failed to read code from workspace', {
            error: error.message,
          });
        }
      } else {
        testCases = input;
      }

      if (!testCases || testCases.trim() === '') {
        throw new Error('Test cases not found for review');
      }

      // Build prompt
      let prompt = buildTestCaseReviewPrompt(testCases, prd, code);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'test_case_review_system_prompt',
        TEST_CASE_REVIEW_SYSTEM_PROMPT
      );

      // CLI 模式处理
      const isCLIMode = this.isCLIMode();
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };

      // CLI 模式下，在 prompt 中指定文件保存路径和限制指令
      if (isCLIMode && options?.applicationId) {
        const savePath = `${this.getWorkspaceDir(workspaceOptions)}/TEST_CASES_REVIEWED.md`;
        const saveInstruction = buildCLISaveInstruction(savePath, '补充后的测试用例');
        prompt += saveInstruction;
        
        logger.info('TestCaseReview: Added CLI save path instruction', { savePath });
      }

      // Call LLM/CLI to review and supplement test cases
      const cliOutput = await this.aask(prompt, [systemPrompt]);
      
      let content: string;
      
      if (isCLIMode && isCLISummaryOutput(cliOutput)) {
        logger.info('TestCaseReview: CLI output appears to be a summary, reading actual review from workspace', {
          cliOutputLength: cliOutput.length,
          cliOutputPreview: cliOutput.substring(0, 200),
        });
        
        // 尝试从workspace读取CLI实际生成的审核结果
        const workspaceDir = this.getWorkspaceDir(workspaceOptions);
        const actualReview = await tryReadActualReviewFromWorkspace(workspaceDir, {
          reviewFileName: 'TEST_CASES_REVIEWED.md',
          filePattern: 'test_cases_reviewed',
        });
        
        if (actualReview) {
          content = actualReview;
          logger.info('TestCaseReview: Successfully read actual review from workspace', {
            actualReviewLength: actualReview.length,
          });
        } else {
          logger.warn('TestCaseReview: Could not find actual review in workspace, using CLI output', {
            cliOutputLength: cliOutput.length,
          });
          content = cliOutput;
        }
      } else {
        content = cliOutput;
      }

      // Save to workspace (只有当内容不是CLI总结时才保存)
      if (!isCLISummaryOutput(content)) {
        await this.saveToWorkspace('TEST_CASES_REVIEWED.md', content, workspaceOptions);
      }

      logger.info('TestCaseReview: Test case review completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'test_case_review',
          filename: 'TEST_CASES_REVIEWED.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('TestCaseReview: Failed to review test cases', error);
      throw error;
    }
  }
}
