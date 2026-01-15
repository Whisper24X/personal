/**
 * 命令执行工具
 * 提供异步执行系统命令的功能
 */

import { spawn } from 'child_process';
import { logger } from './logger';

export interface CommandExecutorOptions {
  /** 工作目录 */
  cwd?: string;
  /** 超时时间（毫秒），默认5分钟 */
  timeout?: number;
  /** 是否使用shell执行，默认true */
  shell?: boolean;
  /** 环境变量 */
  env?: NodeJS.ProcessEnv;
}

export interface CommandExecutorResult {
  /** 标准输出 */
  stdout: string;
  /** 标准错误输出 */
  stderr: string;
  /** 退出码 */
  exitCode: number | null;
}

export class CommandExecutorError extends Error {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  originalError?: Error;

  constructor(message: string, stdout: string = '', stderr: string = '', exitCode: number | null = null) {
    super(message);
    this.name = 'CommandExecutorError';
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

/**
 * 使用spawn异步执行命令
 * @param command 要执行的命令（包含参数）
 * @param options 执行选项
 * @returns Promise<CommandExecutorResult> 命令执行结果
 */
export async function executeCommand(
  command: string,
  options: CommandExecutorOptions = {}
): Promise<CommandExecutorResult> {
  const {
    cwd = process.cwd(),
    timeout = 300000, // 默认5分钟
    shell = true,
    env = process.env,
  } = options;

  return new Promise((resolve, reject) => {
    // 解析命令和参数
    const args = command.split(' ');
    const cmd = args.shift() || '';

    logger.info('CommandExecutor: Spawning command', {
      cmd,
      args: args.length > 0 ? args : '(no args)',
      cwd,
      timeout,
    });

    // 使用spawn执行命令
    const child = spawn(cmd, args, {
      cwd,
      shell,
      env,
      stdio: ['ignore', 'pipe', 'pipe'], // 忽略stdin，管道化stdout和stderr
    });

    let stdout = '';
    let stderr = '';

    // 收集标准输出
    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      logger.debug('CommandExecutor: Command stdout chunk', { length: chunk.length });
    });

    // 收集标准错误输出
    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      logger.debug('CommandExecutor: Command stderr chunk', { length: chunk.length });
    });

    // 设置超时处理
    let timeoutHandle: NodeJS.Timeout | null = null;
    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        const error = new CommandExecutorError(
          `Command execution timeout (${timeout}ms)`,
          stdout,
          stderr,
          -1
        );
        logger.warn('CommandExecutor: Command execution timeout', {
          timeout,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        });
        reject(error);
      }, timeout);
    }

    // 处理命令完成
    child.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      logger.info('CommandExecutor: Command execution completed', {
        exitCode: code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      const result: CommandExecutorResult = {
        stdout,
        stderr,
        exitCode: code,
      };

      if (code === 0) {
        resolve(result);
      } else {
        const error = new CommandExecutorError(
          `Command failed with exit code ${code}`,
          stdout,
          stderr,
          code
        );
        reject(error);
      }
    });

    // 处理spawn错误
    child.on('error', (err) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      logger.error('CommandExecutor: Command spawn error', { error: err.message });
      const error = new CommandExecutorError(
        `Failed to spawn command: ${err.message}`,
        stdout,
        stderr,
        null
      );
      error.originalError = err;
      reject(error);
    });
  });
}

/**
 * 使用spawn异步执行命令（简化版，只返回stdout）
 * @param command 要执行的命令（包含参数）
 * @param options 执行选项
 * @returns Promise<string> 命令的标准输出
 */
export async function executeCommandSimple(
  command: string,
  options: CommandExecutorOptions = {}
): Promise<string> {
  const result = await executeCommand(command, options);
  return result.stdout;
}

/**
 * 使用spawn异步执行命令（带重试机制）
 * @param command 要执行的命令（包含参数）
 * @param options 执行选项
 * @param maxRetries 最大重试次数，默认0（不重试）
 * @param retryDelay 重试延迟（毫秒），默认1000ms
 * @returns Promise<CommandExecutorResult> 命令执行结果
 */
export async function executeCommandWithRetry(
  command: string,
  options: CommandExecutorOptions = {},
  maxRetries: number = 0,
  retryDelay: number = 1000
): Promise<CommandExecutorResult> {
  let lastError: CommandExecutorError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info('CommandExecutor: Retrying command', { attempt, maxRetries });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      return await executeCommand(command, options);
    } catch (error) {
      lastError = error as CommandExecutorError;
      logger.warn('CommandExecutor: Command failed', {
        attempt,
        maxRetries,
        message: lastError.message,
        exitCode: lastError.exitCode,
      });
    }
  }

  throw lastError;
}
