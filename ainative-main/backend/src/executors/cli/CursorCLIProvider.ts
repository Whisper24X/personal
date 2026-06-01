/**
 * Cursor CLI Provider
 * Cursor CLI 提供商实现
 * 
 * 使用 cursor-agent 命令行工具执行任务
 */

import { BaseCLIProvider } from './ICLIProvider';
import { CLIProviderConfig, CLIExecutionResult } from '../types';
import { executeCommandSimple, CommandExecutorError } from '../../utils/commandExecutor';
import { executeCommandStream, createProgressHandler } from '../../utils/streamCommandExecutor';
import { CLIConfigUtil } from '../../utils/cliConfigUtil';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// 全局 cursor-agent 调用计数器，用于诊断重复执行
let globalCursorAgentCallCounter = 0;

/**
 * Cursor CLI 默认配置
 */
const CURSOR_DEFAULT_CONFIG: Partial<CLIProviderConfig> = {
  command: 'cursor-agent',
  model: 'composer-1',
  timeout: 3600000, // 60 分钟
};

/**
 * Cursor CLI 提供商
 */
export class CursorCLIProvider extends BaseCLIProvider {
  constructor(defaultConfig?: Partial<CLIProviderConfig>) {
    // 从环境变量加载全局配置
    const globalConfig = CLIConfigUtil.loadGlobalConfig();
    const globalCLIConfig = CLIConfigUtil.toCLIProviderConfig(globalConfig, 'cursor');
    
    super('cursor', { 
      ...CURSOR_DEFAULT_CONFIG, 
      ...globalCLIConfig,
      ...defaultConfig 
    });
  }

  /**
   * 获取要使用的 API key
   * 优先级：config.apiKey > config.apiKeys[config.apiKeyIndex] > process.env.CURSOR_API_KEY
   */
  private getApiKey(config: Partial<CLIProviderConfig>): string | undefined {
    // 优先级 1: 直接指定的 apiKey
    if (config.apiKey) {
      return config.apiKey;
    }

    // 优先级 2: 从 apiKeys 数组中选取
    if (config.apiKeys && config.apiKeys.length > 0) {
      const index = config.apiKeyIndex ?? 0;
      if (index >= 0 && index < config.apiKeys.length) {
        return config.apiKeys[index];
      }
      // 如果索引无效，使用第一个
      if (config.apiKeys.length > 0) {
        logger.warn('CursorCLIProvider: Invalid apiKeyIndex, using first apiKey', {
          apiKeyIndex: config.apiKeyIndex,
          apiKeysCount: config.apiKeys.length,
        });
        return config.apiKeys[0];
      }
    }

    // 优先级 3: 环境变量
    return process.env.CURSOR_API_KEY;
  }

  /**
   * 执行 Cursor CLI 命令
   */
  async execute(
    prompt: string,
    workDir: string,
    config?: Partial<CLIProviderConfig>
  ): Promise<CLIExecutionResult> {
    const mergedConfig = this.mergeConfig(config);
    const startTime = Date.now();

    const command = mergedConfig.command || 'cursor-agent';
    const model = mergedConfig.model || 'composer-1';
    const timeout = mergedConfig.timeout || 3600000;

    // 诊断信息：生成唯一调用ID和获取调用栈
    const callId = uuidv4().substring(0, 8);
    globalCursorAgentCallCounter++;
    const callStack = new Error().stack?.split('\n').slice(2, 8).join('\n') || 'unknown';

    // 获取要使用的 API key
    const apiKey = this.getApiKey(mergedConfig);

    // 从配置中获取流式进度跟踪设置
    const enableStreamProgress = mergedConfig.enableStreamProgress ?? false;
    const outputFormat = mergedConfig.outputFormat || 'text';
    const streamPartialOutput = mergedConfig.streamPartialOutput ?? false;

    // 构建命令
    const escapedPrompt = this.escapePrompt(prompt);
    let fullCommand = `${command} --model ${model}`;
    
    // 如果配置了 API key，添加 --api-key 参数
    if (apiKey) {
      // 转义 API key 中的特殊字符（主要是双引号和反斜杠）
      const escapedApiKey = apiKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      fullCommand += ` --api-key "${escapedApiKey}"`;
    } else {
      fullCommand += ` --api-key ${process.env.CURSOR_API_KEY}`;
      logger.warn(`CursorCLIProvider: No API key provided, using process.env.CURSOR_API_KEY: ${process.env.CURSOR_API_KEY}`);
    }
    
    // 添加输出格式参数
    if (enableStreamProgress && outputFormat === 'stream-json') {
      fullCommand += ` --print --output-format stream-json`;
      if (streamPartialOutput) {
        fullCommand += ` --stream-partial-output`;
      }
    } else {
      fullCommand += ` --print`;
    }
    
    fullCommand += ` "${escapedPrompt}"`;

    logger.info('CursorCLIProvider: Executing command', {
      command: command,
      model,
      workDir,
      timeout,
      promptLength: prompt.length,
      hasApiKey: !!apiKey,
      apiKeyIndex: mergedConfig.apiKeyIndex,
      apiKeysCount: mergedConfig.apiKeys?.length,
      enableStreamProgress,
      outputFormat,
      streamPartialOutput,
      callId,
      globalCallCount: globalCursorAgentCallCounter,
    });

    logger.debug('CursorCLIProvider: Call stack for diagnostic', {
      callId,
      callStack,
    });

    try {
      let output: string;
      
      // 根据配置选择执行方式
      if (enableStreamProgress && outputFormat === 'stream-json') {
        // 使用流式执行
        const progressHandler = createProgressHandler(callId, logger);
        const result = await executeCommandStream(fullCommand, {
          cwd: workDir,
          timeout,
          env: mergedConfig.env,
          abortSignal: mergedConfig.abortSignal,
          onProgress: progressHandler,
        });
        output = result.stdout;
      } else {
        // 使用原有执行方式
        output = await executeCommandSimple(fullCommand, {
          cwd: workDir,
          timeout,
          env: mergedConfig.env,
          abortSignal: mergedConfig.abortSignal,
        });
      }

      const executionTime = Date.now() - startTime;

      logger.info('CursorCLIProvider: Command completed successfully', {
        outputLength: output.length,
        executionTimeMs: executionTime,
        callId,
        globalCallCount: globalCursorAgentCallCounter,
      });

      return {
        output,
        exitCode: 0,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const execError = error as CommandExecutorError;

      // 如果流式执行失败，尝试回退到普通执行
      if (enableStreamProgress && outputFormat === 'stream-json') {
        // 中文友好输出
        console.warn('⚠️ 流式执行失败，正在回退到普通模式...');
        if (execError.stderr) {
          console.warn(`错误信息: ${execError.stderr.substring(0, 200)}`);
        }
        
        // 结构化日志（用于日志文件）
        logger.warn('CursorCLIProvider: Stream execution failed, falling back to simple execution', {
          message: execError.message,
          exitCode: execError.exitCode,
          callId,
        });
        
        try {
          // 重新构建命令（不使用流式格式）
          const fallbackCommand = fullCommand.replace('--output-format stream-json', '').replace('--stream-partial-output', '').trim();
          const fallbackOutput = await executeCommandSimple(fallbackCommand, {
            cwd: workDir,
            timeout,
            env: mergedConfig.env,
            abortSignal: mergedConfig.abortSignal,
          });
          
          // 中文友好输出
          console.log('✅ 回退执行成功');
          
          // 结构化日志（用于日志文件）
          logger.info('CursorCLIProvider: Fallback execution succeeded', {
            callId,
            outputLength: fallbackOutput.length,
          });
          
          return {
            output: fallbackOutput,
            exitCode: 0,
            executionTime: Date.now() - startTime,
          };
        } catch (fallbackError) {
          // 回退也失败，使用原始错误
          const fallbackExecError = fallbackError as CommandExecutorError;
          
          // 中文友好输出
          console.error('❌ 回退执行也失败');
          console.error(`退出码: ${fallbackExecError.exitCode || execError.exitCode || 1}`);
          console.error(`错误详情: ${(fallbackError as Error).message}`);
          if (fallbackExecError.stderr) {
            console.error(`stderr: ${fallbackExecError.stderr.substring(0, 500)}`);
          } else if (execError.stderr) {
            console.error(`stderr: ${execError.stderr.substring(0, 500)}`);
          }
          
          // 结构化日志（用于日志文件）
          logger.error('CursorCLIProvider: Fallback execution also failed', {
            callId,
            fallbackError: (fallbackError as Error).message,
          });
        }
      }

      // 中文友好输出
      const executionTimeSeconds = Math.round(executionTime / 1000);
      console.error('❌ 命令执行失败');
      console.error(`退出码: ${execError.exitCode || 1}`);
      console.error(`执行耗时: ${executionTimeSeconds}s`);
      if (execError.stderr) {
        console.error(`stderr: ${execError.stderr.substring(0, 500)}`);
      }
      if (execError.message) {
        console.error(`错误详情: ${execError.message}`);
      }

      // 结构化日志（用于日志文件）
      logger.warn('CursorCLIProvider: Command failed', {
        message: execError.message,
        exitCode: execError.exitCode,
        executionTimeMs: executionTime,
        stdout: execError.stdout?.substring(0, 500),
        stderr: execError.stderr?.substring(0, 500),
        callId,
        globalCallCount: globalCursorAgentCallCounter,
        callStack,
      });

      // 即使命令失败，也返回已有的输出
      return {
        output: execError.stdout || '',
        exitCode: execError.exitCode || 1,
        executionTime,
        stderr: execError.stderr,
      };
    }
  }

  /**
   * 检查 cursor-agent 是否可用
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await executeCommandSimple('cursor-agent --version', {
        timeout: 10000,
      });
      return true;
    } catch {
      logger.debug('CursorCLIProvider: cursor-agent not available');
      return false;
    }
  }

  /**
   * 获取 cursor-agent 版本
   */
  async getVersion(): Promise<string> {
    try {
      const output = await executeCommandSimple('cursor-agent --version', {
        timeout: 10000,
      });
      return output.trim();
    } catch (error) {
      logger.warn('CursorCLIProvider: Failed to get version', {
        error: (error as Error).message,
      });
      return 'unknown';
    }
  }
}

export default CursorCLIProvider;
