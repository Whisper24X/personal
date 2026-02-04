/**
 * AutomationExecution Action
 * Executes TypeScript test scripts from test/auto directory and generates HTML/JSON reports
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, executeCommand } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AutomationExecutionOptions extends WorkspaceOptions {
  // Inherits all options from WorkspaceOptions
  testUrl?: string; // Optional URL to test against
}

interface TestScriptResult {
  testCaseId: string;
  testCaseName: string;
  scriptFile: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  output?: string;
  error?: string;
  steps?: string[]; // 测试步骤列表
  logs?: string[]; // 执行日志（按时间顺序）
  exitCode?: number; // 退出码
}

export class AutomationExecution extends BaseAction {
  constructor() {
    super('AutomationExecution', 'Execute TypeScript test scripts from test/auto directory and generate HTML/JSON reports');
  }

  async run(_input: string, options?: AutomationExecutionOptions): Promise<IActionOutput> {
    logger.info('AutomationExecution: Starting automation execution from test scripts');

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

      // Read all TypeScript files from auto directory
      const scriptFiles = await this.findTestScripts(autoDir);
      if (scriptFiles.length === 0) {
        logger.warn('AutomationExecution: No test scripts found in auto directory', {
          autoDir,
          workspaceDir,
        });

        // Even if no scripts found, generate an empty report to indicate execution was attempted
        const emptyResults: TestScriptResult[] = [];
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
          content: 'test/auto 目录中未找到测试脚本文件，已生成空报告。请先运行 AutomationPlanning 生成测试脚本后重新执行。',
          data: {
            type: 'automation_execution',
            skipped: true,
            reason: 'No test scripts found',
            timestamp: new Date().toISOString(),
            workspaceDir,
            reportDir,
          },
        };
      }

      logger.info('AutomationExecution: Found test scripts', {
        scriptCount: scriptFiles.length,
        scripts: scriptFiles.map((f) => path.basename(f)),
      });

      // Execute all test scripts
      let results: TestScriptResult[] = [];
      try {
        logger.info('AutomationExecution: Starting script execution', {
          scriptCount: scriptFiles.length,
          cwd: autoDir,
        });
        results = await this.executeTestScripts(scriptFiles, autoDir);
        logger.info('AutomationExecution: Script execution completed', {
          resultsCount: results.length,
          successCount: results.filter((r) => r.success).length,
          failedCount: results.filter((r) => !r.success).length,
        });
      } catch (error: any) {
        logger.error('AutomationExecution: Failed to execute test scripts', {
          error: error.message,
          stack: error.stack,
        });
        // Even if execution fails, create empty results to generate report
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
   * Find all TypeScript test scripts in the auto directory
   */
  private async findTestScripts(autoDir: string): Promise<string[]> {
    try {
      logger.info('AutomationExecution: Reading auto directory', { autoDir });
      const entries = await fs.readdir(autoDir, { withFileTypes: true });
      logger.info('AutomationExecution: Found entries in auto directory', {
        totalEntries: entries.length,
        entryNames: entries.map((e) => e.name),
      });

      const scriptFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => path.join(autoDir, entry.name))
        .sort();

      logger.info('AutomationExecution: Filtered TypeScript script files', {
        scriptCount: scriptFiles.length,
        scriptFiles: scriptFiles.map((f) => path.basename(f)),
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
   * Execute all test scripts and collect results
   */
  private async executeTestScripts(scriptFiles: string[], cwd: string): Promise<TestScriptResult[]> {
    const results: TestScriptResult[] = [];

    logger.info('AutomationExecution: Starting to execute test scripts', {
      totalScripts: scriptFiles.length,
      cwd,
    });

    for (let i = 0; i < scriptFiles.length; i++) {
      const scriptFile = scriptFiles[i];
      const startTime = Date.now();
      const scriptName = path.basename(scriptFile);

      // Extract test case ID and name from script file
      const testCaseId = scriptName.replace('.ts', '');
      let testCaseName = testCaseId;
      const testSteps: string[] = [];

      try {
        // Read script content to extract test case name and steps
        const scriptContent = await fs.readFile(scriptFile, 'utf-8');

        // Extract test case name
        const nameMatch = scriptContent.match(/测试用例名称[：:]\s*(.+)/);
        if (nameMatch) {
          testCaseName = nameMatch[1].trim();
        }

        // Extract test steps from script (look for stagehandService.act calls)
        const stepMatches = scriptContent.matchAll(/stagehandService\.act\(['"](.+?)['"]/g);
        for (const match of stepMatches) {
          if (match[1] && !match[1].includes('导航到页面')) {
            testSteps.push(match[1].trim());
          }
        }
      } catch (error: any) {
        logger.warn('AutomationExecution: Failed to read script file for extraction', {
          scriptFile,
          error: error.message,
        });
      }

      logger.info('AutomationExecution: Executing test script', {
        scriptFile: scriptName,
        testCaseId,
        stepsCount: testSteps.length,
      });

      try {
        // Execute script using tsx
        // Set NODE_PATH to include backend/src so scripts can import StagehandService.
        // Use __dirname so path is correct regardless of process.cwd() (e.g. when run from workspace).
        const backendSrcPath = path.resolve(__dirname, '..');
        const nodePath = process.env.NODE_PATH ? `${process.env.NODE_PATH}:${backendSrcPath}` : backendSrcPath;
        // Explicitly pass LLM/Stagehand env so tsx child gets same config as backend (e.g. ZhipuAI)
        const scriptEnv: NodeJS.ProcessEnv = {
          ...process.env,
          NODE_PATH: nodePath,
        };
        const llmEnvKeys = [
          'OPENAI_API_KEY',
          'OPENAI_BASE_URL',
          'OPENAI_MODEL',
          'ZHIPUAI_API_KEY',
          'ZHIPUAI_BASE_URL',
          'ZHIPUAI_MODEL',
          'STAGEHAND_MODEL',
          'STAGEHAND_ENV',
          'STAGEHAND_HEADLESS',
          'ENABLE_BROWSER',
        ];
        for (const key of llmEnvKeys) {
          if (process.env[key] != null) scriptEnv[key] = process.env[key];
        }
        // Stagehand 内部只认 OPENAI_API_KEY，子进程用智谱时需映射，否则报 MissingLLMConfigurationError 导致浏览器闪退
        if (!scriptEnv.OPENAI_API_KEY && scriptEnv.ZHIPUAI_API_KEY) {
          scriptEnv.OPENAI_API_KEY = scriptEnv.ZHIPUAI_API_KEY;
          scriptEnv.OPENAI_BASE_URL = scriptEnv.ZHIPUAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
          scriptEnv.OPENAI_MODEL = scriptEnv.STAGEHAND_MODEL || scriptEnv.ZHIPUAI_MODEL || 'glm-4-flash';
        }
        const result = await executeCommand(`tsx ${scriptName}`, {
          cwd,
          timeout: 300000, // 5 minutes timeout per script
          env: scriptEnv,
        });

        const executionTime = Date.now() - startTime;
        const success = result.exitCode === 0;

        // Parse logs from output - combine stdout and stderr, preserve order
        const logs: string[] = [];
        const stdoutLines = result.stdout ? result.stdout.split('\n') : [];
        const stderrLines = result.stderr ? result.stderr.split('\n') : [];

        // Combine outputs (stdout first, then stderr if any)
        if (stdoutLines.length > 0) {
          logs.push(...stdoutLines.filter((line) => line.trim()));
        }
        if (stderrLines.length > 0 && result.stderr !== result.stdout) {
          logs.push(...stderrLines.filter((line) => line.trim()));
        }

        // If no logs but we have output, use it
        if (logs.length === 0 && (result.stdout || result.stderr)) {
          const allOutput = (result.stdout || '') + (result.stderr || '');
          if (allOutput.trim()) {
            logs.push(...allOutput.split('\n').filter((line) => line.trim()));
          }
        }

        results.push({
          testCaseId,
          testCaseName,
          scriptFile: scriptName,
          success,
          executionTime,
          timestamp: new Date().toISOString(),
          output: result.stdout || undefined,
          error: success ? undefined : result.stderr || result.stdout || '执行失败',
          steps: testSteps.length > 0 ? testSteps : undefined,
          logs: logs.length > 0 ? logs : undefined,
          exitCode: result.exitCode ?? undefined,
        });

        logger.info('AutomationExecution: Script execution completed', {
          scriptFile: scriptName,
          success,
          executionTime,
          logsCount: logs.length,
        });
      } catch (error: any) {
        const executionTime = Date.now() - startTime;

        // Try to extract error details from CommandExecutorError
        let errorMessage = error.message || 'Script execution failed';
        const errorLogs: string[] = [];
        let errorOutput = '';
        let errorStderr = '';

        // Check if error has stdout/stderr properties (from CommandExecutorError)
        if (error.stdout || error.stderr) {
          errorOutput = error.stdout || '';
          errorStderr = error.stderr || '';

          // Combine stdout and stderr for logs
          const stdoutLines = errorOutput ? errorOutput.split('\n') : [];
          const stderrLines = errorStderr ? errorStderr.split('\n') : [];

          if (stdoutLines.length > 0) {
            errorLogs.push(...stdoutLines.filter((line) => line.trim()));
          }
          if (stderrLines.length > 0 && errorStderr !== errorOutput) {
            errorLogs.push(...stderrLines.filter((line) => line.trim()));
          }

          // Use the most detailed error message
          if (errorLogs.length > 0) {
            errorMessage = errorLogs.join('\n');
          } else if (errorStderr) {
            errorMessage = errorStderr;
          } else if (errorOutput) {
            errorMessage = errorOutput;
          }
        }

        results.push({
          testCaseId,
          testCaseName,
          scriptFile: scriptName,
          success: false,
          executionTime,
          timestamp: new Date().toISOString(),
          error: errorMessage,
          output: errorOutput || undefined,
          steps: testSteps.length > 0 ? testSteps : undefined,
          logs: errorLogs.length > 0 ? errorLogs : undefined,
          exitCode: error.exitCode || 1,
        });

        logger.error('AutomationExecution: Script execution failed', {
          scriptFile: scriptName,
          error: errorMessage,
          logsCount: errorLogs.length,
          exitCode: error.exitCode,
        });
      }
    }

    logger.info('AutomationExecution: Completed executing all test scripts', {
      totalScripts: scriptFiles.length,
      resultsCount: results.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * Generate execution summary
   */
  private generateExecutionSummary(results: TestScriptResult[]): any {
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
  private generateJSONReport(summary: any, results: TestScriptResult[]): string {
    return JSON.stringify(
      {
        summary,
        results: results.map((r) => ({
          testCaseId: r.testCaseId,
          testCaseName: r.testCaseName,
          scriptFile: r.scriptFile,
          success: r.success,
          executionTime: r.executionTime,
          timestamp: r.timestamp,
          exitCode: r.exitCode,
          steps: r.steps || [],
          logs: r.logs || [],
          output: r.output,
          error: r.error,
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
  private generateHTMLReport(summary: any, results: TestScriptResult[]): string {
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
                    <th>脚本文件</th>
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
                    <td><code>${this.escapeHtml(result.scriptFile)}</code></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${(result.executionTime / 1000).toFixed(2)}s</td>
                    <td>${new Date(result.timestamp).toLocaleString('zh-CN')}</td>
                </tr>`;

      // Show test steps if available
      if (result.steps && result.steps.length > 0) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="steps-details">
                            <strong>测试步骤 (${result.steps.length} 步):</strong>
                            <ol>`;
        result.steps.forEach((step, _index) => {
          html += `<li>${this.escapeHtml(step)}</li>`;
        });
        html += `
                            </ol>
                        </div>
                    </td>
                </tr>`;
      }

      // Show execution logs (always show if available, even if test passed)
      if (result.logs && result.logs.length > 0) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="logs-details">
                            <strong>执行日志 (${result.logs.length} 条):</strong><br>`;
        result.logs.forEach((log, index) => {
          const logClass = this.getLogClass(log);
          const timestamp = `[${index + 1}]`;
          html += `<div class="log-line ${logClass}">${timestamp} ${this.escapeHtml(log)}</div>`;
        });
        html += `
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
                            ${result.exitCode !== undefined ? `<br><br><strong>退出码:</strong> ${result.exitCode}` : ''}
                        </div>
                    </td>
                </tr>`;
      }

      // Show output if available and different from logs (for debugging)
      if (result.output && result.output.trim() && (!result.logs || result.output.trim() !== result.logs.join('\n').trim())) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="output-details">
                            <strong>📋 标准输出:</strong><br>
                            ${this.escapeHtml(result.output)}
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

  /**
   * Determine log line CSS class based on content
   */
  private getLogClass(log: string): string {
    const lowerLog = log.toLowerCase();
    if (lowerLog.includes('error') || lowerLog.includes('失败') || lowerLog.includes('failed')) {
      return 'log-error';
    }
    if (lowerLog.includes('success') || lowerLog.includes('成功') || lowerLog.includes('passed')) {
      return 'log-success';
    }
    if (lowerLog.includes('info') || lowerLog.includes('初始化') || lowerLog.includes('initialized')) {
      return 'log-info';
    }
    return '';
  }
}
