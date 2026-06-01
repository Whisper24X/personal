/**
 * FillProjectContext Action
 * Fill project context from PRD and DESIGN documents
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { buildFillProjectContextPrompt, FillProjectContextPaths } from '../prompts/task';

export interface FillProjectContextOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class FillProjectContext extends BaseAction {
  constructor() {
    super('FillProjectContext', 'Fill project context from PRD and DESIGN documents');
  }

  async run(options?: FillProjectContextOptions): Promise<IActionOutput> {
    logger.info('FillProjectContext: Starting project context filling', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('FillProjectContext: Workspace directory prepared', {
        workDir,
      });

      // 检查是否被取消
      this.checkCancellation();

      // 构建路径配置
      const paths: FillProjectContextPaths = {
        projectMdPath: 'openspec/project.md',
        designPath: '../docs/design/DESIGN.md',
        prdPath: '../docs/prd/PRD.md',
        agentsPath: '../AGENTS.md',
      };

      // 构建提示词
      const prompt = buildFillProjectContextPrompt(paths);

      logger.info('FillProjectContext: Executing CLI command', {
        promptLength: prompt.length,
      });

      // 执行 CLI 命令
      const result = await this.runCLICommand(prompt, workDir, {
        timeout: 1800000, // 30分钟超时
        abortSignal: this.abortSignal,
      });

      if (result.exitCode === 0) {
        logger.info('FillProjectContext: Command completed successfully', {
          outputLength: result.output.length,
        });
      } else {
        logger.warn('FillProjectContext: Command failed', {
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'fill_project_context',
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('FillProjectContext: Failed to fill project context', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default FillProjectContext;
