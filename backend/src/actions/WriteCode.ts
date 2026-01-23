/**
 * WriteCode Action
 * 使用Cursor CLI命令行执行代码生成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, executeCommandSimple, CommandExecutorError, WorkspaceManager } from '../utils';
import { getApplyCommand, getCheckCommand } from '../prompts/code';
import * as fs from 'fs/promises';

export interface WriteCodeOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class WriteCode extends BaseAction {
  constructor() {
    super('WriteCode', 'Generate source code using Cursor CLI');
  }

  async run(design: string, options?: WriteCodeOptions): Promise<IActionOutput> {
    logger.info('WriteCode: Starting code generation using Cursor CLI', {
      designLength: design?.length || 0,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });
    
    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('WriteCode: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('WriteCode: projectId is required in options');
      }
      
      // 直接获取工作空间根目录 (ainative-workspace) - 代码将在此目录下生成
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);
      
      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });
      
      logger.info('WriteCode: Workspace directory prepared', { 
        workDir,
      });
      
      // 调试模式检查
      const isDebugMode = process.env.WRITE_CODE_DEBUG === 'true';
      if (isDebugMode) {
        logger.info('WriteCode: Debug mode enabled, executing debug command', {
          workDir,
        });
        
        try {
          const debugCommand = 'cursor-agent --model composer-1 --print "在当前目录下生成一个writeCodeTest.txt文档，内容为 我是编写代码调试"';
          const debugOutput = await executeCommandSimple(debugCommand, {
            cwd: workDir,
            timeout: 300000, // 5分钟超时
          });
          
          logger.info('WriteCode: Debug command completed', {
            outputLength: debugOutput.length,
          });
          
          return {
            content: `# WriteCode Debug Mode\n\n## Debug Command Executed\n\`\`\`\n${debugCommand}\n\`\`\`\n\n## Output:\n\`\`\`\n${debugOutput}\n\`\`\``,
            data: {
              type: 'debug',
              workspaceDir: workDir,
              debugOutput,
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error: any) {
          logger.error('WriteCode: Debug command failed', {
            message: error.message,
          });
          throw error;
        }
      }
      
      // 从 prompts/code.ts 获取命令提示词
      const applyCommand = getApplyCommand();
      const checkCommand = getCheckCommand();
      
      // 循环执行，直到任务完成
      const maxRetries = 10; // 最大重试次数
      let isCompleted = false;
      let retryCount = 0;
      let allOutputs: string[] = [];
      
      logger.info('WriteCode: Starting code generation loop', { 
        cwd: workDir,
        maxRetries,
      });
      
      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        retryCount++;
        
        logger.info(`WriteCode: Iteration ${retryCount}/${maxRetries} - Executing apply command`, {
          command: applyCommand,
        });
        
        // 1. 执行 apply 命令
        let applyOutput = '';
        try {
          const command = `cursor-agent --model composer-1 --print "${applyCommand}"`;
          applyOutput = await executeCommandSimple(command, {
            cwd: workDir,
            timeout: 3600000, // 60分钟超时
          });
          logger.info(`WriteCode: Apply command completed (iteration ${retryCount})`, {
            outputLength: applyOutput.length,
            output: applyOutput.length > 0 ? applyOutput : '(empty output)',
          });
        } catch (execError) {
          const error = execError as CommandExecutorError;
          logger.warn(`WriteCode: Apply command failed (iteration ${retryCount})`, { 
            message: error.message,
            exitCode: error.exitCode,
            stdout: error.stdout || '(empty)',
            stderr: error.stderr || '(empty)',
          });
          applyOutput = error.stdout || '';
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Apply ===\n${applyOutput}`);
        
        // 2. 执行 check 命令
        logger.info(`WriteCode: Iteration ${retryCount}/${maxRetries} - Executing check command`, {
          command: checkCommand,
        });
        
        let checkOutput = '';
        try {
          const command = `cursor-agent --model composer-1 --print "${checkCommand}"`;
          checkOutput = await executeCommandSimple(command, {
            cwd: workDir,
            timeout: 300000, // 5分钟超时（检查命令应该很快）
            abortSignal: this.abortSignal, // 传递取消信号
          });
          logger.info(`WriteCode: Check command completed (iteration ${retryCount})`, {
            outputLength: checkOutput.length,
            output: checkOutput.substring(0, 200), // 记录前200字符
          });
        } catch (execError) {
          const error = execError as CommandExecutorError;
          // 如果是取消错误，向上抛出
          if (error.message?.includes('cancelled')) {
            logger.info(`WriteCode: Check command cancelled (iteration ${retryCount})`);
            throw error;
          }
          logger.warn(`WriteCode: Check command failed (iteration ${retryCount})`, { 
            message: error.message,
            exitCode: error.exitCode,
            stdout: error.stdout || '(empty)',
            stderr: error.stderr || '(empty)',
          });
          checkOutput = error.stdout || '';
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);
        
        // 3. 判断是否完成 - 解析JSON响应
        try {
          // 尝试从输出中提取JSON
          const jsonMatch = checkOutput.match(/\{[\s\S]*"result"[\s\S]*\}/);
          if (!jsonMatch) {
            logger.warn(`WriteCode: Unable to parse JSON from check output (iteration ${retryCount})`, {
              checkOutput: checkOutput.substring(0, 200),
            });
            // 回退到旧的文本匹配方式
            if (checkOutput.includes('未找到')) {
              const errorMessage = `WriteCode: Task file not found. Check command returned "未找到". Output: ${checkOutput.substring(0, 500)}`;
              logger.error(errorMessage, {
                iteration: retryCount,
                checkOutput: checkOutput.substring(0, 500),
              });
              throw new Error(errorMessage);
            } else if (checkOutput.includes('已完成')) {
              isCompleted = true;
            }
          } else {
            const checkResult = JSON.parse(jsonMatch[0]);
            const result = checkResult.result;
            const reason = checkResult.reason || '';
            
            logger.info(`WriteCode: Check result parsed (iteration ${retryCount})`, {
              result,
              reason,
            });
            
            if (result === '未找到') {
              const errorMessage = `WriteCode: Task file not found. Reason: ${reason}`;
              logger.error(errorMessage, {
                iteration: retryCount,
                result,
                reason,
              });
              throw new Error(errorMessage);
            } else if (result === '已完成') {
              isCompleted = true;
              logger.info(`WriteCode: Tasks completed successfully (iteration ${retryCount})`, {
                totalIterations: retryCount,
                reason,
              });
            } else {
              logger.warn(`WriteCode: Tasks not completed yet (iteration ${retryCount})`, {
                result,
                reason,
                willRetry: retryCount < maxRetries,
              });
            }
          }
        } catch (parseError: any) {
          logger.warn(`WriteCode: Failed to parse check output as JSON (iteration ${retryCount})`, {
            error: parseError.message,
            checkOutput: checkOutput.substring(0, 200),
          });
          // 回退到旧的文本匹配方式
          if (checkOutput.includes('未找到')) {
            const errorMessage = `WriteCode: Task file not found. Check command returned "未找到". Output: ${checkOutput.substring(0, 500)}`;
            logger.error(errorMessage, {
              iteration: retryCount,
              checkOutput: checkOutput.substring(0, 500),
            });
            throw new Error(errorMessage);
          } else if (checkOutput.includes('已完成')) {
            isCompleted = true;
          }
        }
      }
      
      // 汇总输出
      const stdout = allOutputs.join('\n\n');
      
      if (!isCompleted) {
        logger.error('WriteCode: Max retries reached, tasks still not completed', {
          maxRetries,
          totalIterations: retryCount,
        });
      }
      
      logger.info('WriteCode: Code generation loop completed', {
        isCompleted,
        totalIterations: retryCount,
        workDir,
      });
      
      return {
        content: `# Code Generation ${isCompleted ? 'Completed' : 'Incomplete'}\n\n## Status: ${isCompleted ? '✅ All tasks completed' : '❌ Max retries reached'}\n\n## Total Iterations: ${retryCount}\n\n## Cursor CLI Output:\n\n${stdout}`,
        data: {
          type: 'code',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
          totalIterations: retryCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      // 避免循环引用导致JSON序列化失败
      logger.error('WriteCode: Failed to generate code using Cursor CLI', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

}

export default WriteCode;

