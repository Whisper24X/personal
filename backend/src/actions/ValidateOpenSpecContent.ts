/**
 * ValidateOpenSpecContent Action
 * Validate openSpec content based on PRD and design documents
 * Check for conflicts, missing content, and errors
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { buildValidateOpenSpecContentPrompt } from '../prompts/task';

export interface ValidateOpenSpecContentOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class ValidateOpenSpecContent extends BaseAction {
  constructor() {
    super('ValidateOpenSpecContent', 'Validate openSpec content based on PRD and design documents');
  }

  async run(options?: ValidateOpenSpecContentOptions): Promise<IActionOutput> {
    logger.info('ValidateOpenSpecContent: Starting content validation', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('ValidateOpenSpecContent: Workspace directory prepared', {
        workDir,
      });

      // 检查是否被取消
      this.checkCancellation();

      // 构建 skill 文件路径（相对于 workDir）
      const skillPath = '../skills/openspec-validator/SKILL.md';

      // 构建提示词
      const prompt = buildValidateOpenSpecContentPrompt(skillPath);

      logger.info('ValidateOpenSpecContent: Executing CLI command', {
        skillPath,
        promptLength: prompt.length,
      });

      // 执行 CLI 命令（30分钟超时）
      const result = await this.runCLICommand(prompt, workDir, {
        timeout: 1800000, // 30分钟超时
        abortSignal: this.abortSignal,
      });

      // 解析结果 - 检查是否包含审查完成标记
      const passed = result.output.includes('审查完成') || result.output.includes('OpenSpec 审查完成');

      if (result.exitCode === 0) {
        logger.info('ValidateOpenSpecContent: Command completed successfully', {
          outputLength: result.output.length,
          passed,
        });
      } else {
        logger.warn('ValidateOpenSpecContent: Command failed', {
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'openspec_content_validation',
          passed,
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('ValidateOpenSpecContent: Failed to validate content', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ValidateOpenSpecContent;
