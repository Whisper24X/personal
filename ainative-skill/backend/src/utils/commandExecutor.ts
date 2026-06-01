/**
 * 命令执行工具
 * 提供异步执行系统命令的功能
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';

// 跟踪所有正在运行的子进程
const runningProcesses = new Set<ChildProcess>();

// 清理所有正在运行的子进程
function cleanupAllProcesses() {
  if (runningProcesses.size > 0) {
    logger.info('CommandExecutor: Cleaning up running processes', {
      count: runningProcesses.size,
    });
    
    for (const child of runningProcesses) {
      try {
        child.kill('SIGTERM');
      } catch (error: any) {
        logger.warn('CommandExecutor: Failed to kill child process', {
          error: error.message,
        });
      }
    }
    
    runningProcesses.clear();
  }
}

// 监听进程退出事件，清理所有子进程
let cleanupRegistered = false;
function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  // 正常退出
  process.on('exit', () => {
    cleanupAllProcesses();
  });

  // SIGTERM 信号（kill 命令默认）
  process.on('SIGTERM', () => {
    logger.info('CommandExecutor: Received SIGTERM, cleaning up...');
    cleanupAllProcesses();
    process.exit(0);
  });

  // SIGINT 信号（Ctrl+C）
  process.on('SIGINT', () => {
    logger.info('CommandExecutor: Received SIGINT, cleaning up...');
    cleanupAllProcesses();
    process.exit(0);
  });

  // 未捕获的异常
  process.on('uncaughtException', (error) => {
    logger.error('CommandExecutor: Uncaught exception, cleaning up...', {
      error: error.message,
    });
    cleanupAllProcesses();
    process.exit(1);
  });
}

export interface CommandExecutorOptions {
  /** 工作目录 */
  cwd?: string;
  /** 超时时间（毫秒），默认5分钟 */
  timeout?: number;
  /** 是否使用shell执行，默认true */
  shell?: boolean;
  /** 环境变量 */
  env?: NodeJS.ProcessEnv;
  /** 取消信号，用于中止正在执行的命令 */
  abortSignal?: AbortSignal;
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
    abortSignal,
  } = options;

  // 检查是否已经被取消
  if (abortSignal?.aborted) {
    const error = new CommandExecutorError(
      'Command execution was cancelled before start',
      '',
      '',
      -1
    );
    logger.info('CommandExecutor: Command cancelled before start');
    throw error;
  }

  return new Promise((resolve, reject) => {
    // 注册清理函数（只注册一次）
    registerCleanup();

    logger.info('CommandExecutor: Spawning command', {
      command: shell ? command : command.split(' ')[0],
      cwd,
      timeout,
      shell,
    });

    // 使用spawn执行命令
    // 当shell=true时，直接传递完整命令字符串，让shell处理参数解析（包括引号）
    // 当shell=false时，需要手动拆分命令和参数
    let child: ChildProcess;
    if (shell) {
      // shell模式：直接传递完整命令，shell会正确处理引号和转义
      child = spawn(command, {
        cwd,
        shell: true,
        env,
        stdio: ['ignore', 'pipe', 'pipe'], // 忽略stdin，管道化stdout和stderr
      });
    } else {
      // 非shell模式：手动拆分命令和参数
      const args = command.split(' ');
      const cmd = args.shift() || '';
      child = spawn(cmd, args, {
        cwd,
        shell: false,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    // 添加到正在运行的进程集合
    runningProcesses.add(child);
    logger.debug('CommandExecutor: Process added to tracking', {
      totalProcesses: runningProcesses.size,
    });

    let stdout = '';
    let stderr = '';
    let isAborted = false;

    // 监听取消信号
    const abortHandler = () => {
      if (isAborted) return;
      isAborted = true;
      
      logger.info('CommandExecutor: Received abort signal, killing process');
      child.kill('SIGTERM');
      
      // 从跟踪集合中移除
      runningProcesses.delete(child);
      logger.debug('CommandExecutor: Process removed from tracking (abort)', {
        totalProcesses: runningProcesses.size,
      });
      
      const error = new CommandExecutorError(
        'Command execution was cancelled',
        stdout,
        stderr,
        -1
      );
      reject(error);
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', abortHandler, { once: true });
    }

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
        // 如果已经被取消，不需要再处理
        if (isAborted) {
          return;
        }

        // 移除 abort 监听器
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }

        child.kill('SIGTERM');
        // 从跟踪集合中移除
        runningProcesses.delete(child);
        logger.debug('CommandExecutor: Process removed from tracking (timeout)', {
          totalProcesses: runningProcesses.size,
        });
        
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

      // 移除 abort 监听器
      if (abortSignal) {
        abortSignal.removeEventListener('abort', abortHandler);
      }

      // 如果已经被取消，不需要再处理
      if (isAborted) {
        return;
      }

      // 从跟踪集合中移除
      runningProcesses.delete(child);
      logger.debug('CommandExecutor: Process removed from tracking (close)', {
        totalProcesses: runningProcesses.size,
      });

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

      // 移除 abort 监听器
      if (abortSignal) {
        abortSignal.removeEventListener('abort', abortHandler);
      }

      // 如果已经被取消，不需要再处理
      if (isAborted) {
        return;
      }
      
      // 从跟踪集合中移除
      runningProcesses.delete(child);
      logger.debug('CommandExecutor: Process removed from tracking (error)', {
        totalProcesses: runningProcesses.size,
      });
      
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
