/**
 * Deploy Action
 * 使用Cursor CLI命令行执行部署调试
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';

export interface DeployOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class Deploy extends BaseAction {
  constructor() {
    super('Deploy', 'Deploy application using Cursor CLI');
  }

  async run(design: string, options?: DeployOptions): Promise<IActionOutput> {
    logger.info('Deploy: Starting deployment using Cursor CLI', {
      designLength: design?.length || 0,
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
    });
    
    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('Deploy: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('Deploy: projectId is required in options');
      }
      
      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);
      
      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });
      
      logger.info('Deploy: Workspace directory prepared', { 
        workDir,
      });
      
      // 执行部署命令
      logger.info('Deploy: Executing deploy command', {
        workDir,
      });
      
      const deployPrompt = '在当前目录下生成一个deployTest.txt文档，内容为 我是部署调试';
      const deployResult = await this.runCLICommand(deployPrompt, workDir, {
        timeout: 300000, // 5分钟超时
        abortSignal: this.abortSignal,
      });
      
      if (deployResult.exitCode !== 0) {
        logger.error('Deploy: Deploy command failed', {
          exitCode: deployResult.exitCode,
          stderr: deployResult.stderr,
        });
        throw new Error(`Deploy command failed with exit code ${deployResult.exitCode}`);
      }
      
      logger.info('Deploy: Deploy command completed', {
        outputLength: deployResult.output.length,
      });
      
      return {
        content: `# Deploy Completed\n\n## Deploy Prompt\n\`\`\`\n${deployPrompt}\n\`\`\`\n\n## Output:\n\`\`\`\n${deployResult.output}\n\`\`\``,
        data: {
          type: 'deploy',
          workspaceDir: workDir,
          deployOutput: deployResult.output,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('Deploy: Failed to deploy using Cursor CLI', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

}

export default Deploy;
