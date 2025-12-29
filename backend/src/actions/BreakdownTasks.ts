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
import { logger } from '../utils';

export class BreakdownTasks extends BaseAction {
  constructor() {
    super('BreakdownTasks', 'Break down project into minimal granularity tasks');
  }

  async run(prd: string, design: string): Promise<IActionOutput> {
    logger.info('BreakdownTasks: Starting task breakdown');
    
    try {
      // Build the prompt
      const prompt = buildTaskBreakdownPrompt(prd, design);
      
      // Call LLM with system message and prompt
      const taskBreakdownContent = await this.aask(prompt, [TASK_BREAKDOWN_SYSTEM_PROMPT]);
      
      logger.info('BreakdownTasks: Task breakdown completed', {
        contentLength: taskBreakdownContent.length,
      });
      
      return {
        content: taskBreakdownContent,
        data: {
          type: 'task_breakdown',
          filename: 'TASK_BREAKDOWN.md',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error('BreakdownTasks: Failed to break down tasks', error);
      throw error;
    }
  }
}

export default BreakdownTasks;

