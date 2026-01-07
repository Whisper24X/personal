/**
 * BreakdownTasks Action
 * Breaks down project into minimal granularity tasks based on PRD and Design
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TASK_BREAKDOWN_SYSTEM_PROMPT,
  buildTaskBreakdownPrompt,
} from '../prompts/task';
import { logger, SubtaskManager, WorkspaceOptions, loadPrompt } from '../utils';

export interface BreakdownTasksOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class BreakdownTasks extends BaseAction {
  constructor() {
    super('BreakdownTasks', 'Break down project into minimal granularity tasks');
  }

  async run(prd: string, design: string, options?: BreakdownTasksOptions): Promise<IActionOutput> {
    logger.info('BreakdownTasks: Starting task breakdown');

    try {
      // Build the prompt
      const prompt = buildTaskBreakdownPrompt(prd, design);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'task', 'system_prompt', TASK_BREAKDOWN_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const taskBreakdownContent = await this.aask(prompt, [systemPrompt]);

      // 解析任务拆分结果
      const subtaskManager = new SubtaskManager();
      const breakdown = subtaskManager.parseTaskBreakdown(taskBreakdownContent);

      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TASKS',
      };
      await subtaskManager.saveToWorkspace(workspaceOptions);

      // 同时保存原始文档
      await this.saveToWorkspace('TASK_BREAKDOWN.md', taskBreakdownContent, workspaceOptions);

      logger.info('BreakdownTasks: Task breakdown completed', {
        contentLength: taskBreakdownContent.length,
        taskCount: breakdown.tasks.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });

      return {
        content: taskBreakdownContent,
        data: {
          type: 'task_breakdown',
          filename: 'TASK_BREAKDOWN.md',
          timestamp: new Date().toISOString(),
          taskCount: breakdown.tasks.length,
          tasks: breakdown.tasks,
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('BreakdownTasks: Failed to break down tasks', error);
      throw error;
    }
  }
}

export default BreakdownTasks;

