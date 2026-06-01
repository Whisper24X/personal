/**
 * ApiAutomationExecution Action
 * Executes api-test-*.js scripts from docs/test/auto-api and generates reports to docs/test/report-api
 * Does not read or execute docs/test/auto (Playwright).
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

export interface ApiAutomationExecutionOptions extends WorkspaceOptions {
  /** Optional base URL for API tests (passed as BASE_URL env to run.js) */
  baseUrl?: string;
  /** Optional auth token (passed as ACCESS_TOKEN env to run.js) */
  accessToken?: string;
}

interface ApiCaseResult {
  testCaseId: string;
  testCaseName: string;
  filename: string;
  success: boolean;
  executionTime: number;
  timestamp: string;
  error?: string;
}

export class ApiAutomationExecution extends BaseAction {
  constructor() {
    super('ApiAutomationExecution', 'Execute API test scripts from docs/test/auto-api and generate HTML/JSON reports to docs/test/report-api');
  }

  async run(_input: string, options?: ApiAutomationExecutionOptions): Promise<IActionOutput> {
    logger.info('ApiAutomationExecution: Starting from docs/test/auto-api');

    const workspaceOptions: WorkspaceOptions = { ...options, documentType: 'TEST' };
    const workspaceDir = this.getWorkspaceDir(workspaceOptions);
    const autoApiDir = path.join(workspaceDir, 'auto-api');
    const reportDir = path.join(workspaceDir, 'report-api');

    try {
      try {
        await fs.access(autoApiDir);
      } catch {
        logger.info('ApiAutomationExecution: auto-api directory does not exist, creating', { autoApiDir });
        await fs.mkdir(autoApiDir, { recursive: true });
      }

      const scriptFiles = await this.findApiScriptFiles(autoApiDir);
      if (scriptFiles.length === 0) {
        logger.warn('ApiAutomationExecution: No api-test-*.js scripts found in auto-api', {
          autoApiDir,
          workspaceDir,
        });
        const emptyResults: ApiCaseResult[] = [];
        const emptySummary = this.generateSummary(emptyResults);
        await this.saveReports(workspaceOptions, emptySummary, emptyResults);
        return {
          content: 'docs/test/auto-api 中未找到 api-test-*.js 脚本。请先运行 ApiAutomationPlanning（CLI 模式）生成接口自动化脚本后重新执行。',
          data: {
            type: 'api_automation_execution',
            skipped: true,
            reason: 'No api-test-*.js scripts found',
            timestamp: new Date().toISOString(),
            workspaceDir,
            reportDir,
          },
        };
      }

      logger.info('ApiAutomationExecution: Found API script files', {
        fileCount: scriptFiles.length,
        files: scriptFiles.map((f) => path.basename(f)),
      });

      const runPath = this.getApifoxRunJsPath();
      if (!runPath) {
        logger.error('ApiAutomationExecution: apifox-skill run.js not found');
        const failedResults: ApiCaseResult[] = scriptFiles.map((f) => ({
          testCaseId: path.basename(f).replace(/\.js$/, ''),
          testCaseName: path.basename(f),
          filename: path.basename(f),
          success: false,
          executionTime: 0,
          timestamp: new Date().toISOString(),
          error: 'apifox-skill run.js not found',
        }));
        const summary = this.generateSummary(failedResults);
        await this.saveReports(workspaceOptions, summary, failedResults);
        return {
          content: '未找到 apifox-skill 的 run.js，无法执行接口脚本。',
          data: {
            type: 'api_automation_execution',
            summary,
            results: failedResults,
            timestamp: new Date().toISOString(),
            workspaceDir,
            reportDir,
          },
        };
      }

      const results: ApiCaseResult[] = [];
      const env = { ...process.env };
      if (options?.baseUrl) env.BASE_URL = options.baseUrl;
      if (options?.accessToken) env.ACCESS_TOKEN = options.accessToken;

      for (const scriptPath of scriptFiles) {
        const start = Date.now();
        const result = spawnSync('node', [runPath.runJsPath, scriptPath], {
          cwd: runPath.skillDir,
          encoding: 'utf-8',
          timeout: 60000,
          env,
        });
        const executionTime = Date.now() - start;
        const filename = path.basename(scriptPath);
        const testCaseId = filename.replace(/\.js$/, '');
        const success = result.status === 0;
        results.push({
          testCaseId,
          testCaseName: testCaseId,
          filename,
          success,
          executionTime,
          timestamp: new Date().toISOString(),
          error: success ? undefined : (result.stderr || result.stdout || `exit code ${result.status}`).trim(),
        });
      }

      const summary = this.generateSummary(results);
      await this.saveReports(workspaceOptions, summary, results);

      logger.info('ApiAutomationExecution: Completed', {
        total: results.length,
        passed: summary.passed,
        failed: summary.failed,
        workspaceDir,
        reportDir,
      });

      return {
        content: `接口自动化执行完成\n\n总用例数: ${summary.total}\n通过: ${summary.passed}\n失败: ${summary.failed}\n成功率: ${summary.successRate}\n\n报告已保存到 docs/test/report-api`,
        data: {
          type: 'api_automation_execution',
          summary,
          results,
          timestamp: new Date().toISOString(),
          workspaceDir,
          reportDir,
        },
      };
    } catch (error: any) {
      logger.error('ApiAutomationExecution: Failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private getApifoxRunJsPath(): { runJsPath: string; skillDir: string } | null {
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const runJsPath = path.join(projectRoot, 'skills', 'apifox-skill', 'run.js');
    const skillDir = path.dirname(runJsPath);
    if (!existsSync(runJsPath)) {
      logger.warn('ApiAutomationExecution: apifox-skill run.js not found', { runJsPath });
      return null;
    }
    return { runJsPath, skillDir };
  }

  private async findApiScriptFiles(autoApiDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(autoApiDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.startsWith('api-test-') && e.name.endsWith('.js'))
        .map((e) => path.join(autoApiDir, e.name))
        .sort();
    } catch {
      return [];
    }
  }

  private generateSummary(results: ApiCaseResult[]): {
    total: number;
    passed: number;
    failed: number;
    successRate: string;
    totalExecutionTime: number;
    averageExecutionTime: number;
  } {
    const total = results.length;
    const passed = results.filter((r) => r.success).length;
    const failed = total - passed;
    const totalTime = results.reduce((s, r) => s + r.executionTime, 0);
    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%',
      totalExecutionTime: totalTime,
      averageExecutionTime: total > 0 ? Math.round(totalTime / total) : 0,
    };
  }

  private async saveReports(
    workspaceOptions: WorkspaceOptions,
    summary: ReturnType<ApiAutomationExecution['generateSummary']>,
    results: ApiCaseResult[]
  ): Promise<void> {
    const jsonReport = JSON.stringify({ summary, results, timestamp: new Date().toISOString() }, null, 2);
    const htmlReport = this.generateHTMLReport(summary, results);
    try {
      await this.saveToWorkspace('report-api/api_results.json', jsonReport, workspaceOptions);
      await this.saveToWorkspace('report-api/api_report.html', htmlReport, workspaceOptions);
    } catch (e: any) {
      logger.error('ApiAutomationExecution: Failed to save reports', { error: e.message });
    }
  }

  private generateHTMLReport(summary: ReturnType<ApiAutomationExecution['generateSummary']>, results: ApiCaseResult[]): string {
    const time = new Date().toLocaleString('zh-CN');
    const successRate = parseFloat(summary.successRate);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>接口自动化测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
    h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { padding: 16px; border-radius: 8px; color: white; text-align: center; }
    .card.total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .card.passed { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .card.failed { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .card.rate { background: linear-gradient(135deg, #${successRate >= 80 ? '28a745' : successRate >= 50 ? 'ffc107' : 'dc3545'} 0%, #${successRate >= 80 ? '20c997' : successRate >= 50 ? 'fd7e14' : 'c82333'} 100%); }
    .card h3 { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
    .card .value { font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #007bff; color: white; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge.pass { background: #28a745; color: white; }
    .badge.fail { background: #dc3545; color: white; }
    .err { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin-top: 6px; border-radius: 4px; font-size: 12px; font-family: monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <h1>接口自动化测试报告</h1>
    <p style="color:#666;margin-bottom:20px;">执行时间: ${time}</p>
    <div class="summary">
      <div class="card total"><h3>总用例数</h3><div class="value">${summary.total}</div></div>
      <div class="card passed"><h3>通过</h3><div class="value">${summary.passed}</div></div>
      <div class="card failed"><h3>失败</h3><div class="value">${summary.failed}</div></div>
      <div class="card rate"><h3>成功率</h3><div class="value">${summary.successRate}</div></div>
      <div class="card total"><h3>总耗时</h3><div class="value">${(summary.totalExecutionTime / 1000).toFixed(2)}s</div></div>
    </div>
    <h2 style="margin-bottom:12px;">详细结果</h2>
    <table>
      <thead><tr><th>用例编号</th><th>文件名</th><th>状态</th><th>耗时</th><th>时间戳</th></tr></thead>
      <tbody>
        ${results
          .map(
            (r) => `
        <tr>
          <td><strong>${this.escapeHtml(r.testCaseId)}</strong></td>
          <td><code>${this.escapeHtml(r.filename)}</code></td>
          <td><span class="badge ${r.success ? 'pass' : 'fail'}">${r.success ? '通过' : '失败'}</span></td>
          <td>${(r.executionTime / 1000).toFixed(2)}s</td>
          <td>${new Date(r.timestamp).toLocaleString('zh-CN')}</td>
        </tr>
        ${r.error ? `<tr><td colspan="5"><div class="err">${this.escapeHtml(r.error)}</div></td></tr>` : ''}`
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
