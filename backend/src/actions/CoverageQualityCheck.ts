/**
 * CoverageQualityCheck Action
 * Checks test coverage and performs quality self-assessment
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  COVERAGE_QUALITY_CHECK_SYSTEM_PROMPT,
  buildCoverageQualityCheckPrompt,
} from '../prompts/test';

export interface CoverageQualityCheckOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class CoverageQualityCheck extends BaseAction {
  constructor() {
    super(
      'CoverageQualityCheck',
      'Check test coverage and perform quality self-assessment'
    );
  }

  async run(input: string, options?: CoverageQualityCheckOptions): Promise<IActionOutput> {
    logger.info('CoverageQualityCheck: Starting coverage and quality check');

    if (!input || input.trim() === '') {
      throw new Error('Input content not found');
    }

    try {
      // Read test cases, code, and test execution results from workspace
      let testCases = '';
      let code = '';
      let testExecutionResults = '';

      if (options) {
        // Read test cases
        try {
          const reviewedTestCases = await this.readWorkspaceFile('TEST_CASES_REVIEWED.md', {
            ...options,
            documentType: 'TEST',
          });
          if (reviewedTestCases) {
            testCases = reviewedTestCases;
          } else {
            const originalTestCases = await this.readWorkspaceFile('TEST.md', {
              ...options,
              documentType: 'TEST',
            });
            if (originalTestCases) {
              testCases = originalTestCases;
            }
          }
        } catch (error: any) {
          logger.warn('CoverageQualityCheck: Failed to read test cases from workspace', {
            error: error.message,
          });
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
          logger.warn('CoverageQualityCheck: Failed to read code from workspace', {
            error: error.message,
          });
        }

        // Try to read test execution results (if automation was executed)
        try {
          const resultsFromWorkspace = await this.readWorkspaceFile('tests/automated_tests.md', {
            ...options,
            documentType: 'TEST',
          });
          if (resultsFromWorkspace) {
            testExecutionResults = resultsFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('CoverageQualityCheck: Failed to read test execution results', {
            error: error.message,
          });
        }
      }

      // Use input if test cases not found
      if (!testCases) {
        testCases = input;
      }

      if (!testCases || testCases.trim() === '') {
        throw new Error('Test cases not found for coverage check');
      }

      // Build prompt
      const prompt = buildCoverageQualityCheckPrompt(testCases, code, testExecutionResults);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'coverage_quality_check_system_prompt',
        COVERAGE_QUALITY_CHECK_SYSTEM_PROMPT
      );

      // Call LLM to generate coverage and quality report
      const content = await this.aask(prompt, [systemPrompt]);

      // Save reports to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };

      // Save coverage report and quality check report
      // The LLM output should contain both reports, we'll save them separately
      await this.saveToWorkspace('COVERAGE_REPORT.md', content, workspaceOptions);
      await this.saveToWorkspace('QUALITY_CHECK.md', content, workspaceOptions);

      logger.info('CoverageQualityCheck: Coverage and quality check completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'coverage_quality_check',
          filename: 'COVERAGE_REPORT.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('CoverageQualityCheck: Failed to check coverage and quality', error);
      throw error;
    }
  }
}
