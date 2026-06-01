/**
 * CLI Executor
 * CLI 执行器实现
 * 
 * 使用命令行工具（如 Cursor CLI, Aider）执行任务
 */

import { IExecutor, ExecutorMode, ExecutorOptions, CLIProviderType, CLIProviderConfig, ICLIModelFallbackStrategy } from './types';
import { CLIProviderFactory } from './cli/CLIProviderFactory';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// 全局执行计数器，用于诊断重复执行
let globalExecutionCounter = 0;

/**
 * CLI 执行器配置
 */
export interface CLIExecutorConfig {
  /** CLI 提供商类型 */
  providerType?: CLIProviderType;
  /** CLI 提供商配置 */
  providerConfig?: Partial<CLIProviderConfig>;
  /** 默认工作目录 */
  defaultWorkDir?: string;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 模型降级策略 */
  fallbackStrategy?: ICLIModelFallbackStrategy | null;
}

/**
 * CLI 执行器
 */
export class CLIExecutor implements IExecutor {
  private config: CLIExecutorConfig;

  constructor(config?: CLIExecutorConfig) {
    this.config = {
      providerType: config?.providerType || CLIProviderFactory.getDefaultProviderType(),
      maxRetries: config?.maxRetries || 0,
      ...config,
    };
  }

  /**
   * 获取执行模式
   */
  getMode(): ExecutorMode {
    return 'cli';
  }

  /**
   * 执行提示词
   * @param prompt 提示词内容
   * @param options 执行选项
   */
  async execute(prompt: string, options?: ExecutorOptions): Promise<string> {
    const workDir = options?.workDir || this.config.defaultWorkDir;

    if (!workDir) {
      throw new Error('CLIExecutor: workDir is required for CLI execution');
    }

    // 检查取消信号
    if (options?.abortSignal?.aborted) {
      throw new Error('CLIExecutor: Execution was cancelled');
    }

    const startTime = Date.now();
    const providerType = this.config.providerType || 'cursor';

    // 诊断信息：生成唯一执行ID和获取调用栈
    const executionId = uuidv4().substring(0, 8);
    globalExecutionCounter++;
    const callStack = new Error().stack?.split('\n').slice(2, 8).join('\n') || 'unknown';

    const logContext = {
      mode: 'cli',
      provider: providerType,
      workDir,
      promptLength: prompt.length,
      hasSystemPrompt: !!options?.systemPrompt,
      executionId,
      globalExecutionCount: globalExecutionCounter,
    };

    logger.info('CLIExecutor: Starting execution', logContext);
    logger.debug('CLIExecutor: Call stack for diagnostic', {
      executionId,
      callStack,
    });

    try {
      // 获取 CLI 提供商
      const provider = CLIProviderFactory.getProvider(
        providerType,
        this.config.providerConfig
      );

      // 构建完整提示词（包含系统提示词）
      let fullPrompt = prompt;
      if (options?.systemPrompt) {
        fullPrompt = `${options.systemPrompt}\n\n## 任务\n\n${prompt}`;
      }

      // 如果指定了输出文件，添加到提示词中
      if (options?.outputFile) {
        fullPrompt += `\n\n请将结果保存到 ${options.outputFile} 文件中。`;
      }

      // 执行命令
      const result = await provider.execute(fullPrompt, workDir, {
        timeout: options?.timeout || this.config.providerConfig?.timeout,
        env: options?.env,
      });

      // 再次检查取消信号
      // 如果命令已经成功执行（exitCode: 0），即使信号被取消，也返回成功结果
      // 只有在命令失败且信号被取消时，才抛出取消错误
      if (options?.abortSignal?.aborted && result.exitCode !== 0) {
        throw new Error('CLIExecutor: Execution was cancelled');
      }
      
      // 如果命令成功但信号被取消，记录警告但不抛出错误
      if (options?.abortSignal?.aborted && result.exitCode === 0) {
        logger.warn('CLIExecutor: Command completed successfully but abort signal was set', {
          ...logContext,
          exitCode: result.exitCode,
        });
      }

      const executionTime = Date.now() - startTime;

      // 如果退出码非零，尝试降级
      if (result.exitCode !== 0 && this.config.fallbackStrategy) {
        const originalConfig = this.config.providerConfig || {};
        const shouldFallback = this.config.fallbackStrategy.shouldFallback(
          originalConfig,
          new Error(`Command exited with code ${result.exitCode}`),
          result
        );

        if (shouldFallback) {
          const fallbackConfig = this.config.fallbackStrategy.getFallbackConfig(originalConfig);
          const originalModel = originalConfig.model;
          const fallbackModel = fallbackConfig.model;

          logger.warn('CLIExecutor: Command exited with non-zero code, attempting model fallback', {
            ...logContext,
            exitCode: result.exitCode,
            originalModel,
            fallbackModel,
            executionTimeMs: executionTime,
            stderr: result.stderr?.substring(0, 500),
          });

          try {
            // 使用降级配置创建新的提供商
            const fallbackProvider = CLIProviderFactory.getProvider(
              providerType,
              fallbackConfig
            );

            // 构建完整提示词（与之前相同）
            let fullPromptForFallback = prompt;
            if (options?.systemPrompt) {
              fullPromptForFallback = `${options.systemPrompt}\n\n## 任务\n\n${prompt}`;
            }

            if (options?.outputFile) {
              fullPromptForFallback += `\n\n请将结果保存到 ${options.outputFile} 文件中。`;
            }

            // 使用降级配置执行
            const fallbackResult = await fallbackProvider.execute(fullPromptForFallback, workDir, {
              timeout: options?.timeout || fallbackConfig.timeout || this.config.providerConfig?.timeout,
              env: options?.env,
            });

            // 再次检查取消信号
            // 如果命令已经成功执行（exitCode: 0），即使信号被取消，也返回成功结果
            if (options?.abortSignal?.aborted && fallbackResult.exitCode !== 0) {
              throw new Error('CLIExecutor: Execution was cancelled');
            }
            
            // 如果命令成功但信号被取消，记录警告但不抛出错误
            if (options?.abortSignal?.aborted && fallbackResult.exitCode === 0) {
              logger.warn('CLIExecutor: Fallback command completed successfully but abort signal was set', {
                ...logContext,
                exitCode: fallbackResult.exitCode,
                fallbackModel,
              });
            }

            const fallbackExecutionTime = Date.now() - startTime;

            if (fallbackResult.exitCode === 0) {
              logger.info('CLIExecutor: Model fallback succeeded', {
                ...logContext,
                originalModel,
                fallbackModel,
                executionTimeMs: fallbackExecutionTime,
                outputLength: fallbackResult.output.length,
              });

              return fallbackResult.output;
            } else {
              logger.warn('CLIExecutor: Model fallback also exited with non-zero code', {
                ...logContext,
                originalModel,
                fallbackModel,
                exitCode: fallbackResult.exitCode,
                executionTimeMs: fallbackExecutionTime,
                stderr: fallbackResult.stderr?.substring(0, 500),
              });
              // 继续使用原始结果
            }
          } catch (fallbackError: any) {
            const fallbackExecutionTime = Date.now() - startTime;

            logger.error('CLIExecutor: Model fallback failed', {
              ...logContext,
              originalModel,
              fallbackModel: fallbackConfig.model,
              fallbackError: fallbackError.message,
              executionTimeMs: fallbackExecutionTime,
            });
            // 继续使用原始结果
          }
        }
      }

      if (result.exitCode !== 0) {
        logger.warn('CLIExecutor: Command exited with non-zero code', {
          ...logContext,
          exitCode: result.exitCode,
          executionTimeMs: executionTime,
          stderr: result.stderr?.substring(0, 500),
        });
      } else {
        logger.info('CLIExecutor: Execution completed', {
          ...logContext,
          executionTimeMs: executionTime,
          outputLength: result.output.length,
        });
      }

      logger.debug('CLIExecutor: Execution finished', {
        executionId,
        globalExecutionCount: globalExecutionCounter,
        success: result.exitCode === 0,
      });

      return result.output;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // 尝试模型降级
      if (this.config.fallbackStrategy) {
        const originalConfig = this.config.providerConfig || {};
        const shouldFallback = this.config.fallbackStrategy.shouldFallback(
          originalConfig,
          error,
          undefined // 这里没有result，因为是在catch块中
        );

        if (shouldFallback) {
          const fallbackConfig = this.config.fallbackStrategy.getFallbackConfig(originalConfig);
          const originalModel = originalConfig.model;
          const fallbackModel = fallbackConfig.model;

          logger.warn('CLIExecutor: Execution failed, attempting model fallback', {
            ...logContext,
            originalModel,
            fallbackModel,
            error: error.message,
            executionTimeMs: executionTime,
          });

          try {
            // 使用降级配置创建新的提供商
            const fallbackProvider = CLIProviderFactory.getProvider(
              providerType,
              fallbackConfig
            );

            // 构建完整提示词（与之前相同）
            let fullPrompt = prompt;
            if (options?.systemPrompt) {
              fullPrompt = `${options.systemPrompt}\n\n## 任务\n\n${prompt}`;
            }

            if (options?.outputFile) {
              fullPrompt += `\n\n请将结果保存到 ${options.outputFile} 文件中。`;
            }

            // 使用降级配置执行
            const fallbackResult = await fallbackProvider.execute(fullPrompt, workDir, {
              timeout: options?.timeout || fallbackConfig.timeout || this.config.providerConfig?.timeout,
              env: options?.env,
            });

            // 再次检查取消信号
            // 如果命令已经成功执行（exitCode: 0），即使信号被取消，也返回成功结果
            if (options?.abortSignal?.aborted && fallbackResult.exitCode !== 0) {
              throw new Error('CLIExecutor: Execution was cancelled');
            }
            
            // 如果命令成功但信号被取消，记录警告但不抛出错误
            if (options?.abortSignal?.aborted && fallbackResult.exitCode === 0) {
              logger.warn('CLIExecutor: Fallback command completed successfully but abort signal was set', {
                ...logContext,
                exitCode: fallbackResult.exitCode,
                fallbackModel,
              });
            }

            const fallbackExecutionTime = Date.now() - startTime;

            logger.info('CLIExecutor: Model fallback succeeded', {
              ...logContext,
              originalModel,
              fallbackModel,
              executionTimeMs: fallbackExecutionTime,
              outputLength: fallbackResult.output.length,
            });

            return fallbackResult.output;
          } catch (fallbackError: any) {
            const fallbackExecutionTime = Date.now() - startTime;

            logger.error('CLIExecutor: Model fallback also failed', {
              ...logContext,
              originalModel,
              fallbackModel,
              originalError: error.message,
              fallbackError: fallbackError.message,
              executionTimeMs: fallbackExecutionTime,
            });

            // 如果降级也失败，抛出原始错误
            throw error;
          }
        }
      }

      logger.error('CLIExecutor: Execution failed', {
        ...logContext,
        executionTimeMs: executionTime,
        error: error.message,
        callStack,
        hasFallbackStrategy: !!this.config.fallbackStrategy,
      });

      throw error;
    }
  }

  /**
   * 带重试的执行
   * @param prompt 提示词
   * @param checkPrompt 检查提示词（用于判断是否完成）
   * @param options 执行选项
   */
  async executeWithRetry(
    prompt: string,
    checkPrompt: string,
    options?: ExecutorOptions & { maxRetries?: number; isComplete?: (output: string) => boolean }
  ): Promise<{ output: string; iterations: number; isCompleted: boolean }> {
    const workDir = options?.workDir || this.config.defaultWorkDir;

    if (!workDir) {
      throw new Error('CLIExecutor: workDir is required for CLI execution');
    }

    const maxRetries = options?.maxRetries || this.config.maxRetries || 10;
    const isComplete = options?.isComplete || ((output: string) => output.includes('已完成'));

    let retryCount = 0;
    let isCompleted = false;
    const allOutputs: string[] = [];

    const startTime = Date.now();

    logger.info('CLIExecutor: Starting execution with retry', {
      mode: 'cli',
      provider: this.config.providerType,
      workDir,
      maxRetries,
    });

    while (!isCompleted && retryCount < maxRetries) {
      retryCount++;

      // 检查取消信号
      if (options?.abortSignal?.aborted) {
        throw new Error('CLIExecutor: Execution was cancelled');
      }

      logger.info(`CLIExecutor: Iteration ${retryCount}/${maxRetries}`, {
        promptLength: prompt.length,
      });

      // 执行主命令
      const mainOutput = await this.execute(prompt, options);
      allOutputs.push(`=== Iteration ${retryCount} - Execute ===\n${mainOutput}`);

      // 执行检查命令
      const checkOutput = await this.execute(checkPrompt, options);
      allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);

      // 判断是否完成
      if (isComplete(checkOutput)) {
        isCompleted = true;
        logger.info(`CLIExecutor: Tasks completed at iteration ${retryCount}`);
      }
    }

    const executionTime = Date.now() - startTime;

    logger.info('CLIExecutor: Retry execution finished', {
      isCompleted,
      iterations: retryCount,
      executionTimeMs: executionTime,
    });

    return {
      output: allOutputs.join('\n\n'),
      iterations: retryCount,
      isCompleted,
    };
  }

  /**
   * 检查 CLI 工具是否可用
   */
  async checkAvailability(): Promise<boolean> {
    return CLIProviderFactory.checkProviderAvailability(this.config.providerType);
  }

  /**
   * 获取 CLI 提供商类型
   */
  getProviderType(): CLIProviderType {
    return this.config.providerType || 'cursor';
  }
}

export default CLIExecutor;
