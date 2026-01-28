/**
 * Stream Command Executor
 * 流式命令执行器
 * 
 * 支持流式输出处理和 stream-json 格式解析
 * 实时解析进度事件并记录到日志
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';
import { CommandExecutorOptions, CommandExecutorResult, CommandExecutorError } from './commandExecutor';
import { StreamJSONEvent } from '../executors/types';
import winston from 'winston';

// 跟踪所有正在运行的子进程
const runningProcesses = new Set<ChildProcess>();

// 清理所有正在运行的子进程
function cleanupAllProcesses() {
  if (runningProcesses.size > 0) {
    logger.info('StreamCommandExecutor: Cleaning up running processes', {
      count: runningProcesses.size,
    });
    
    for (const child of runningProcesses) {
      try {
        child.kill('SIGTERM');
      } catch (error: any) {
        logger.warn('StreamCommandExecutor: Failed to kill child process', {
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

  process.on('exit', () => {
    cleanupAllProcesses();
  });

  process.on('SIGTERM', () => {
    logger.info('StreamCommandExecutor: Received SIGTERM, cleaning up...');
    cleanupAllProcesses();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('StreamCommandExecutor: Received SIGINT, cleaning up...');
    cleanupAllProcesses();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    logger.error('StreamCommandExecutor: Uncaught exception, cleaning up...', {
      error: error.message,
    });
    cleanupAllProcesses();
    process.exit(1);
  });
}

/**
 * 进度跟踪器接口
 */
interface ProgressTracker {
  accumulatedText: string;
  toolCount: number;
  startTime: number;
  model?: string;
}

/**
 * 创建进度事件处理器
 */
export function createProgressHandler(
  callId: string,
  log: winston.Logger = logger
): (event: StreamJSONEvent) => void {
  const tracker: ProgressTracker = {
    accumulatedText: '',
    toolCount: 0,
    startTime: Date.now(),
  };

  return (event: StreamJSONEvent) => {
    try {
      switch (event.type) {
        case 'system':
          if (event.subtype === 'init' && event.model) {
            tracker.model = event.model;
            log.info('CursorCLIProvider: Stream progress - system.init', {
              callId,
              model: event.model,
            });
          }
          break;

        case 'assistant':
          if (event.message?.content) {
            const text = event.message.content
              .map(c => c.text || '')
              .join('');
            tracker.accumulatedText += text;
            log.debug('CursorCLIProvider: Stream progress - assistant', {
              callId,
              textLength: text.length,
              accumulatedLength: tracker.accumulatedText.length,
            });
          }
          break;

        case 'tool_call':
          if (event.subtype === 'started') {
            tracker.toolCount++;
            const toolCall = event.tool_call;
            
            if (toolCall?.writeToolCall) {
              log.info('CursorCLIProvider: Stream progress - tool_call.started', {
                callId,
                toolNumber: tracker.toolCount,
                type: 'write',
                path: toolCall.writeToolCall.args.path,
              });
            } else if (toolCall?.readToolCall) {
              log.info('CursorCLIProvider: Stream progress - tool_call.started', {
                callId,
                toolNumber: tracker.toolCount,
                type: 'read',
                path: toolCall.readToolCall.args.path,
              });
            }
          } else if (event.subtype === 'completed') {
            const toolCall = event.tool_call;
            
            if (toolCall?.writeToolCall?.result?.success) {
              const result = toolCall.writeToolCall.result.success;
              log.info('CursorCLIProvider: Stream progress - tool_call.completed', {
                callId,
                toolNumber: tracker.toolCount,
                type: 'write',
                linesCreated: result.linesCreated,
                fileSize: result.fileSize,
              });
            } else if (toolCall?.readToolCall?.result?.success) {
              const result = toolCall.readToolCall.result.success;
              log.info('CursorCLIProvider: Stream progress - tool_call.completed', {
                callId,
                toolNumber: tracker.toolCount,
                type: 'read',
                totalLines: result.totalLines,
              });
            }
          }
          break;

        case 'result':
          const duration = event.duration_ms || 0;
          const totalTime = Date.now() - tracker.startTime;
          log.info('CursorCLIProvider: Stream progress - result', {
            callId,
            durationMs: duration,
            totalTimeMs: totalTime,
            toolCount: tracker.toolCount,
            accumulatedTextLength: tracker.accumulatedText.length,
            model: tracker.model,
          });
          break;
      }
    } catch (error: any) {
      log.warn('StreamCommandExecutor: Error processing progress event', {
        callId,
        error: error.message,
        eventType: event.type,
      });
    }
  };
}

/**
 * 流式命令执行选项
 */
export interface StreamCommandExecutorOptions extends CommandExecutorOptions {
  /** 进度事件回调 */
  onProgress?: (event: StreamJSONEvent) => void;
}

/**
 * 使用spawn异步执行命令（流式模式）
 * 支持 stream-json 格式解析和实时进度跟踪
 * 
 * @param command 要执行的命令（包含参数）
 * @param options 执行选项
 * @returns Promise<CommandExecutorResult> 命令执行结果
 */
export async function executeCommandStream(
  command: string,
  options: StreamCommandExecutorOptions = {}
): Promise<CommandExecutorResult> {
  const {
    cwd = process.cwd(),
    timeout = 300000, // 默认5分钟
    shell = true,
    env = process.env,
    abortSignal,
    onProgress,
  } = options;

  // 检查是否已经被取消
  if (abortSignal?.aborted) {
    const error = new CommandExecutorError(
      'Command execution was cancelled before start',
      '',
      '',
      -1
    );
    logger.info('StreamCommandExecutor: Command cancelled before start');
    throw error;
  }

  return new Promise((resolve, reject) => {
    // 注册清理函数（只注册一次）
    registerCleanup();

    logger.info('StreamCommandExecutor: Spawning command', {
      command: shell ? command : command.split(' ')[0],
      cwd,
      timeout,
      shell,
      hasProgressHandler: !!onProgress,
    });

    // 使用spawn执行命令
    let child: ChildProcess;
    if (shell) {
      child = spawn(command, {
        cwd,
        shell: true,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
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
    logger.debug('StreamCommandExecutor: Process added to tracking', {
      totalProcesses: runningProcesses.size,
    });

    let stdout = '';
    let stderr = '';
    let isAborted = false;
    let buffer = ''; // 用于缓冲不完整的行

    // 监听取消信号
    const abortHandler = () => {
      if (isAborted) return;
      isAborted = true;
      
      logger.info('StreamCommandExecutor: Received abort signal, killing process');
      child.kill('SIGTERM');
      
      runningProcesses.delete(child);
      logger.debug('StreamCommandExecutor: Process removed from tracking (abort)', {
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

    // 收集标准输出并解析 stream-json
    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      
      // 处理行缓冲
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后不完整的行
      
      // 逐行解析 JSON
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          try {
            const event = JSON.parse(trimmedLine) as StreamJSONEvent;
            // 调用进度回调
            if (onProgress) {
              onProgress(event);
            }
          } catch (parseError: any) {
            // JSON 解析错误，记录警告但不中断执行
            logger.debug('StreamCommandExecutor: Failed to parse JSON line', {
              line: trimmedLine.substring(0, 100),
              error: parseError.message,
            });
          }
        }
      }
    });

    // 收集标准错误输出
    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      logger.debug('StreamCommandExecutor: Command stderr chunk', { length: chunk.length });
    });

    // 设置超时处理
    let timeoutHandle: NodeJS.Timeout | null = null;
    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        if (isAborted) {
          return;
        }

        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }

        child.kill('SIGTERM');
        runningProcesses.delete(child);
        logger.debug('StreamCommandExecutor: Process removed from tracking (timeout)', {
          totalProcesses: runningProcesses.size,
        });
        
        const error = new CommandExecutorError(
          `Command execution timeout (${timeout}ms)`,
          stdout,
          stderr,
          -1
        );
        logger.warn('StreamCommandExecutor: Command execution timeout', {
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

      if (abortSignal) {
        abortSignal.removeEventListener('abort', abortHandler);
      }

      if (isAborted) {
        return;
      }

      // 处理缓冲区中剩余的内容
      if (buffer.trim() && onProgress) {
        try {
          const event = JSON.parse(buffer.trim()) as StreamJSONEvent;
          onProgress(event);
        } catch (parseError) {
          // 忽略解析错误
        }
      }

      runningProcesses.delete(child);
      logger.debug('StreamCommandExecutor: Process removed from tracking (close)', {
        totalProcesses: runningProcesses.size,
      });

      logger.info('StreamCommandExecutor: Command execution completed', {
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

      if (abortSignal) {
        abortSignal.removeEventListener('abort', abortHandler);
      }

      if (isAborted) {
        return;
      }
      
      runningProcesses.delete(child);
      logger.debug('StreamCommandExecutor: Process removed from tracking (error)', {
        totalProcesses: runningProcesses.size,
      });
      
      logger.error('StreamCommandExecutor: Command spawn error', { error: err.message });
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

export default executeCommandStream;
