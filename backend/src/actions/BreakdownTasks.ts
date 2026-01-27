/**
 * BreakdownTasks Action
 * Create openSpec change proposal based on PRD and DESIGN documents
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BreakdownTasksOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class BreakdownTasks extends BaseAction {
  constructor() {
    super('BreakdownTasks', 'Create openSpec change proposal based on PRD and DESIGN');
  }

  async run(prd: string, design: string, options?: BreakdownTasksOptions): Promise<IActionOutput> {
    logger.info('BreakdownTasks: Starting openSpec proposal creation using Cursor CLI', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
      prdLength: prd?.length || 0,
      designLength: design?.length || 0,
    });
    
    try {
      // 验证必需参数
      if (!options?.applicationId) {
        throw new Error('BreakdownTasks: applicationId is required in options');
      }
      if (!options?.projectId) {
        throw new Error('BreakdownTasks: projectId is required in options');
      }
      
      // 获取工作空间根目录 (ainative-workspace)
      const workDir = WorkspaceManager.getProjectWorkspacePath(options);
      
      // 确保工作目录存在
      await fs.mkdir(workDir, { recursive: true });
      
      logger.info('BreakdownTasks: Workspace directory prepared', { 
        workDir,
      });
      
      // ========== 所有提示词统一管理 ==========
      
      // 指令1：填充项目上下文
      const contextCommand = `请阅读 openspec/project.md，帮我补充完善关于当前项目、技术栈和开发规范等内容，参考 ../docs/design/DESIGN.md、../docs/prd/PRD.md、../AGENTS.md 这三个文档，用中文完善`;

      // 指令2: 创建openSpec变更提案
      const proposeCommand = `创建openSpec变更提案 1. 读取并分析以下文档：- ../docs/prd/PRD.md（产品需求文档）- ../docs/design/DESIGN.md（系统设计文档）- ../AGENTS.md（项目代理和开发指南）,用中文完善

重要要求：
- 任务清单只包含开发实现相关的任务（数据库设计、后端实现、前端实现等）
- 不要生成"测试与验证"章节
- 不要生成"文档与部署"章节
- 任务清单应该以开发实现为核心，聚焦于代码开发任务`;
      
      // 指令3: 检查openSpec变更提案
      const checkCommand = `执行指令openspec-validate 检查变更提案的格式、结构是否符合 OpenSpec 规范（避免格式错误）,符合规范返回：SUCCESS，不符合返回: FAIL`;

      // 指令4: 故事点评估命令（需要动态参数 tasksFile）
      const buildEstimateCommand = (tasksFile: string): string => {
        return `请执行以下任务：

1. 读取文件 ${tasksFile}（任务列表）
2. 读取文件 ../doc/33_任务_故事点评估基准.md（故事点评估基准）
3. 在同一目录下创建 ${tasksFile} 的副本，命名为 ${tasksFile.replace('tasks.md', 'tasks-with-estimates.md')}
4. 分析副本文档中每个任务的复杂度（参考评估基准）：
   - 接口数量
   - UI页面数
   - 业务逻辑复杂度
   - 数据表数量
   - 状态管理复杂度
5. 对比评估基准中的示例（3个故事点的应用更新功能作为基准点）
6. 为副本文档中的每个任务添加故事点评估（只能使用：1、2、3、5、8）
7. 在每个任务描述后添加故事点标记，格式：**故事点: X**
8. 确保所有任务都有故事点评估，不要遗漏任何任务

注意：
- 严格按照评估基准文档中的标准进行评估
- 如果任务超过8个故事点，标注并建议拆分
- 用中文完成所有内容`;
      };

      // 指令5: 验证故事点评估结果（需要动态参数 tasksFile）
      const buildEstimateCheckCommand = (tasksFile: string): string => {
        return `检查文件 ${tasksFile.replace('tasks.md', 'tasks-with-estimates.md')}：

1. 统计文档中的任务总数
2. 统计包含"**故事点: X**"标记的任务数量（X必须是1、2、3、5、8中的一个）
3. 检查是否所有任务都有故事点评估

请以JSON格式返回，只返回JSON，不要返回其他内容：
{
  "result": "SUCCESS" 或 "INCOMPLETE",
  "totalTasks": N,
  "estimatedTasks": M,
  "reason": "说明具体原因"
}

如果所有任务都有评估，返回 SUCCESS
如果有任务未评估，返回 INCOMPLETE`;
      };
      
      // ========== 提示词定义结束 ==========
      
      // 循环执行，直到任务完成（包含两个阶段：提案创建 + 故事点评估）
      const maxRetries = 10; // 最大重试次数
      let retryCount = 0; // 初始化重试计数器
      let proposalCompleted = false; // openSpec提案是否完成
      let estimationCompleted = false; // 故事点评估是否完成
      let isCompleted = false; // 整体是否完成
      let allOutputs: string[] = [];
      
      logger.info('BreakdownTasks: Starting openSpec proposal creation loop', { 
        cwd: workDir,
        maxRetries,
      });
      
      while (!isCompleted && retryCount < maxRetries) {
        // 检查是否被取消
        this.checkCancellation();
        
        retryCount++;
        
        logger.info(`BreakdownTasks: Iteration ${retryCount}/${maxRetries} - Executing propose command`, {
          commandLength: proposeCommand.length,
        });
        
        // 1. 执行项目上下文填充命令（仅在第一次迭代时执行）
        logger.info(`BreakdownTasks: Executing context command (iteration ${retryCount})`, {
          commandLength: contextCommand.length,
        });
        
        const contextResult = await this.runCLICommand(contextCommand, workDir, {
          timeout: 1800000, // 30分钟超时
          abortSignal: this.abortSignal,
        });
        
        if (contextResult.exitCode === 0) {
          logger.info(`BreakdownTasks: Context command completed (iteration ${retryCount})`, {
            outputLength: contextResult.output.length,
            output: contextResult.output.length > 0 ? contextResult.output.substring(0, 200) : '(empty output)',
          });
          allOutputs.push(`=== Iteration ${retryCount} - Context ===\n${contextResult.output}`);
        } else {
          logger.warn(`BreakdownTasks: Context command failed (iteration ${retryCount})`, { 
            exitCode: contextResult.exitCode,
            stdout: contextResult.output || '(empty)',
            stderr: contextResult.stderr || '(empty)',
          });
          allOutputs.push(`=== Iteration ${retryCount} - Context (FAILED) ===\n${contextResult.output || ''}`);
        }

        // 检查是否被取消
        this.checkCancellation();

        // 2. 执行创建提案命令
        const proposeResult = await this.runCLICommand(proposeCommand, workDir, {
          timeout: 3600000, // 60分钟超时
          abortSignal: this.abortSignal,
        });
        
        const proposeOutput = proposeResult.output;
        if (proposeResult.exitCode === 0) {
          logger.info(`BreakdownTasks: Propose command completed (iteration ${retryCount})`, {
            outputLength: proposeOutput.length,
            output: proposeOutput.length > 0 ? proposeOutput : '(empty output)',
          });
        } else {
          logger.warn(`BreakdownTasks: Propose command failed (iteration ${retryCount})`, { 
            exitCode: proposeResult.exitCode,
            stdout: proposeOutput || '(empty)',
            stderr: proposeResult.stderr || '(empty)',
          });
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Propose ===\n${proposeOutput}`);
        
        // 检查是否被取消
        this.checkCancellation();
        
        // 3. 执行检查命令
        logger.info(`BreakdownTasks: Iteration ${retryCount}/${maxRetries} - Executing check command`, {
          commandLength: checkCommand.length,
        });
        
        const checkResult = await this.runCLICommand(checkCommand, workDir, {
          timeout: 300000, // 5分钟超时（检查命令应该很快）
          abortSignal: this.abortSignal,
        });
        
        const checkOutput = checkResult.output;
        if (checkResult.exitCode === 0) {
          logger.info(`BreakdownTasks: Check command completed (iteration ${retryCount})`, {
            outputLength: checkOutput.length,
            output: checkOutput.substring(0, 200), // 记录前200字符
          });
        } else {
          logger.warn(`BreakdownTasks: Check command failed (iteration ${retryCount})`, { 
            exitCode: checkResult.exitCode,
            stderr: checkResult.stderr,
          });
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);
        
        // 4. 判断提案是否完成
        // 检查输出中是否包含"SUCCESS"
        if (checkOutput.includes('SUCCESS')) {
          proposalCompleted = true;
          logger.info(`BreakdownTasks: OpenSpec proposal creation completed successfully (iteration ${retryCount})`, {
            totalIterations: retryCount,
          });
          // 不设置 isCompleted，继续执行故事点评估
        } else {
          logger.warn(`BreakdownTasks: OpenSpec proposal not complete yet (iteration ${retryCount})`, {
            checkOutput: checkOutput.substring(0, 200),
            willRetry: retryCount < maxRetries,
          });
        }
        
        // 5. 如果提案完成且评估未完成，执行故事点评估
        if (proposalCompleted && !estimationCompleted) {
          this.checkCancellation();
          
          logger.info(`BreakdownTasks: Starting story point estimation (iteration ${retryCount})`);
          
          // 5.1 查找最新的 tasks.md 文件
          const tasksFile = await this.findLatestTasksFile(workDir);
          if (!tasksFile) {
            logger.error('BreakdownTasks: No tasks.md file found for story point estimation');
            break;
          }
          
          // 5.2 构建评估命令（使用统一管理的提示词函数）
          const estimateCommand = buildEstimateCommand(tasksFile);

          // 5.3 执行评估命令
          logger.info(`BreakdownTasks: Executing estimation command (iteration ${retryCount})`);
          
          const estimateResult = await this.runCLICommand(estimateCommand, workDir, {
            timeout: 1800000, // 30分钟超时
            abortSignal: this.abortSignal,
          });
          
          if (estimateResult.exitCode === 0) {
            logger.info(`BreakdownTasks: Estimation command completed (iteration ${retryCount})`, {
              outputLength: estimateResult.output.length,
            });
            allOutputs.push(`=== Iteration ${retryCount} - Story Point Estimation ===\n${estimateResult.output}`);
          } else {
            logger.warn(`BreakdownTasks: Estimation command failed (iteration ${retryCount})`, {
              exitCode: estimateResult.exitCode,
              stderr: estimateResult.stderr,
            });
            allOutputs.push(`=== Iteration ${retryCount} - Estimation (FAILED) ===\n${estimateResult.output || ''}`);
          }
          
          this.checkCancellation();
          
          // 5.4 验证评估结果（使用统一管理的提示词函数）
          const estimateCheckCommand = buildEstimateCheckCommand(tasksFile);

          logger.info(`BreakdownTasks: Executing estimation check command (iteration ${retryCount})`);
          
          const estimateCheckResult = await this.runCLICommand(estimateCheckCommand, workDir, {
            timeout: 300000, // 5分钟超时
            abortSignal: this.abortSignal,
          });
          
          const estimateCheckOutput = estimateCheckResult.output;
          
          if (estimateCheckResult.exitCode === 0) {
            logger.info(`BreakdownTasks: Estimation check completed (iteration ${retryCount})`, {
              outputLength: estimateCheckOutput.length,
            });
          } else {
            logger.warn(`BreakdownTasks: Estimation check failed (iteration ${retryCount})`, {
              exitCode: estimateCheckResult.exitCode,
              stderr: estimateCheckResult.stderr,
            });
          }
          
          allOutputs.push(`=== Iteration ${retryCount} - Estimation Check ===\n${estimateCheckOutput}`);
          
          // 5.5 解析验证结果
          try {
            const jsonMatch = estimateCheckOutput.match(/\{[\s\S]*"result"[\s\S]*\}/);
            if (jsonMatch) {
              const checkData = JSON.parse(jsonMatch[0]);
              
              if (checkData.result === 'SUCCESS') {
                estimationCompleted = true;
                logger.info(`BreakdownTasks: Story point estimation completed successfully (iteration ${retryCount})`, {
                  totalTasks: checkData.totalTasks,
                  estimatedTasks: checkData.estimatedTasks,
                });
              } else {
                logger.warn(`BreakdownTasks: Story point estimation not complete yet (iteration ${retryCount})`, {
                  totalTasks: checkData.totalTasks,
                  estimatedTasks: checkData.estimatedTasks,
                  reason: checkData.reason,
                  willRetry: retryCount < maxRetries,
                });
              }
            } else if (estimateCheckOutput.includes('SUCCESS')) {
              estimationCompleted = true;
              logger.info(`BreakdownTasks: Story point estimation completed (SUCCESS found in output)`);
            } else {
              logger.warn(`BreakdownTasks: Could not parse estimation check result (iteration ${retryCount})`);
            }
          } catch (error: any) {
            logger.warn(`BreakdownTasks: Failed to parse estimation check result (iteration ${retryCount})`, {
              error: error.message,
            });
          }
        }
        
        // 6. 判断整体是否完成（提案完成 && 评估完成）
        if (proposalCompleted && estimationCompleted) {
          isCompleted = true;
          logger.info(`BreakdownTasks: All tasks completed successfully (iteration ${retryCount})`);
        }
      }
      
      // 汇总输出
      const stdout = allOutputs.join('\n\n');
      
      if (!isCompleted) {
        logger.error('BreakdownTasks: Max retries reached, tasks still incomplete', {
          maxRetries,
          totalIterations: retryCount,
          proposalCompleted,
          estimationCompleted,
        });
      }
      
      logger.info('BreakdownTasks: OpenSpec proposal and story point estimation loop completed', {
        isCompleted,
        proposalCompleted,
        estimationCompleted,
        totalIterations: retryCount,
        workDir,
      });
      
      return {
        content: `# OpenSpec Proposal and Story Point Estimation ${isCompleted ? 'Completed' : 'Incomplete'}

## Status: ${isCompleted ? '✅ All tasks completed successfully' : '❌ Max retries reached'}

## Completion Details:
- OpenSpec Proposal: ${proposalCompleted ? '✅ Completed' : '❌ Incomplete'}
- Story Point Estimation: ${estimationCompleted ? '✅ Completed' : '❌ Incomplete'}

## Total Iterations: ${retryCount}

## Cursor CLI Output:

${stdout}`,
        data: {
          type: 'openspec_proposal_with_estimation',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
          proposalCompleted,
          estimationCompleted,
          totalIterations: retryCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      // 避免循环引用导致JSON序列化失败
      logger.error('BreakdownTasks: Failed to create openSpec proposal using Cursor CLI', {
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
      const directories = entries.filter(entry => entry.isDirectory());
      
      if (directories.length === 0) {
        logger.warn('BreakdownTasks: No change proposal directories found', {
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
        logger.warn('BreakdownTasks: No tasks.md found in any change proposal directory', {
          changesDir,
          directoriesChecked: directories.map(d => d.name),
        });
        return null;
      }
      
      // 按修改时间倒序排列，获取最新的文件
      tasksFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const latestFile = tasksFiles[0];
      
      logger.info('BreakdownTasks: Found latest tasks.md', {
        directory: latestFile.dirName,
        relativePath: latestFile.path,
        modifiedTime: latestFile.mtime.toISOString(),
        totalFilesFound: tasksFiles.length,
      });
      
      return latestFile.path;
    } catch (error: any) {
      // 如果目录不存在，记录警告而不是错误
      if (error.code === 'ENOENT') {
        logger.warn('BreakdownTasks: Changes directory does not exist', {
          changesDir,
        });
        return null;
      }
      
      logger.error('BreakdownTasks: Failed to find tasks.md', {
        changesDir,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }
}

export default BreakdownTasks;

