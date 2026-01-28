/**
 * ValidateStoryPointEstimates Action
 * Validate that all tasks have story point estimates
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { buildValidateStoryPointEstimatesPrompt } from '../prompts/task';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ValidateStoryPointEstimatesOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class ValidateStoryPointEstimates extends BaseAction {
  constructor() {
    super('ValidateStoryPointEstimates', 'Validate that all tasks have story point estimates');
  }

  async run(options?: ValidateStoryPointEstimatesOptions): Promise<IActionOutput> {
    logger.info('ValidateStoryPointEstimates: Starting validation', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('ValidateStoryPointEstimates: Workspace directory prepared', {
        workDir,
      });

      // 检查是否被取消
      this.checkCancellation();

      // 查找最新的 tasks.md 文件
      const tasksFile = await this.findLatestTasksFile(workDir);
      if (!tasksFile) {
        logger.error('ValidateStoryPointEstimates: No tasks.md file found');
        return {
          content: 'Error: No tasks.md file found for validation',
          data: {
            type: 'story_point_validation',
            passed: false,
            error: 'NO_TASKS_FILE',
            workspaceDir: workDir,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 计算评估文件路径
      const estimatesFile = tasksFile.replace('tasks.md', 'tasks-with-estimates.md');

      // 构建提示词
      const prompt = buildValidateStoryPointEstimatesPrompt(estimatesFile);

      logger.info('ValidateStoryPointEstimates: Executing CLI command', {
        estimatesFile,
        promptLength: prompt.length,
      });

      // 执行 CLI 命令
      const result = await this.runCLICommand(prompt, workDir, {
        timeout: 300000, // 5分钟超时
        abortSignal: this.abortSignal,
      });

      // 解析验证结果
      let passed = false;
      let totalTasks: number | undefined;
      let estimatedTasks: number | undefined;
      let reason: string | undefined;

      try {
        const jsonMatch = result.output.match(/\{[\s\S]*"result"[\s\S]*\}/);
        if (jsonMatch) {
          const checkData = JSON.parse(jsonMatch[0]);
          passed = checkData.result === 'SUCCESS';
          totalTasks = checkData.totalTasks;
          estimatedTasks = checkData.estimatedTasks;
          reason = checkData.reason;

          logger.info('ValidateStoryPointEstimates: Parsed validation result', {
            passed,
            totalTasks,
            estimatedTasks,
            reason,
          });
        } else if (result.output.includes('SUCCESS')) {
          passed = true;
          logger.info('ValidateStoryPointEstimates: SUCCESS found in output');
        } else {
          logger.error('ValidateStoryPointEstimates: Could not parse validation result');
        }
      } catch (parseError: any) {
        logger.error('ValidateStoryPointEstimates: Failed to parse validation result', {
          error: parseError.message,
        });
      }

      if (result.exitCode === 0) {
        logger.info('ValidateStoryPointEstimates: Command completed', {
          outputLength: result.output.length,
          passed,
        });
      } else {
        logger.error('ValidateStoryPointEstimates: Command failed', {
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'story_point_validation',
          passed,
          totalTasks,
          estimatedTasks,
          reason,
          estimatesFile,
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('ValidateStoryPointEstimates: Failed to validate', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 查找最新的 tasks.md 文件
   * 在 openspec/changes/变更提案名称/ 目录下查找
   * 按修改时间排序, 返回最新的 tasks.md 文件
   */
  private async findLatestTasksFile(workDir: string): Promise<string | null> {
    const changesDir = path.join(workDir, 'openspec', 'changes');

    try {
      // 检查目录是否存在
      await fs.access(changesDir);

      // 读取所有子目录（变更提案目录）
      const entries = await fs.readdir(changesDir, { withFileTypes: true });
      const directories = entries.filter((entry) => entry.isDirectory());

      if (directories.length === 0) {
        logger.error('ValidateStoryPointEstimates: No change proposal directories found', {
          changesDir,
        });
        return null;
      }

      // 获取每个目录的 tasks.md 文件信息（包括修改时间）
      const tasksFiles: Array<{ path: string; mtime: Date; dirName: string }> = [];

      for (const dir of directories) {
        const tasksPath = path.join('openspec', 'changes', dir.name, 'tasks.md');
        const fullPath = path.join(workDir, tasksPath);

        try {
          const stats = await fs.stat(fullPath);
          if (stats.isFile()) {
            tasksFiles.push({
              path: tasksPath,
              mtime: stats.mtime,
              dirName: dir.name,
            });
          }
        } catch {
          // 文件不存在，跳过
          continue;
        }
      }

      if (tasksFiles.length === 0) {
        logger.error('ValidateStoryPointEstimates: No tasks.md found in any change proposal directory', {
          changesDir,
          directoriesChecked: directories.map((d) => d.name),
        });
        return null;
      }

      // 按修改时间倒序排列，获取最新的文件
      tasksFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const latestFile = tasksFiles[0];

      logger.info('ValidateStoryPointEstimates: Found latest tasks.md', {
        directory: latestFile.dirName,
        relativePath: latestFile.path,
        modifiedTime: latestFile.mtime.toISOString(),
        totalFilesFound: tasksFiles.length,
      });

      return latestFile.path;
    } catch (error: any) {
      // 如果目录不存在，记录警告而不是错误
      if (error.code === 'ENOENT') {
        logger.error('ValidateStoryPointEstimates: Changes directory does not exist', {
          changesDir,
        });
        return null;
      }

      logger.error('ValidateStoryPointEstimates: Failed to find tasks.md', {
        changesDir,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }
}

export default ValidateStoryPointEstimates;
