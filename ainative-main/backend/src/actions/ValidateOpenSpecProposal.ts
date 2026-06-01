/**
 * ValidateOpenSpecProposal Action
 * Validate openSpec change proposal format and structure
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { VALIDATE_OPENSPEC_PROPOSAL_PROMPT } from '../prompts/task';

export interface ValidateOpenSpecProposalOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class ValidateOpenSpecProposal extends BaseAction {
  constructor() {
    super('ValidateOpenSpecProposal', 'Validate openSpec change proposal format and structure');
  }

  async run(options?: ValidateOpenSpecProposalOptions): Promise<IActionOutput> {
    logger.info('ValidateOpenSpecProposal: Starting proposal validation', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('ValidateOpenSpecProposal: Workspace directory prepared', {
        workDir,
      });

      // 检查是否被取消
      this.checkCancellation();

      logger.info('ValidateOpenSpecProposal: Executing CLI command', {
        promptLength: VALIDATE_OPENSPEC_PROPOSAL_PROMPT.length,
      });

      // 执行 CLI 命令
      const result = await this.runCLICommand(VALIDATE_OPENSPEC_PROPOSAL_PROMPT, workDir, {
        timeout: 300000, // 5分钟超时
        abortSignal: this.abortSignal,
      });

      // 判断验证是否通过
      const passed = result.output.includes('SUCCESS');

      if (result.exitCode === 0) {
        logger.info('ValidateOpenSpecProposal: Command completed', {
          outputLength: result.output.length,
          passed,
        });
      } else {
        logger.warn('ValidateOpenSpecProposal: Command failed', {
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'openspec_validation',
          passed,
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('ValidateOpenSpecProposal: Failed to validate proposal', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ValidateOpenSpecProposal;
