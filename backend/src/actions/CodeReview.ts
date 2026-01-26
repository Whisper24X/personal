/**
 * CodeReview Action
 * 使用 Cursor CLI 进行代码审查
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { buildCursorCLICodeReviewPrompt } from '../prompts/code';
import { logger, WorkspaceOptions, executeCommandSimple, CommandExecutorError } from '../utils';
import * as fs from 'fs/promises';

export interface CodeReviewOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class CodeReview extends BaseAction {
  constructor() {
    super('CodeReview', 'Review code using Cursor CLI');
  }

  async run(_unused: string, options?: CodeReviewOptions): Promise<IActionOutput> {
    logger.info('CodeReview: Starting code review using Cursor CLI', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });
    
    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('CodeReview: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('CodeReview: projectId is required in options');
      }
      
      // 获取 CODE 目录
      const codeDir = this.getWorkspaceDir({ ...options, documentType: 'CODE' });
      // 工作目录
      const workDir = codeDir;
      
      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });
      
      logger.info('CodeReview: Workspace directory prepared', { 
        workDir,
      });
      
      // 构建代码审查提示词
      const reviewPrompt = buildCursorCLICodeReviewPrompt();
      
      logger.info('CodeReview: Using Cursor CLI code review prompt', {
        promptLength: reviewPrompt.length,
      });
      
      // 执行代码审查命令
      const command = `cursor-agent --model composer-1 --print "${reviewPrompt}"`;
      
      logger.info('CodeReview: Executing Cursor CLI review command', { 
        cwd: workDir,
      });
      
      // 检查是否被取消
      this.checkCancellation();
      
      let reviewOutput = '';
      try {
        reviewOutput = await executeCommandSimple(command, {
          cwd: workDir,
          timeout: 600000, // 10分钟超时（代码审查应该较快）
          abortSignal: this.abortSignal, // 传递取消信号
        });
        logger.info('CodeReview: Review command completed', {
          outputLength: reviewOutput.length,
        });
      } catch (execError) {
        const error = execError as CommandExecutorError;
        // 如果是取消错误，向上抛出
        if (error.message?.includes('cancelled')) {
          logger.info('CodeReview: Review command cancelled');
          throw error;
        }
        logger.warn('CodeReview: Review command failed', { 
          message: error.message,
          exitCode: error.exitCode,
        });
        reviewOutput = error.stdout || '';
      }
      
      logger.info('CodeReview: Code review completed', {
        outputLength: reviewOutput.length,
        workDir,
      });
      
      return {
        content: `# Code Review Report\n\n${reviewOutput}`,
        data: {
          type: 'code_review',
          workspaceDir: codeDir,
          reviewOutput,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('CodeReview: Failed to review code using Cursor CLI', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default CodeReview;

