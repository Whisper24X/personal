/**
 * WriteCode Action
 * 使用Cursor CLI命令行执行代码生成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, executeCommandSimple, CommandExecutorError, WorkspaceManager } from '../utils';
import { buildCursorCLIPrompt } from '../prompts/code';
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
      
      // 构建强约束提示词
      const systemPrompt = buildCursorCLIPrompt();
      
      logger.info('WriteCode: Using strong constraint prompt for Cursor CLI', {
        promptLength: systemPrompt.length,
        constraintType: 'Cursor CLI Code Generation',
      });
      
      // 定义命令
      const applyCommand = "执行/openspec-apply命令，并且自动执行所有必要的构建命令（如make api、make wire、npm run generate等），不要只生成代码就停止，必须完成所有任务直到tasks.md中的任务全部标记为完成。";

      const checkCommand = "在openspec目录下changes目录内查找tasks.md,告诉我里面的任务是否全部执行完成,给我返回:已完成、未完成或未找到，不要返回具体原因。如果文件不存在或无法找到，返回未找到。";
      
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
          });
          logger.info(`WriteCode: Check command completed (iteration ${retryCount})`, {
            outputLength: checkOutput.length,
            output: checkOutput.substring(0, 200), // 记录前200字符
          });
        } catch (execError) {
          const error = execError as CommandExecutorError;
          logger.warn(`WriteCode: Check command failed (iteration ${retryCount})`, { 
            message: error.message,
            exitCode: error.exitCode,
            stdout: error.stdout || '(empty)',
            stderr: error.stderr || '(empty)',
          });
          checkOutput = error.stdout || '';
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);
        
        // 3. 判断是否完成
        // 先检查是否返回"未找到"，如果是则抛出错误
        if (checkOutput.includes('未找到')) {
          const errorMessage = `WriteCode: Task file not found. Check command returned "未找到". Output: ${checkOutput.substring(0, 500)}`;
          logger.error(errorMessage, {
            iteration: retryCount,
            checkOutput: checkOutput.substring(0, 500),
          });
          throw new Error(errorMessage);
        }
        
        // 检查输出中是否包含"已完成"
        if (checkOutput.includes('已完成')) {
          isCompleted = true;
          logger.info(`WriteCode: Tasks completed successfully (iteration ${retryCount})`, {
            totalIterations: retryCount,
          });
        } else {
          logger.warn(`WriteCode: Tasks not completed yet (iteration ${retryCount})`, {
            checkOutput: checkOutput.substring(0, 200),
            willRetry: retryCount < maxRetries,
          });
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

