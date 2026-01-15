/**
 * BreakdownTasks Action
 * Breaks down project into minimal granularity tasks based on PRD only
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TASK_BREAKDOWN_SYSTEM_PROMPT,
  buildTaskBreakdownPrompt,
} from '../prompts/task';
import { logger, SubtaskManager, WorkspaceOptions, loadPrompt } from '../utils';
import { Subtask } from '../utils/SubtaskManager';

export interface BreakdownTasksOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class BreakdownTasks extends BaseAction {
  constructor() {
    super('BreakdownTasks', 'Break down project into minimal granularity tasks');
  }

  async run(prd: string, options?: BreakdownTasksOptions): Promise<IActionOutput> {
    logger.info('BreakdownTasks: Starting task breakdown based on PRD');

    try {
      // Build the prompt (only PRD, no Design)
      const prompt = buildTaskBreakdownPrompt(prd);

      // Load system prompt from database or use default
      const userId = this.context?.get('userId');
      const systemPrompt = await loadPrompt(userId, 'task', 'system_prompt', TASK_BREAKDOWN_SYSTEM_PROMPT);

      // Call LLM with system message and prompt
      const taskBreakdownContent = await this.aask(prompt, [systemPrompt]);

      // 解析任务拆分结果
      const subtaskManager = new SubtaskManager();
      const breakdown = subtaskManager.parseTaskBreakdown(taskBreakdownContent);

      // 保存到workspace - 使用TASK作为documentType
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TASK',
      };

      // 保存原始任务拆分文档
      await this.saveToWorkspace('TASK_BREAKDOWN.md', taskBreakdownContent, workspaceOptions);

      // 为每个任务生成独立的task_n.md文件
      logger.info('BreakdownTasks: Generating individual task files', {
        taskCount: breakdown.tasks.length,
      });

      for (let i = 0; i < breakdown.tasks.length; i++) {
        const task = breakdown.tasks[i];
        const taskFileName = `task_${i + 1}.md`;
        const taskContent = this.generateTaskDocument(task, i + 1);
        
        await this.saveToWorkspace(taskFileName, taskContent, workspaceOptions);
        logger.debug('BreakdownTasks: Generated task file', {
          taskId: task.id,
          fileName: taskFileName,
        });
      }

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

  /**
   * 生成单个任务文档
   */
  private generateTaskDocument(task: Subtask, taskNumber: number): string {
    const dependenciesText = task.dependencies.length > 0 
      ? task.dependencies.join(', ') 
      : '无';

    const inputsText = task.inputs.length > 0
      ? task.inputs.map((input, idx) => `${idx + 1}. ${input}`).join('\n')
      : '无';

    const outputsText = task.outputs.length > 0
      ? task.outputs.map((output, idx) => `${idx + 1}. ${output}`).join('\n')
      : '无';

    const acceptanceCriteriaText = task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria.map((criteria, idx) => `${idx + 1}. ${criteria}`).join('\n')
      : '无';

    const technicalPointsText = task.technicalPoints.length > 0
      ? task.technicalPoints.map((point, idx) => `${idx + 1}. ${point}`).join('\n')
      : '无';

    return `# 任务 ${taskNumber}: ${task.name}

## 基本信息
- **任务ID**：${task.id}
- **任务类型**：${task.type}
- **任务角色**：${task.type.includes('前端') ? '前端' : '后端'}
- **优先级**：${task.priority}
- **预估工时**：${task.estimatedHours} 小时
- **依赖任务**：${dependenciesText}

## 任务描述
${task.description}

## 输入
${inputsText}

## 输出
${outputsText}

## 验收标准
${acceptanceCriteriaText}

## 技术要点
${technicalPointsText}
`;
  }
}

export default BreakdownTasks;

