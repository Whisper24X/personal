/**
 * WriteCode Action
 * Generates source code from design document
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { CODE_SYSTEM_PROMPT, buildCodePrompt, parseCodeFiles } from '../prompts/code';
import { logger } from '../utils';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface WriteCodeOptions {
  applicationId?: string;
  version?: number;
  workspacePath?: string;
}

export class WriteCode extends BaseAction {
  constructor() {
    super('WriteCode', 'Generate source code from design document');
  }

  async run(design: string, options?: WriteCodeOptions): Promise<IActionOutput> {
    logger.info('WriteCode: Starting code generation');
    
    try {
      // Build the prompt
      const prompt = buildCodePrompt(design);
      
      // Call LLM with system message and prompt
      const codeOutput = await this.aask(prompt, [CODE_SYSTEM_PROMPT]);
      
      // Parse the output into separate files
      const files = parseCodeFiles(codeOutput);
      
      logger.info('WriteCode: Code generation completed', {
        filesGenerated: files.length,
        totalLength: codeOutput.length,
      });
      
      // Save files to workspace
      const workspaceDir = this.getWorkspaceDir(options);
      for (const file of files) {
        await this.saveToWorkspace(file.path, file.content, workspaceDir);
      }
      
      // Create a summary of generated files
      const summary = files.map((f) => `- ${f.path}`).join('\n');
      
      return {
        content: `# Generated Code\n\n## Files Created:\n${summary}\n\n## Full Code:\n\n${codeOutput}`,
        data: {
          type: 'code',
          files: files,
          filesCount: files.length,
          workspaceDir: workspaceDir,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('WriteCode: Failed to generate code', error);
      throw error;
    }
  }

  /**
   * 获取工作目录路径
   * 使用根目录的 workspace 目录，文件夹命名格式：应用-版本号-类型（如 default-v1-CODE）
   */
  private getWorkspaceDir(options?: WriteCodeOptions): string {
    const possibleRoots = [
      path.resolve(__dirname, '../../../'),
      path.resolve(__dirname, '../../../../'),
      process.cwd(),
    ];

    let projectRoot = possibleRoots[0];
    for (const root of possibleRoots) {
      if (fsSync.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
        fsSync.existsSync(path.join(root, 'package.json'))) {
        projectRoot = root;
        break;
      }
    }

    const workspaceRoot = options?.workspacePath || process.env.WORKSPACE_PATH || path.join(projectRoot, 'workspace');
    const applicationId = options?.applicationId || 'default';
    const version = options?.version || 1;
    const type = 'CODE';
    return path.join(workspaceRoot, `${applicationId}-v${version}-${type}`);
  }

  /**
   * 保存文件到 workspace
   */
  private async saveToWorkspace(
    filePath: string,
    content: string,
    workspaceDir: string
  ): Promise<void> {
    try {
      const fullPath = path.join(workspaceDir, filePath);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.info('WriteCode: Saved file to workspace', {
        filePath: fullPath,
        contentLength: content.length,
      });
    } catch (error: any) {
      logger.error('WriteCode: Failed to save file to workspace', {
        filePath,
        error: error.message,
      });
      // 不抛出错误，继续执行其他文件
    }
  }
}

export default WriteCode;

