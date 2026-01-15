/**
 * WriteTestPlan Action
 * Creates a comprehensive test plan based on PRD, code, and testability review
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  TEST_PLAN_SYSTEM_PROMPT,
  buildTestPlanPrompt,
} from '../prompts/test';

export interface WriteTestPlanOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class WriteTestPlan extends BaseAction {
  constructor() {
    super(
      'WriteTestPlan',
      'Create a comprehensive test plan including test scope, test strategy, and test resources'
    );
  }

  async run(input: string, options?: WriteTestPlanOptions): Promise<IActionOutput> {
    logger.info('WriteTestPlan: Starting test plan generation');

    if (!input || input.trim() === '') {
      throw new Error('Input content not found');
    }

    try {
      // Parse input: may contain PRD, code, and testability review
      let prd = '';
      let code = '';
      let testabilityReview = '';

      // Try to read testability review from workspace
      if (options) {
        try {
          const reviewFromWorkspace = await this.readWorkspaceFile('TESTABILITY_REVIEW.md', {
            ...options,
            documentType: 'TEST',
          });
          if (reviewFromWorkspace) {
            testabilityReview = reviewFromWorkspace;
            logger.info('WriteTestPlan: Loaded testability review from workspace', {
              reviewLength: testabilityReview.length,
            });
          }
        } catch (error: any) {
          logger.warn('WriteTestPlan: Failed to read testability review from workspace', {
            error: error.message,
          });
        }
      }

      // Parse input for PRD and code
      if (input.includes('PRD文档：') && input.includes('代码实现：')) {
        const parts = input.split('代码实现：');
        prd = parts[0].replace('PRD文档：', '').trim();
        code = parts[1]?.trim() || '';
      } else if (input.includes('PRD文档：')) {
        prd = input.replace('PRD文档：', '').trim();
      } else {
        code = input;
      }

      // Try to read PRD from workspace if not in input
      if (!prd && options) {
        try {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', {
            ...options,
            documentType: 'PRD',
          });
          if (prdFromWorkspace) {
            prd = prdFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('WriteTestPlan: Failed to read PRD from workspace', {
            error: error.message,
          });
        }
      }

      if (!prd && !code) {
        throw new Error('Neither PRD nor code found for test plan generation');
      }

      // Build prompt
      const prompt = buildTestPlanPrompt(prd, code, testabilityReview);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'test_plan_system_prompt',
        TEST_PLAN_SYSTEM_PROMPT
      );

      // Call LLM to generate test plan
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };
      await this.saveToWorkspace('TEST_PLAN.md', content, workspaceOptions);

      logger.info('WriteTestPlan: Test plan generation completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'test_plan',
          filename: 'TEST_PLAN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('WriteTestPlan: Failed to generate test plan', error);
      throw error;
    }
  }
}
