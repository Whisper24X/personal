/**
 * Role class
 * Concrete implementation of BaseRole with full observe-think-act lifecycle
 */

import {
  IRoleConfig,
  RoleReactMode,
  RoleStatus,
  ActionStatus,
  anyToStr,
} from '@mind2build/shared';
import { BaseRole } from '../core/base/BaseRole';
import { BaseAction } from '../core/base/BaseAction';
import { Message } from '../core/message/Message';
import { RoleContext } from '../core/context/RoleContext';
import { Context } from '../core/context/Context';
import { logger } from '../utils';
import { RoleLLMConfig } from './RoleLLMConfig';
import { RoleThinker } from './RoleThinker';
import { RoleActionExecutor } from './RoleActionExecutor';
import { RoleWorkspaceExtractor } from './RoleWorkspaceExtractor';

export class Role extends BaseRole {
  goal: string;
  constraints: string;
  description: string;
  actions: BaseAction[] = [];
  rc: RoleContext;
  context: Context;
  private addresses: Set<string> = new Set();

  private llmConfig: RoleLLMConfig;
  private thinker: RoleThinker;
  private actionExecutor: RoleActionExecutor;
  private workspaceExtractor: RoleWorkspaceExtractor;

  constructor(config: IRoleConfig, context: Context) {
    super(config.name, config.profile);
    this.goal = config.goal;
    this.constraints = config.constraints || '';
    this.description = config.description || '';
    this.context = context;
    this.rc = new RoleContext();

    // Initialize modules
    this.llmConfig = new RoleLLMConfig(this.profile, context, this.actions);
    this.workspaceExtractor = new RoleWorkspaceExtractor(this.rc, context);
    this.thinker = new RoleThinker(this.profile, this.rc, this.actions);
    this.actionExecutor = new RoleActionExecutor(
      this.profile,
      this.rc,
      this.actions,
      this.workspaceExtractor
    );

    // Initialize role-specific LLM if configured
    // Priority: database config > config.llm (explicit) > default (context.llm)
    this.llmConfig.initializeWithConfig(config.llm);
    this.llmConfig.startLoadingFromDatabase();

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
   * 获取角色状态
   */
  getStatus(): RoleStatus {
    return this.rc.status;
  }

  /**
   * 设置角色状态
   */
  setStatus(status: RoleStatus): void {
    this.rc.status = status;
    logger.debug(`${this.profile} status changed to: ${status}`);
  }

  /**
   * 获取当前action的状态
   */
  getActionStatus(): ActionStatus | null {
    return this.rc.todo?.status || null;
  }

  /**
   * 设置当前action的状态
   */
  setActionStatus(status: ActionStatus): void {
    if (this.rc.todo) {
      this.rc.todo.status = status;
      logger.debug(`${this.profile} action ${this.rc.todo.name} status changed to: ${status}`);
    }
  }

  /**
   * Set actions for this role
   */
  setActions(actions: BaseAction[]): void {
    this.actions = actions;

    // Update modules with new actions
    this.thinker = new RoleThinker(this.profile, this.rc, this.actions);
    this.actionExecutor = new RoleActionExecutor(
      this.profile,
      this.rc,
      this.actions,
      this.workspaceExtractor
    );

    // Set context and role for each action
    // LLM is NOT set here - it will be obtained dynamically from Context
    // unless there's a role-specific config (handled by updateActionsLLM)
    actions.forEach((action) => {
      // Set context for each action (enables dynamic LLM access via context.llm)
      (action as any).context = this.context;
      // Set role for each action (for StateManager integration)
      (action as any).role = this;
      // Initialize action status as pending
      action.status = ActionStatus.PENDING;
    });

    // Let RoleLLMConfig handle LLM assignment
    // Only sets custom LLM if role has specific config, otherwise Actions use Context.llm
    this.llmConfig.updateActionsLLM(actions);

    // Initialize role status as idle
    this.rc.status = RoleStatus.IDLE;

    if (this.llmConfig.hasSpecificConfig()) {
      logger.debug(`${this.profile} setActions: using role-specific LLM`);
    } else {
      logger.info(
        `${this.profile} setActions: Actions will use Context.llm (supports hot-reload)`
      );
    }
  }

  /**
   * Subscribe to specific action types
   */
  watch(actionTypes: Array<string | Function>): void {
    actionTypes.forEach((actionType) => {
      if (actionType === undefined || actionType === null) {
        logger.warn(`${this.profile} watch(): Received undefined/null actionType, skipping`);
        return;
      }
      const actionStr = anyToStr(actionType);
      if (!actionStr || actionStr === 'undefined' || actionStr === 'null') {
        logger.warn(`${this.profile} watch(): Failed to convert actionType to string: ${actionType}, skipping`);
        return;
      }
      this.rc.watch.add(actionStr);
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
      // 3. In BY_ORDER mode, we're in the middle of executing a sequence of actions
      const hasPendingTodo = this.rc.todo !== null;
      const hasWatchedMessages = this.rc.news.some(msg => this.rc.watch.has(msg.causeBy));
      const isInSequence = this.rc.reactMode === RoleReactMode.BY_ORDER &&
        this.rc.state >= 0 &&
        this.rc.state < this.actions.length - 1;

      if (hasPendingTodo || hasWatchedMessages || isInSequence) {
        const newsCauseBys = this.rc.news.map(m => m.causeBy).join(', ');
        logger.debug(`${this.profile} observed no new messages, but preserving news (todo: ${hasPendingTodo}, watched: ${hasWatchedMessages}, inSequence: ${isInSequence}): [${newsCauseBys}]`);
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
    return await this.thinker.think();
  }

  /**
   * Extract workspace options from messages
   * Protected method for subclasses that need to override this behavior
   */
  protected extractWorkspaceOptions(): any {
    return this.workspaceExtractor.extractWorkspaceOptions(this.rc.todo?.name);
  }


  /**
   * Act: Execute the current action
   */
  async act(): Promise<Message | null> {
    return await this.actionExecutor.act();
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

