/**
 * Team class
 * High-level orchestration API for multi-agent collaboration
 */

import { Context } from '../core/context/Context';
import { Environment } from './Environment';
import { Role } from '../roles/Role';
import { Message } from '../core/message/Message';
import { logger } from '../utils';
import { NoMoneyException } from '@mind2build/shared';
import { InteractiveHandler } from '../utils/InteractiveHandler';

export class Team {
  private context: Context;
  private env: Environment;
  private idea: string = '';
  private nRound: number = 5;
  private interactiveHandler: InteractiveHandler;

  constructor(context?: Context, interactive: boolean = false) {
    this.context = context || new Context();
    this.interactiveHandler = new InteractiveHandler(interactive);
    this.env = new Environment(this.interactiveHandler);
  }

  /**
   * Hire roles (add them to the team)
   */
  hire(roles: Role[]): void {
    this.env.addRoles(roles);
    logger.info(`Team: Hired ${roles.length} roles`);
  }

  /**
   * Set interactive mode
   */
  setInteractive(enabled: boolean): void {
    this.interactiveHandler.setEnabled(enabled);
  }

  /**
   * Get interactive handler
   */
  getInteractiveHandler(): InteractiveHandler {
    return this.interactiveHandler;
  }

  /**
   * Set investment/budget
   */
  invest(amount: number): void {
    this.context.costManager.maxBudget = amount;
    logger.info(`Team: Investment set to $${amount}`);
  }

  /**
   * Run the team with a project idea
   */
  async run(idea: string, nRound?: number): Promise<{
    success: boolean;
    messages: Message[];
    cost: number;
  }> {
    this.idea = idea;
    if (nRound !== undefined) {
      this.nRound = nRound;
    }

    logger.info('Team: Starting project execution', {
      idea: idea.substring(0, 100),
      maxRounds: this.nRound,
    });

    try {
      // Publish initial user requirement
      const initialMessage = new Message({
        content: idea,
        role: 'user',
        causeBy: 'User',
        sentFrom: 'User',
      });
      
      this.env.publishMessage(initialMessage);
      
      // Run for specified rounds
      await this.env.runForRounds(this.nRound);
      
      // Check if all work is complete
      if (!this.env.isIdle) {
        logger.warn('Team: Reached max rounds but roles still have pending work');
      }
      
      const costReport = this.context.costManager.getReport();
      
      logger.info('Team: Project execution completed', {
        messagesGenerated: this.env.history.length,
        totalCost: costReport.totalCost.toFixed(4),
        tokensUsed: costReport.totalTokens,
      });
      
      return {
        success: true,
        messages: this.env.history,
        cost: costReport.totalCost,
      };
    } catch (error: any) {
      if (error instanceof NoMoneyException) {
        logger.error('Team: Budget exhausted', {
          spent: this.context.costManager.getReport().totalCost,
          budget: this.context.costManager.maxBudget,
        });
      } else {
        logger.error('Team: Execution failed', error);
      }
      
      return {
        success: false,
        messages: this.env.history,
        cost: this.context.costManager.getReport().totalCost,
      };
    } finally {
      // Close interactive handler
      this.interactiveHandler.close();
    }
  }

  /**
   * Get cost report
   */
  getCostReport() {
    return this.context.costManager.getReport();
  }

  /**
   * Get message history
   */
  getHistory(): Message[] {
    return this.env.history;
  }

  /**
   * Get environment
   */
  getEnvironment(): Environment {
    return this.env;
  }

  /**
   * Get context
   */
  getContext(): Context {
    return this.context;
  }

  /**
   * Serialize team state
   */
  toJSON(): Record<string, any> {
    return {
      idea: this.idea,
      nRound: this.nRound,
      context: this.context.toJSON(),
      environment: this.env.toJSON(),
    };
  }

  /**
   * Deserialize team state
   */
  static fromJSON(data: any): Team {
    const context = Context.fromJSON(data.context);
    const team = new Team(context);
    team.idea = data.idea;
    team.nRound = data.nRound;
    // Note: Environment roles need to be re-instantiated
    return team;
  }
}

export default Team;

