/**
 * CreateOpenSpecProposal Action
 * Create openSpec change proposal based on PRD and DESIGN documents
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { buildCreateOpenSpecProposalPrompt, OpenSpecProposalPaths } from '../prompts/task';

export interface CreateOpenSpecProposalOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class CreateOpenSpecProposal extends BaseAction {
  constructor() {
    super('CreateOpenSpecProposal', 'Create openSpec change proposal based on PRD and DESIGN');
  }

  async run(options?: CreateOpenSpecProposalOptions): Promise<IActionOutput> {
    logger.info('CreateOpenSpecProposal: Starting proposal creation', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('CreateOpenSpecProposal: Workspace directory prepared', {
        workDir,
      });

      // 检查是否被取消
      this.checkCancellation();

      // 构建路径配置
      const paths: OpenSpecProposalPaths = {
        prdPath: '../docs/prd/PRD.md',
        designPath: '../docs/design/DESIGN.md',
        agentsPath: '../AGENTS.md',
        devSpecPath: '../docs/dev-spec',
        // 模板代码路径
        appTemplatePath: '../ainative-app',
        backendTemplatePath: '../ainative-backend',
        shadowTemplatePath: '../ainative-shadow',
      };

      // 构建提示词
      const prompt = buildCreateOpenSpecProposalPrompt(paths);

      logger.info('CreateOpenSpecProposal: Executing CLI command', {
        promptLength: prompt.length,
      });

      // 执行 CLI 命令
      const result = await this.runCLICommand(prompt, workDir, {
        timeout: 3600000, // 60分钟超时
        abortSignal: this.abortSignal,
      });

      if (result.exitCode === 0) {
        logger.info('CreateOpenSpecProposal: Command completed successfully', {
          outputLength: result.output.length,
        });
      } else {
        logger.warn('CreateOpenSpecProposal: Command failed', {
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'openspec_proposal',
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('CreateOpenSpecProposal: Failed to create proposal', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default CreateOpenSpecProposal;
