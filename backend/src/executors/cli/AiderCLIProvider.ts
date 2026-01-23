/**
 * Aider CLI Provider
 * Aider CLI 提供商实现
 * 
 * 使用 aider 命令行工具执行任务
 * https://github.com/paul-gauthier/aider
 */

import { BaseCLIProvider } from './ICLIProvider';
import { CLIProviderConfig, CLIExecutionResult } from '../types';
import { executeCommandSimple, CommandExecutorError } from '../../utils/commandExecutor';
import { logger } from '../../utils/logger';

/**
 * Aider CLI 默认配置
 */
const AIDER_DEFAULT_CONFIG: Partial<CLIProviderConfig> = {
  command: 'aider',
  model: 'gpt-4',
  timeout: 3600000, // 60 分钟
};

/**
 * Aider CLI 提供商
 */
export class AiderCLIProvider extends BaseCLIProvider {
  constructor(defaultConfig?: Partial<CLIProviderConfig>) {
    super('aider', { ...AIDER_DEFAULT_CONFIG, ...defaultConfig });
  }

  /**
   * 执行 Aider CLI 命令
   */
  async execute(
    prompt: string,
    workDir: string,
    config?: Partial<CLIProviderConfig>
  ): Promise<CLIExecutionResult> {
    const mergedConfig = this.mergeConfig(config);
    const startTime = Date.now();

    const command = mergedConfig.command || 'aider';
    const model = mergedConfig.model || 'gpt-4';
    const timeout = mergedConfig.timeout || 3600000;

    // 构建命令
    // Aider 使用 --message 参数传递提示词
    const escapedPrompt = this.escapePrompt(prompt);
    const args = mergedConfig.args?.join(' ') || '';
    const fullCommand = `${command} --model ${model} --yes --no-git --message "${escapedPrompt}" ${args}`.trim();

    logger.info('AiderCLIProvider: Executing command', {
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
        env: {
          ...process.env,
          ...mergedConfig.env,
        },
      });

      const executionTime = Date.now() - startTime;

      logger.info('AiderCLIProvider: Command completed successfully', {
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

      logger.warn('AiderCLIProvider: Command failed', {
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
   * 检查 aider 是否可用
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await executeCommandSimple('aider --version', {
        timeout: 10000,
      });
      return true;
    } catch {
      logger.debug('AiderCLIProvider: aider not available');
      return false;
    }
  }

  /**
   * 获取 aider 版本
   */
  async getVersion(): Promise<string> {
    try {
      const output = await executeCommandSimple('aider --version', {
        timeout: 10000,
      });
      return output.trim();
    } catch (error) {
      logger.warn('AiderCLIProvider: Failed to get version', {
        error: (error as Error).message,
      });
      return 'unknown';
    }
  }
}

export default AiderCLIProvider;
