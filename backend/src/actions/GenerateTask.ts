/**
 * GenerateTask Action
 * Generates detailed task descriptions for engineers
 */

import { BaseAction } from '../core/base/BaseAction';
import { IActionOutput } from '@mind2build/shared';
import {
  TASK_GENERATION_SYSTEM_PROMPT,
  buildTaskGenerationPrompt,
} from '../prompts/task';
import { logger, WorkspaceOptions } from '../utils';

export interface GenerateTaskOptions extends WorkspaceOptions {
  // 继承WorkspaceOptions的所有选项
}

export class GenerateTask extends BaseAction {
  constructor() {
    super('GenerateTask', 'Generate detailed task descriptions for engineers');
  }

  async run(
    taskBreakdown: string,
    subProjectDesign?: string,
    options?: GenerateTaskOptions
  ): Promise<IActionOutput> {
    logger.info('GenerateTask: Starting task generation');
    
    try {
      // Build the prompt
      const prompt = buildTaskGenerationPrompt(taskBreakdown, subProjectDesign);
      
      // Call LLM with system message and prompt
      const taskContent = await this.aask(prompt, [TASK_GENERATION_SYSTEM_PROMPT]);
      
      // 保存到workspace
      const workspaceOptions: WorkspaceOptions = {
        ...options,
        documentType: 'TASKS',
      };
      await this.saveToWorkspace('TASK_DESCRIPTION.md', taskContent, workspaceOptions);
      
      logger.info('GenerateTask: Task generation completed', {
        contentLength: taskContent.length,
        workspaceDir: this.getWorkspaceDir(workspaceOptions),
      });
      
      return {
        content: taskContent,
        data: {
          type: 'task',
          filename: 'TASK_DESCRIPTION.md',
          timestamp: new Date().toISOString(),
          workspaceDir: this.getWorkspaceDir(workspaceOptions),
        },
      };
    } catch (error: any) {
      logger.error('GenerateTask: Failed to generate task', error);
      throw error;
    }
  }
}

export default GenerateTask;

