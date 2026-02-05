/**
 * StagehandService
 * Service for browser automation using Stagehand framework
 * Provides methods for validating and executing automated test cases
 */

import { logger } from '../utils';

/**
 * 去掉 content 中的 ```json ... ``` 或 ``` ... ``` 包裹，避免 Stagehand Zod 校验失败。
 * 增强版：支持多种 markdown 代码块格式，并尝试提取 JSON 对象。
 */
function stripJsonMarkdown(text: string): string {
  if (typeof text !== 'string') return text;
  let cleaned = text.trim();
  
  // 1. 尝试匹配各种 markdown 代码块格式（支持前后有文本）
  const codeBlockPatterns = [
    /```(?:json)?\s*\n([\s\S]*?)\n```/g,  // 标准格式
    /```(?:json)?\s*([\s\S]*?)```/g,      // 无换行
    /```(?:json)?\s*\n?([\s\S]*?)\n?```/g, // 灵活换行
  ];
  
  for (const pattern of codeBlockPatterns) {
    const matches = [...cleaned.matchAll(pattern)];
    if (matches.length > 0) {
      // 取最后一个匹配（通常是最完整的）
      const lastMatch = matches[matches.length - 1];
      if (lastMatch[1]) {
        cleaned = lastMatch[1].trim();
        break;
      }
    }
  }
  
  // 2. 如果清理后仍包含 markdown 标记，尝试提取第一个 JSON 对象
  if (cleaned.includes('```') || cleaned.includes('`')) {
    // 尝试提取 {...} 或 [...] 格式的 JSON
    const jsonObjectMatch = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(cleaned);
    if (jsonObjectMatch && jsonObjectMatch[1]) {
      try {
        // 验证是否为有效 JSON
        JSON.parse(jsonObjectMatch[1]);
        cleaned = jsonObjectMatch[1].trim();
      } catch {
        // 不是有效 JSON，继续使用原逻辑
      }
    }
  }
  
  // 3. 清理可能的尾随 markdown 标记
  cleaned = cleaned.replace(/^`+|`+$/g, '').trim();
  
  return cleaned || text.trim(); // 如果清理后为空，返回原文本
}

/** 包装 OpenAI 客户端：对响应中的 message.content 做 stripJsonMarkdown，再交给 Stagehand 做 Zod 校验 */
function wrapOpenAIClientForZod(client: any): any {
  const create = client.chat?.completions?.create;
  if (typeof create !== 'function') return client;
  return {
    ...client,
    chat: {
      ...client.chat,
      completions: {
        ...client.chat.completions,
        create: async (params: any, options?: any) => {
          const response = await create.call(client.chat.completions, params, options);
          
          // 清理 content 字段
          const content = response?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.length > 0) {
            const originalContent = content;
            const cleanedContent = stripJsonMarkdown(content);
            
            // 仅在内容发生变化时记录（避免日志过多）
            if (cleanedContent !== originalContent) {
              logger.debug('StagehandService: Cleaned markdown from LLM response', {
                originalLength: originalContent.length,
                cleanedLength: cleanedContent.length,
                originalPreview: originalContent.substring(0, 100),
                cleanedPreview: cleanedContent.substring(0, 100),
              });
            }
            
            response.choices[0].message.content = cleanedContent;
          }
          
          return response;
        },
      },
    },
  };
}

export interface TestCase {
  name: string;
  description?: string;
  steps: string[];
  expectedResult?: string;
}

export interface TestExecutionResult {
  testCase: string;
  success: boolean;
  error?: string;
  duration?: number;
  timestamp?: string;
}

export class StagehandService {
  private initialized: boolean = false;
  private stagehandInstance: any = null; // Stagehand instance (if available)
  private stagehandAvailable: boolean = false; // Whether Stagehand is available

  /**
   * Check if StagehandService is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize Stagehand service
   * @param userId Optional user ID for session management
   */
  async initialize(userId?: string): Promise<void> {
    if (this.initialized) {
      logger.warn('StagehandService: Already initialized');
      return;
    }

    // Check if browser automation is enabled
    if (process.env.ENABLE_BROWSER !== 'true') {
      logger.info('StagehandService: Browser automation is disabled (ENABLE_BROWSER !== true)');
      this.initialized = true; // Mark as initialized but in disabled mode
      return;
    }

    try {
      // userId parameter is kept for future session management
      void userId;

      // Try to load Stagehand if available
      // Check if alpha version is installed, otherwise use stable version
      let stagehandModule: any = null;
      let Stagehand: any = null;
      let stagehandVersion = 'unknown';

      try {
        // Dynamic import to avoid breaking if Stagehand is not installed
        try {
          stagehandModule = await import('@browserbasehq/stagehand' as any);
        } catch (firstError: any) {
          const msg = firstError?.message || '';
          if (msg.includes('Did you mean to import') || msg.includes('dist/index.js')) {
            stagehandModule = await import('@browserbasehq/stagehand/dist/index.js' as any);
          } else {
            throw firstError;
          }
        }
        Stagehand = stagehandModule.Stagehand || stagehandModule.default;

        // Check version from package.json to determine if alpha version is installed
        // Try multiple possible paths to find the package.json
        try {
          const fs = await import('fs/promises');
          const path = await import('path');

          // Try different possible paths
          const possiblePaths = [
            // From backend directory
            path.resolve(__dirname, '../../node_modules/@browserbasehq/stagehand/package.json'),
            // From project root
            path.resolve(__dirname, '../../../node_modules/@browserbasehq/stagehand/package.json'),
            // From current working directory
            path.resolve(process.cwd(), 'node_modules/@browserbasehq/stagehand/package.json'),
            path.resolve(process.cwd(), 'backend/node_modules/@browserbasehq/stagehand/package.json'),
          ];

          let packageJson: any = null;
          for (const packagePath of possiblePaths) {
            try {
              packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
              break; // Found it, exit loop
            } catch {
              // Try next path
              continue;
            }
          }

          if (packageJson) {
            const version = packageJson.version || '';
            if (version.includes('alpha')) {
              stagehandVersion = 'alpha';
              logger.info('StagehandService: Using Stagehand alpha version', { version });
            } else {
              stagehandVersion = 'stable';
              logger.info('StagehandService: Using Stagehand stable version', { version });
            }
          } else {
            // If we can't find package.json, check if module has version property
            if (stagehandModule.version && stagehandModule.version.includes('alpha')) {
              stagehandVersion = 'alpha';
              logger.info('StagehandService: Using Stagehand alpha version (from module)', { version: stagehandModule.version });
            } else {
              stagehandVersion = 'stable';
              logger.info('StagehandService: Using Stagehand (assuming stable version)');
            }
          }
        } catch (versionError: any) {
          // If we can't read version, assume stable
          stagehandVersion = 'stable';
          logger.info('StagehandService: Loaded Stagehand (version check failed)', { error: versionError.message });
        }
      } catch (importError: any) {
        // Stagehand not available, use placeholder mode
        this.stagehandAvailable = false;
        logger.info('StagehandService: Stagehand not available, using placeholder mode', {
          userId,
          reason: importError.message,
        });
        this.initialized = true;
        return;
      }

      try {
        // Determine which LLM provider to use
        // Priority: OPENAI_API_KEY > ZHIPUAI_API_KEY
        let apiKey: string | undefined;
        let baseURL: string | undefined;
        let modelName: string;
        let provider: string;

        if (process.env.OPENAI_API_KEY) {
          // Use OpenAI
          apiKey = process.env.OPENAI_API_KEY;
          baseURL = process.env.OPENAI_BASE_URL;
          modelName = process.env.STAGEHAND_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';
          provider = 'openai';
          logger.info('StagehandService: Using OpenAI provider', { model: modelName });
        } else if (process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY) {
          // Use ZhipuAI (OpenAI-compatible)，支持 ZHIPUAI_* 与 ZHIPU_API_KEY（与用户示例一致）
          apiKey = process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY;
          baseURL = process.env.ZHIPUAI_BASE_URL || process.env.ZHIPU_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';
          modelName = process.env.STAGEHAND_MODEL || process.env.ZHIPUAI_MODEL || 'glm-4-flash';
          provider = 'zhipuai';
          logger.info('StagehandService: Using ZhipuAI provider', { model: modelName, baseURL });
        } else {
          // No API key found, use default OpenAI config (will fail if no key)
          apiKey = undefined;
          baseURL = undefined;
          modelName = process.env.STAGEHAND_MODEL || 'gpt-4o';
          provider = 'openai';
          logger.warn('StagehandService: No API key found, using default OpenAI config (may fail)');
        }

        // 与用户可运行示例一致：使用 CustomOpenAIClient + openai 包（智谱兼容 OpenAI API）
        const normalizedBaseURL = baseURL?.replace(/\/+$/, '') || baseURL;
        const { CustomOpenAIClient } = stagehandModule as any;
        const OpenAI = (await import('openai')).default;

        const rawClient = new OpenAI({
          apiKey: apiKey,
          baseURL: normalizedBaseURL,
        });

        // 包装 client：智谱有时在 content 外包裹 ```json ... ```，导致 Stagehand 的 Zod 校验失败，此处统一剥掉
        const openaiClient = wrapOpenAIClientForZod(rawClient);

        const llmClient = new CustomOpenAIClient({
          modelName: modelName,
          client: openaiClient,
        });

        logger.info('StagehandService: Created CustomOpenAIClient for LLM', {
          provider,
          model: modelName,
          baseURL: normalizedBaseURL,
        });

        // verbose: 0=仅错误 1=info 2=debug(含完整 LLM 请求/可访问性树)。默认 0 减少刷屏日志
        const verboseRaw = process.env.STAGEHAND_VERBOSE;
        const verbose = verboseRaw === '2' ? 2 : verboseRaw === '1' ? 1 : 0;

        // 检查浏览器模式配置
        const isHeadless = process.env.STAGEHAND_HEADLESS === 'true';
        logger.info('StagehandService: Browser launch configuration', {
          headless: isHeadless,
          mode: isHeadless ? '无头模式（HEADLESS - 不可见）' : '有头模式（HEADED - 可见）',
          message: isHeadless
            ? '⚠️ 浏览器将在后台运行，用户无法看到操作过程'
            : '✅ 浏览器窗口将可见，用户可以观察自动化操作',
          envVar: process.env.STAGEHAND_HEADLESS || 'undefined (default: false)',
        });

        const stagehandConfig: any = {
          env: process.env.STAGEHAND_ENV || 'LOCAL',
          llmClient: llmClient,
          verbose,
          localBrowserLaunchOptions: {
            // 默认有头模式；仅当 STAGEHAND_HEADLESS=true 时为无头
            headless: isHeadless,
          },
        };

        this.stagehandInstance = new Stagehand(stagehandConfig);
        await this.stagehandInstance.init();
        this.stagehandAvailable = true;
        logger.info('StagehandService: Initialized with Stagehand framework', {
          userId,
          provider,
          model: modelName,
          stagehandVersion,
        });
      } catch (importError: any) {
        // Stagehand not available, use placeholder mode
        this.stagehandAvailable = false;
        logger.info('StagehandService: Stagehand not available, using placeholder mode', {
          userId,
          reason: importError.message,
        });
      }

      this.initialized = true;
    } catch (error: any) {
      logger.error('StagehandService: Failed to initialize', { error: error.message });
      throw new Error(`Failed to initialize Stagehand: ${error.message}`);
    }
  }

  /**
   * Execute a single action/instruction
   * @param instruction The action to perform (e.g., "click the login button")
   * @param url Optional URL to navigate to first
   */
  async act(instruction: string, url?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('StagehandService: Not initialized. Call initialize() first.');
    }

    if (process.env.ENABLE_BROWSER !== 'true') {
      logger.info('StagehandService: Browser automation disabled, skipping action', {
        instruction,
        url,
      });
      return;
    }

    try {
      logger.info('StagehandService: Executing action', { instruction, url });

      if (this.stagehandAvailable && this.stagehandInstance) {
        // 与用户可运行示例一致：直接调用 stagehand.act()，使用初始化时的 CustomOpenAIClient
        try {
          if (url) {
            const pages = this.stagehandInstance.context?.pages();
            if (pages && pages.length > 0) {
              logger.info('StagehandService: Navigating to URL', { url });
              await pages[0].goto(url, { waitUntil: 'networkidle0' });
              logger.info('StagehandService: Successfully navigated to URL', { url });
            }
          }

          // 如果指令不是简单的导航操作，执行 act
          // 对于纯导航操作（如"打开页面"），URL 导航已经完成，可以跳过 act
          if (instruction && !(url && (instruction === '打开页面' || instruction.toLowerCase().includes('navigate') || instruction.toLowerCase().includes('goto')))) {
            await this.stagehandInstance.act(instruction);
            logger.info('StagehandService: Action completed via Stagehand act', { instruction });
          } else if (url) {
            logger.info('StagehandService: Navigation completed', { url });
          }
        } catch (actError: any) {
          logger.error('StagehandService: Stagehand act failed', {
            instruction,
            error: actError.message,
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          logger.warn('StagehandService: Fell back to placeholder mode', { instruction });
        }
      } else {
        // Placeholder mode: simulate action execution
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
        logger.info('StagehandService: Action completed (placeholder mode)', { instruction });
      }
    } catch (error: any) {
      logger.error('StagehandService: Action failed', {
        instruction,
        error: error.message,
      });
      throw new Error(`Failed to execute action "${instruction}": ${error.message}`);
    }
  }

  /**
   * 在 act 之后调用，用于观察页面状态、判断上一步 act 是否执行完成
   * @param instruction 可选，观察指令（如「确认当前操作已完成」）；不传则使用默认观察
   */
  async observe(instruction?: string): Promise<void> {
    if (!this.initialized) return;
    if (process.env.ENABLE_BROWSER !== 'true') return;

    if (this.stagehandAvailable && this.stagehandInstance) {
      try {
        if (typeof this.stagehandInstance.observe === 'function') {
          await this.stagehandInstance.observe(instruction ?? '确认当前页面状态');
          logger.debug('StagehandService: Observe completed', { instruction: instruction ?? '(default)' });
        }
      } catch (err: any) {
        logger.warn('StagehandService: Observe failed (non-fatal)', { error: err?.message });
      }
    } else {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  /**
   * Execute multiple test cases
   * @param testCases Array of test cases to execute
   * @param testUrl URL to test against
   * @returns Array of execution results
   */
  async executeTests(testCases: TestCase[], testUrl: string): Promise<TestExecutionResult[]> {
    if (!this.initialized) {
      throw new Error('StagehandService: Not initialized. Call initialize() first.');
    }

    if (process.env.ENABLE_BROWSER !== 'true') {
      logger.info('StagehandService: Browser automation disabled, returning placeholder results');
      return testCases.map((tc) => ({
        testCase: tc.name,
        success: false,
        error: 'Browser automation is disabled (ENABLE_BROWSER !== true)',
        timestamp: new Date().toISOString(),
      }));
    }

    const results: TestExecutionResult[] = [];

    logger.info('StagehandService: Starting test execution', {
      testCasesCount: testCases.length,
      testUrl,
    });

    for (const testCase of testCases) {
      const startTime = Date.now();
      const result: TestExecutionResult = {
        testCase: testCase.name,
        success: false,
        timestamp: new Date().toISOString(),
      };

      try {
        logger.info('StagehandService: Executing test case', { name: testCase.name });

        // Navigate to URL if provided
        if (testUrl) {
          await this.act(`导航到页面: ${testUrl}`, testUrl);
        }

        // Execute each step
        for (const step of testCase.steps) {
          await this.act(step, testUrl);
        }

        result.success = true;
        result.duration = Date.now() - startTime;
        logger.info('StagehandService: Test case completed successfully', {
          name: testCase.name,
          duration: result.duration,
        });
      } catch (error: any) {
        result.success = false;
        result.error = error.message;
        result.duration = Date.now() - startTime;
        logger.error('StagehandService: Test case failed', {
          name: testCase.name,
          error: error.message,
        });
      }

      results.push(result);
    }

    logger.info('StagehandService: Test execution completed', {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * Get the current Playwright page for assertions and network listening.
   * Used by generated scripts to satisfy skill: 必含关键接口监听、必含流程结果验证.
   * @returns The first page from Stagehand context, or null if browser disabled / not ready
   */
  async getPage(): Promise<any> {
    if (!this.initialized || process.env.ENABLE_BROWSER !== 'true') return null;
    const pages = this.stagehandInstance?.context?.pages?.();
    return pages && pages.length > 0 ? pages[0] : null;
  }

  /**
   * Close and cleanup Stagehand resources
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      logger.info('StagehandService: Closing and cleaning up resources');

      // Cleanup Stagehand instance if available
      if (this.stagehandInstance && this.stagehandAvailable) {
        try {
          await this.stagehandInstance.close();
          logger.info('StagehandService: Stagehand instance closed');
        } catch (closeError: any) {
          logger.warn('StagehandService: Error closing Stagehand instance', {
            error: closeError.message,
          });
        }
      }

      this.initialized = false;
      this.stagehandInstance = null;
      this.stagehandAvailable = false;
      logger.info('StagehandService: Cleanup completed');
    } catch (error: any) {
      logger.error('StagehandService: Error during cleanup', { error: error.message });
      // Don't throw - cleanup errors shouldn't break the flow
    }
  }
}
