/**
 * Project Manager Role
 * Manages project tasks breakdown, sub-project design, and task generation
 */

import {
  IRoleConfig,
  ACTION_WRITE_PRD,
  ACTION_WRITE_DESIGN,
} from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { BreakdownTasks } from '../actions/BreakdownTasks';
import { WriteSubProjectDesign } from '../actions/WriteSubProjectDesign';
import { GenerateTask } from '../actions/GenerateTask';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

export class ProjectManager extends Role {
  constructor(context: Context, name: string = 'ProjectManager') {
    const config: IRoleConfig = {
      name,
      profile: 'ProjectManager',
      goal: 'Break down projects into minimal granularity tasks, provide sub-project design and task generation support for engineers',
      constraints: 'Ensure tasks are minimal granularity, independent, testable, and deliverable. Provide clear task descriptions and acceptance criteria.',
      description: 'Experienced project manager who specializes in task breakdown and project planning',
    };
    
    super(config, context);
    
    // Watch for PRD and Design completion to trigger task breakdown
    this.watch([ACTION_WRITE_PRD, ACTION_WRITE_DESIGN]);
    
    // Set actions
    this.setActions([
      new BreakdownTasks(),
      new WriteSubProjectDesign(),
      new GenerateTask(),
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
        // BreakdownTasks needs both PRD and Design
        const prdMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_PRD);
        const designMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_DESIGN);
        
        // Also check memory if not in news
        let prdContent = prdMessage?.content;
        let designContent = designMessage?.content;
        
        if (!prdContent) {
          const prdMessages = this.rc.memory.getByAction(ACTION_WRITE_PRD);
          if (prdMessages.length > 0) {
            prdContent = prdMessages[prdMessages.length - 1].content;
            logger.info(`${this.profile} BreakdownTasks: Found PRD in memory`);
          }
        }
        
        if (!designContent) {
          const designMessages = this.rc.memory.getByAction(ACTION_WRITE_DESIGN);
          if (designMessages.length > 0) {
            designContent = designMessages[designMessages.length - 1].content;
            logger.info(`${this.profile} BreakdownTasks: Found Design in memory`);
          }
        }
        
        if (!prdContent || !designContent) {
          logger.warn(`${this.profile} BreakdownTasks: Missing PRD or Design. PRD: ${!!prdContent}, Design: ${!!designContent}`);
          // Wait for both documents
          return null;
        }
        
        result = await action.run(prdContent, designContent);
      } else if (action.name === 'WriteSubProjectDesign') {
        // WriteSubProjectDesign needs task breakdown and design
        const taskBreakdownMessage = this.rc.news.find(msg => msg.causeBy === 'BreakdownTasks');
        const designMessage = this.rc.news.find(msg => msg.causeBy === ACTION_WRITE_DESIGN);
        
        let taskBreakdownContent = taskBreakdownMessage?.content;
        let designContent = designMessage?.content;
        
        // Check memory
        if (!taskBreakdownContent) {
          const taskMessages = this.rc.memory.getByAction('BreakdownTasks');
          if (taskMessages.length > 0) {
            taskBreakdownContent = taskMessages[taskMessages.length - 1].content;
          }
        }
        
        if (!designContent) {
          const designMessages = this.rc.memory.getByAction(ACTION_WRITE_DESIGN);
          if (designMessages.length > 0) {
            designContent = designMessages[designMessages.length - 1].content;
          }
        }
        
        if (!taskBreakdownContent || !designContent) {
          logger.warn(`${this.profile} WriteSubProjectDesign: Missing task breakdown or design`);
          return null;
        }
        
        result = await action.run(taskBreakdownContent, designContent);
      } else if (action.name === 'GenerateTask') {
        // GenerateTask needs task breakdown, optionally sub-project design
        const taskBreakdownMessage = this.rc.news.find(msg => msg.causeBy === 'BreakdownTasks');
        const subProjectDesignMessage = this.rc.news.find(msg => msg.causeBy === 'WriteSubProjectDesign');
        
        let taskBreakdownContent = taskBreakdownMessage?.content;
        let subProjectDesignContent = subProjectDesignMessage?.content;
        
        // Check memory
        if (!taskBreakdownContent) {
          const taskMessages = this.rc.memory.getByAction('BreakdownTasks');
          if (taskMessages.length > 0) {
            taskBreakdownContent = taskMessages[taskMessages.length - 1].content;
          }
        }
        
        if (!subProjectDesignContent) {
          const subProjectMessages = this.rc.memory.getByAction('WriteSubProjectDesign');
          if (subProjectMessages.length > 0) {
            subProjectDesignContent = subProjectMessages[subProjectMessages.length - 1].content;
          }
        }
        
        if (!taskBreakdownContent) {
          logger.warn(`${this.profile} GenerateTask: Missing task breakdown`);
          return null;
        }
        
        result = await action.run(taskBreakdownContent, subProjectDesignContent);
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

