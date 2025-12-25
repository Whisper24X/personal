/**
 * Role class
 * Concrete implementation of BaseRole with full observe-think-act lifecycle
 */

import {
  IRoleConfig,
  RoleReactMode,
  anyToStr,
} from '@mind2build/shared';
import { BaseRole } from '../core/base/BaseRole';
import { BaseAction } from '../core/base/BaseAction';
import { Message } from '../core/message/Message';
import { RoleContext } from '../core/context/RoleContext';
import { Context } from '../core/context/Context';
import { logger } from '../utils';

export class Role extends BaseRole {
  goal: string;
  constraints: string;
  description: string;
  actions: BaseAction[] = [];
  rc: RoleContext;
  context: Context;
  private addresses: Set<string> = new Set();

  constructor(config: IRoleConfig, context: Context) {
    super(config.name, config.profile);
    this.goal = config.goal;
    this.constraints = config.constraints || '';
    this.description = config.description || '';
    this.context = context;
    this.rc = new RoleContext();

    // Initialize addresses for message routing
    this.addresses.add(this.name);
    this.addresses.add(this.profile);
    this.addresses.add(anyToStr(this));
  }

  /**
   * Check if role is idle
   */
  get isIdle(): boolean {
    return this.rc.todo === null && this.rc.msgBuffer.isEmpty;
  }

  /**
   * Set actions for this role
   */
  setActions(actions: BaseAction[]): void {
    this.actions = actions;
    // Set LLM for each action
    actions.forEach((action) => action.setLLM(this.context.llm));
  }

  /**
   * Subscribe to specific action types
   */
  watch(actionTypes: Array<string | Function>): void {
    actionTypes.forEach((actionType) => {
      this.rc.watch.add(anyToStr(actionType));
    });
  }

  /**
   * Put a message into the role's message buffer
   */
  putMessage(message: Message): void {
    this.rc.putMessage(message);
  }

  /**
   * Observe: Get new messages from buffer
   */
  async observe(): Promise<number> {
    const messages = this.rc.getBufferedMessages();

    if (messages.length > 0) {
      // Replace news with new messages (don't accumulate)
      this.rc.news = messages;
      // Add messages to memory
      messages.forEach((msg) => this.rc.addToMemory(msg));
      const causeBys = messages.map(m => m.causeBy).join(', ');
      const watchSet = Array.from(this.rc.watch).join(', ');
      logger.info(`${this.profile} observed ${messages.length} new messages: [${causeBys}], watching: [${watchSet}]`);

      // Log detailed message content
      messages.forEach((msg, index) => {
        logger.info(`${this.profile} observed message ${index + 1}/${messages.length}:`, {
          id: msg.id,
          role: msg.role,
          causeBy: msg.causeBy,
          sentFrom: msg.sentFrom,
          sendTo: Array.from(msg.sendTo),
          content: msg.content,
          instructContent: msg.instructContent,
          metadata: msg.metadata,
        });
      });

      // Check if any message matches watch set
      const matchingMessages = messages.filter(msg => this.rc.watch.has(msg.causeBy));
      if (matchingMessages.length > 0) {
        logger.info(`${this.profile} found ${matchingMessages.length} matching message(s) in watch set`);
      } else if (this.rc.watch.size > 0) {
        logger.warn(`${this.profile} received messages but none match watch set. Messages: [${causeBys}], Watch: [${watchSet}]`);
      }
    } else {
      // Don't clear news if:
      // 1. There's a pending todo (action hasn't been executed yet)
      // 2. News contains watched messages that haven't been acted upon
      const hasPendingTodo = this.rc.todo !== null;
      const hasWatchedMessages = this.rc.news.some(msg => this.rc.watch.has(msg.causeBy));

      if (hasPendingTodo || hasWatchedMessages) {
        const newsCauseBys = this.rc.news.map(m => m.causeBy).join(', ');
        logger.debug(`${this.profile} observed no new messages, but preserving news (todo: ${hasPendingTodo}, watched: ${hasWatchedMessages}): [${newsCauseBys}]`);
      } else {
        // Clear news if no new messages and nothing pending
        this.rc.news = [];
        logger.debug(`${this.profile} observed no new messages, cleared news`);
      }
    }

    return messages.length;
  }

  /**
   * Think: Decide what action to take next
   */
  async think(): Promise<boolean> {
    // Log input for think
    const newsContents = this.rc.news.map((msg, idx) =>
      `[${idx + 1}] ${msg.causeBy} (from ${msg.sentFrom}): ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
    ).join('\n');
    logger.debug(`${this.profile} think() input - news count: ${this.rc.news.length}, reactMode: ${this.rc.reactMode}`, {
      newsContents: newsContents,
      newsDetails: this.rc.news.map(msg => ({
        causeBy: msg.causeBy,
        sentFrom: msg.sentFrom,
        contentLength: msg.content.length,
        hasInstructContent: !!msg.instructContent,
      })),
    });

    let result = false;
    if (this.rc.reactMode === RoleReactMode.BY_ORDER) {
      result = this.thinkByOrder();
    } else if (this.rc.reactMode === RoleReactMode.PLAN_AND_ACT) {
      result = await this.thinkPlanAndAct();
    } else {
      result = await this.thinkReact();
    }

    // Log output for think
    logger.debug(`${this.profile} think() output:`, {
      result: result,
      selectedTodo: this.rc.todo ? {
        name: this.rc.todo.name,
        description: this.rc.todo.description,
        type: this.rc.todo.constructor.name,
      } : null,
      state: this.rc.state,
    });
    return result;
  }

  /**
   * Think in BY_ORDER mode: Execute actions sequentially
   */
  private thinkByOrder(): boolean {
    // Check if there are relevant messages
    const relevantMessages = this.rc.news.filter((msg) =>
      this.rc.watch.has(msg.causeBy)
    );
    const hasRelevantMessages = relevantMessages.length > 0;

    // Debug: log all news causeBy values
    const newsCauseBys = this.rc.news.map(msg => msg.causeBy).join(', ');
    const watchSet = Array.from(this.rc.watch).join(', ');
    logger.debug(`${this.profile} thinkByOrder: news=${this.rc.news.length}, news.causeBy=[${newsCauseBys}], watch=[${watchSet}], relevant=${relevantMessages.length}, state=${this.rc.state}, todo=${this.rc.todo ? this.rc.todo.name : 'null'}`);

    // If we already have a todo, don't change it
    if (this.rc.todo !== null) {
      logger.debug(`${this.profile} thinkByOrder: Already has todo: ${this.rc.todo.name}`);
      return true;
    }

    // Check if we have relevant messages to process
    if (!hasRelevantMessages) {
      // If we have news but no relevant messages, log warning
      if (this.rc.news.length > 0) {
        logger.warn(`${this.profile} thinkByOrder: News exists but no relevant messages found. News causeBys: [${newsCauseBys}], Watch set: [${watchSet}]`);
      }
      return false;
    }

    // Validate we have actions to execute
    if (this.actions.length === 0) {
      logger.warn(`${this.profile} thinkByOrder: Has relevant messages but no actions configured`);
      return false;
    }

    // If we have relevant messages but no todo, we need to set one
    // Reset state to -1 and start from the first action
    logger.info(`${this.profile} thinkByOrder: Resetting state to process new messages (current state: ${this.rc.state}, actions: ${this.actions.length})`);
    this.rc.state = -1; // Reset to initial state
    this.rc.state++;

    // Validate state is within bounds
    if (this.rc.state >= this.actions.length) {
      logger.error(`${this.profile} thinkByOrder: State ${this.rc.state} exceeds actions length ${this.actions.length}`);
      return false;
    }

    this.rc.todo = this.actions[this.rc.state];
    logger.info(`${this.profile} thinkByOrder: Set todo to action ${this.rc.state}: ${this.rc.todo.name}`, {
      actionIndex: this.rc.state,
      actionName: this.rc.todo.name,
      actionDescription: this.rc.todo.description,
      actionType: this.rc.todo.constructor.name,
      totalActions: this.actions.length,
    });
    return true;
  }

  /**
   * Think in REACT mode: LLM decides next action
   */
  private async thinkReact(): Promise<boolean> {
    // For MVP, use simple logic
    // TODO: Implement LLM-based action selection in future
    if (this.actions.length > 0 && this.rc.todo === null) {
      this.rc.todo = this.actions[0];
      return true;
    }
    return false;
  }

  /**
   * Think in PLAN_AND_ACT mode: Plan all actions first
   */
  private async thinkPlanAndAct(): Promise<boolean> {
    // For MVP, similar to BY_ORDER
    // TODO: Implement planning logic in future
    return this.thinkByOrder();
  }

  /**
   * Act: Execute the current action
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;
    logger.info(`${this.profile} executing action: ${action.name}`);

    try {
      // Get relevant context from news
      const context = this.rc.news.map((msg) => msg.content).join('\n\n');

      // Special handling for WriteTest: also include PRD from memory
      let actionInput = context;
      if (action.name === 'WriteTest') {
        const prdMessages = this.rc.memory.getByAction('WritePRD');
        if (prdMessages.length > 0) {
          const prdContent = prdMessages[prdMessages.length - 1].content; // Get the latest PRD
          actionInput = `PRD文档：\n${prdContent}\n\n代码实现：\n${context}`;
          logger.info(`${this.profile} WriteTest: Including PRD from memory`, {
            prdLength: prdContent.length,
            codeLength: context.length,
          });
        } else {
          logger.warn(`${this.profile} WriteTest: No PRD found in memory, proceeding with code only`);
        }
      }

      // Log input for act
      logger.info(`${this.profile} act() input:`, {
        actionName: action.name,
        actionType: action.constructor.name,
        contextLength: actionInput.length,
        contextPreview: actionInput.substring(0, 500) + (actionInput.length > 500 ? '...' : ''),
        newsCount: this.rc.news.length,
        newsDetails: this.rc.news.map(msg => ({
          causeBy: msg.causeBy,
          sentFrom: msg.sentFrom,
          contentLength: msg.content.length,
          contentPreview: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
        })),
      });

      // Execute action
      const result = await action.run(actionInput);

      // Log output for act
      logger.info(`${this.profile} act() output:`, {
        actionName: action.name,
        resultContentLength: result.content.length,
        resultContentPreview: result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''),
        resultData: result.data,
        hasData: !!result.data,
      });

      // Create message from result
      const message = new Message({
        content: result.content,
        role: this.profile,
        causeBy: action.constructor.name,
        sentFrom: this.name,
        instructContent: result.data,
      });

      logger.info(`${this.profile} completed action: ${action.name}`, {
        messageId: message.id,
        messageContentLength: message.content.length,
        messageInstructContent: message.instructContent,
      });

      // Clear current action and news after successful execution
      // This allows the role to process new messages in the next cycle
      this.rc.todo = null;
      this.rc.news = [];
      logger.debug(`${this.profile} cleared todo and news after successful action execution`);

      return message;
    } catch (error: any) {
      logger.error(`${this.profile} action failed:`, {
        actionName: action.name,
        error: error.message,
        errorStack: error.stack,
        contextLength: this.rc.news.map((msg) => msg.content).join('\n\n').length,
      });
      // Don't clear news on error - allow retry
      this.rc.todo = null;
      throw error;
    }
  }

  /**
   * Main run loop: observe -> think -> act
   */
  async run(): Promise<Message | null> {
    logger.debug(`${this.profile} run() started`);

    // Observe new messages
    const newMessages = await this.observe();

    // Log current state for debugging
    const newsCauseBys = this.rc.news.map(m => m.causeBy).join(', ');
    const watchSet = Array.from(this.rc.watch).join(', ');
    logger.debug(`${this.profile} run() after observe:`, {
      newMessages: newMessages,
      newsCount: this.rc.news.length,
      newsCauseBys: newsCauseBys,
      watchSet: watchSet,
      todo: this.rc.todo ? this.rc.todo.name : 'null',
      state: this.rc.state,
    });

    if (newMessages === 0 && this.rc.todo === null) {
      // No new messages and no pending action
      // Check if we have news that should trigger an action
      if (this.rc.news.length > 0) {
        const hasWatchedMessages = this.rc.news.some(msg => this.rc.watch.has(msg.causeBy));
        if (hasWatchedMessages) {
          logger.info(`${this.profile} run(): Has watched messages in news but no todo - will try to think`);
        } else {
          logger.debug(`${this.profile} run(): No new messages, no todo, and news doesn't contain watched messages`);
          return null;
        }
      } else {
        logger.debug(`${this.profile} run(): No new messages, no todo, no news`);
        return null;
      }
    }

    // Think about what to do
    const hasTodo = await this.think();

    if (!hasTodo) {
      // Nothing to do - log why
      if (this.rc.news.length > 0) {
        logger.warn(`${this.profile} run(): think() returned false despite having ${this.rc.news.length} news messages. News: [${newsCauseBys}], Watch: [${watchSet}]`);
      } else {
        logger.debug(`${this.profile} run(): think() returned false - no actionable items`);
      }
      return null;
    }

    // Execute action
    const message = await this.act();

    if (message) {
      logger.info(`${this.profile} run() completed successfully:`, {
        messageId: message.id,
        messageCauseBy: message.causeBy,
        messageContentLength: message.content.length,
        messageContentPreview: message.content.substring(0, 300) + (message.content.length > 300 ? '...' : ''),
        messageInstructContent: message.instructContent,
      });
    } else {
      logger.warn(`${this.profile} run(): act() returned null despite having todo`);
    }

    return message;
  }

  /**
   * Get recent memories
   */
  getMemories(k: number = 0): Message[] {
    if (k === 0) {
      return this.rc.news;
    }
    return this.rc.news.slice(-k);
  }

  /**
   * Get role addresses for message routing
   */
  getAddresses(): Set<string> {
    return this.addresses;
  }

  /**
   * Serialize role to JSON
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      profile: this.profile,
      goal: this.goal,
      constraints: this.constraints,
      description: this.description,
      actions: this.actions.map((a) => a.toJSON()),
      rc: this.rc.toJSON(),
    };
  }
}

export default Role;

