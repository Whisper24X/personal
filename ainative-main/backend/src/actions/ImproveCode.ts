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
          content: `# ImproveCode 调试模式\n\n## 调试提示词\n\`\`\`\n${debugPrompt}\n\`\`\`\n\n## 输出结果:\n\`\`\`\n${debugResult.output}\n\`\`\``,
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
          content: `# 代码改进 - 已跳过\n\n未找到改进文件 \`docs/code/ImproveCode.md\`。\n\n这是正常现象，首次执行时不会运行。只有在 QA 测试发现问题后才会执行。\n\n## 工作流程：\n\n1. QA 测试识别 Bug 或改进机会\n2. 系统生成 \`docs/code/ImproveCode.md\` 文件，包含问题详情\n3. ImproveCode 读取文件并执行代码改进\n4. 改进成功后删除该文件\n5. 如果发现新问题，重复上述流程\n\n当前状态: ✅ 无需改进`,
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
        content: `# 代码改进${isCompleted ? '已完成' : '未完成'}\n\n## 状态: ${isCompleted ? '✅ 所有改进已成功完成' : '❌ 已达最大重试次数，可能仍有未解决的问题'}\n\n## 执行次数: ${retryCount}\n\n## Cursor CLI 输出:\n\n${stdout}`,
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
