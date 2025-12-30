/**
 * Role class
 * Concrete implementation of BaseRole with full observe-think-act lifecycle
 */

import {
  IRoleConfig,
  RoleReactMode,
  anyToStr,
  ILLMConfig,
} from '@mind2build/shared';
import { BaseRole } from '../core/base/BaseRole';
import { BaseAction } from '../core/base/BaseAction';
import { Message } from '../core/message/Message';
import { RoleContext } from '../core/context/RoleContext';
import { Context } from '../core/context/Context';
import { logger, WorkspaceOptions } from '../utils';
import { createLLM } from '../providers/llm/factory';
import { RoleLLMConfigRepository } from '../database';

export class Role extends BaseRole {
  goal: string;
  constraints: string;
  description: string;
  actions: BaseAction[] = [];
  rc: RoleContext;
  context: Context;
  private addresses: Set<string> = new Set();

  private roleLLM?: any; // Role-specific LLM instance
  private roleLLMConfigRepo = new RoleLLMConfigRepository();
  private llmLoadPromise?: Promise<void>; // Track async LLM loading

  constructor(config: IRoleConfig, context: Context) {
    super(config.name, config.profile);
    this.goal = config.goal;
    this.constraints = config.constraints || '';
    this.description = config.description || '';
    this.context = context;
    this.rc = new RoleContext();

    // Initialize role-specific LLM if configured
    // Priority: database config > config.llm (explicit) > default (context.llm)
    // First, try to load from database (highest priority)
    this.llmLoadPromise = this.loadRoleLLMFromDatabase(context);
    
    // If explicit config.llm is provided, use it as fallback (for backward compatibility)
    // But database config will override it when loaded
    if (config.llm) {
      // Use explicitly provided LLM config as temporary fallback
      // Will be overridden by database config if available
      this.roleLLM = createLLM(config.llm);
      this.roleLLM.costManager = context.costManager;
      logger.info(`${this.profile} using explicitly configured LLM (may be overridden by database config): ${config.llm.provider}/${config.llm.model}`);
    }

    // Initialize addresses for message routing
    this.addresses.add(this.name);
    this.addresses.add(this.profile);
    this.addresses.add(anyToStr(this));
  }

  /**
   * Load role-specific LLM configuration from database
   * Priority: database config > explicit config.llm > default context.llm
   */
  private async loadRoleLLMFromDatabase(context: Context): Promise<void> {
    try {
      // Get userId from context (if set)
      const userId = context.get('userId') || '302769d6-247d-43db-a005-0519712255fb';
      
      // Load role-specific LLM config from database
      const dbConfig = await this.roleLLMConfigRepo.findByProfile(userId, this.profile);
      
      if (dbConfig) {
        // Convert database config to ILLMConfig
        const llmConfig: ILLMConfig = {
          provider: dbConfig.provider,
          apiKey: dbConfig.api_key || '',
          baseURL: dbConfig.base_url,
          model: dbConfig.model,
          temperature: dbConfig.temperature !== null ? dbConfig.temperature : undefined,
          maxTokens: dbConfig.max_tokens !== null ? dbConfig.max_tokens : undefined,
          repository: dbConfig.repository || undefined,
          branchName: dbConfig.branch_name || undefined,
          autoCreatePr: dbConfig.auto_create_pr,
        };
        
        // Create role-specific LLM instance (overrides any explicit config.llm)
        this.roleLLM = createLLM(llmConfig);
        this.roleLLM.costManager = context.costManager;
        
        // If actions have already been set, update their LLM
        if (this.actions.length > 0) {
          this.actions.forEach((action) => action.setLLM(this.roleLLM));
          logger.info(`${this.profile} updated actions with database LLM config: ${dbConfig.provider}/${dbConfig.model}`);
        } else {
          logger.info(`${this.profile} loaded LLM config from database (highest priority): ${dbConfig.provider}/${dbConfig.model}`);
        }
      } else {
        // No database config found
        // If explicit config.llm was provided, keep using it
        // Otherwise, will use default context.llm in setActions
        if (!this.roleLLM) {
          logger.debug(`${this.profile} no database LLM config found, will use default context.llm`);
        } else {
          logger.debug(`${this.profile} no database LLM config found, using explicit config.llm`);
        }
      }
    } catch (error: any) {
      // If database query fails, keep using explicit config.llm or default LLM
      logger.debug(`${this.profile} error loading LLM config from database:`, error.message);
      if (!this.roleLLM) {
        logger.debug(`${this.profile} will use default context.llm due to database error`);
      }
    }
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
    // Set LLM for each action - use role-specific LLM if available, otherwise use context LLM
    // If database config is still loading, use default LLM for now; it will be updated when loading completes
    const llmToUse = this.roleLLM || this.context.llm;
    actions.forEach((action) => action.setLLM(llmToUse));
    
    if (this.roleLLM) {
      logger.debug(`${this.profile} setActions: using role-specific LLM`);
    } else {
      logger.debug(`${this.profile} setActions: using default context LLM (database config may still be loading)`);
    }
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
   * Extract workspace options from messages
   * 从消息中提取workspace选项（applicationId, version等）
   */
  protected extractWorkspaceOptions(): WorkspaceOptions | undefined {
    // 尝试从最近的PRD、Design或RequirementSpec消息中获取workspace选项
    const messagesToCheck = [
      ...this.rc.news,
      ...this.rc.memory.getByAction('WritePRD'),
      ...this.rc.memory.getByAction('WriteDesign'),
      ...this.rc.memory.getByAction('WriteRequirementSpec'),
    ];

    for (const msg of messagesToCheck) {
      const data = msg.instructContent as any;
      if (data?.workspaceDir) {
        // 从workspaceDir解析applicationId和version
        // 格式: {applicationId}-v{version}-{documentType}
        const match = data.workspaceDir.match(/(.+)-v(\d+)-(.+)/);
        if (match) {
          return {
            applicationId: match[1],
            version: parseInt(match[2], 10),
            documentType: this.getDocumentTypeForAction(this.rc.todo?.name || ''),
          };
        }
      }
      
      // 如果消息数据中直接包含workspace选项
      if (data?.applicationId && data?.version) {
        return {
          applicationId: data.applicationId,
          version: data.version,
          documentType: this.getDocumentTypeForAction(this.rc.todo?.name || ''),
        };
      }
    }

    return undefined;
  }

  /**
   * Get document type for action
   */
  private getDocumentTypeForAction(actionName: string): string {
    const typeMap: Record<string, string> = {
      'WriteRequirementSpec': 'REQUIREMENT',
      'WritePRD': 'PRD',
      'WriteDesign': 'DESIGN',
      'WriteSubProjectDesign': 'DESIGN',
      'BreakdownTasks': 'TASKS',
      'GenerateTask': 'TASKS',
      'WriteCode': 'CODE',
      'WriteTest': 'TEST',
      'ExecuteSubtask': 'CODE',
    };
    return typeMap[actionName] || 'DOCS';
  }

  /**
   * Check if action accepts options parameter
   */
  private actionAcceptsOptions(actionName: string): boolean {
    // 这些Action支持options参数
    const actionsWithOptions = [
      'WriteRequirementSpec',
      'WritePRD',
      'WriteDesign',
      'WriteSubProjectDesign',
      'BreakdownTasks',
      'GenerateTask',
      'WriteCode',
      'WriteTest',
      'ExecuteSubtask',
    ];
    return actionsWithOptions.includes(actionName);
  }

  /**
   * Run action with workspace options
   */
  private async runActionWithOptions(
    action: BaseAction,
    input: string,
    workspaceOptions: WorkspaceOptions
  ): Promise<any> {
    const actionName = action.name;

    // 根据不同的Action，传递不同的参数
    switch (actionName) {
      case 'WriteRequirementSpec':
        return await (action as any).run(input, workspaceOptions);
      
      case 'WritePRD':
        return await (action as any).run(input, workspaceOptions);
      
      case 'WriteDesign':
        return await (action as any).run(input, workspaceOptions);
      
      case 'WriteSubProjectDesign':
        // WriteSubProjectDesign需要两个参数：taskBreakdown和design
        // 这里需要特殊处理，暂时只传递第一个参数
        return await (action as any).run(input, undefined, workspaceOptions);
      
      case 'BreakdownTasks':
        // BreakdownTasks需要两个参数：prd和design
        // 需要从消息中提取
        const prdMessages = this.rc.memory.getByAction('WritePRD');
        const designMessages = this.rc.memory.getByAction('WriteDesign');
        const prd = prdMessages.length > 0 ? prdMessages[prdMessages.length - 1].content : input;
        const design = designMessages.length > 0 ? designMessages[designMessages.length - 1].content : input;
        return await (action as any).run(prd, design, workspaceOptions);
      
      case 'GenerateTask':
        // GenerateTask需要taskBreakdown和可选的subProjectDesign
        const taskBreakdownMessages = this.rc.memory.getByAction('BreakdownTasks');
        const subProjectMessages = this.rc.memory.getByAction('WriteSubProjectDesign');
        const taskBreakdown = taskBreakdownMessages.length > 0 
          ? taskBreakdownMessages[taskBreakdownMessages.length - 1].content 
          : input;
        const subProjectDesign = subProjectMessages.length > 0 
          ? subProjectMessages[subProjectMessages.length - 1].content 
          : undefined;
        return await (action as any).run(taskBreakdown, subProjectDesign, workspaceOptions);
      
      case 'WriteCode':
        return await (action as any).run(input, workspaceOptions);
      
      case 'WriteTest':
        return await (action as any).run(input, workspaceOptions);
      
      case 'ExecuteSubtask':
        // ExecuteSubtask需要taskDescription和options
        return await (action as any).run(input, workspaceOptions);
      
      default:
        // 默认情况，只传递input
        return await action.run(input);
    }
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

      // Extract workspace options
      const workspaceOptions = this.extractWorkspaceOptions();

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
        workspaceOptions,
        newsDetails: this.rc.news.map(msg => ({
          causeBy: msg.causeBy,
          sentFrom: msg.sentFrom,
          contentLength: msg.content.length,
          contentPreview: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
        })),
      });

      // Execute action with workspace options
      // 根据Action的签名决定如何传递参数
      let result;
      if (workspaceOptions && this.actionAcceptsOptions(action.name)) {
        // 如果Action支持options参数，传递workspace选项
        result = await this.runActionWithOptions(action, actionInput, workspaceOptions);
      } else {
        // 否则使用默认方式
        result = await action.run(actionInput);
      }

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

