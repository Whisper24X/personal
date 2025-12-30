/**
 * ExecuteSubtask Action
 * 执行单个子任务，生成对应的代码
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import { logger, SubtaskManager, WorkspaceOptions } from '../utils';
import { WriteCode, WriteCodeOptions } from './WriteCode';

export interface ExecuteSubtaskOptions extends WorkspaceOptions {
  taskId: string; // 要执行的任务ID
  taskDescription: string; // 任务描述
  prd?: string; // PRD文档（可选）
  design?: string; // 设计文档（可选）
}

export class ExecuteSubtask extends BaseAction {
  constructor() {
    super('ExecuteSubtask', 'Execute a single subtask and generate code');
  }

  async run(
    taskDescription: string,
    options?: ExecuteSubtaskOptions
  ): Promise<IActionOutput> {
    if (!options?.taskId) {
      throw new Error('ExecuteSubtask: taskId is required');
    }

    logger.info('ExecuteSubtask: Starting subtask execution', {
      taskId: options.taskId,
    });

    try {
      // 构建任务执行的prompt
      // 将任务描述转换为设计文档格式，供WriteCode使用
      const designContent = this.buildDesignFromTask(taskDescription, options.prd, options.design);

      // 使用WriteCode来生成代码
      const writeCodeAction = new WriteCode();
      writeCodeAction.setLLM(this.llm);

      const writeCodeOptions: WriteCodeOptions = {
        applicationId: options?.applicationId,
        version: options?.version,
        workspacePath: options?.workspacePath,
      };

      const codeResult = await writeCodeAction.run(designContent, writeCodeOptions);

      // 更新子任务状态
      if (options?.applicationId && options?.version) {
        const subtaskManager = new SubtaskManager();
        const loaded = await subtaskManager.loadFromWorkspace({
          applicationId: options.applicationId,
          version: options.version,
          documentType: 'TASKS',
        });

        if (loaded) {
          subtaskManager.markTaskCompleted(options.taskId);
          await subtaskManager.saveToWorkspace({
            applicationId: options.applicationId,
            version: options.version,
            documentType: 'TASKS',
          });

          // 生成执行报告并保存
          const report = subtaskManager.getExecutionReport();
          const WorkspaceManager = (await import('../utils/WorkspaceManager')).WorkspaceManager;
          await WorkspaceManager.saveToWorkspace(
            'TASK_EXECUTION_REPORT.md',
            report,
            {
              applicationId: options.applicationId,
              version: options.version,
              documentType: 'TASKS',
            }
          );
          
          // 保存更新后的任务状态
          await subtaskManager.saveToWorkspace({
            applicationId: options.applicationId,
            version: options.version,
            documentType: 'TASKS',
          });
        }
      }

      logger.info('ExecuteSubtask: Subtask execution completed', {
        taskId: options.taskId,
        filesGenerated: codeResult.data?.filesCount || 0,
      });

      return {
        content: `# 子任务执行完成\n\n任务ID: ${options.taskId}\n\n${codeResult.content}`,
        data: {
          type: 'subtask_execution',
          taskId: options.taskId,
          ...codeResult.data,
        },
      };
    } catch (error: any) {
      logger.error('ExecuteSubtask: Failed to execute subtask', {
        taskId: options.taskId,
        error: error.message,
      });

      // 更新子任务状态为失败
      if (options?.applicationId && options?.version) {
        const subtaskManager = new SubtaskManager();
        const loaded = await subtaskManager.loadFromWorkspace({
          applicationId: options.applicationId,
          version: options.version,
          documentType: 'TASKS',
        });

        if (loaded) {
          subtaskManager.markTaskFailed(options.taskId, error.message);
          await subtaskManager.saveToWorkspace({
            applicationId: options.applicationId,
            version: options.version,
            documentType: 'TASKS',
          });
        }
      }

      throw error;
    }
  }

  /**
   * 从任务描述构建设计文档格式
   */
  private buildDesignFromTask(taskDescription: string, prd?: string, design?: string): string {
    let designContent = `# 任务实现设计\n\n`;
    designContent += `## 任务描述\n\n${taskDescription}\n\n`;

    if (prd) {
      designContent += `## 产品需求文档（PRD）参考\n\n${prd}\n\n`;
    }

    if (design) {
      designContent += `## 系统设计参考\n\n${design}\n\n`;
    }

    designContent += `## 实现要求\n\n`;
    designContent += `请根据任务描述、PRD和系统设计，生成完整的代码实现。\n`;
    designContent += `确保代码符合设计规范，包含必要的注释和文档。\n`;

    return designContent;
  }
}

export default ExecuteSubtask;

