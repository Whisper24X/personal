/**
 * WriteCode Action
 * 使用Cursor CLI命令行执行代码生成
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, executeCommandSimple, CommandExecutorError } from '../utils';
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
      
      // 获取版本目录（v1），不包含文档类型子目录
      // 先获取任意文档类型的路径，然后取父目录得到 v1 目录
      const anyDocDir = this.getWorkspaceDir({ ...options, documentType: 'CODE' });
      const versionDir = path.dirname(anyDocDir); // 去掉最后的 CODE，得到 v1 目录
      
      // CODE 子目录路径（由 cursor-agent 自动创建）
      const codeDir = path.join(versionDir, 'CODE');
      
      logger.info('WriteCode: Workspace directory prepared', { 
        versionDir,
        codeDir,
      });
      
      // 构建cursor cli命令
      // 使用 cursor-agent --print 在非交互模式下运行，不会打开Agent窗口
      // 命令在版本目录（v1）运行，可以访问 DESIGN、PRD、TASK 等同级目录，代码生成到 CODE 子目录
      const prompt = `读DESIGN目录下的DESIGN.md,PRD目录下的PRD.md,TASK目录TASK_BREAKDOWN.md,严格参考我给你的设计文档，生成代码，并生成到CODE目录下`;
      const command = `cursor-agent --model composer-1 --print "${prompt}"`;
      
      logger.info('WriteCode: Executing Cursor CLI command', { 
        command, 
        cwd: versionDir,
        targetDir: 'CODE',
      });
      
      // 执行cursor cli命令（异步执行）
      // 设置 cwd 为版本目录（v1），确保 cursor-agent 能访问 DESIGN、PRD、TASK 等同级目录
      let stdout = '';
      try {
        stdout = await executeCommandSimple(command, {
          cwd: versionDir,
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
        codeDir,
      });
      
      // 读取生成的文件列表（从 CODE 目录）
      const files: Array<{ path: string; content: string }> = [];
      try {
        const entries = await fs.readdir(codeDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const filePath = path.join(codeDir, entry.name);
            const content = await fs.readFile(filePath, 'utf-8');
            files.push({ path: entry.name, content });
          }
        }
      } catch (error: any) {
        logger.warn('WriteCode: Failed to read generated files', { error: error.message });
      }
      
      // 创建文件列表摘要
      const summary = files.map((f) => `- ${f.path}`).join('\n');
      const codeOutput = files.map(f => `===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`).join('\n\n');
      
      return {
        content: `# Generated Code\n\n## Files Created:\n${summary}\n\n## Cursor CLI Output:\n\n${stdout}\n\n## Full Code:\n\n${codeOutput}`,
        data: {
          type: 'code',
          files: files,
          filesCount: files.length,
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

