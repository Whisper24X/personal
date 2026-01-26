/**
 * BreakdownTasks Action
 * Create openSpec change proposal based on PRD and DESIGN documents
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, WorkspaceOptions, WorkspaceManager } from '../utils';
import * as fs from 'fs/promises';

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
      
      // 指令1：填充项目上下文
      const contextCommand = `请阅读 openspec/project.md，帮我补充完善关于当前项目、技术栈和开发规范等内容，参考 ../docs/design/DESIGN.md、../docs/prd/PRD.md、../AGENTS.md 这三个文档，用中文完善`;

      // 指令2: 创建openSpec变更提案
      const proposeCommand = `创建openSpec变更提案 1. 读取并分析以下文档：- ../docs/prd/PRD.md（产品需求文档）- ../docs/design/DESIGN.md（系统设计文档）- ../AGENTS.md（项目代理和开发指南）,用中文完善`;
      
      // 指令3: 检查openSpec变更提案
      const checkCommand = `执行指令openspec-validate 检查变更提案的格式、结构是否符合 OpenSpec 规范（避免格式错误）,符合规范返回：SUCCESS，不符合返回: FAIL`;
      
      // 循环执行，直到任务完成
      const maxRetries = 10; // 最大重试次数
      let retryCount = 0; // 初始化重试计数器
      let isCompleted = false;
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
        
        // 4. 判断是否完成
        // 检查输出中是否包含"SUCCESS"
        if (checkOutput.includes('SUCCESS')) {
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

