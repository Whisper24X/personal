/**
 * BreakdownTasks Action
 * Create openSpec change proposal based on PRD and DESIGN documents
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, executeCommandSimple, CommandExecutorError, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';

export interface BreakdownTasksOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class BreakdownTasks extends BaseAction {
  constructor() {
    super('BreakdownTasks', 'Create openSpec change proposal based on PRD and DESIGN');
  }

  async run(_prd: string, options?: BreakdownTasksOptions): Promise<IActionOutput> {
    logger.info('BreakdownTasks: Starting openSpec proposal creation using Cursor CLI', {
      applicationId: options?.applicationId,
      projectId: options?.projectId,
      version: options?.version,
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
      
      // 定义命令
      const proposeCommand = `创建openSpec变更提案，请执行以下步骤：

1. 读取并分析以下文档：
   - docs/prd/PRD.md（产品需求文档）
   - docs/design/DESIGN.md（系统设计文档）

2. 基于这两个文档，分析项目的：
   - 核心功能需求
   - 技术架构设计
   - 实现方案

3. 在 openspec 目录下创建或更新变更提案，包含：
   - 需要实现的功能列表
   - 建议的技术方案
   - 文件和目录结构变更
   - 实现步骤建议

请开始创建变更提案。`;

      const checkCommand = `检查 openspec 目录下是否已成功创建变更提案文件。

检查标准：
1. openspec 目录下是否有新的提案文件或更新
2. 提案内容是否包含基于 PRD.md 和 DESIGN.md 的分析
3. 提案是否包含具体的实现建议

如果提案已创建且内容完整，返回：已完成
如果提案未创建或内容不完整，返回：未完成`;
      
      // 循环执行，直到任务完成
      const maxRetries = 10; // 最大重试次数
      let isCompleted = false;
      let retryCount = 0;
      let allOutputs: string[] = [];
      
      logger.info('BreakdownTasks: Starting openSpec proposal creation loop', { 
        cwd: workDir,
        maxRetries,
      });
      
      while (!isCompleted && retryCount < maxRetries) {
        retryCount++;
        
        logger.info(`BreakdownTasks: Iteration ${retryCount}/${maxRetries} - Executing propose command`, {
          commandLength: proposeCommand.length,
        });
        
        // 1. 执行创建提案命令
        let proposeOutput = '';
        try {
          const command = `cursor-agent --model composer-1 --print "${proposeCommand.replace(/"/g, '\\"')}"`;
          proposeOutput = await executeCommandSimple(command, {
            cwd: workDir,
            timeout: 3600000, // 60分钟超时
          });
          logger.info(`BreakdownTasks: Propose command completed (iteration ${retryCount})`, {
            outputLength: proposeOutput.length,
          });
        } catch (execError) {
          const error = execError as CommandExecutorError;
          logger.warn(`BreakdownTasks: Propose command failed (iteration ${retryCount})`, { 
            message: error.message,
            exitCode: error.exitCode,
          });
          proposeOutput = error.stdout || '';
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Propose ===\n${proposeOutput}`);
        
        // 2. 执行检查命令
        logger.info(`BreakdownTasks: Iteration ${retryCount}/${maxRetries} - Executing check command`, {
          commandLength: checkCommand.length,
        });
        
        let checkOutput = '';
        try {
          const command = `cursor-agent --model composer-1 --print "${checkCommand.replace(/"/g, '\\"')}"`;
          checkOutput = await executeCommandSimple(command, {
            cwd: workDir,
            timeout: 300000, // 5分钟超时（检查命令应该很快）
          });
          logger.info(`BreakdownTasks: Check command completed (iteration ${retryCount})`, {
            outputLength: checkOutput.length,
            output: checkOutput.substring(0, 200), // 记录前200字符
          });
        } catch (execError) {
          const error = execError as CommandExecutorError;
          logger.warn(`BreakdownTasks: Check command failed (iteration ${retryCount})`, { 
            message: error.message,
            exitCode: error.exitCode,
          });
          checkOutput = error.stdout || '';
        }
        
        allOutputs.push(`=== Iteration ${retryCount} - Check ===\n${checkOutput}`);
        
        // 3. 判断是否完成
        // 检查输出中是否包含"已完成"
        if (checkOutput.includes('已完成')) {
          isCompleted = true;
          logger.info(`BreakdownTasks: OpenSpec proposal creation completed successfully (iteration ${retryCount})`, {
            totalIterations: retryCount,
          });
        } else {
          logger.warn(`BreakdownTasks: OpenSpec proposal not complete yet (iteration ${retryCount})`, {
            checkOutput: checkOutput.substring(0, 200),
            willRetry: retryCount < maxRetries,
          });
        }
      }
      
      // 汇总输出
      const stdout = allOutputs.join('\n\n');
      
      if (!isCompleted) {
        logger.error('BreakdownTasks: Max retries reached, openSpec proposal still incomplete', {
          maxRetries,
          totalIterations: retryCount,
        });
      }
      
      logger.info('BreakdownTasks: OpenSpec proposal creation loop completed', {
        isCompleted,
        totalIterations: retryCount,
        workDir,
      });
      
      return {
        content: `# OpenSpec Proposal Creation ${isCompleted ? 'Completed' : 'Incomplete'}\n\n## Status: ${isCompleted ? '✅ Proposal created successfully' : '❌ Max retries reached'}\n\n## Total Iterations: ${retryCount}\n\n## Cursor CLI Output:\n\n${stdout}`,
        data: {
          type: 'openspec_proposal',
          workspaceDir: workDir,
          cursorOutput: stdout,
          isCompleted,
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
}

export default BreakdownTasks;

