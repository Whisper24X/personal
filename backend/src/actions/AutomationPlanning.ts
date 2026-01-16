/**
 * AutomationPlanning Action
 * Evaluates which test cases can be automated and creates an automation plan
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  AUTOMATION_PLANNING_SYSTEM_PROMPT,
  buildAutomationPlanningPrompt,
} from '../prompts/test';

export interface AutomationPlanningOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class AutomationPlanning extends BaseAction {
  constructor() {
    super(
      'AutomationPlanning',
      'Evaluate test cases for automation feasibility and create an automation plan with priorities and technology choices'
    );
  }

  async run(input: string, options?: AutomationPlanningOptions): Promise<IActionOutput> {
    logger.info('AutomationPlanning: Starting automation planning');

    if (!input || input.trim() === '') {
      throw new Error('Input content not found');
    }

    try {
      // Read test cases from workspace
      let testCases = '';
      let code = '';

      if (options) {
        // Try to read reviewed test cases first, fallback to original test cases
        try {
          const reviewedTestCases = await this.readWorkspaceFile('TEST_CASES_REVIEWED.md', {
            ...options,
            documentType: 'TEST',
          });
          if (reviewedTestCases) {
            testCases = reviewedTestCases;
            logger.info('AutomationPlanning: Loaded reviewed test cases from workspace', {
              testCasesLength: testCases.length,
            });
          }
        } catch (error: any) {
          logger.warn('AutomationPlanning: Failed to read reviewed test cases, trying original', {
            error: error.message,
          });
        }

        // Fallback to original test cases
        if (!testCases) {
          try {
            const originalTestCases = await this.readWorkspaceFile('TEST.md', {
              ...options,
              documentType: 'TEST',
            });
            if (originalTestCases) {
              testCases = originalTestCases;
            }
          } catch (error: any) {
            logger.warn('AutomationPlanning: Failed to read test cases from workspace', {
              error: error.message,
            });
          }
        }

        // Read code from workspace
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
          logger.warn('AutomationPlanning: Failed to read code from workspace', {
            error: error.message,
          });
        }
      }

      // Use input if test cases not found in workspace
      if (!testCases) {
        testCases = input;
      }

      if (!testCases || testCases.trim() === '') {
        throw new Error('Test cases not found for automation planning');
      }

      // Build prompt
      const prompt = buildAutomationPlanningPrompt(testCases, code);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'automation_planning_system_prompt',
        AUTOMATION_PLANNING_SYSTEM_PROMPT
      );

      // Call LLM to generate automation plan
      const content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };
      await this.saveToWorkspace('AUTOMATION_PLAN.md', content, workspaceOptions);

      logger.info('AutomationPlanning: Automation planning completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'automation_plan',
          filename: 'AUTOMATION_PLAN.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('AutomationPlanning: Failed to create automation plan', error);
      throw error;
    }
  }
}
