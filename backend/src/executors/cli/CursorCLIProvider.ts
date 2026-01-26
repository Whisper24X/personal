/**
 * Cursor CLI Provider
 * Cursor CLI 提供商实现
 * 
 * 使用 cursor-agent 命令行工具执行任务
 */

import { BaseCLIProvider } from './ICLIProvider';
import { CLIProviderConfig, CLIExecutionResult } from '../types';
import { executeCommandSimple, CommandExecutorError } from '../../utils/commandExecutor';
import { logger } from '../../utils/logger';

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
    super('cursor', { ...CURSOR_DEFAULT_CONFIG, ...defaultConfig });
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

    // 构建命令
    const escapedPrompt = this.escapePrompt(prompt);
    const fullCommand = `${command} --model ${model} --print "${escapedPrompt}"`;

    logger.info('CursorCLIProvider: Executing command', {
      command: command,
      model,
      workDir,
      timeout,
      promptLength: prompt.length,
    });

    try {
      const output = await executeCommandSimple(fullCommand, {
        cwd: workDir,
        timeout,
        env: mergedConfig.env,
      });

      const executionTime = Date.now() - startTime;

      logger.info('CursorCLIProvider: Command completed successfully', {
        outputLength: output.length,
        executionTimeMs: executionTime,
      });

      return {
        output,
        exitCode: 0,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const execError = error as CommandExecutorError;

      logger.warn('CursorCLIProvider: Command failed', {
        message: execError.message,
        exitCode: execError.exitCode,
        executionTimeMs: executionTime,
        stdout: execError.stdout?.substring(0, 500),
        stderr: execError.stderr?.substring(0, 500),
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
