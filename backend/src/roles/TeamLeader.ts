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
  constructor(context: Context, name: string = 'Mike') {
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
    logger.info(`${this.profile} executing action: ${action.name}`);
    
    try {
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
      
      // Execute action with all messages
      const result = await action.run(allMessagesContent);
      
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

export default TeamLeader;

