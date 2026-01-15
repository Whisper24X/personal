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
      
      // 获取CODE目录
      const workspaceOptions = {
        ...options,
        documentType: 'CODE',
      };
      // 确保使用绝对路径
      const workspaceDir = path.resolve(this.getWorkspaceDir(workspaceOptions));
      
      // 确保目录存在
      await fs.mkdir(workspaceDir, { recursive: true });
      
      logger.info('WriteCode: Workspace directory prepared', { workspaceDir });
      
      // 构建cursor cli命令
      // 使用 cursor-agent --print 在非交互模式下运行，不会打开Agent窗口
      // 使用绝对路径确保文件生成到正确的位置
      const prompt = `生成一个test.txt文档放到${workspaceDir}目录下`;
      const command = `cursor-agent --print "${prompt}"`;
      
      logger.info('WriteCode: Executing Cursor CLI command', { command, cwd: workspaceDir });
      
      // 执行cursor cli命令（异步执行）
      // 设置 cwd 为工作目录，确保 cursor-agent 在正确的目录下执行
      let stdout = '';
      try {
        stdout = await executeCommandSimple(command, {
          cwd: workspaceDir,
          timeout: 300000, // 5分钟超时
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
        workspaceDir,
      });
      
      // 读取生成的文件列表
      const files: Array<{ path: string; content: string }> = [];
      try {
        const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const filePath = path.join(workspaceDir, entry.name);
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
          workspaceDir: workspaceDir,
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

