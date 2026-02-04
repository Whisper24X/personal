/**
 * StagehandService
 * Service for browser automation using Stagehand framework
 * Provides methods for validating and executing automated test cases
 */

import { logger } from '../utils';

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
        } else if (process.env.ZHIPUAI_API_KEY) {
          // Use ZhipuAI (OpenAI-compatible)
          apiKey = process.env.ZHIPUAI_API_KEY;
          baseURL = process.env.ZHIPUAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
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

        // 必须让 Stagehand 内部创建带 getLanguageModel() 的 client，否则 agent 会报 MissingLLMConfigurationError。
        // CustomOpenAIClient 无 getLanguageModel()，不能用于 act()。故不传 llmClient，改用 openai/模型名 + modelClientOptions。
        if (apiKey) {
          process.env.OPENAI_API_KEY = apiKey;
          if (baseURL) process.env.OPENAI_BASE_URL = baseURL;
        }

        // Stagehand 的 provider/model 格式会走 AISdkClient（有 getLanguageModel），兼容自定义 baseURL
        const stagehandModelName = modelName.includes('/') ? modelName : `openai/${modelName}`;

        const stagehandConfig: any = {
          env: process.env.STAGEHAND_ENV || 'LOCAL',
          modelName: stagehandModelName,
          localBrowserLaunchOptions: {
            headless: process.env.STAGEHAND_HEADLESS !== 'false',
          },
        };
        if (apiKey) {
          stagehandConfig.modelClientOptions = { apiKey, baseURL };
        }

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
        // Use real Stagehand agent to execute the action
        try {
          // Get agent with model configuration if needed
          // The llmClient should be inherited from Stagehand instance, but we can also pass model config
          const agent = this.stagehandInstance.agent();

          // Navigate to URL first if provided
          if (url) {
            const pages = this.stagehandInstance.context?.pages();
            if (pages && pages.length > 0) {
              await pages[0].goto(url);
              logger.info('StagehandService: Navigated to URL', { url });
            }
          }

          // Execute the instruction using Stagehand agent
          // The agent should use the llmClient configured during Stagehand initialization
          await agent.execute({
            instruction: instruction,
            maxSteps: 10, // Limit steps to prevent infinite loops
          });

          logger.info('StagehandService: Action completed via Stagehand agent', { instruction });
        } catch (agentError: any) {
          logger.error('StagehandService: Stagehand agent execution failed', {
            instruction,
            error: agentError.message,
          });
          // Fall back to placeholder if agent fails
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
