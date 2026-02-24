/**
 * AutomationExecution Action
 * Executes JSON format test cases from test/auto directory and generates HTML/JSON reports
 * Architecture: Step Runner + Result Collector + Stability Middleware
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

export interface AutomationExecutionOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
  testUrl?: string; // Optional URL to test against
  /** Step execution timeout in ms (default: 30000) */
  stepTimeoutMs?: number;
  /** Maximum retry count for failed steps (default: 2) */
  maxRetryCount?: number;
  /** Wait time before step execution in ms (default: 500) */
  waitBeforeMs?: number;
  /** Wait time after step execution in ms (default: 500) */
  waitAfterMs?: number;
  /** Continue execution on step error (default: false) */
  continueOnError?: boolean;
  /** 执行完成后保持浏览器打开的毫秒数（默认：5000ms） */
  keepBrowserOpenMs?: number;
  /** 是否显示浏览器窗口（默认：true，强制有头模式） */
  showBrowserWindow?: boolean;
  /** 是否启用 Flow 模式（复用浏览器 session，默认 false，每个 case 独立浏览器 session） */
  flowMode?: boolean;
}

interface StepExecutionResult {
  stepIndex: number;
  step: string;
  status: 'passed' | 'failed';
  executionTime: number;
  error?: string;
  errorType?: 'initialization' | 'execution' | 'timeout' | 'zod_validation' | 'browser' | 'unknown';
  screenshot?: string;
  retryCount?: number;
  timestamp: string;
}

interface TestCaseExecutionResult {
  testCaseId: string;
  testCaseName: string;
  jsonFile: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  steps: StepExecutionResult[];
  error?: string;
}

export class AutomationExecution extends BaseAction {
  constructor() {
    super('AutomationExecution', 'Execute Playwright scripts from docs/test/auto and generate HTML/JSON reports');
  }

  async run(_input: string, options?: AutomationExecutionOptions): Promise<IActionOutput> {
    logger.info('AutomationExecution: Starting automation execution from Playwright scripts in docs/test/auto');

    const workspaceOptions: WorkspaceOptions = {
      ...options,
      documentType: 'TEST',
    };
    const workspaceDir = this.getWorkspaceDir(workspaceOptions);
    const autoDir = path.join(workspaceDir, 'auto');
    const reportDir = path.join(workspaceDir, 'report');

    try {
      // Ensure auto directory exists (create if missing so we can continue to "no scripts" flow)
      try {
        await fs.access(autoDir);
      } catch {
        logger.info('AutomationExecution: auto directory does not exist, creating', { autoDir });
        await fs.mkdir(autoDir, { recursive: true });
      }

      const testCaseFiles = await this.findTestCaseFiles(autoDir);
      if (testCaseFiles.length === 0) {
        logger.warn('AutomationExecution: No Playwright script files (.js/.ts) found in auto directory', {
          autoDir,
          workspaceDir,
        });

        // Even if no scripts found, generate an empty report to indicate execution was attempted
        const emptyResults: TestCaseExecutionResult[] = [];
        const emptySummary = this.generateExecutionSummary(emptyResults);

        // Generate and save empty reports
        try {
          const emptyJsonReport = this.generateJSONReport(emptySummary, emptyResults);
          await this.saveToWorkspace('report/automation_results.json', emptyJsonReport, workspaceOptions);
          logger.info('AutomationExecution: Saved empty JSON report', {
            filePath: 'report/automation_results.json',
          });
        } catch (error: any) {
          logger.error('AutomationExecution: Failed to save empty JSON report', {
            error: error.message,
          });
        }

        try {
          const emptyHtmlReport = this.generateHTMLReport(emptySummary, emptyResults);
          await this.saveToWorkspace('report/automation_report.html', emptyHtmlReport, workspaceOptions);
          logger.info('AutomationExecution: Saved empty HTML report', {
            filePath: 'report/automation_report.html',
          });
        } catch (error: any) {
          logger.error('AutomationExecution: Failed to save empty HTML report', {
            error: error.message,
          });
        }

        return {
          content: 'docs/test/auto 目录中未找到 Playwright 脚本（.js/.ts）。请先运行 AutomationPlanning（CLI 模式）生成脚本后重新执行。',
          data: {
            type: 'automation_execution',
            skipped: true,
            reason: 'No Playwright script files found',
            timestamp: new Date().toISOString(),
            workspaceDir,
            reportDir,
          },
        };
      }

      logger.info('AutomationExecution: Found Playwright script files', {
        fileCount: testCaseFiles.length,
        files: testCaseFiles.map((f) => path.basename(f)),
      });

      let results: TestCaseExecutionResult[] = [];
      try {
        logger.info('AutomationExecution: Starting test case execution', {
          fileCount: testCaseFiles.length,
          autoDir,
        });
        results = await this.executeTestCaseFiles(testCaseFiles, autoDir, options);
        logger.info('AutomationExecution: Test case execution completed', {
          resultsCount: results.length,
          successCount: results.filter((r) => r.success).length,
          failedCount: results.filter((r) => !r.success).length,
        });
      } catch (error: any) {
        logger.error('AutomationExecution: Failed to execute test cases', {
          error: error.message,
          stack: error.stack,
        });
        results = [];
      }

      // Generate execution summary (always generate, even if no results)
      const summary = this.generateExecutionSummary(results);

      logger.info('AutomationExecution: Generated execution summary', {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        successRate: summary.successRate,
      });

      // Generate JSON report (always generate, even if no results)
      let jsonReport: string = '';
      try {
        jsonReport = this.generateJSONReport(summary, results);
        logger.info('AutomationExecution: Generated JSON report', {
          reportLength: jsonReport.length,
          resultsCount: results.length,
        });
      } catch (error: any) {
        logger.error('AutomationExecution: Failed to generate JSON report', {
          error: error.message,
          stack: error.stack,
        });
        // Create a minimal JSON report if generation fails
        jsonReport = JSON.stringify(
          {
            summary,
            results: [],
            error: 'Failed to generate report: ' + error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        );
      }

      // Save JSON report
      try {
        logger.info('AutomationExecution: Saving JSON report', {
          filePath: 'report/automation_results.json',
          reportLength: jsonReport.length,
        });
        await this.saveToWorkspace('report/automation_results.json', jsonReport, workspaceOptions);
        logger.info('AutomationExecution: Saved JSON report successfully', {
          filePath: 'report/automation_results.json',
          workspaceDir,
        });
      } catch (error: any) {
        logger.error('AutomationExecution: Failed to save JSON report', {
          error: error.message,
          stack: error.stack,
          workspaceDir,
          reportDir,
        });
        // Continue execution even if report save fails
      }

      // Generate HTML report (always generate, even if no results)
      let htmlReport: string = '';
      try {
        htmlReport = this.generateHTMLReport(summary, results);
        logger.info('AutomationExecution: Generated HTML report', {
          reportLength: htmlReport.length,
          resultsCount: results.length,
        });
      } catch (error: any) {
        logger.error('AutomationExecution: Failed to generate HTML report', {
          error: error.message,
          stack: error.stack,
        });
        // Create a minimal HTML report if generation fails
        htmlReport = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>自动化测试执行报告</title>
</head>
<body>
    <h1>自动化测试执行报告</h1>
    <p>报告生成失败: ${this.escapeHtml(error.message)}</p>
    <p>时间: ${new Date().toLocaleString('zh-CN')}</p>
</body>
</html>`;
      }

      // Save HTML report
      try {
        logger.info('AutomationExecution: Saving HTML report', {
          filePath: 'report/automation_report.html',
          reportLength: htmlReport.length,
        });
        await this.saveToWorkspace('report/automation_report.html', htmlReport, workspaceOptions);
        logger.info('AutomationExecution: Saved HTML report successfully', {
          filePath: 'report/automation_report.html',
          workspaceDir,
        });
      } catch (error: any) {
        logger.error('AutomationExecution: Failed to save HTML report', {
          error: error.message,
          stack: error.stack,
          workspaceDir,
          reportDir,
        });
        // Continue execution even if report save fails
      }

      logger.info('AutomationExecution: Automation execution completed', {
        totalTests: results.length,
        passed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        workspaceDir,
        reportDir,
      });

      return {
        content: `自动化测试执行完成\n\n总测试用例数: ${summary.total}\n通过: ${summary.passed}\n失败: ${summary.failed}\n成功率: ${summary.successRate}\n\n报告已保存到 test/report 目录`,
        data: {
          type: 'automation_execution',
          summary,
          results,
          timestamp: new Date().toISOString(),
          workspaceDir,
          reportDir,
        },
      };
    } catch (error: any) {
      logger.error('AutomationExecution: Failed to execute automation', {
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Find all Playwright script files (.js / .ts) in the auto directory
   */
  private async findTestCaseFiles(autoDir: string): Promise<string[]> {
    try {
      logger.info('AutomationExecution: Reading auto directory', { autoDir });
      const entries = await fs.readdir(autoDir, { withFileTypes: true });
      logger.info('AutomationExecution: Found entries in auto directory', {
        totalEntries: entries.length,
        entryNames: entries.map((e) => e.name),
      });

      const scriptFiles = entries
        .filter((entry) => entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts')))
        .map((entry) => path.join(autoDir, entry.name))
        .sort();

      logger.info('AutomationExecution: Filtered Playwright script files', {
        fileCount: scriptFiles.length,
        files: scriptFiles.map((f) => path.basename(f)),
      });

      return scriptFiles;
    } catch (error: any) {
      logger.error('AutomationExecution: Failed to read auto directory', {
        error: error.message,
        errorStack: error.stack,
        autoDir,
      });
      return [];
    }
  }

  /**
   * Resolve playwright-skill run.js path and skill directory (cwd for execution)
   */
  private getPlaywrightRunJsPath(): { runJsPath: string; skillDir: string } | null {
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const runJsPath = path.join(projectRoot, 'skills', 'playwright-skill', 'skills', 'playwright-skill', 'run.js');
    const skillDir = path.dirname(runJsPath);
    if (!existsSync(runJsPath)) {
      logger.warn('AutomationExecution: playwright-skill run.js not found', { runJsPath });
      return null;
    }
    return { runJsPath, skillDir };
  }

  /**
   * Execute a single Playwright script via run.js and return result
   */
  private runPlaywrightScript(scriptPath: string, skillDir: string, runJsPath: string): { exitCode: number; stdout: string; stderr: string } {
    const result = spawnSync('node', [runJsPath, scriptPath], {
      cwd: skillDir,
      encoding: 'utf-8',
      timeout: 120000,
    });
    return {
      exitCode: result.status ?? -1,
      stdout: (result.stdout ?? '') as string,
      stderr: (result.stderr ?? '') as string,
    };
  }

  /**
   * Execute all test case files: Playwright scripts (.js/.ts) via run.js
   */
  private async executeTestCaseFiles(jsonFiles: string[], _cwd: string, _options?: AutomationExecutionOptions): Promise<TestCaseExecutionResult[]> {
    const results: TestCaseExecutionResult[] = [];
    const isScriptMode = jsonFiles.length > 0 && jsonFiles.every((f) => f.endsWith('.js') || f.endsWith('.ts'));

    if (isScriptMode) {
      const runPath = this.getPlaywrightRunJsPath();
      if (!runPath) {
        logger.error('AutomationExecution: playwright-skill run.js not found, cannot execute scripts');
        return jsonFiles.map((f) => ({
          testCaseId: path.basename(f).replace(/\.(js|ts)$/, ''),
          testCaseName: path.basename(f),
          jsonFile: path.basename(f),
          success: false,
          executionTime: 0,
          timestamp: new Date().toISOString(),
          steps: [],
          error: 'playwright-skill run.js not found',
        }));
      }
      logger.info('AutomationExecution: Executing Playwright scripts via run.js', {
        totalFiles: jsonFiles.length,
        skillDir: runPath.skillDir,
      });
      for (const scriptFile of jsonFiles) {
        const startTime = Date.now();
        const fileName = path.basename(scriptFile);
        const testCaseId = fileName.replace(/\.(js|ts)$/, '');
        const { exitCode, stderr } = this.runPlaywrightScript(scriptFile, runPath.skillDir, runPath.runJsPath);
        const executionTime = Date.now() - startTime;
        const success = exitCode === 0;
        if (!success) {
          logger.warn('AutomationExecution: Script failed', { fileName, exitCode, stderr: stderr.slice(0, 500) });
        }
        results.push({
          testCaseId,
          testCaseName: testCaseId,
          jsonFile: fileName,
          success,
          executionTime,
          timestamp: new Date().toISOString(),
          steps: [],
          error: success ? undefined : stderr?.trim() || `exit code ${exitCode}`,
        });
      }
      logger.info('AutomationExecution: Completed executing Playwright scripts', {
        totalFiles: jsonFiles.length,
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
      });
      return results;
    }

    return results;
  }

  /**
   * Generate execution summary
   */
  private generateExecutionSummary(results: TestCaseExecutionResult[]): any {
    const total = results.length;
    const passed = results.filter((r) => r.success).length;
    const failed = total - passed;
    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);

    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%',
      totalExecutionTime: totalTime,
      averageExecutionTime: total > 0 ? Math.round(totalTime / total) : 0,
    };
  }

  /**
   * Generate JSON report
   */
  private generateJSONReport(summary: any, results: TestCaseExecutionResult[]): string {
    return JSON.stringify(
      {
        summary,
        results: results.map((r) => ({
          testCaseId: r.testCaseId,
          testCaseName: r.testCaseName,
          jsonFile: r.jsonFile,
          success: r.success,
          executionTime: r.executionTime,
          timestamp: r.timestamp,
          error: r.error,
          steps: r.steps.map((s) => ({
            stepIndex: s.stepIndex,
            step: s.step,
            status: s.status,
            executionTime: s.executionTime,
            error: s.error,
            errorType: s.errorType,
            retryCount: s.retryCount,
            timestamp: s.timestamp,
          })),
        })),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(summary: any, results: TestCaseExecutionResult[]): string {
    const executionTime = new Date().toLocaleString('zh-CN');
    const successRate = parseFloat(summary.successRate);

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>自动化测试执行报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card.success {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        .summary-card.failed {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
        .summary-card.warning {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .summary-card h3 {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
        }
        .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .results-table th {
            background: #007bff;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        .results-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        .results-table tr:hover {
            background: #f8f9fa;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-pass {
            background: #28a745;
            color: white;
        }
        .status-fail {
            background: #dc3545;
            color: white;
        }
        .error-details {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin-top: 5px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .output-details {
            background: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 10px;
            margin-top: 5px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .steps-details {
            background: #e7f3ff;
            border-left: 4px solid #007bff;
            padding: 10px;
            margin-top: 5px;
            border-radius: 4px;
            font-size: 13px;
        }
        .steps-details ol {
            margin-left: 20px;
            margin-top: 8px;
        }
        .steps-details li {
            margin-bottom: 5px;
            padding-left: 5px;
        }
        .logs-details {
            background: #f8f9fa;
            border-left: 4px solid #6c757d;
            padding: 10px;
            margin-top: 5px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .logs-details .log-line {
            margin-bottom: 2px;
            padding: 2px 0;
        }
        .logs-details .log-error {
            color: #dc3545;
        }
        .logs-details .log-success {
            color: #28a745;
        }
        .logs-details .log-info {
            color: #17a2b8;
        }
        .timestamp {
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>自动化测试执行报告</h1>
        <div class="timestamp">执行时间: ${executionTime}</div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>总测试用例数</h3>
                <div class="value">${summary.total}</div>
            </div>
            <div class="summary-card success">
                <h3>通过</h3>
                <div class="value">${summary.passed}</div>
            </div>
            <div class="summary-card failed">
                <h3>失败</h3>
                <div class="value">${summary.failed}</div>
            </div>
            <div class="summary-card" style="background: linear-gradient(135deg, #${successRate >= 80 ? '28a745' : successRate >= 50 ? 'ffc107' : 'dc3545'} 0%, #${successRate >= 80 ? '20c997' : successRate >= 50 ? 'fd7e14' : 'c82333'} 100%);">
                <h3>成功率</h3>
                <div class="value">${summary.successRate}</div>
            </div>
            <div class="summary-card">
                <h3>总执行时间</h3>
                <div class="value">${(summary.totalExecutionTime / 1000).toFixed(2)}s</div>
            </div>
            <div class="summary-card">
                <h3>平均执行时间</h3>
                <div class="value">${(summary.averageExecutionTime / 1000).toFixed(2)}s</div>
            </div>
        </div>

        <h2 style="margin-top: 40px; margin-bottom: 20px;">详细结果</h2>
        <table class="results-table">
            <thead>
                <tr>
                    <th>测试用例编号</th>
                    <th>测试用例名称</th>
                    <th>JSON文件</th>
                    <th>状态</th>
                    <th>执行时间</th>
                    <th>时间戳</th>
                </tr>
            </thead>
            <tbody>`;

    for (const result of results) {
      const statusClass = result.success ? 'status-pass' : 'status-fail';
      const statusText = result.success ? '✅ 通过' : '❌ 失败';

      html += `
                <tr>
                    <td><strong>${this.escapeHtml(result.testCaseId)}</strong></td>
                    <td>${this.escapeHtml(result.testCaseName)}</td>
                    <td><code>${this.escapeHtml(result.jsonFile)}</code></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${(result.executionTime / 1000).toFixed(2)}s</td>
                    <td>${new Date(result.timestamp).toLocaleString('zh-CN')}</td>
                </tr>`;

      // Show step-level execution details if available
      if (result.steps && result.steps.length > 0) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="steps-details" style="background: #f0f8ff; border-left: 4px solid #0066cc;">
                            <strong>步骤执行详情:</strong>
                            <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #e6f2ff;">
                                        <th style="padding: 8px; text-align: left; border: 1px solid #cce5ff;">步骤</th>
                                        <th style="padding: 8px; text-align: left; border: 1px solid #cce5ff;">指令</th>
                                        <th style="padding: 8px; text-align: center; border: 1px solid #cce5ff;">状态</th>
                                        <th style="padding: 8px; text-align: right; border: 1px solid #cce5ff;">执行时间</th>
                                    </tr>
                                </thead>
                                <tbody>`;
        result.steps.forEach((stepResult) => {
          const stepStatusClass = stepResult.status === 'passed' ? 'status-pass' : 'status-fail';
          const stepStatusText = stepResult.status === 'passed' ? '✅ 成功' : '❌ 失败';
          const stepTime = stepResult.executionTime ? `${(stepResult.executionTime / 1000).toFixed(2)}s` : 'N/A';
          html += `
                                    <tr>
                                        <td style="padding: 8px; border: 1px solid #cce5ff;">${stepResult.stepIndex + 1}</td>
                                        <td style="padding: 8px; border: 1px solid #cce5ff;">${this.escapeHtml(stepResult.step)}</td>
                                        <td style="padding: 8px; text-align: center; border: 1px solid #cce5ff;">
                                            <span class="status-badge ${stepStatusClass}">${stepStatusText}</span>
                                        </td>
                                        <td style="padding: 8px; text-align: right; border: 1px solid #cce5ff;">${stepTime}</td>
                                    </tr>`;
          if (stepResult.error) {
            html += `
                                    <tr>
                                        <td colspan="4" style="padding: 8px; border: 1px solid #cce5ff; background: #fff3cd;">
                                            <strong>错误:</strong> ${this.escapeHtml(stepResult.error)}
                                            ${stepResult.errorType ? `<br><strong>错误类型:</strong> ${this.escapeHtml(stepResult.errorType)}` : ''}
                                            ${stepResult.retryCount !== undefined ? `<br><strong>重试次数:</strong> ${stepResult.retryCount}` : ''}
                                        </td>
                                    </tr>`;
          }
        });
        html += `
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>`;
      }

      // Show error details (only for failed tests)
      if (result.error && !result.success) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="error-details">
                            <strong>❌ 错误信息:</strong><br>
                            ${this.escapeHtml(result.error)}
                        </div>
                    </td>
                </tr>`;
      }
    }

    html += `
            </tbody>
        </table>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
