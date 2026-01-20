/**
 * QAConclusion Action
 * Provides final QA conclusion (pass/block/needs modification) based on all test results
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, loadPrompt } from '../utils';
import {
  QA_CONCLUSION_SYSTEM_PROMPT,
  buildQAConclusionPrompt,
} from '../prompts/test';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface QAConclusionOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
}

export class QAConclusion extends BaseAction {
  constructor() {
    super(
      'QAConclusion',
      'Provide final QA conclusion (pass/block/needs modification) based on all test results'
    );
  }

  async run(input: string, options?: QAConclusionOptions): Promise<IActionOutput> {
    logger.info('QAConclusion: Starting QA conclusion generation');

    try {
      // Read all test documents from workspace
      let testabilityReview = '';
      let testPlan = '';
      let testCases = '';
      let testCasesReviewed = '';
      let automationPlan = '';
      let automationExecution = '';
      let coverageReport = '';
      let qualityCheck = '';
      let prd = '';

      if (options) {
        // Read all test-related documents
        const testDocuments = [
          { name: 'TESTABILITY_REVIEW.md', var: 'testabilityReview' },
          { name: 'TEST_PLAN.md', var: 'testPlan' },
          { name: 'TEST.md', var: 'testCases' },
          { name: 'TEST_CASES_REVIEWED.md', var: 'testCasesReviewed' },
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
        testCasesReviewed,
        automationPlan,
        automationExecution,
        coverageReport,
        qualityCheck,
        prd,
      });

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(
        userId,
        'test',
        'qa_conclusion_system_prompt',
        QA_CONCLUSION_SYSTEM_PROMPT
      );

      // Call LLM to generate QA conclusion
      let content = await this.aask(prompt, [systemPrompt]);

      // Save to workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TEST',
      };
      
      // Append test report to QA conclusion
      content = await this.appendTestReport(content, workspaceOptions);
      
      await this.saveToWorkspace('QA_CONCLUSION.md', content, workspaceOptions);

      logger.info('QAConclusion: QA conclusion generation completed', {
        contentLength: content.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: content,
        data: {
          type: 'qa_conclusion',
          filename: 'QA_CONCLUSION.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
          conclusion: this.extractConclusion(content), // Extract conclusion status
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

  /**
   * Append test report to QA conclusion
   */
  private async appendTestReport(content: string, options?: WorkspaceOptions): Promise<string> {
    try {
      if (!options?.applicationId || !options?.projectId) {
        logger.warn('QAConclusion: Cannot append test report - missing applicationId or projectId');
        return content;
      }

      // Get test directory path: workspace/{applicationId}/{projectId}/test/
      const workspaceRoot = process.env.WORKSPACE_PATH || path.join(process.cwd(), 'workspace');
      const testDir = path.join(workspaceRoot, options.applicationId, options.projectId, 'test');

      // Check if test directory exists
      try {
        await fs.access(testDir);
      } catch {
        logger.info('QAConclusion: Test directory does not exist, skipping test report append', {
          testDir,
        });
        return content;
      }

      // Find latest test report HTML file
      const files = await fs.readdir(testDir);
      const testReportFiles = files
        .filter((file) => file.startsWith('test_report_') && file.endsWith('.html'))
        .sort()
        .reverse(); // Latest first

      if (testReportFiles.length === 0) {
        logger.info('QAConclusion: No test report found in test directory', {
          testDir,
        });
        return content;
      }

      const latestReportFile = testReportFiles[0];
      const reportPath = path.join(testDir, latestReportFile);

      // Read test report HTML
      const reportContent = await fs.readFile(reportPath, 'utf-8');

      // Extract key information from HTML report (summary, pass/fail counts, etc.)
      const reportSummary = this.extractReportSummary(reportContent);

      // Append test report section to QA conclusion
      const testReportSection = `

---

## 7. 测试报告

### 7.1 测试报告文件

**报告文件**: \`${latestReportFile}\`

**报告路径**: \`test/${latestReportFile}\`

### 7.2 测试执行摘要

${reportSummary}

### 7.3 详细测试报告

详细的测试报告请查看: \`test/${latestReportFile}\`

> **注意**: 测试报告为HTML格式，请在浏览器中打开查看完整的测试结果、执行日志和截图等信息。

`;

      // Append to content
      return content + testReportSection;
    } catch (error: any) {
      logger.warn('QAConclusion: Failed to append test report', {
        error: error.message,
      });
      // Return original content if append fails
      return content;
    }
  }

  /**
   * Extract summary information from HTML test report
   */
  private extractReportSummary(htmlContent: string): string {
    try {
      // Extract summary information from HTML structure
      // Pattern: <div class="summary-card total">...<div class="value">数字</div>...
      const totalMatch = htmlContent.match(/<div[^>]*class="summary-card total"[^>]*>[\s\S]*?<div[^>]*class="value"[^>]*>(\d+)<\/div>/i);
      const passedMatch = htmlContent.match(/<div[^>]*class="summary-card passed"[^>]*>[\s\S]*?<div[^>]*class="value"[^>]*>(\d+)<\/div>/i);
      const failedMatch = htmlContent.match(/<div[^>]*class="summary-card failed"[^>]*>[\s\S]*?<div[^>]*class="value"[^>]*>(\d+)<\/div>/i);
      const rateMatch = htmlContent.match(/<div[^>]*class="summary-card rate"[^>]*>[\s\S]*?<div[^>]*class="value"[^>]*>([\d.]+)%?<\/div>/i);

      const total = totalMatch ? totalMatch[1] : null;
      const passed = passedMatch ? passedMatch[1] : null;
      const failed = failedMatch ? failedMatch[1] : null;
      const rate = rateMatch ? rateMatch[1] : null;

      if (total || passed || failed) {
        let summary = '';
        if (total) {
          summary += `- **测试用例总数**: ${total}\n`;
        }
        if (passed !== null) {
          summary += `- **通过**: ${passed}\n`;
        }
        if (failed !== null) {
          summary += `- **失败**: ${failed}\n`;
        }
        if (rate) {
          summary += `- **通过率**: ${rate}%\n`;
        }
        return summary.trim();
      }

      // Fallback: try to extract from text patterns
      const totalTextMatch = htmlContent.match(/总计[^<]*<[^>]*>(\d+)/i) || htmlContent.match(/Total[^<]*<[^>]*>(\d+)/i);
      const passedTextMatch = htmlContent.match(/通过[^<]*<[^>]*>(\d+)/i) || htmlContent.match(/Passed[^<]*<[^>]*>(\d+)/i);
      const failedTextMatch = htmlContent.match(/失败[^<]*<[^>]*>(\d+)/i) || htmlContent.match(/Failed[^<]*<[^>]*>(\d+)/i);

      if (totalTextMatch || passedTextMatch || failedTextMatch) {
        let summary = '';
        if (totalTextMatch) {
          summary += `- **测试用例总数**: ${totalTextMatch[1]}\n`;
        }
        if (passedTextMatch) {
          summary += `- **通过**: ${passedTextMatch[1]}\n`;
        }
        if (failedTextMatch) {
          summary += `- **失败**: ${failedTextMatch[1]}\n`;
        }
        return summary.trim();
      }

      // Final fallback
      return '- 测试报告已生成，请查看详细报告文件获取完整信息。';
    } catch (error: any) {
      logger.warn('QAConclusion: Failed to extract report summary', {
        error: error.message,
      });
      return '- 测试报告已生成，请查看详细报告文件获取完整信息。';
    }
  }
}
