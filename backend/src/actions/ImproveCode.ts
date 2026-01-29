/**
 * ImproveCode Action
 * 基于QA反馈和用户建议改进代码
 * 使用Cursor CLI执行代码改进
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { getImproveCommand } from '../prompts/code';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImproveCodeOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class ImproveCode extends BaseAction {
  constructor() {
    super('ImproveCode', 'Improve code based on QA feedback and user suggestions');
  }

  async run(design: string, options?: ImproveCodeOptions): Promise<IActionOutput> {
    logger.info('ImproveCode: Starting code improvement using Cursor CLI', {
      designLength: design?.length || 0,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });
    
    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('ImproveCode: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('ImproveCode: projectId is required in options');
      }
      
      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);
      const improveFilePath = path.join(workDir, 'docs/code/ImproveCode.md');
      
      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });
      
      logger.info('ImproveCode: Workspace directory prepared', { 
        workDir,
        improveFilePath,
      });
      
      // 调试模式检查
      const isDebugMode = process.env.IMPROVE_CODE_DEBUG === 'true';
      if (isDebugMode) {
        logger.info('ImproveCode: Debug mode enabled, executing debug command', {
          workDir,
        });
        
        const debugPrompt = '在 docs/code 目录下创建 improveTest.txt 文档，内容为：ImproveCode 调试测试成功';
        const debugResult = await this.runCLICommand(debugPrompt, workDir, {
          timeout: 300000, // 5分钟超时
        });
        
        if (debugResult.exitCode !== 0) {
          logger.error('ImproveCode: Debug command failed', {
            exitCode: debugResult.exitCode,
            stderr: debugResult.stderr,
          });
          throw new Error(`Debug command failed with exit code ${debugResult.exitCode}`);
        }
        
        logger.info('ImproveCode: Debug command completed', {
          outputLength: debugResult.output.length,
        });
        
        return {
          content: `# ImproveCode Debug Mode\n\n## Debug Prompt\n\`\`\`\n${debugPrompt}\n\`\`\`\n\n## Output:\n\`\`\`\n${debugResult.output}\n\`\`\``,
          data: {
            type: 'debug',
            workspaceDir: workDir,
            debugOutput: debugResult.output,
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      // 首次检查文件是否存在
      let fileExists = await this.checkFileExists(improveFilePath);
      if (!fileExists) {
        logger.info('ImproveCode: No improvement file found, skipping', {
          improveFilePath,
        });
        return {
          content: `# ImproveCode - Skipped\n\nNo improvement file found at \`docs/code/ImproveCode.md\`.\n\nThis is normal for the first execution. The action will only run when QA testing discovers issues.\n\n## How it works:\n\n1. QA testing identifies bugs or improvement opportunities\n2. System generates \`docs/code/ImproveCode.md\` with issue details\n3. ImproveCode action reads the file and performs improvements\n4. After successful improvements, the file is deleted\n5. Process repeats if new issues are found\n\nCurrent status: ✅ No improvements needed`,
          data: {
            type: 'skipped',
            reason: 'no_improvement_file',
            filePath: improveFilePath,
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      // 在循环外获取固定提示词（重要：避免每次循环重新构建）
      const improveCommand = getImproveCommand();
      
      // 循环改进（最多 10 次）
      const maxRetries = 10;
      let isCompleted = false;
      let retryCount = 0;
      let allOutputs: string[] = [];
      
      logger.info('ImproveCode: Starting improvement loop', {
        cwd: workDir,
        maxRetries,
        improveFilePath,
      });
      
      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        retryCount++;
        
        logger.info(`ImproveCode: Iteration ${retryCount}/${maxRetries} - Executing improve command`);
        
        // 执行改进命令
        const result = await this.runCLICommand(improveCommand, workDir, {
          timeout: 600000, // 10分钟超时
          abortSignal: this.abortSignal,
        });
        
        const improveOutput = result.output;
        if (result.exitCode === 0) {
          logger.info(`ImproveCode: Command completed (iteration ${retryCount})`, {
            outputLength: improveOutput.length,
            output: improveOutput.length > 0 ? improveOutput.substring(0, 200) : '(empty output)',
          });
        } else {
          logger.warn(`ImproveCode: Command failed (iteration ${retryCount})`, {
            exitCode: result.exitCode,
            stdout: improveOutput || '(empty)',
            stderr: result.stderr || '(empty)',
          });
        }
        
        allOutputs.push(`=== Iteration ${retryCount} ===\n${improveOutput}`);
        
        // 检查文件是否还存在
        fileExists = await this.checkFileExists(improveFilePath);
        if (!fileExists) {
          isCompleted = true;
          logger.info(`ImproveCode: File deleted, improvement completed (iteration ${retryCount})`, {
            improveFilePath,
            totalIterations: retryCount,
          });
        } else {
          logger.info(`ImproveCode: File still exists, continuing (iteration ${retryCount})`, {
            improveFilePath,
            willRetry: retryCount < maxRetries,
          });
        }
      }
      
      // 汇总输出
      const stdout = allOutputs.join('\n\n');
      
      if (!isCompleted) {
        logger.error('ImproveCode: Max retries reached, improvement still not completed', {
          maxRetries,
          totalIterations: retryCount,
          improveFilePath,
        });
      }
      
      logger.info('ImproveCode: Improvement loop completed', {
        isCompleted,
        totalIterations: retryCount,
        workDir,
      });
      
      return {
        content: `# Code Improvement ${isCompleted ? 'Completed' : 'Incomplete'}\n\n## Status: ${isCompleted ? '✅ All improvements completed successfully' : '❌ Max retries reached, some issues may remain'}\n\n## Total Iterations: ${retryCount}\n\n## Cursor CLI Output:\n\n${stdout}`,
        data: {
          type: 'improve_code',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
          totalIterations: retryCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('ImproveCode: Failed to improve code using Cursor CLI', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default ImproveCode;
