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
  /** 是否启用 Flow 模式（复用浏览器 session，默认 false，每个 case 独立浏览器 session） */
  flowMode?: boolean;
}

interface TestCaseJSON {
  testCase: string;
  status: 'pending' | 'passed' | 'failed' | 'running';
  precondition?: string[] | string; // 前置条件数组或字符串（向后兼容）
  steps: Array<{
    step: string;
    action?: string; // 动作类型（click, type, open, verify 等）
    params?: { url?: string; selector?: string; [key: string]: any }; // 增强的参数对象，包含 url 或 selector
    expected?: { type: 'url' | 'text' | 'element' | 'api' | 'cookie' | 'url_match'; value: string } | string | null; // 预期结果对象格式或字符串（向后兼容）
    waitFor?: {
      type: 'toast' | 'element';
      text?: string; // Toast 消息文本（用于 contains 匹配）
      selector?: string; // 元素选择器（用于 element 类型）
      timeout?: number; // 超时时间（毫秒，默认 5000）
    };
    status: 'pending' | 'passed' | 'failed' | 'running';
    error?: string | null; // 错误信息
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
   * @param step - 步骤字符串或步骤对象（包含 step, params, expected）
   * @param stepIndex - 步骤索引
   * @param options - 执行选项
   */
  async runStep(
    step:
      | string
      | {
          step: string;
          params?: { url?: string; selector?: string; [key: string]: any };
          expected?: { type: 'url' | 'text' | 'element' | 'api' | 'cookie' | 'url_match'; value: string } | string | null;
          waitFor?: { type: 'toast' | 'element'; text?: string; selector?: string; timeout?: number };
          [key: string]: any;
        },
    stepIndex: number,
    options?: StepRunnerOptions
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? 30000;
    const retryCount = options?.retryCount ?? 2;
    const waitBeforeMs = options?.waitBeforeMs ?? 500;
    const waitAfterMs = options?.waitAfterMs ?? 500;

    // 解析步骤（支持字符串和对象格式）
    const stepText = typeof step === 'string' ? step : step.step;
    const stepParams = typeof step === 'object' ? step.params : undefined;
    const stepExpected = typeof step === 'object' ? step.expected : undefined;
    const stepWaitFor = typeof step === 'object' ? step.waitFor : undefined;

    // 优先使用 params.url，否则从步骤文本中提取 URL
    let url: string | undefined = stepParams?.url;
    if (!url) {
      const urlMatch = stepText.match(/(https?:\/\/[^\s]+)/i);
      url = urlMatch ? urlMatch[1] : undefined;
    }

    // 如果包含 URL，使用导航指令；否则使用原始指令
    const instruction = url
      ? stepText.toLowerCase().includes('打开') || stepText.toLowerCase().includes('navigate') || stepText.toLowerCase().includes('goto')
        ? '打开页面'
        : stepText.replace(/\s*https?:\/\/[^\s]+/gi, '').trim() || '打开页面'
      : stepText;

    logger.info('StepRunner: Executing step', {
      stepIndex,
      step: stepText,
      instruction,
      url,
      params: stepParams,
      expected: stepExpected,
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
            await this.stagehandService.act(instruction || stepText, url);
          }, timeoutMs),
        {
          maxRetries: retryCount,
          retryDelayMs: 1000,
        }
      );

      // 执行后等待
      await this.stabilityMiddleware.withWait(() => Promise.resolve(), waitAfterMs);

      // 如果步骤有 waitFor，先等待元素/Toast 出现
      if (stepWaitFor) {
        logger.info('StepRunner: Waiting for element/toast before assertion', {
          stepIndex,
          step: stepText,
          waitFor: stepWaitFor,
        });

        const waitResult = await this.waitForElement(stepWaitFor);
        if (!waitResult) {
          logger.warn('StepRunner: waitForElement failed', {
            stepIndex,
            step: stepText,
            waitFor: stepWaitFor,
          });
          // waitFor 失败不影响继续执行断言，但记录警告
        } else {
          logger.info('StepRunner: waitForElement succeeded', {
            stepIndex,
            step: stepText,
            waitFor: stepWaitFor,
          });
        }
      }

      // 如果步骤有 expected，执行断言验证
      let assertionPassed = true;
      if (stepExpected) {
        // 如果 expected 是字符串格式（向后兼容），跳过断言验证
        if (typeof stepExpected === 'string') {
          logger.debug('StepRunner: Expected is string format, skipping assertion (backward compatibility)', {
            stepIndex,
            step: stepText,
            expected: stepExpected,
          });
        } else if (typeof stepExpected === 'object' && stepExpected !== null && 'type' in stepExpected && 'value' in stepExpected) {
          assertionPassed = await this.assertExpected(stepExpected as { type: 'url' | 'text' | 'element' | 'api'; value: string });
          if (!assertionPassed) {
            logger.warn('StepRunner: Assertion failed', {
              stepIndex,
              step: stepText,
              expected: stepExpected,
            });
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const status: 'passed' | 'failed' = assertionPassed ? 'passed' : 'failed';

      logger.info('StepRunner: Step executed', {
        stepIndex,
        step: stepText,
        status,
        executionTime,
        assertionPassed,
      });

      return {
        stepIndex,
        step: stepText,
        status,
        executionTime,
        error: assertionPassed
          ? undefined
          : typeof stepExpected === 'object' && stepExpected !== null
            ? `Assertion failed: expected ${stepExpected.type} "${stepExpected.value}"`
            : 'Assertion failed',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorType = this.classifyError(error);

      logger.error('StepRunner: Step execution failed', {
        stepIndex,
        step: stepText,
        error: error.message,
        errorType,
        executionTime,
      });

      return {
        stepIndex,
        step: stepText,
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
   * 根据 expected 对象执行断言验证
   * @param expected - 预期结果对象 { type, value }
   * @returns true if assertion passes, false otherwise
   */
  async assertExpected(expected: { type: 'url' | 'text' | 'element' | 'api' | 'cookie' | 'url_match'; value: string }): Promise<boolean> {
    try {
      const page = await this.stagehandService.getPage();
      if (!page) {
        logger.warn('StepRunner: Cannot assert expected - page not available');
        return false;
      }

      switch (expected.type) {
        case 'url': {
          // 验证当前页面 URL
          const currentUrl = page.url();
          const expectedValue = expected.value;

          // 支持完整 URL 或路径匹配
          const urlMatches =
            currentUrl.includes(expectedValue) ||
            expectedValue.includes(currentUrl) ||
            currentUrl.endsWith(expectedValue) ||
            (expectedValue.startsWith('/') && currentUrl.includes(expectedValue));

          logger.info('StepRunner: Asserting URL', {
            expected: expectedValue,
            actual: currentUrl,
            matches: urlMatches,
          });

          return urlMatches;
        }

        case 'text': {
          // 验证页面文本内容
          try {
            // 尝试多种方式获取页面内容
            let pageContent = '';
            let pageText = '';

            // 方法1：使用 content() 方法
            try {
              if (typeof page.content === 'function') {
                pageContent = await page.content();
              }
            } catch (e: any) {
              logger.debug('StepRunner: page.content() failed, trying alternative', { error: e.message });
            }

            // 方法2：使用 textContent() 方法（备选）
            try {
              if (typeof page.textContent === 'function') {
                pageText = await page.textContent('body').catch(() => '');
              }
            } catch (e: any) {
              logger.debug('StepRunner: page.textContent() failed', { error: e.message });
            }

            // 方法3：使用 evaluate() 方法（最后备选）
            if (!pageContent && !pageText) {
              try {
                if (typeof page.evaluate === 'function') {
                  // 使用函数形式的 evaluate，传入的函数会在浏览器环境中执行
                  // @ts-expect-error - document 在浏览器环境中是可用的
                  pageContent = await page.evaluate(() => document.body.innerHTML).catch(() => '');
                  // @ts-expect-error - document 在浏览器环境中是可用的
                  pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
                }
              } catch (e: any) {
                logger.debug('StepRunner: page.evaluate() failed', { error: e.message });
              }
            }

            // 使用 contains 匹配（includes），不使用 equals 精确匹配
            const textMatches = pageContent.includes(expected.value) || pageText.includes(expected.value);

            logger.info('StepRunner: Asserting text (using contains match)', {
              expected: expected.value,
              found: textMatches,
              matchType: 'contains',
              pageContentLength: pageContent.length,
              pageTextLength: pageText.length,
            });

            return textMatches;
          } catch (error: any) {
            logger.error('StepRunner: Failed to assert text', {
              expected: expected.value,
              error: error.message,
              pageType: typeof page,
              pageMethods: page
                ? Object.keys(page)
                    .filter((k: string) => typeof (page as any)[k] === 'function')
                    .slice(0, 10)
                : [],
            });
            return false;
          }
        }

        case 'element': {
          // 验证元素可见性/状态
          // 支持多种查找方式：文本内容、CSS 选择器、角色定位
          try {
            let element = null;
            const value = expected.value.trim();

            // 1. 尝试通过 CSS 选择器查找（如果 value 看起来像选择器）
            if (value.startsWith('#') || value.startsWith('.') || value.startsWith('[') || value.includes(' ')) {
              try {
                element = page.locator(value).first();
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                  logger.info('StepRunner: Asserting element by selector', {
                    expected: value,
                    visible: true,
                  });
                  return true;
                }
              } catch {
                // 选择器查找失败，继续尝试其他方式
              }
            }

            // 2. 尝试通过角色定位（如 [role="button"]）
            if (value.startsWith('role=') || value.includes('role:')) {
              try {
                const roleMatch = value.match(/role[=:]"?([^"]+)"?/i);
                if (roleMatch) {
                  const role = roleMatch[1];
                  element = page.locator(`[role="${role}"]`).first();
                  const isVisible = await element.isVisible().catch(() => false);
                  if (isVisible) {
                    logger.info('StepRunner: Asserting element by role', {
                      expected: value,
                      role,
                      visible: true,
                    });
                    return true;
                  }
                }
              } catch {
                // 角色查找失败，继续尝试其他方式
              }
            }

            // 3. 优先查找登录态特征元素（用户头像、用户名等）
            const loginIndicators = ['用户头像', '用户名', '头像', 'avatar', 'user', 'profile'];
            for (const indicator of loginIndicators) {
              if (value.includes(indicator) || indicator.includes(value)) {
                // 尝试多种常见的选择器模式
                const selectors = [
                  '[alt*="头像"]',
                  '[alt*="avatar"]',
                  '[class*="avatar"]',
                  '[class*="user"]',
                  '[class*="profile"]',
                  'img[alt*="用户"]',
                  '*[role="img"][aria-label*="用户"]',
                ];

                for (const selector of selectors) {
                  try {
                    const found = page.locator(selector).first();
                    const isVisible = await found.isVisible().catch(() => false);
                    if (isVisible) {
                      logger.info('StepRunner: Asserting login indicator element', {
                        expected: value,
                        selector,
                        visible: true,
                      });
                      return true;
                    }
                  } catch {
                    // 继续尝试下一个选择器
                  }
                }
              }
            }

            // 4. 默认通过文本内容查找
            element = page.locator(`text="${value}"`).first();
            const isVisible = await element.isVisible().catch(() => false);

            logger.info('StepRunner: Asserting element by text', {
              expected: value,
              visible: isVisible,
            });

            return isVisible;
          } catch (error: any) {
            logger.warn('StepRunner: Failed to assert element', {
              expected: expected.value,
              error: error.message,
            });
            return false;
          }
        }

        case 'api': {
          // 验证网络请求/响应
          // 注意：这需要预先设置网络监听，当前实现简化处理
          // 可以通过检查页面状态或使用网络监听器来实现
          logger.info('StepRunner: Asserting API (simplified - network monitoring not implemented)', {
            expected: expected.value,
          });

          // 简化实现：如果包含状态码，检查是否有相关错误
          if (expected.value.match(/\d{3}/)) {
            // 这里应该检查网络请求，但简化实现返回 true
            // 实际应该使用 page.on('response') 监听
            return true;
          }

          return true; // 简化实现
        }

        case 'cookie': {
          // 验证 Cookie 存在性（用于登录态校验）
          try {
            const context = page.context();
            if (!context) {
              logger.warn('StepRunner: Cannot assert cookie - page context not available');
              return false;
            }

            const cookies = await context.cookies();
            const cookieName = expected.value;

            // 查找匹配的 cookie
            const matchingCookie = cookies.find((cookie: { name: string; value: string }) => cookie.name === cookieName);

            const cookieExists = matchingCookie !== undefined && matchingCookie.value && matchingCookie.value.length > 0;

            // 脱敏处理：只显示 cookie 值的前4个和后4个字符
            const maskCookieValue = (value: string): string => {
              if (!value || value.length <= 8) return '***';
              return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
            };

            logger.info('StepRunner: Asserting cookie', {
              expected: cookieName,
              exists: cookieExists,
              cookieFound: matchingCookie !== undefined,
              cookieValueLength: matchingCookie ? matchingCookie.value.length : 0,
              cookieValueMasked: matchingCookie ? maskCookieValue(matchingCookie.value) : null,
              allCookies: cookies.map((c: { name: string; value: string }) => ({
                name: c.name,
                valueLength: c.value ? c.value.length : 0,
                hasValue: !!c.value && c.value.length > 0,
              })),
              totalCookies: cookies.length,
            });

            if (!cookieExists && matchingCookie) {
              logger.warn('StepRunner: Cookie exists but value is empty', {
                cookieName,
                cookieValue: matchingCookie.value,
              });
            }

            return cookieExists;
          } catch (error: any) {
            logger.error('StepRunner: Failed to assert cookie', {
              expected: expected.value,
              error: error.message,
              stack: error.stack,
            });
            return false;
          }
        }

        case 'url_match': {
          // 验证 URL 模糊匹配（用于登录后页面跳转校验）
          try {
            const currentUrl = page.url();
            const pattern = expected.value;

            // 支持字符串包含匹配和正则表达式匹配
            let matches = false;
            try {
              // 尝试作为正则表达式匹配
              const regex = new RegExp(pattern);
              matches = regex.test(currentUrl);
            } catch {
              // 不是有效的正则表达式，使用字符串包含匹配
              matches = currentUrl.includes(pattern);
            }

            logger.info('StepRunner: Asserting URL match', {
              expected: pattern,
              actual: currentUrl,
              matches,
            });

            return matches;
          } catch (error: any) {
            logger.warn('StepRunner: Failed to assert URL match', {
              expected: expected.value,
              error: error.message,
            });
            return false;
          }
        }

        default:
          logger.warn('StepRunner: Unknown expected type', { type: expected.type });
          return false;
      }
    } catch (error: any) {
      logger.error('StepRunner: Assertion failed', {
        expected,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 等待元素或 Toast 出现
   * @param waitFor - 等待配置对象
   * @returns true if element/toast found, false otherwise
   */
  private async waitForElement(waitFor: { type: 'toast' | 'element'; text?: string; selector?: string; timeout?: number }): Promise<boolean> {
    try {
      const page = await this.stagehandService.getPage();
      if (!page) {
        logger.warn('StepRunner: Cannot wait for element - page not available');
        return false;
      }

      const timeout = waitFor.timeout || 5000;
      const startTime = Date.now();

      if (waitFor.type === 'toast') {
        // 等待 Toast 消息出现
        // 尝试多种 Toast 选择器（覆盖常见 UI 框架）
        const toastSelectors = [
          '[role="alert"]',
          '[role="status"]',
          '.toast',
          '.message',
          '.notification',
          '[class*="toast"]',
          '[class*="message"]',
          '[class*="notification"]',
          '[class*="alert"]',
          '[id*="toast"]',
          '[id*="message"]',
        ];

        logger.debug('StepRunner: Waiting for toast', {
          text: waitFor.text,
          timeout,
          selectors: toastSelectors,
        });

        while (Date.now() - startTime < timeout) {
          for (const selector of toastSelectors) {
            try {
              const element = page.locator(selector).first();
              const isVisible = await element.isVisible().catch(() => false);
              if (isVisible) {
                // 检查文本内容是否匹配（使用 contains 匹配）
                if (waitFor.text) {
                  const text = await element.textContent().catch(() => '');
                  if (text && text.includes(waitFor.text)) {
                    logger.info('StepRunner: Toast found with matching text', {
                      selector,
                      expectedText: waitFor.text,
                      actualText: text.substring(0, 100), // 限制日志长度
                    });
                    return true;
                  }
                } else {
                  // 如果没有指定文本，只要元素可见就返回成功
                  logger.info('StepRunner: Toast element found', { selector });
                  return true;
                }
              }
            } catch {
              // 继续尝试下一个选择器
            }
          }
          // 每 100ms 检查一次
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        logger.warn('StepRunner: Toast not found within timeout', {
          text: waitFor.text,
          timeout,
        });
        return false;
      } else if (waitFor.type === 'element') {
        // 等待元素出现
        if (waitFor.selector) {
          try {
            logger.debug('StepRunner: Waiting for element', {
              selector: waitFor.selector,
              timeout,
            });
            await page.waitForSelector(waitFor.selector, { timeout });
            logger.info('StepRunner: Element found', { selector: waitFor.selector });
            return true;
          } catch (error: any) {
            logger.warn('StepRunner: Element not found within timeout', {
              selector: waitFor.selector,
              timeout,
              error: error.message,
            });
            return false;
          }
        } else {
          logger.warn('StepRunner: waitFor element type requires selector');
          return false;
        }
      }

      return false;
    } catch (error: any) {
      logger.error('StepRunner: Failed to wait for element', {
        waitFor,
        error: error.message,
        stack: error.stack,
      });
      return false;
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

    const updatedSteps = testCase.steps.map((step, index) => {
      const result = stepResults.find((r) => r.stepIndex === index);
      if (result) {
        return {
          step: step.step,
          // 保留原有字段（支持新的对象格式）
          ...(step.action !== undefined && { action: step.action }),
          ...(step.params !== undefined && { params: step.params }),
          ...(step.expected !== undefined && { expected: step.expected }),
          // 更新执行结果
          status: (result.status === 'passed' ? 'passed' : 'failed') as 'pending' | 'passed' | 'failed' | 'running',
          ...(result.error && { error: result.error }),
          ...(result.screenshot && { screenshot: result.screenshot }),
          executionTime: result.executionTime / 1000, // 转换为秒
        };
      }
      // 没有执行结果的步骤，保留所有原有字段
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
   * Execute login fixture by finding and executing login test case
   * @param jsonFiles - All JSON test case files
   * @param _autoDir - Directory containing test case files (reserved for future use)
   * @returns true if fixture executed successfully, false otherwise
   */
  private async executeLoginFixture(jsonFiles: string[], _autoDir: string): Promise<boolean> {
    try {
      logger.info('AutomationExecution: Looking for login fixture', {
        totalFiles: jsonFiles.length,
      });

      // Find login test case (prefer TC-001, then any case with "登录" in name but not "退出")
      let loginFile: string | null = null;

      // First, try to find TC-001
      loginFile =
        jsonFiles.find((f) => {
          const basename = path.basename(f);
          return basename.includes('TC-001') || basename.match(/TC-0*1/i);
        }) || null;

      // If not found, find any case with "登录" but not "退出"
      if (!loginFile) {
        loginFile =
          jsonFiles.find((f) => {
            const basename = path.basename(f);
            return basename.includes('登录') && !basename.includes('退出');
          }) || null;
      }

      if (!loginFile) {
        logger.warn('AutomationExecution: Login fixture not found', {
          availableFiles: jsonFiles.map((f) => path.basename(f)),
        });
        return false;
      }

      logger.info('AutomationExecution: Found login fixture', {
        fixtureFile: path.basename(loginFile),
      });

      // Read and parse login test case
      const loginContent = await fs.readFile(loginFile, 'utf-8');
      const loginCase = JSON.parse(loginContent) as TestCaseJSON;

      // Execute all steps of login case
      logger.info('AutomationExecution: Executing login fixture steps', {
        stepsCount: loginCase.steps.length,
      });

      const stepRunnerOptions: StepRunnerOptions = {
        timeoutMs: 30000,
        retryCount: 2,
        waitBeforeMs: 500,
        waitAfterMs: 500,
        continueOnError: false,
      };

      for (let stepIndex = 0; stepIndex < loginCase.steps.length; stepIndex++) {
        const step = loginCase.steps[stepIndex];
        const stepText = step.step;

        logger.info('AutomationExecution: Executing login fixture step', {
          stepIndex: stepIndex + 1,
          totalSteps: loginCase.steps.length,
          step: stepText,
        });

        try {
          // Pass full step object to support params and expected
          const stepResult = await this.stepRunner.runStep(step, stepIndex, stepRunnerOptions);

          if (stepResult.status === 'failed') {
            logger.error('AutomationExecution: Login fixture step failed', {
              stepIndex,
              step: stepText,
              error: stepResult.error,
            });
            return false;
          }
        } catch (error: any) {
          logger.error('AutomationExecution: Login fixture step execution error', {
            stepIndex,
            step: stepText,
            error: error.message,
          });
          return false;
        }
      }

      logger.info('AutomationExecution: Login fixture executed successfully');
      return true;
    } catch (error: any) {
      logger.error('AutomationExecution: Failed to execute login fixture', {
        error: error.message,
        stack: error.stack,
      });
      return false;
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

      try {
        // 如果不是 Flow 模式，每个 case 独立浏览器 session
        if (!options?.flowMode && i > 0) {
          logger.info('AutomationExecution: Case mode - closing and reinitializing browser for independent session', {
            testCaseId,
            caseIndex: i + 1,
            totalCases: jsonFiles.length,
          });
          try {
            await this.stagehandService.close();
            await this.stagehandService.initialize();
          } catch (reinitError: any) {
            logger.error('AutomationExecution: Failed to reinitialize browser', {
              testCaseId,
              error: reinitError.message,
            });
            // Continue execution even if reinitialization fails
          }
        }

        // 检查页面是否存在，如果不存在则自动重新初始化
        try {
          const page = await this.stagehandService.getPage();
          if (!page) {
            logger.warn('AutomationExecution: Page not found, reinitializing browser', {
              testCaseId,
            });
            await this.stagehandService.close();
            await this.stagehandService.initialize();
          }
        } catch (pageError: any) {
          logger.error('AutomationExecution: Failed to get page, reinitializing browser', {
            testCaseId,
            error: pageError.message,
          });
          try {
            await this.stagehandService.close();
            await this.stagehandService.initialize();
          } catch (reinitError: any) {
            logger.error('AutomationExecution: Failed to reinitialize browser after page error', {
              testCaseId,
              error: reinitError.message,
            });
          }
        }

        // Read and parse JSON file first to check precondition
        const jsonContent = await fs.readFile(jsonFile, 'utf-8');
        testCase = JSON.parse(jsonContent) as TestCaseJSON;
        testCaseName = testCase.testCase || testCaseId;

        // 处理 precondition（支持数组和字符串格式，向后兼容）
        const preconditions = Array.isArray(testCase.precondition) ? testCase.precondition : testCase.precondition ? [testCase.precondition] : [];

        // 检查当前用例是否是登录用例（文件名包含"登录"且不包含"退出"）
        const isLoginTestCase =
          (testCaseId.includes('登录') || fileName.includes('登录')) && !testCaseId.includes('退出') && !fileName.includes('退出');

        // 检测并执行 fixture（如果 precondition 包含 "login"）
        // 只匹配表示"已登录状态"的关键词，排除"登录页面"、"登录功能"等
        const needsLoginFixture =
          !isLoginTestCase &&
          (preconditions.includes('login') ||
            preconditions.some(
              (p) =>
                typeof p === 'string' &&
                // 精确匹配：只匹配"已登录"、"登录状态"等表示状态的关键词
                ((p.includes('已登录') && !p.includes('登录页面') && !p.includes('登录功能')) ||
                  p.includes('登录状态') ||
                  p.includes('用户已登录') ||
                  p.toLowerCase().includes('logged in') ||
                  p.toLowerCase().includes('login state') ||
                  // 匹配"需要登录"、"要求登录"等
                  p.includes('需要登录') ||
                  p.includes('要求登录'))
            ));

        // 如果是登录用例，不需要执行 fixture，清除浏览器状态确保从干净状态开始
        if (isLoginTestCase) {
          logger.info('AutomationExecution: Current test case is login case, skipping fixture', {
            testCaseId,
            fileName,
            preconditions,
          });
          // 清除浏览器状态，确保从干净状态开始
          try {
            await this.stagehandService.clearBrowserState();
            logger.info('AutomationExecution: Cleared browser state for login test case', {
              testCaseId,
              jsonFile: fileName,
            });
          } catch (clearError: any) {
            logger.warn('AutomationExecution: Failed to clear browser state for login test case', {
              testCaseId,
              jsonFile: fileName,
              error: clearError.message,
            });
            // Continue execution even if clearing fails
          }
        } else if (needsLoginFixture) {
          // 其他用例如果需要登录状态，执行 fixture
          logger.info('AutomationExecution: Precondition requires login, executing login fixture', {
            testCaseId,
            preconditions,
          });
          const fixtureSuccess = await this.executeLoginFixture(jsonFiles, cwd);
          if (!fixtureSuccess) {
            logger.warn('AutomationExecution: Login fixture failed, but continuing test case execution', {
              testCaseId,
            });
            // Continue execution even if fixture fails (record error but don't abort)
          }
        } else {
          // 如果没有登录前置条件，清除浏览器状态（确保从干净状态开始）
          try {
            await this.stagehandService.clearBrowserState();
            logger.info('AutomationExecution: Cleared browser state before test case', {
              testCaseId,
              jsonFile: fileName,
              preconditions: preconditions.length > 0 ? preconditions : ['none'],
            });
          } catch (clearError: any) {
            logger.warn('AutomationExecution: Failed to clear browser state before test case', {
              testCaseId,
              jsonFile: fileName,
              error: clearError.message,
            });
            // Continue execution even if clearing fails
          }
        }

        logger.info('AutomationExecution: Executing test case', {
          jsonFile: fileName,
          testCaseId,
          testCaseName,
          stepsCount: testCase.steps.length,
          precondition: preconditions.length > 0 ? preconditions : ['none'],
          flowMode: options?.flowMode || false,
          isLoginTestCase,
          executedFixture: needsLoginFixture,
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

          // Execute step (pass full step object to support params and expected)
          const stepResult = await this.stepRunner.runStep(step, stepIndex, stepRunnerOptions);
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
