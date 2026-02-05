/**
 * ExecuteProjectManagement Action
 * Execute the complete project management workflow using skill
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';

export interface ExecuteProjectManagementOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class ExecuteProjectManagement extends BaseAction {
  constructor() {
    super('ExecuteProjectManagement', 'Execute complete project management workflow including task breakdown, validation, and estimation');
  }

  async run(options?: ExecuteProjectManagementOptions): Promise<IActionOutput> {
    logger.info('ExecuteProjectManagement: Starting workflow', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('ExecuteProjectManagement: Workspace prepared', { workDir });

      // 检查是否被取消
      this.checkCancellation();

      // 构建 skill 文件路径
      const skillPath = '../skills/project-management/SKILL.md';

      // 构建提示词
      const prompt = `请阅读并严格执行技能文件 ${skillPath} 中定义的完整项目管理流程。

按顺序执行所有 6 个步骤：
1. 填充项目上下文
2. 创建 OpenSpec 变更提案
3. 验证提案格式和结构
4. 验证提案内容（调用 openspec-validator skill）
5. 估算故事点
6. 验证故事点估算

每一步都要按照技能文件中的要求完成，确保输出符合验收标准。

最后输出完整的执行摘要，包括：
- 每个步骤的执行状态
- 输出文件列表
- 任务统计信息（任务总数、总故事点）
- 下一步行动建议`;

      logger.info('ExecuteProjectManagement: Executing skill', {
        skillPath,
        promptLength: prompt.length,
      });

      // 执行 CLI 命令（60分钟超时，因为包含多个步骤）
      const result = await this.runCLICommand(prompt, workDir, {
        timeout: 3600000, // 60分钟
        abortSignal: this.abortSignal,
      });

      // 判断是否成功
      const success =
        result.exitCode === 0 &&
        (result.output.includes('SUCCESS') || result.output.includes('项目管理流程完成') || result.output.includes('执行摘要'));

      if (success) {
        logger.info('ExecuteProjectManagement: Workflow completed successfully', {
          outputLength: result.output.length,
        });
      } else {
        logger.warn('ExecuteProjectManagement: Workflow failed or incomplete', {
          exitCode: result.exitCode,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'project_management',
          success,
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('ExecuteProjectManagement: Failed to execute workflow', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export default ExecuteProjectManagement;
