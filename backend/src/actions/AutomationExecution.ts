/**
 * AutomationExecution Action
 * Executes JSON format test cases from test/auto directory and generates HTML/JSON reports
 * Architecture: Step Runner + Result Collector + Stability Middleware
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { WorkspaceOptions, logger } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StagehandService } from '../services/StagehandService';

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
}

interface TestCaseJSON {
  testCase: string;
  status: 'pending' | 'passed' | 'failed' | 'running';
  steps: Array<{
    step: string;
    status: 'pending' | 'passed' | 'failed' | 'running';
    error?: string;
    screenshot?: string;
    executionTime?: number;
  }>;
  duration: number;
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

interface StepRunnerOptions {
  timeoutMs?: number;
  retryCount?: number;
  waitBeforeMs?: number;
  waitAfterMs?: number;
  continueOnError?: boolean;
}

interface RetryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Stability Middleware - 稳定性中间件
 * 提供等待、重试、超时控制等功能
 */
class StabilityMiddleware {
  /**
   * 带重试的执行
   */
  async withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const maxRetries = options?.maxRetries ?? 2;
    const retryDelayMs = options?.retryDelayMs ?? 1000;
    const shouldRetry = options?.shouldRetry ?? (() => true);

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries && shouldRetry(error)) {
          logger.info('StabilityMiddleware: Retrying after error', {
            attempt: attempt + 1,
            maxRetries,
            error: error.message,
          });
          await this.withWait(() => Promise.resolve(), retryDelayMs);
        } else {
          throw error;
        }
      }
    }
    throw lastError || new Error('Retry failed');
  }

  /**
   * 带超时的执行
   */
  async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Execution timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * 带等待的执行
   */
  async withWait(fn: () => Promise<void>, waitMs?: number): Promise<void> {
    if (waitMs && waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    await fn();
  }

  /**
   * 判断是否应该在错误后继续执行
   */
  shouldContinueOnError(_error: Error, _stepIndex: number, options?: { continueOnError?: boolean }): boolean {
    return options?.continueOnError === true;
  }
}

/**
 * Step Runner - 步骤执行器
 * 负责执行单个测试步骤，集成稳定性中间件
 */
class StepRunner {
  constructor(
    private stagehandService: StagehandService,
    private stabilityMiddleware: StabilityMiddleware
  ) {}

  /**
   * 执行单个步骤
   */
  async runStep(step: string, stepIndex: number, options?: StepRunnerOptions): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? 30000;
    const retryCount = options?.retryCount ?? 2;
    const waitBeforeMs = options?.waitBeforeMs ?? 500;
    const waitAfterMs = options?.waitAfterMs ?? 500;

    // 提取步骤中的 URL（如果存在）
    const urlMatch = step.match(/(https?:\/\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[1] : undefined;
    // 如果包含 URL，使用导航指令；否则使用原始指令
    // 对于导航操作，Stagehand 只需要 URL，指令可以简化
    const instruction = url
      ? step.toLowerCase().includes('打开') || step.toLowerCase().includes('navigate') || step.toLowerCase().includes('goto')
        ? '打开页面'
        : step.replace(/\s*https?:\/\/[^\s]+/gi, '').trim() || '打开页面'
      : step;

    logger.info('StepRunner: Executing step', {
      stepIndex,
      step,
      instruction,
      url,
      timeoutMs,
      retryCount,
    });

    try {
      // 执行前等待
      await this.stabilityMiddleware.withWait(() => Promise.resolve(), waitBeforeMs);

      // 带超时和重试的执行
      await this.stabilityMiddleware.withRetry(
        () =>
          this.stabilityMiddleware.withTimeout(async () => {
            // 如果步骤包含 URL，将 URL 作为单独参数传递
            await this.stagehandService.act(instruction || step, url);
          }, timeoutMs),
        {
          maxRetries: retryCount,
          retryDelayMs: 1000,
        }
      );

      // 执行后等待
      await this.stabilityMiddleware.withWait(() => Promise.resolve(), waitAfterMs);

      const executionTime = Date.now() - startTime;
      logger.info('StepRunner: Step executed successfully', {
        stepIndex,
        step,
        executionTime,
      });

      return {
        stepIndex,
        step,
        status: 'passed',
        executionTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorType = this.classifyError(error);

      logger.error('StepRunner: Step execution failed', {
        stepIndex,
        step,
        error: error.message,
        errorType,
        executionTime,
      });

      return {
        stepIndex,
        step,
        status: 'failed',
        executionTime,
        error: error.message,
        errorType,
        retryCount,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): 'initialization' | 'execution' | 'timeout' | 'zod_validation' | 'browser' | 'unknown' {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('zod') || errorMessage.includes('validation')) {
      return 'zod_validation';
    }
    if (errorMessage.includes('browser') || errorMessage.includes('page') || errorMessage.includes('element')) {
      return 'browser';
    }
    if (errorMessage.includes('initialization') || errorMessage.includes('init')) {
      return 'initialization';
    }
    return 'unknown';
  }
}

/**
 * Result Collector - 结果收集器
 * 负责收集执行结果并更新 JSON 文件
 */
class ResultCollector {
  /**
   * 收集步骤结果
   */
  collectStepResult(stepResult: StepExecutionResult): void {
    logger.debug('ResultCollector: Collected step result', {
      stepIndex: stepResult.stepIndex,
      status: stepResult.status,
      executionTime: stepResult.executionTime,
    });
  }

  /**
   * 收集测试用例结果
   */
  collectTestCaseResult(testCaseId: string, testCaseName: string, jsonFile: string, allStepResults: StepExecutionResult[]): TestCaseExecutionResult {
    const totalExecutionTime = allStepResults.reduce((sum, r) => sum + r.executionTime, 0);
    const success = allStepResults.every((r) => r.status === 'passed');
    const firstFailedStep = allStepResults.find((r) => r.status === 'failed');

    return {
      testCaseId,
      testCaseName,
      jsonFile,
      success,
      executionTime: totalExecutionTime,
      timestamp: new Date().toISOString(),
      steps: allStepResults,
      error: firstFailedStep?.error,
    };
  }

  /**
   * 生成结果 JSON 字符串
   */
  generateResultJSON(testCase: TestCaseJSON, stepResults: StepExecutionResult[]): string {
    const totalDuration = stepResults.reduce((sum, r) => sum + r.executionTime, 0) / 1000; // 转换为秒
    const allPassed = stepResults.every((r) => r.status === 'passed');
    const overallStatus: 'passed' | 'failed' = allPassed ? 'passed' : 'failed';

    const updatedSteps: Array<{
      step: string;
      status: 'pending' | 'passed' | 'failed' | 'running';
      error?: string;
      screenshot?: string;
      executionTime?: number;
    }> = testCase.steps.map((step, index) => {
      const result = stepResults.find((r) => r.stepIndex === index);
      if (result) {
        return {
          step: step.step,
          status: (result.status === 'passed' ? 'passed' : 'failed') as 'pending' | 'passed' | 'failed' | 'running',
          ...(result.error && { error: result.error }),
          ...(result.screenshot && { screenshot: result.screenshot }),
          executionTime: result.executionTime / 1000, // 转换为秒
        };
      }
      return step;
    });

    const resultJSON: TestCaseJSON = {
      testCase: testCase.testCase,
      status: overallStatus as 'pending' | 'passed' | 'failed' | 'running',
      steps: updatedSteps,
      duration: totalDuration,
    };

    return JSON.stringify(resultJSON, null, 2);
  }

  /**
   * 更新 JSON 文件
   */
  async updateJSONFile(jsonFile: string, resultJSON: string): Promise<void> {
    try {
      await fs.writeFile(jsonFile, resultJSON, 'utf-8');
      logger.info('ResultCollector: Updated JSON file', {
        jsonFile: path.basename(jsonFile),
      });
    } catch (error: any) {
      logger.error('ResultCollector: Failed to update JSON file', {
        jsonFile,
        error: error.message,
      });
      throw error;
    }
  }
}

export class AutomationExecution extends BaseAction {
  private stagehandService: StagehandService;
  private stabilityMiddleware: StabilityMiddleware;
  private stepRunner: StepRunner;
  private resultCollector: ResultCollector;

  constructor() {
    super('AutomationExecution', 'Execute JSON format test cases from test/auto directory and generate HTML/JSON reports');
    this.stagehandService = new StagehandService();
    this.stabilityMiddleware = new StabilityMiddleware();
    this.stepRunner = new StepRunner(this.stagehandService, this.stabilityMiddleware);
    this.resultCollector = new ResultCollector();
  }

  /**
   * Check Stagehand environment status before execution
   * Validates browser automation configuration and API keys
   */
  private checkStagehandEnvironment(): void {
    const envStatus = {
      browserEnabled: process.env.ENABLE_BROWSER === 'true',
      hasOpenAIApiKey: !!process.env.OPENAI_API_KEY,
      hasZhipuAIApiKey: !!process.env.ZHIPUAI_API_KEY || !!process.env.ZHIPU_API_KEY,
      stagehandModel: process.env.STAGEHAND_MODEL || process.env.OPENAI_MODEL || process.env.ZHIPUAI_MODEL || 'not set',
      stagehandEnv: process.env.STAGEHAND_ENV || 'LOCAL',
      stagehandHeadless: process.env.STAGEHAND_HEADLESS === 'true',
      stagehandVerbose: process.env.STAGEHAND_VERBOSE || '0',
    };

    logger.info('AutomationExecution: Stagehand environment check', envStatus);

    // Warn if browser automation is disabled
    if (!envStatus.browserEnabled) {
      logger.warn('AutomationExecution: Browser automation is disabled (ENABLE_BROWSER !== true). Scripts may run in placeholder mode.');
    }

    // Warn if no API key is configured
    if (!envStatus.hasOpenAIApiKey && !envStatus.hasZhipuAIApiKey) {
      logger.warn('AutomationExecution: No LLM API key found (OPENAI_API_KEY or ZHIPUAI_API_KEY). Stagehand may fail to initialize.');
    }

    // Log configuration summary
    const apiProvider = envStatus.hasOpenAIApiKey ? 'OpenAI' : envStatus.hasZhipuAIApiKey ? 'ZhipuAI' : 'None';
    logger.info('AutomationExecution: Stagehand configuration summary', {
      apiProvider,
      model: envStatus.stagehandModel,
      environment: envStatus.stagehandEnv,
      headless: envStatus.stagehandHeadless,
      verbose: envStatus.stagehandVerbose,
    });
  }

  async run(_input: string, options?: AutomationExecutionOptions): Promise<IActionOutput> {
    logger.info('AutomationExecution: Starting automation execution from JSON test case files');

    // 强制开启浏览器有头模式（确保用户能看到浏览器窗口）
    const wasHeadless = process.env.STAGEHAND_HEADLESS === 'true';
    if (wasHeadless) {
      logger.warn('AutomationExecution: STAGEHAND_HEADLESS was set to true, forcing headless=false for visible browser window');
    }
    // 如果用户没有明确禁用浏览器窗口，强制设置为有头模式
    if (options?.showBrowserWindow !== false) {
      process.env.STAGEHAND_HEADLESS = 'false'; // 强制有头模式
      logger.info('AutomationExecution: Browser will run in HEADED mode (visible window)', {
        previousHeadless: wasHeadless,
        currentHeadless: false,
        message: '浏览器窗口将可见，请观察执行过程',
      });
    }

    // Check Stagehand environment status before execution
    this.checkStagehandEnvironment();

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

      // Read all JSON test case files from auto directory
      const testCaseFiles = await this.findTestCaseFiles(autoDir);
      if (testCaseFiles.length === 0) {
        logger.warn('AutomationExecution: No test case JSON files found in auto directory', {
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
          content: 'test/auto 目录中未找到测试用例 JSON 文件，已生成空报告。请先运行 AutomationPlanning 生成测试用例 JSON 文件后重新执行。',
          data: {
            type: 'automation_execution',
            skipped: true,
            reason: 'No test case JSON files found',
            timestamp: new Date().toISOString(),
            workspaceDir,
            reportDir,
          },
        };
      }

      logger.info('AutomationExecution: Found test case JSON files', {
        fileCount: testCaseFiles.length,
        files: testCaseFiles.map((f) => path.basename(f)),
      });

      // Initialize Stagehand service
      await this.stagehandService.initialize();

      // Execute all test case files
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
        // Even if execution fails, create empty results to generate report
        results = [];
      } finally {
        // 延迟关闭浏览器，让用户有时间观察
        const keepOpenMs = options?.keepBrowserOpenMs ?? 5000;
        if (keepOpenMs > 0) {
          logger.info(`AutomationExecution: Keeping browser open for ${keepOpenMs}ms for observation`, {
            keepOpenMs,
            message: `浏览器将在 ${(keepOpenMs / 1000).toFixed(1)} 秒后关闭，请观察执行结果`,
          });
          await new Promise((resolve) => setTimeout(resolve, keepOpenMs));
        }

        // Cleanup Stagehand service
        try {
          await this.stagehandService.close();
          logger.info('AutomationExecution: Stagehand service closed successfully');
        } catch (closeError: any) {
          logger.warn('AutomationExecution: Failed to close Stagehand service', {
            error: closeError.message,
          });
        }
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
   * Find all JSON test case files in the auto directory
   */
  private async findTestCaseFiles(autoDir: string): Promise<string[]> {
    try {
      logger.info('AutomationExecution: Reading auto directory', { autoDir });
      const entries = await fs.readdir(autoDir, { withFileTypes: true });
      logger.info('AutomationExecution: Found entries in auto directory', {
        totalEntries: entries.length,
        entryNames: entries.map((e) => e.name),
      });

      const jsonFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => path.join(autoDir, entry.name))
        .sort();

      logger.info('AutomationExecution: Filtered JSON test case files', {
        fileCount: jsonFiles.length,
        files: jsonFiles.map((f) => path.basename(f)),
      });

      return jsonFiles;
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
   * Execute all test case JSON files and collect results
   */
  private async executeTestCaseFiles(jsonFiles: string[], cwd: string, options?: AutomationExecutionOptions): Promise<TestCaseExecutionResult[]> {
    const results: TestCaseExecutionResult[] = [];

    logger.info('AutomationExecution: Starting to execute test case JSON files', {
      totalFiles: jsonFiles.length,
      cwd,
    });

    for (let i = 0; i < jsonFiles.length; i++) {
      const jsonFile = jsonFiles[i];
      const startTime = Date.now();
      const fileName = path.basename(jsonFile);

      // Extract test case ID from file name (e.g., TC-001-xxx.json -> TC-001-xxx)
      const testCaseId = fileName.replace('.json', '');
      let testCaseName = testCaseId;
      let testCase: TestCaseJSON | null = null;

      // Clear browser state before executing each test case
      // This ensures each test case starts from a clean state (no cookies, no localStorage)
      try {
        await this.stagehandService.clearBrowserState();
        logger.info('AutomationExecution: Cleared browser state before test case', {
          testCaseId,
          jsonFile: fileName,
        });
      } catch (clearError: any) {
        logger.warn('AutomationExecution: Failed to clear browser state before test case', {
          testCaseId,
          jsonFile: fileName,
          error: clearError.message,
        });
        // Continue execution even if clearing fails
      }

      try {
        // Read and parse JSON file
        const jsonContent = await fs.readFile(jsonFile, 'utf-8');
        testCase = JSON.parse(jsonContent) as TestCaseJSON;
        testCaseName = testCase.testCase || testCaseId;

        logger.info('AutomationExecution: Executing test case', {
          jsonFile: fileName,
          testCaseId,
          testCaseName,
          stepsCount: testCase.steps.length,
        });

        // Execute all steps using StepRunner
        const stepResults: StepExecutionResult[] = [];
        const stepRunnerOptions: StepRunnerOptions = {
          timeoutMs: options?.stepTimeoutMs,
          retryCount: options?.maxRetryCount,
          waitBeforeMs: options?.waitBeforeMs,
          waitAfterMs: options?.waitAfterMs,
          continueOnError: options?.continueOnError,
        };

        for (let stepIndex = 0; stepIndex < testCase.steps.length; stepIndex++) {
          const step = testCase.steps[stepIndex];
          const stepText = step.step;

          // Update step status to running
          testCase.steps[stepIndex].status = 'running';

          // Execute step
          const stepResult = await this.stepRunner.runStep(stepText, stepIndex, stepRunnerOptions);
          stepResults.push(stepResult);

          // Collect step result
          this.resultCollector.collectStepResult(stepResult);

          // Check if we should continue on error
          if (stepResult.status === 'failed' && !options?.continueOnError) {
            logger.warn('AutomationExecution: Step failed, stopping execution', {
              testCaseId,
              stepIndex,
              step: stepText,
            });
            break;
          }
        }

        // Collect test case result
        const testCaseResult = this.resultCollector.collectTestCaseResult(testCaseId, testCaseName, jsonFile, stepResults);

        // Generate updated JSON with results
        const updatedJSON = this.resultCollector.generateResultJSON(testCase, stepResults);

        // Update JSON file with results
        await this.resultCollector.updateJSONFile(jsonFile, updatedJSON);

        results.push(testCaseResult);

        logger.info('AutomationExecution: Test case execution completed', {
          jsonFile: fileName,
          testCaseId,
          success: testCaseResult.success,
          executionTime: testCaseResult.executionTime,
          stepsPassed: stepResults.filter((r) => r.status === 'passed').length,
          stepsFailed: stepResults.filter((r) => r.status === 'failed').length,
        });
      } catch (error: any) {
        const executionTime = Date.now() - startTime;
        logger.error('AutomationExecution: Failed to execute test case', {
          jsonFile: fileName,
          testCaseId,
          error: error.message,
          executionTime,
        });

        results.push({
          testCaseId,
          testCaseName,
          jsonFile,
          success: false,
          executionTime,
          timestamp: new Date().toISOString(),
          steps: [],
          error: error.message,
        });
      }
    }

    logger.info('AutomationExecution: Completed executing all test case JSON files', {
      totalFiles: jsonFiles.length,
      resultsCount: results.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
    });

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
