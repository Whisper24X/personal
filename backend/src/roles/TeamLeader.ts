/**
 * Team Leader Role
 * Coordinates team work and makes decisions based on all messages
 */

import { IRoleConfig } from '@mind2build/shared';
import { Role } from './Role';
import { Context } from '../core/context/Context';
import { Coordinate } from '../actions/Coordinate';
import { Message } from '../core/message/Message';
import { logger } from '../utils';

export class TeamLeader extends Role {
  constructor(context: Context, name: string = 'TeamLeader') {
    const config: IRoleConfig = {
      name,
      profile: 'TeamLeader',
      goal: '团队领导，负责协调各角色工作，制定开发计划，进行决策管理',
      constraints: '确保团队协作高效，决策合理',
      description: '我是一名经验丰富的团队领导，擅长协调团队工作，制定计划并做出关键决策。',
    };
    
    super(config, context);
    
    // Team Leader doesn't need to watch specific actions
    // It will receive all broadcast messages automatically
    // And can access all messages from environment history
    
    // Set actions
    this.setActions([new Coordinate()]);
  }

  /**
   * Override act to provide all environment messages to Coordinate action
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }
    
    const action = this.rc.todo;
    
      // For TeamLeader, get all messages from environment history, not just news
      let allMessagesContent: string;
      
      if (this.rc.env && this.rc.env.history) {
        // Get all messages from environment history
        const allMessages = this.rc.env.history;
        allMessagesContent = allMessages.map((msg: Message) => {
          return `[${msg.sentFrom} (${msg.role})] ${msg.causeBy}:\n${msg.content}`;
        }).join('\n\n---\n\n');
      } else {
        // Fallback to news if environment not available
        allMessagesContent = this.rc.news.map((msg) => msg.content).join('\n\n');
      }
      
    // Log action execution start
    logger.info(`Action [${action.name}]: Starting execution`, {
      actionName: action.name,
      role: this.profile,
      description: action.description,
      inputLength: allMessagesContent.length,
    });
    
    const actionStartTime = Date.now();
    try {
      // Execute action with all messages
      const result = await action.run(allMessagesContent);
      
      // Log action execution success
      const executionTime = Date.now() - actionStartTime;
      logger.info(`Action [${action.name}]: Execution completed successfully`, {
        actionName: action.name,
        role: this.profile,
        executionTimeMs: executionTime,
        outputType: result.data?.type,
        contentLength: result.content?.length || 0,
      });
      
      // Create message from result
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });
      
      // Clear current action
      this.rc.todo = null;
      
      return message;
    } catch (error: any) {
      // Log action execution failure
      const executionTime = Date.now() - actionStartTime;
      logger.error(`Action [${action.name}]: Execution failed`, {
        actionName: action.name,
        role: this.profile,
        executionTimeMs: executionTime,
        error: error.message,
        errorStack: error.stack,
      });
      this.rc.todo = null;
      throw error;
    }
  }
}

export default TeamLeader;

