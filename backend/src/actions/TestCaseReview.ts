/**
 * TestCaseReview Action
 * Reviews and supplements test cases with boundary, exception, and negative test cases
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
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
      let testPlan = '';

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

        // Try to read Test Plan from workspace
        try {
          const testPlanFromWorkspace = await this.readWorkspaceFile('TEST_PLAN.md', {
            ...options,
            documentType: 'TESTPLAN',
          });
          if (testPlanFromWorkspace) {
            testPlan = testPlanFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('TestCaseReview: Failed to read TEST_PLAN from workspace', {
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
      const prompt = buildTestCaseReviewPrompt(testCases, prd, code, testPlan);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'test_case_review_system_prompt',
        TEST_CASE_REVIEW_SYSTEM_PROMPT
      );

      // Call LLM to review and supplement test cases
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };
      await this.saveToWorkspace('TEST_CASES_REVIEWED.md', content, workspaceOptions);

      logger.info('TestCaseReview: Test case review completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      // 明确通知：测试用例审查完成，准备进行自动化规划
      logger.info('TestCaseReview: Test case review completed, ready for AutomationPlanning', {
        reviewedFile: 'TEST_CASES_REVIEWED.md',
        nextAction: 'AutomationPlanning',
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'test_case_review',
          filename: 'TEST_CASES_REVIEWED.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          nextAction: 'AutomationPlanning', // 明确标记下一个action
        },
      };
    } catch (error: any) {
      logger.error('TestCaseReview: Failed to review test cases', error);
      throw error;
    }
  }
}
