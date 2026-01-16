/**
 * WriteCode Action
 * 使用Cursor CLI命令行执行代码生成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, executeCommandSimple, CommandExecutorError } from '../utils';
import { buildCursorCLIPrompt } from '../prompts/code';
import * as fs from 'fs/promises';
import * as path from 'path';

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
      
      // 获取 CODE 目录
      const codeDir = this.getWorkspaceDir({ ...options, documentType: 'CODE' });
      // 获取父目录（v1 目录，包含 DESIGN、PRD、TASK 等同级目录）
      // const versionDir = path.dirname(codeDir); // 保留供后续使用
      // 工作目录：暂时等于 codeDir，可以根据需要修改为 versionDir
      const workDir = codeDir;
      
      // 确保 工作 目录存在
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
      
      // 构建cursor cli命令
      // 使用 cursor-agent --print 在非交互模式下运行，不会打开Agent窗口
      // 命令在版本目录（v1）运行，可以访问 DESIGN、PRD、TASK 等同级目录，代码生成到 CODE 子目录
      // 转义提示词中的双引号，确保命令正确执行
      // const escapedPrompt = systemPrompt.replace(/"/g, '\\"').replace(/\n/g, ' ');
      const escapedPrompt = "执行/openspec-apply命令"
      // const escapedPrompt = "读DESIGN目录下的DESIGN.md,PRD目录下的PRD.md,TASK目录TASK_BREAKDOWN.md,生成完整的代码"

      const command = `cursor-agent --model composer-1 --print "${escapedPrompt}"`;
      
      logger.info('WriteCode: Executing Cursor CLI command with strong constraints', { 
        cwd: workDir,
      });
      
      // 执行cursor cli命令（异步执行）
      let stdout = '';
      try {
        stdout = await executeCommandSimple(command, {
          cwd: workDir,
          timeout: 3600000, // 60分钟超时（适用于生成整个项目）
        });
      } catch (execError) {
        // 命令执行失败，但我们可能仍然想继续
        const error = execError as CommandExecutorError;
        logger.warn('WriteCode: Cursor CLI command failed', { 
          message: error.message,
          exitCode: error.exitCode,
        });
        stdout = error.stdout || '';
      }
      
      logger.info('WriteCode: Cursor CLI execution completed', {
        stdoutLength: stdout.length,
        workDir,
      });
      
      return {
        content: `# Code Generation Completed\n\n## Cursor CLI Output:\n\n${stdout}`,
        data: {
          type: 'code',
          workspaceDir: codeDir,
          cursorOutput: stdout,
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

