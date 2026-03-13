/**
 * AutomationExecution Action
 * Executes JSON format test cases from test/auto directory and generates HTML/JSON reports
 * Architecture: Step Runner + Result Collector + Stability Middleware
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger, WorkspaceManager } from '../utils';
import { runOptimizer } from '../optimizer/optimizerRunner';
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
  /** 执行成功时的页面截图文件名（相对 report 目录），用于报告展示 */
  screenshotSuccess?: string;
  /** 执行失败时的页面截图文件名（相对 report 目录），用于报告展示 */
  screenshotFail?: string;
  /** 嵌入的日志信息（step/selector/expected/actual/url/consoleErrors/network），供分析失败原因 */
  logEmbed?: {
    step?: string;
    selector?: string;
    expected?: string;
    actual?: string;
    url?: string;
    consoleErrors?: string[];
    network?: { api: string; status: number }[];
  };
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

      // When tests fail, save structured bug report as ImproveCode.md for the Engineer to fix
      let resetToEngineer = false;
      if (summary.failed > 0) {
        try {
          const codeOptions: WorkspaceOptions = { ...workspaceOptions, documentType: 'CODE' };
          const bugReport = await this.generateBugReport(summary, results, reportDir);
          await this.saveToWorkspace('ImproveCode.md', bugReport, codeOptions);
          resetToEngineer = true;
          logger.info('AutomationExecution: Saved ImproveCode.md with structured bug report', {
            failedCount: summary.failed,
          });
        } catch (saveError: any) {
          logger.warn('AutomationExecution: Failed to save ImproveCode.md, continuing normally', {
            error: saveError.message,
          });
        }
      }

      // Generate HTML report with embedded base64 screenshots as content
      let embeddedHtml = this.generateHTMLReport(summary, results);

      // Embed screenshots as base64 data URLs inline
      for (const r of results) {
        if (r.screenshotFail) {
          const imgPath = path.join(reportDir, r.screenshotFail);
          try {
            const imgBuffer = await fs.readFile(imgPath);
            const base64 = imgBuffer.toString('base64');
            embeddedHtml = embeddedHtml.replace(
              `src="${this.escapeHtml(r.screenshotFail)}"`,
              `src="data:image/png;base64,${base64}"`
            );
          } catch (imgErr: any) {
            logger.warn('AutomationExecution: Failed to embed screenshot', {
              file: r.screenshotFail,
              error: imgErr.message,
            });
          }
        }
        if (r.screenshotSuccess) {
          const imgPath = path.join(reportDir, r.screenshotSuccess);
          try {
            const imgBuffer = await fs.readFile(imgPath);
            const base64 = imgBuffer.toString('base64');
            embeddedHtml = embeddedHtml.replace(
              `src="${this.escapeHtml(r.screenshotSuccess)}"`,
              `src="data:image/png;base64,${base64}"`
            );
          } catch (imgErr: any) {
            logger.warn('AutomationExecution: Failed to embed screenshot', {
              file: r.screenshotSuccess,
              error: imgErr.message,
            });
          }
        }
      }

      if (resetToEngineer) {
        embeddedHtml = embeddedHtml.replace(
          '</div>\n</body>',
          `    <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
            <strong>⚠ 检测到失败用例</strong>，已生成 ImproveCode.md 并重置流程到工程师角色进行代码改进。
        </div>
    </div>\n</body>`
        );
      }

      return {
        content: embeddedHtml,
        data: {
          type: 'automation_execution',
          summary,
          results,
          timestamp: new Date().toISOString(),
          workspaceDir,
          reportDir,
          resetToEngineer,
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
   * Parse TEST.md to extract TC IDs in document order (first occurrence).
   * Returns Map<tcId, index> for sorting. Empty map on parse failure.
   */
  private async getTestMdTcOrder(workspaceDir: string): Promise<Map<string, number>> {
    const testMdPath = path.join(workspaceDir, 'TEST.md');
    try {
      const content = await fs.readFile(testMdPath, 'utf-8');
      const tcOrder = new Map<string, number>();
      const tcRegex = /TC-[^\s]+/g;
      let match: RegExpExecArray | null;
      let index = 0;
      while ((match = tcRegex.exec(content)) !== null) {
        const tcId = match[0];
        if (!tcOrder.has(tcId)) {
          tcOrder.set(tcId, index++);
        }
      }
      if (tcOrder.size > 0) {
        logger.info('AutomationExecution: Parsed TEST.md for TC order', {
          testMdPath,
          tcCount: tcOrder.size,
          tcIds: Array.from(tcOrder.keys()),
        });
      }
      return tcOrder;
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        logger.debug('AutomationExecution: TEST.md not found, using lexicographic sort', { testMdPath });
      } else {
        logger.warn('AutomationExecution: Failed to parse TEST.md for TC order, using lexicographic sort', {
          testMdPath,
          error: err?.message ?? String(err),
        });
      }
      return new Map();
    }
  }

  /**
   * Extract TC ID from Playwright script filename.
   * e.g. playwright-test-TC-渠道配置-001-xxx.js -> TC-渠道配置-001
   */
  private extractTcIdFromFilepath(filePath: string): string | null {
    const baseName = path.basename(filePath);
    // TC-{模块}-{编号}，如 TC-渠道配置-001、TC-CSV导入-001
    const match = baseName.match(/playwright-test-(TC-[^-]+-\d+)(?:-|\.)/);
    return match ? match[1] : null;
  }

  /**
   * Find all Playwright script files (.js / .ts) in the auto directory.
   * Sorts by TEST.md TC order when available; otherwise lexicographic.
   */
  private async findTestCaseFiles(autoDir: string): Promise<string[]> {
    try {
      logger.info('AutomationExecution: Reading auto directory', { autoDir });
      const entries = await fs.readdir(autoDir, { withFileTypes: true });
      logger.info('AutomationExecution: Found entries in auto directory', {
        totalEntries: entries.length,
        entryNames: entries.map((e) => e.name),
      });

      const workspaceDir = path.dirname(autoDir);
      let scriptFiles = entries
        .filter((entry) => entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts')))
        .filter((entry) => {
          const name = entry.name;
          if (/^playwright-test-API-/i.test(name) || /^api-test-/i.test(name)) {
            logger.debug('AutomationExecution: Excluding API script from Playwright execution', { name });
            return false;
          }
          return true;
        })
        .map((entry) => path.join(autoDir, entry.name));

      const tcOrder = await this.getTestMdTcOrder(workspaceDir);
      if (tcOrder.size > 0) {
        scriptFiles = scriptFiles.sort((a, b) => {
          const tcA = this.extractTcIdFromFilepath(a);
          const tcB = this.extractTcIdFromFilepath(b);
          const idxA = tcA !== null ? tcOrder.get(tcA) : undefined;
          const idxB = tcB !== null ? tcOrder.get(tcB) : undefined;
          if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
          if (idxA !== undefined) return -1;
          if (idxB !== undefined) return 1;
          return path.basename(a).localeCompare(path.basename(b));
        });
      } else {
        scriptFiles.sort();
      }

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
   * Parse __AUTOMATION_LOG__{json}__END__ from stdout and build logEmbed with error info
   */
  private parseLogFromStdout(stdout: string, testCaseId: string, error?: string): TestCaseExecutionResult['logEmbed'] | undefined {
    const m = stdout.match(/__AUTOMATION_LOG__(.+?)__END__/s);
    if (!m) return undefined;
    try {
      const raw = JSON.parse(m[1]) as { url?: string; consoleErrors?: string[]; network?: { api: string; status: number }[] };
      const locator = error ? this.extractLocatorInfo(error) : undefined;
      const actual = error ? this.extractErrorDescription(error) : undefined;
      const step = testCaseId.replace(/^playwright-test-/, '');
      const embed: NonNullable<TestCaseExecutionResult['logEmbed']> = {
        step,
        url: raw.url || undefined,
        consoleErrors: raw.consoleErrors?.length ? raw.consoleErrors : undefined,
        network: raw.network?.length ? raw.network : undefined,
      };
      if (locator?.selector) embed.selector = locator.selector;
      if (actual) embed.actual = actual;
      if (embed.selector || embed.actual) embed.expected = 'visible';
      return embed;
    } catch {
      return undefined;
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
   * 优先从 skills/playwright-skill/login.md 解析账号、密码（供 Playwright 脚本 LOGIN_USER/LOGIN_PASSWORD）。
   * 若无则从 workspace 的 docs/deploy/deployResult.md 解析。
   */
  private async readLoginMdCredentials(): Promise<{ loginUser?: string; loginPassword?: string }> {
    const projectRoot = WorkspaceManager.getProjectRootPath();
    const loginPath = path.join(projectRoot, 'skills', 'playwright-skill', 'login.md');

    try {
      const content = await fs.readFile(loginPath, 'utf-8');
      let loginUser: string | undefined;
      let loginPassword: string | undefined;
      const accountMatch = content.match(/账号\s*[：:]\s*(.+)/);
      if (accountMatch && accountMatch[1]) {
        loginUser = accountMatch[1].trim();
      }
      const passwordMatch = content.match(/密码\s*[：:]\s*(.+)/);
      if (passwordMatch && passwordMatch[1]) {
        loginPassword = passwordMatch[1].trim();
      }
      if (loginUser !== undefined || loginPassword !== undefined) {
        logger.debug('AutomationExecution: Resolved credentials from login.md', {
          hasLoginUser: !!loginUser,
          loginUserLength: loginUser?.length,
        });
      }
      return { loginUser, loginPassword };
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        logger.debug('AutomationExecution: login.md not found', { loginPath });
      } else {
        logger.warn('AutomationExecution: Failed to read login.md for credentials', {
          loginPath,
          error: err?.message ?? String(err),
        });
      }
      return {};
    }
  }

  /**
   * 从 workspace 的 docs/deploy/deployResult.md 解析账号、密码（供 Playwright 脚本 LOGIN_USER/LOGIN_PASSWORD）
   */
  private async readDeployResultCredentials(workspaceDir: string): Promise<{ loginUser?: string; loginPassword?: string }> {
    const baseWorkspaceDir = workspaceDir.replace(/\/docs\/test$/, '');
    const deployResultPath = path.join(baseWorkspaceDir, 'docs', 'deploy', 'deployResult.md');

    try {
      const content = await fs.readFile(deployResultPath, 'utf-8');
      let loginUser: string | undefined;
      let loginPassword: string | undefined;
      const accountMatch = content.match(/账号\s*[：:]\s*(.+)/);
      if (accountMatch && accountMatch[1]) {
        loginUser = accountMatch[1].trim();
      }
      const passwordMatch = content.match(/密码\s*[：:]\s*(.+)/);
      if (passwordMatch && passwordMatch[1]) {
        loginPassword = passwordMatch[1].trim();
      }
      if (loginUser !== undefined || loginPassword !== undefined) {
        logger.debug('AutomationExecution: Resolved credentials from deployResult', {
          hasLoginUser: !!loginUser,
          loginUserLength: loginUser?.length,
        });
      }
      return { loginUser, loginPassword };
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        logger.debug('AutomationExecution: deployResult.md not found', { deployResultPath });
      } else {
        logger.warn('AutomationExecution: Failed to read deployResult.md for credentials', {
          deployResultPath,
          error: err?.message ?? String(err),
        });
      }
      return {};
    }
  }

  /**
   * 从 workspace 的 docs/deploy 解析部署地址，供 Playwright 脚本 TARGET_URL。
   * 优先读取 deploy.md（含完整访问地址表），若无或解析不到则读 deployResult.md。
   * 优先级：管理后台 > 统一入口 > 表中第一个 URL。
   */
  private async readDeployResultBaseUrl(workspaceDir: string): Promise<string | undefined> {
    const baseWorkspaceDir = workspaceDir.replace(/\/docs\/test$/, '');
    const deployDir = path.join(baseWorkspaceDir, 'docs', 'deploy');
    const deployMdPath = path.join(deployDir, 'deploy.md');
    const deployResultPath = path.join(deployDir, 'deployResult.md');
    const regex = /([^\s,，；]+?)\s*[：:]?\s*(https?:\/\/[^\s,，；)、]+)/g;

    const parseUrlMap = (content: string): Record<string, string> => {
      const map: Record<string, string> = {};
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const label = match[1].trim();
        const url = match[2].trim();
        if (label && url && !map[label]) {
          map[label] = url;
        }
      }
      return map;
    };

    try {
      try {
        const content = await fs.readFile(deployMdPath, 'utf-8');
        const map = parseUrlMap(content);
        if (Object.keys(map).length > 0) {
          if (map['管理后台']) {
            logger.debug('AutomationExecution: Resolved baseUrl from deploy.md (管理后台)', {
              deployMdPath,
              url: map['管理后台'],
            });
            return map['管理后台'];
          }
          if (map['统一入口']) {
            return map['统一入口'];
          }
          const firstKey = Object.keys(map)[0];
          return firstKey ? map[firstKey] : undefined;
        }
      } catch (e: any) {
        if (e?.code !== 'ENOENT') {
          logger.warn('AutomationExecution: Failed to read deploy.md for baseUrl', {
            deployMdPath,
            error: e?.message ?? String(e),
          });
        }
      }
      const content = await fs.readFile(deployResultPath, 'utf-8');
      const map = parseUrlMap(content);
      if (map['管理后台']) {
        return map['管理后台'];
      }
      if (map['统一入口']) {
        return map['统一入口'];
      }
      const firstKey = Object.keys(map)[0];
      return firstKey ? map[firstKey] : undefined;
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        logger.debug('AutomationExecution: No deploy doc found for baseUrl', {
          deployMdPath,
          deployResultPath,
        });
      } else {
        logger.warn('AutomationExecution: Failed to read deploy docs for baseUrl', {
          deployMdPath,
          deployResultPath,
          error: err?.message ?? String(err),
        });
      }
      return undefined;
    }
  }

  /**
   * Execute a single Playwright script via run.js and return result
   */
  private runPlaywrightScript(
    scriptPath: string,
    skillDir: string,
    runJsPath: string,
    env?: NodeJS.ProcessEnv
  ): { exitCode: number; stdout: string; stderr: string } {
    const runEnv = env ? { ...process.env, ...env } : process.env;
    const result = spawnSync('node', [runJsPath, scriptPath], {
      cwd: skillDir,
      encoding: 'utf-8',
      timeout: 120000,
      env: runEnv,
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
      const workspaceDir = path.join(_cwd, '..');
      const reportDir = path.join(workspaceDir, 'report');
      await fs.mkdir(reportDir, { recursive: true });
      const loginMdCredentials = await this.readLoginMdCredentials();
      const hasLoginMd =
        (loginMdCredentials.loginUser != null && loginMdCredentials.loginUser !== '') ||
        (loginMdCredentials.loginPassword != null && loginMdCredentials.loginPassword !== '');
      const credentials = hasLoginMd ? loginMdCredentials : await this.readDeployResultCredentials(workspaceDir);
      const runEnv: NodeJS.ProcessEnv = { ...process.env };
      if (credentials.loginUser != null && credentials.loginUser !== '') {
        runEnv.LOGIN_USER = credentials.loginUser;
      }
      if (credentials.loginPassword != null && credentials.loginPassword !== '') {
        runEnv.LOGIN_PASSWORD = credentials.loginPassword;
      }
      const baseUrl = await this.readDeployResultBaseUrl(workspaceDir);
      if (baseUrl) {
        runEnv.TARGET_URL = baseUrl;
      }
      runEnv.AUTOMATION_REPORT_DIR = reportDir;
      for (const scriptFile of jsonFiles) {
        const startTime = Date.now();
        const fileName = path.basename(scriptFile);
        const testCaseId = fileName.replace(/\.(js|ts)$/, '');
        runEnv.AUTOMATION_TEST_CASE_ID = testCaseId;
        const { exitCode, stdout, stderr } = this.runPlaywrightScript(scriptFile, runPath.skillDir, runPath.runJsPath, runEnv);
        const executionTime = Date.now() - startTime;
        const success = exitCode === 0;
        if (!success) {
          logger.warn('AutomationExecution: Script failed', { fileName, exitCode, stderr: stderr.slice(0, 500) });
        }
        const screenshotSuccess = success && existsSync(path.join(reportDir, `${testCaseId}-success.png`)) ? `${testCaseId}-success.png` : undefined;
        const screenshotFail = !success && existsSync(path.join(reportDir, `${testCaseId}-fail.png`)) ? `${testCaseId}-fail.png` : undefined;
        const logEmbed = this.parseLogFromStdout(stdout, testCaseId, success ? undefined : stderr?.trim());
        results.push({
          testCaseId,
          testCaseName: testCaseId,
          jsonFile: fileName,
          success,
          executionTime,
          timestamp: new Date().toISOString(),
          steps: [],
          error: success ? undefined : stderr?.trim() || `exit code ${exitCode}`,
          screenshotSuccess,
          screenshotFail,
          logEmbed,
        });
      }
      logger.info('AutomationExecution: Completed executing Playwright scripts', {
        totalFiles: jsonFiles.length,
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
      });

      // Optimizer: on failure, parse → classify → transform (SCRIPT_*) → rerun up to 2 rounds
      const failedCount = results.filter((r) => !r.success).length;
      if (failedCount > 0) {
        const runScript = async (scriptPath: string) => {
          const fileName = path.basename(scriptPath);
          const testCaseId = fileName.replace(/\.(js|ts)$/, '');
          runEnv.AUTOMATION_TEST_CASE_ID = testCaseId;
          const { exitCode, stdout, stderr } = this.runPlaywrightScript(
            scriptPath,
            runPath.skillDir,
            runPath.runJsPath,
            runEnv
          );
          const success = exitCode === 0;
          const screenshotFail =
            !success && existsSync(path.join(reportDir, `${testCaseId}-fail.png`))
              ? `${testCaseId}-fail.png`
              : undefined;
          const logEmbed = this.parseLogFromStdout(stdout, testCaseId, success ? undefined : stderr?.trim());
          return {
            success,
            error: success ? undefined : stderr?.trim(),
            logEmbed,
            screenshotFail,
          };
        };
        const { results: optimizedResults, optimized } = await runOptimizer({
          scriptFiles: jsonFiles,
          reportDir,
          autoDir: _cwd,
          results,
          runScript,
        });
        if (optimized.length > 0) {
          logger.info('Optimizer: Applied transformations and reran', {
            optimizedCount: optimized.length,
            newSuccessCount: optimizedResults.filter((r) => r.success).length,
          });
          return optimizedResults;
        }
      }

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
          screenshotSuccess: r.screenshotSuccess,
          screenshotFail: r.screenshotFail,
          logEmbed: r.logEmbed,
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
   * Parse the Playwright Call log to extract the CSS selector, data-testid, and UI element type.
   */
  private extractLocatorInfo(rawError: string): { selector: string; testId?: string; elementType?: string } | null {
    if (!rawError) return null;
    const cleaned = rawError.replace(/\u001b\[[0-9;]*m/g, '');

    const locatorMatch = cleaned.match(/waiting for locator\('(.+?)'\)/);
    if (!locatorMatch) return null;

    const selector = locatorMatch[1];
    const testIdMatch = selector.match(/data-testid="([^"]+)"/);
    const testId = testIdMatch ? testIdMatch[1] : undefined;

    const elementTypeMap: [RegExp, string][] = [
      [/\.el-select|select/i, '下拉框'],
      [/\.el-button|button/i, '按钮'],
      [/\.el-input|input/i, '输入框'],
      [/\.el-table|table/i, '表格'],
      [/\.el-checkbox|checkbox/i, '复选框'],
      [/\.el-dialog|dialog|modal/i, '对话框'],
    ];

    let elementType: string | undefined;
    for (const [pattern, label] of elementTypeMap) {
      if (pattern.test(selector)) {
        elementType = label;
        break;
      }
    }
    if (!elementType && testId) {
      if (/btn|button/i.test(testId)) elementType = '按钮';
      else if (/select|filter|dropdown/i.test(testId)) elementType = '下拉框';
      else if (/input|search/i.test(testId)) elementType = '输入框';
      else elementType = '控件';
    }

    return { selector, testId, elementType };
  }

  /**
   * Extract a user-visible error description from a raw Playwright error string.
   * For timeout errors, parses the Call log to identify which UI element is missing.
   */
  private extractErrorDescription(rawError: string): string {
    if (!rawError) return '未知错误';
    const cleaned = rawError.replace(/\u001b\[[0-9;]*m/g, '');

    const isTimeout = /Timeout\s+\d+ms\s+exceeded/i.test(cleaned);
    if (isTimeout) {
      const locator = this.extractLocatorInfo(rawError);
      if (locator) {
        const name = locator.testId || locator.selector;
        const type = locator.elementType || '元素';
        return `页面未找到「${name}」${type}，该功能可能未实现`;
      }
    }

    const firstLine = cleaned.split('\n')[0].trim();
    return firstLine
      .replace(/^❌\s*/, '')
      .replace(/^Execution failed:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim() || '未知错误';
  }

  /**
   * Determine whether a test failure is a test-environment / data issue rather than a product bug.
   */
  private isTestEnvIssue(errorDescription: string): boolean {
    const envKeywords = ['不足', '无法执行', '测试数据', '测试环境', '未配置', '连接失败', 'ERR_CONNECTION_REFUSED'];
    return envKeywords.some((kw) => errorDescription.includes(kw));
  }

  /**
   * Extract a readable test case name from the testCaseId.
   * e.g. "playwright-test-TC-ModeConfig-001-老师为单台设备设置默认自主学习模式"
   *   -> "TC-ModeConfig-001 老师为单台设备设置默认自主学习模式"
   */
  private extractReadableCaseName(testCaseId: string): string {
    const withoutPrefix = testCaseId.replace(/^playwright-test-/, '');
    // Split on the first Chinese char boundary: keep TC-XXX-NNN as ID, rest as description
    const match = withoutPrefix.match(/^(TC-[A-Za-z]+-\d+)-(.+)$/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    return withoutPrefix;
  }

  /**
   * Generate a structured Markdown bug report for the Engineer.
   * Only product defects are listed as actionable bugs; test-env issues are separated.
   * Embeds assertion summary when available to reduce token usage.
   */
  private async generateBugReport(summary: any, results: TestCaseExecutionResult[], _reportDir: string): Promise<string> {
    interface BugEntry {
      caseName: string;
      caseDescription: string;
      description: string;
      selector?: string;
      screenshotFail?: string;
      logEmbed?: TestCaseExecutionResult['logEmbed'];
      summaryEmbed?: string;
      rawError: string;
    }

    const failedResults = results.filter((r) => !r.success && r.error);
    const productBugs: BugEntry[] = [];
    const envIssues: { caseName: string; description: string }[] = [];

    for (const r of failedResults) {
      const description = this.extractErrorDescription(r.error!);
      const caseName = this.extractReadableCaseName(r.testCaseId);
      const locator = this.extractLocatorInfo(r.error!);

      const descMatch = caseName.match(/^TC-[A-Za-z]+-\d+\s+(.+)$/);
      const caseDescription = descMatch ? descMatch[1] : caseName;

      if (this.isTestEnvIssue(description)) {
        envIssues.push({ caseName, description });
      } else {
        let summaryEmbed: string | undefined;
        if (r.logEmbed) {
          const parts: string[] = [];
          if (r.logEmbed.consoleErrors?.length) {
            parts.push(`Console: ${r.logEmbed.consoleErrors.slice(0, 3).join(' | ')}`);
          }
          if (r.logEmbed.network?.length) {
            parts.push(`Network: ${r.logEmbed.network.map((n) => `${n.api}:${n.status}`).join(', ')}`);
          }
          if (parts.length > 0) summaryEmbed = parts.join(' | ');
        }
        productBugs.push({
          caseName,
          caseDescription,
          description,
          selector: locator?.selector,
          screenshotFail: r.screenshotFail,
          logEmbed: r.logEmbed,
          summaryEmbed,
          rawError: r.error!,
        });
      }
    }

    const lines: string[] = [];
    lines.push('# 自动化测试发现的产品缺陷');
    lines.push('');
    lines.push('> 以下问题由自动化测试发现，请修复**应用代码**中的对应问题。');
    lines.push('> **禁止修改测试脚本**（docs/test/auto/ 目录下的文件不在修改范围内）。');
    lines.push('');
    lines.push('## 测试概览');
    lines.push('');
    lines.push(`- 总用例: ${summary.total} | 通过: ${summary.passed} | 失败: ${summary.failed}`);
    lines.push('');

    if (productBugs.length > 0) {
      lines.push('## 产品缺陷');
      lines.push('');
      productBugs.forEach((bug, idx) => {
        lines.push(`### Bug ${idx + 1}: ${bug.description}`);
        lines.push('');
        lines.push(`- **用例**: ${bug.caseName}`);
        lines.push(`- **现象**: ${bug.description}`);
        lines.push(`- **预期行为**: ${bug.caseDescription}`);
        if (bug.selector) {
          lines.push(`- **定位线索**: \`${bug.selector}\``);
        }
        lines.push(`- **修复方向**: 请检查该功能是否已实现，确认对应组件是否渲染到页面中`);
        if (bug.screenshotFail) {
          lines.push('');
          lines.push('- **失败截图**:');
          lines.push('');
          lines.push(`![失败截图](../test/report/${bug.screenshotFail})`);
        }
        if (bug.summaryEmbed) {
          lines.push('- **断言摘要**（优先参考，减少 token）:');
          lines.push('```');
          lines.push(bug.summaryEmbed);
          lines.push('```');
        }
        if (bug.logEmbed && (bug.logEmbed.consoleErrors?.length || bug.logEmbed.network?.length)) {
          const parts: string[] = [];
          if (bug.logEmbed.consoleErrors?.length) parts.push('Console: ' + bug.logEmbed.consoleErrors.slice(0, 2).join('; '));
          if (bug.logEmbed.network?.length) parts.push('Network: ' + bug.logEmbed.network.map((n) => `${n.api}:${n.status}`).join(', '));
          lines.push('- **日志**: ' + parts.join(' | '));
        }
        lines.push('');
      });
    } else {
      lines.push('## 产品缺陷');
      lines.push('');
      lines.push('无产品缺陷（所有失败均为测试环境问题）。');
      lines.push('');
    }

    if (envIssues.length > 0) {
      lines.push('## 测试环境问题（无需修复代码）');
      lines.push('');
      envIssues.forEach((issue) => {
        lines.push(`- ${issue.caseName}: ${issue.description}`);
      });
      lines.push('');
    }

    return lines.join('\n');
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
        .screenshot-details {
            background: #f0f4f8;
            border-left: 4px solid #0d6efd;
            padding: 12px;
            margin-top: 5px;
            border-radius: 4px;
            font-size: 13px;
        }
        .screenshot-details img {
            max-width: 100%;
            max-height: 400px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            margin-top: 8px;
            display: block;
        }
        .screenshot-details .screenshot-label {
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
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

      // For failed tests: show error and screenshot first (more prominent)
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

      if (result.screenshotFail) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="screenshot-details">
                            <strong>📷 执行失败时页面截图</strong>
                            <div class="screenshot-label" style="margin-top: 8px;">执行失败时:</div>
                            <img src="${this.escapeHtml(result.screenshotFail)}" alt="失败截图" />
                        </div>
                    </td>
                </tr>`;
      }

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

      // Show page screenshot(s) in detailed results (success only; fail already shown above for failed cases)
      if (result.screenshotSuccess) {
        html += `
                <tr>
                    <td colspan="6">
                        <div class="screenshot-details">
                            <strong>📷 页面截图</strong>
                            <div class="screenshot-label">执行成功时:</div>
                            <img src="${this.escapeHtml(result.screenshotSuccess)}" alt="成功截图" />
                        </div>
                    </td>
                </tr>`;
      }

      // Assertion info: summary (preferred), DOM snapshot, console log, network log, test data
      if (result.logEmbed && (result.logEmbed.consoleErrors?.length || result.logEmbed.network?.length)) {
        const parts: string[] = [];
        if (result.logEmbed.selector) parts.push('selector: ' + this.escapeHtml(result.logEmbed.selector));
        if (result.logEmbed.actual) parts.push('actual: ' + this.escapeHtml(result.logEmbed.actual));
        if (result.logEmbed.consoleErrors?.length) parts.push('console: ' + result.logEmbed.consoleErrors.slice(0, 2).join('; '));
        if (result.logEmbed.network?.length) parts.push('network: ' + result.logEmbed.network.map((n) => `${n.api}:${n.status}`).join(', '));
        html += `
                <tr>
                    <td colspan="6">
                        <div class="assertion-details" style="background: #f8f9fa; padding: 12px; border-radius: 4px;">
                            <strong>📋 日志</strong>
                            <div style="margin-top: 8px; font-size: 12px;">${parts.join(' | ')}</div>
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
