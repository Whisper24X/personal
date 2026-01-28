/**
 * EstimateStoryPoints Action
 * Estimate story points for tasks based on complexity
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import { buildEstimateStoryPointsPrompt, EstimateStoryPointsPaths } from '../prompts/task';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EstimateStoryPointsOptions extends WorkspaceOptions {
  // 继承 WorkspaceOptions 的所有选项
}

export class EstimateStoryPoints extends BaseAction {
  constructor() {
    super('EstimateStoryPoints', 'Estimate story points for tasks based on complexity');
  }

  async run(options?: EstimateStoryPointsOptions): Promise<IActionOutput> {
    logger.info('EstimateStoryPoints: Starting story point estimation', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      versionId: options?.versionId,
    });

    try {
      // 验证必需参数
      const validatedOptions = this.validateWorkspaceOptions(options);

      // 获取工作空间根目录
      const workDir = WorkspaceManager.getProjectWorkspacePath(validatedOptions);

      logger.info('EstimateStoryPoints: Workspace directory prepared', {
        workDir,
      });

      // 检查是否被取消
      this.checkCancellation();

      // 查找最新的 tasks.md 文件
      const tasksFile = await this.findLatestTasksFile(workDir);
      if (!tasksFile) {
        logger.error('EstimateStoryPoints: No tasks.md file found');
        return {
          content: 'Error: No tasks.md file found for story point estimation',
          data: {
            type: 'story_point_estimation',
            error: 'NO_TASKS_FILE',
            workspaceDir: workDir,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 构建路径配置
      const paths: EstimateStoryPointsPaths = {
        tasksFile,
        estimationBasePath: '../doc/33_任务_故事点评估基准.md',
      };

      // 构建提示词
      const prompt = buildEstimateStoryPointsPrompt(paths);

      logger.info('EstimateStoryPoints: Executing CLI command', {
        tasksFile,
        promptLength: prompt.length,
      });

      // 执行 CLI 命令
      const result = await this.runCLICommand(prompt, workDir, {
        timeout: 1800000, // 30分钟超时
        abortSignal: this.abortSignal,
      });

      if (result.exitCode === 0) {
        logger.info('EstimateStoryPoints: Command completed successfully', {
          outputLength: result.output.length,
        });
      } else {
        logger.warn('EstimateStoryPoints: Command failed', {
          exitCode: result.exitCode,
          stderr: result.stderr,
        });
      }

      return {
        content: result.output,
        data: {
          type: 'story_point_estimation',
          tasksFile,
          outputFile: tasksFile.replace('tasks.md', 'tasks-with-estimates.md'),
          workspaceDir: workDir,
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('EstimateStoryPoints: Failed to estimate story points', {
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
        logger.warn('EstimateStoryPoints: No change proposal directories found', {
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
        logger.warn('EstimateStoryPoints: No tasks.md found in any change proposal directory', {
          changesDir,
          directoriesChecked: directories.map((d) => d.name),
        });
        return null;
      }

      // 按修改时间倒序排列，获取最新的文件
      tasksFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const latestFile = tasksFiles[0];

      logger.info('EstimateStoryPoints: Found latest tasks.md', {
        directory: latestFile.dirName,
        relativePath: latestFile.path,
        modifiedTime: latestFile.mtime.toISOString(),
        totalFilesFound: tasksFiles.length,
      });

      return latestFile.path;
    } catch (error: any) {
      // 如果目录不存在，记录警告而不是错误
      if (error.code === 'ENOENT') {
        logger.warn('EstimateStoryPoints: Changes directory does not exist', {
          changesDir,
        });
        return null;
      }

      logger.error('EstimateStoryPoints: Failed to find tasks.md', {
        changesDir,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }
}

export default EstimateStoryPoints;
