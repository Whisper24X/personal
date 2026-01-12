/**
 * Project Manager Role
 * Manages project tasks breakdown
 */

import {
  IRoleConfig,
  ACTION_WRITE_PRD,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { BreakdownTasks } from '../actions/BreakdownTasks';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

export class ProjectManager extends Role {
  constructor(context: Context, name: string = 'ProjectManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProjectManager',
      goal: 'Break down projects into minimal granularity tasks',
      constraints: 'Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria.',
      description: 'Experienced project manager who specializes in task breakdown and project planning',
    };
    
    super(config, context);
    
    // Watch for PRD completion to trigger task breakdown
    this.watch([ACTION_WRITE_PRD]);
    
    // Set actions
    this.setActions([
      new BreakdownTasks(),
    ]);
  }

  /**
   * Override act to handle different action input requirements
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }
    
    const action = this.rc.todo;
    logger.info(`${this.profile} executing action: ${action.name}`);
    
    try {
      let result;
      
      // Handle different actions with specific input requirements
      if (action.name === 'BreakdownTasks') {
        // BreakdownTasks only needs PRD
        const prdMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_PRD);
        
        // Also check memory if not in news
        let prdContent = prdMessage?.content;
        
        if (!prdContent) {
          const prdMessages = this.rc.memory.getByAction(ACTION_WRITE_PRD);
          if (prdMessages.length > 0) {
            prdContent = prdMessages[prdMessages.length - 1].content;
            logger.info(`${this.profile} BreakdownTasks: Found PRD in memory`);
          }
        }
        
        if (!prdContent) {
          logger.warn(`${this.profile} BreakdownTasks: Missing PRD`);
          // Wait for PRD document
          return null;
        }
        
        // 获取workspace选项
        const workspaceOptions = this.extractWorkspaceOptions();
        result = await action.run(prdContent, workspaceOptions);
      } else {
        // Default: use all news messages as context
        const context = this.rc.news.map((msg) => msg.content).join('\n\n');
        result = await action.run(context);
      }
      
      // Create message from result
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });
      
      logger.info(`${this.profile} completed action: ${action.name}`);
      
      // Clear current action
      this.rc.todo = null;
      
      return message;
    } catch (error: any) {
      logger.error(`${this.profile} action failed:`, error);
      this.rc.todo = null;
      throw error;
    }
  }
}

export default ProjectManager;

