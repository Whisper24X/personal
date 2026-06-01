/**
 * QAConclusion Action
 * Provides final QA conclusion (pass/block/needs modification) based on all test results
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import { QA_CONCLUSION_SYSTEM_PROMPT, buildQAConclusionPrompt } from '../prompts/test';

export interface QAConclusionOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class QAConclusion extends BaseAction {
  constructor() {
    super('QAConclusion', 'Provide final QA conclusion (pass/block/needs modification) based on all test results');
  }

  async run(_input: string, options?: QAConclusionOptions): Promise<IActionOutput> {
    logger.info('QAConclusion: Starting QA conclusion generation');

    try {
      // Read all test documents from workspace
      const testabilityReview = '';
      const testPlan = '';
      const testCases = '';
      const testReview = '';
      const automationPlan = '';
      const automationExecution = '';
      const coverageReport = '';
      const qualityCheck = '';
      let prd = '';

      if (options) {
        // Read all test-related documents
        const testDocuments = [
          { name: 'TESTABILITY_REVIEW.md', var: 'testabilityReview' },
          { name: 'TEST_PLAN.md', var: 'testPlan' },
          { name: 'TEST.md', var: 'testCases' },
          { name: 'TEST_REVIEW.md', var: 'testReview' },
          { name: 'AUTOMATION_PLAN.md', var: 'automationPlan' },
          { name: 'tests/automated_tests.md', var: 'automationExecution' },
          { name: 'COVERAGE_REPORT.md', var: 'coverageReport' },
          { name: 'QUALITY_CHECK.md', var: 'qualityCheck' },
        ];

        for (const doc of testDocuments) {
          try {
            const content = await this.readWorkspaceFile(doc.name, {
              ...options,
              documentType: 'TEST',
            });
            if (content) {
              (this as any)[doc.var] = content;
              logger.info(`QAConclusion: Loaded ${doc.name}`, {
                contentLength: content.length,
              });
            }
          } catch (error: any) {
            logger.warn(`QAConclusion: Failed to read ${doc.name}`, {
              error: error.message,
            });
          }
        }

        // Read PRD
        try {
          const prdFromWorkspace = await this.readWorkspaceFile('PRD.md', {
            ...options,
            documentType: 'PRD',
          });
          if (prdFromWorkspace) {
            prd = prdFromWorkspace;
          }
        } catch (error: any) {
          logger.warn('QAConclusion: Failed to read PRD from workspace', {
            error: error.message,
          });
        }
      }

      // Build prompt with all collected documents
      const prompt = buildQAConclusionPrompt({
        testabilityReview,
        testPlan,
        testCases,
        testReview,
        automationPlan,
        automationExecution,
        coverageReport,
        qualityCheck,
        prd,
      });

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'test', 'qa_conclusion_system_prompt', QA_CONCLUSION_SYSTEM_PROMPT);

      // Call LLM to generate QA conclusion
      const content = await this.aask(prompt, [systemPrompt]);

      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };

      logger.info('QAConclusion: QA conclusion generation completed', {
        contentLength: content.length,
      });

      return {
        content: content,
        data: {
          type: 'qa_conclusion',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          conclusion: this.extractConclusion(content),
        },
      };
    } catch (error: any) {
      logger.error('QAConclusion: Failed to generate QA conclusion', error);
      throw error;
    }
  }

  /**
   * Extract conclusion status from content (pass/block/needs modification)
   */
  private extractConclusion(content: string): string {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('通过') || lowerContent.includes('pass') || lowerContent.includes('approved')) {
      return 'pass';
    }
    if (lowerContent.includes('阻断') || lowerContent.includes('block') || lowerContent.includes('rejected')) {
      return 'block';
    }
    if (lowerContent.includes('需修改') || lowerContent.includes('needs modification') || lowerContent.includes('needs change')) {
      return 'needs_modification';
    }
    return 'unknown';
  }
}
