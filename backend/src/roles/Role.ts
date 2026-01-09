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
  ILLMConfig,
} from '@mind2build/shared';
import * as path from 'path';
import { BaseRole } from '../core/base/BaseRole';
import { BaseAction } from '../core/base/BaseAction';
import { Message } from '../core/message/Message';
import { RoleContext } from '../core/context/RoleContext';
import { Context } from '../core/context/Context';
import { logger, WorkspaceOptions } from '../utils';
import { createLLM } from '../providers/llm/factory';
import { RoleLLMConfigRepository, LLMConfigRepository } from '../database';

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
  private llmConfigRepo = new LLMConfigRepository();
  protected llmLoadPromise?: Promise<void>; // Track async LLM loading

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
   * Priority: database config (role-specific) > explicit config.llm > active LLM config from database
   * If no role-specific config is found, will use active LLM config from database
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
          baseURL: dbConfig.base_url || undefined,
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
        // No role-specific config found - use active LLM config from database
        try {
          const activeConfig = await this.llmConfigRepo.findActive(userId);
          if (activeConfig) {
            // Convert database config to ILLMConfig using repository method
            const llmConfig = this.llmConfigRepo.toILLMConfig(activeConfig);

            // Create LLM instance using active config
            this.roleLLM = createLLM(llmConfig);
            this.roleLLM.costManager = context.costManager;

            // If actions have already been set, update their LLM
            if (this.actions.length > 0) {
              this.actions.forEach((action) => action.setLLM(this.roleLLM));
              logger.info(`${this.profile} updated actions with active LLM config from database: ${llmConfig.provider}/${llmConfig.model}`);
            } else {
              logger.info(`${this.profile} using active LLM config from database: ${llmConfig.provider}/${llmConfig.model}`);
            }
          } else {
            // No active config found - fallback to context.llm or explicit config.llm
            if (!this.roleLLM) {
              const defaultConfig = context.config.llm;
              logger.warn(`${this.profile} no role-specific or active LLM config found, using system default: ${defaultConfig.provider}/${defaultConfig.model}`);
            } else {
              logger.debug(`${this.profile} no database LLM config found, using explicit config.llm`);
            }
          }
        } catch (activeConfigError: any) {
          // If failed to load active config, fallback to context.llm or explicit config.llm
          logger.debug(`${this.profile} error loading active LLM config from database:`, activeConfigError.message);
          if (!this.roleLLM) {
            const defaultConfig = context.config.llm;
            logger.info(`${this.profile} will use system default LLM config due to database error: ${defaultConfig.provider}/${defaultConfig.model}`);
          }
        }
      }
    } catch (error: any) {
      // If database query fails, keep using explicit config.llm or system default LLM
      logger.debug(`${this.profile} error loading LLM config from database:`, error.message);
      if (!this.roleLLM) {
        const defaultConfig = context.config.llm;
        logger.info(`${this.profile} will use system default LLM config due to database error: ${defaultConfig.provider}/${defaultConfig.model}`);
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
    // Set LLM for each action - use role-specific LLM if available, otherwise use system default LLM (context.llm)
    // Priority: role-specific LLM > system default LLM config
    // If database config is still loading, use system default LLM for now; it will be updated when loading completes
    const llmToUse = this.roleLLM || this.context.llm;
    actions.forEach((action) => {
      action.setLLM(llmToUse);
      // Set context for each action
      (action as any).context = this.context;
      // 初始化action状态为待执行
      action.status = ActionStatus.PENDING;
    });
    // 初始化role状态为空闲
    this.rc.status = RoleStatus.IDLE;

    if (this.roleLLM) {
      logger.debug(`${this.profile} setActions: using role-specific LLM`);
    } else {
      const defaultConfig = this.context.config.llm;
      logger.info(`${this.profile} setActions: using system default LLM config: ${defaultConfig.provider}/${defaultConfig.model}`);
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
    logger.debug(`${this.profile} thinkByOrder: news=${this.rc.news.length}, news.causeBy=[${newsCauseBys}], watch=[${watchSet}], relevant=${relevantMessages.length}, state=${this.rc.state}, todo=${this.rc.todo ? this.rc.todo.name : 'null'}, actions.length=${this.actions.length}`);

    // If we already have a todo, don't change it
    if (this.rc.todo !== null) {
      logger.debug(`${this.profile} thinkByOrder: Already has todo: ${this.rc.todo.name}`);
      return true;
    }

    // Validate we have actions to execute
    if (this.actions.length === 0) {
      logger.warn(`${this.profile} thinkByOrder: No actions configured`);
      return false;
    }

    // Check if we're in the middle of executing a sequence of actions
    // If state >= 0 and < actions.length - 1, we should continue to the next action
    // This check should happen BEFORE checking for relevant messages, so we can continue
    // the sequence even if there are no new messages
    // IMPORTANT: Check if we're in the middle of a sequence (state >= 0 means we've started)
    // and we haven't completed all actions yet (state < actions.length - 1 means there's at least one more)
    const isInSequence = this.rc.state >= 0 && this.rc.state < this.actions.length - 1;
    logger.debug(`${this.profile} thinkByOrder: Checking if in sequence - state=${this.rc.state}, actions.length=${this.actions.length}, isInSequence=${isInSequence}, hasRelevantMessages=${hasRelevantMessages}`);

    if (isInSequence) {
      // We have more actions to execute in the sequence
      // Continue to the next action even if there are no new relevant messages
      // This allows sequential execution of multiple actions
      const nextState = this.rc.state + 1;
      if (nextState >= this.actions.length) {
        logger.error(`${this.profile} thinkByOrder: Next state ${nextState} exceeds actions length ${this.actions.length}`);
        return false;
      }

      this.rc.state = nextState;
      this.rc.todo = this.actions[this.rc.state];
      this.rc.todo.status = ActionStatus.PENDING;
      this.rc.status = RoleStatus.PENDING;
      logger.info(`${this.profile} thinkByOrder: Continuing to next action ${this.rc.state}: ${this.rc.todo.name}`, {
        actionIndex: this.rc.state,
        actionName: this.rc.todo.name,
        actionDescription: this.rc.todo.description,
        totalActions: this.actions.length,
        actionStatus: this.rc.todo.status,
        roleStatus: this.rc.status,
        availableActions: this.actions.map(a => a.name).join(', '),
        previousActionIndex: this.rc.state - 1,
        previousActionName: this.rc.state > 0 ? this.actions[this.rc.state - 1].name : 'none',
        hasRelevantMessages,
        newsCount: this.rc.news.length,
      });
      return true;
    }

    // Check if we have relevant messages to start a new sequence
    // Only check this if we're not in the middle of a sequence
    // IMPORTANT: Don't reset state if we're in the middle of a sequence (state >= 0 && state < actions.length - 1)
    // Only reset if we've completed all actions (state >= actions.length - 1)
    if (!hasRelevantMessages) {
      // If we have news but no relevant messages, log warning
      if (this.rc.news.length > 0) {
        logger.warn(`${this.profile} thinkByOrder: News exists but no relevant messages found. News causeBys: [${newsCauseBys}], Watch set: [${watchSet}]`);
      }
      // Reset state ONLY if we've completed all actions (not if we're in the middle)
      // If state >= actions.length - 1, we've completed all actions, so reset
      // But if state >= 0 && state < actions.length - 1, we're still in sequence, don't reset
      if (this.rc.state >= this.actions.length - 1) {
        logger.debug(`${this.profile} thinkByOrder: All actions completed (state=${this.rc.state} >= ${this.actions.length - 1}), resetting state`);
        this.rc.state = -1;
      } else if (this.rc.state >= 0) {
        // We're in the middle of a sequence but no relevant messages
        // This shouldn't happen if isInSequence check above worked correctly
        // But log it for debugging
        logger.warn(`${this.profile} thinkByOrder: In sequence (state=${this.rc.state}) but no relevant messages. This may indicate a logic issue.`);
      }
      return false;
    }

    // If we have relevant messages but no todo, we need to set one
    // BUT: If we're in the middle of a sequence (state >= 0 && state < actions.length - 1),
    // we should continue the sequence instead of restarting
    // Only start a new sequence if state is -1 (initial state) or state >= actions.length - 1 (completed)
    const shouldStartNewSequence = this.rc.state === -1 || this.rc.state >= this.actions.length - 1;

    if (!shouldStartNewSequence && this.rc.state >= 0) {
      // We're in the middle of a sequence, continue to next action
      logger.info(`${this.profile} thinkByOrder: In sequence (state=${this.rc.state}) with relevant messages, continuing sequence instead of restarting`);
      const nextState = this.rc.state + 1;
      if (nextState >= this.actions.length) {
        logger.error(`${this.profile} thinkByOrder: Next state ${nextState} exceeds actions length ${this.actions.length}`);
        return false;
      }

      this.rc.state = nextState;
      this.rc.todo = this.actions[this.rc.state];
      this.rc.todo.status = ActionStatus.PENDING;
      this.rc.status = RoleStatus.PENDING;
      logger.info(`${this.profile} thinkByOrder: Continuing sequence to next action ${this.rc.state}: ${this.rc.todo.name}`, {
        actionIndex: this.rc.state,
        actionName: this.rc.todo.name,
        totalActions: this.actions.length,
      });
      return true;
    }

    // Start a new sequence from the first action
    logger.info(`${this.profile} thinkByOrder: Starting new sequence with relevant messages (current state: ${this.rc.state}, actions: ${this.actions.length})`);
    this.rc.state = -1; // Reset to initial state
    this.rc.state++;

    // Validate state is within bounds
    if (this.rc.state >= this.actions.length) {
      logger.error(`${this.profile} thinkByOrder: State ${this.rc.state} exceeds actions length ${this.actions.length}`);
      return false;
    }

    this.rc.todo = this.actions[this.rc.state];
    // 设置action状态为待执行
    this.rc.todo.status = ActionStatus.PENDING;
    // 设置role状态为待执行
    this.rc.status = RoleStatus.PENDING;

    // Log all available actions for debugging
    logger.info(`${this.profile} thinkByOrder: Available actions:`, {
      totalActions: this.actions.length,
      actions: this.actions.map((a, idx) => ({
        index: idx,
        name: a.name,
        description: a.description,
        type: a.constructor.name,
        status: a.status,
      })),
    });

    logger.info(`${this.profile} thinkByOrder: Set todo to action ${this.rc.state}: ${this.rc.todo.name}`, {
      actionIndex: this.rc.state,
      actionName: this.rc.todo.name,
      actionDescription: this.rc.todo.description,
      actionType: this.rc.todo.constructor.name,
      totalActions: this.actions.length,
      actionStatus: this.rc.todo.status,
      roleStatus: this.rc.status,
      availableActions: this.actions.map(a => a.name).join(', '),
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
      // 设置action状态为待执行
      this.rc.todo.status = ActionStatus.PENDING;
      // 设置role状态为待执行
      this.rc.status = RoleStatus.PENDING;
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
    // 尝试从最近的PRD、Design或MRD消息中获取workspace选项
    const messagesToCheck = [
      ...this.rc.news,
      ...this.rc.memory.getByAction('WritePRD'),
      ...this.rc.memory.getByAction('WriteDesign'),
      ...this.rc.memory.getByAction('WriteMRD'),
    ];

    for (const msg of messagesToCheck) {
      const data = msg.instructContent as any;
      if (data?.workspaceDir) {
        // 从workspaceDir解析applicationId、projectId和version
        // 新格式: workspace/{applicationId}/{projectId}/v{version}/{documentType}/
        // 或者: {applicationId}/{projectId}/v{version}/{documentType}/
        const pathParts = data.workspaceDir.split(path.sep).filter((p: string) => p);

        // 查找版本号部分（格式为 v{number}）
        const versionIndex = pathParts.findIndex((p: string) => p.startsWith('v') && /^v\d+$/.test(p));

        if (versionIndex > 1 && versionIndex < pathParts.length - 1) {
          // 新格式：applicationId 在 versionIndex - 2，projectId 在 versionIndex - 1
          const applicationId = pathParts[versionIndex - 2];
          const projectId = pathParts[versionIndex - 1];
          const versionStr = pathParts[versionIndex].substring(1); // 移除 'v' 前缀
          const documentType = pathParts[versionIndex + 1] || this.getDocumentTypeForAction(this.rc.todo?.name || '');

          return {
            applicationId,
            projectId,
            version: parseInt(versionStr, 10),
            documentType,
          };
        }

        // 兼容旧格式（没有 projectId）: workspace/{applicationId}/v{version}/{documentType}/
        if (versionIndex > 0 && versionIndex < pathParts.length - 1) {
          const applicationId = pathParts[versionIndex - 1];
          const versionStr = pathParts[versionIndex].substring(1); // 移除 'v' 前缀
          const documentType = pathParts[versionIndex + 1] || this.getDocumentTypeForAction(this.rc.todo?.name || '');

          return {
            applicationId,
            version: parseInt(versionStr, 10),
            documentType,
          };
        }

        // 兼容旧格式: {applicationId}-v{version}-{documentType}
        const match = data.workspaceDir.match(/(.+)-v(\d+)-(.+)/);
        if (match) {
          return {
            applicationId: match[1],
            version: parseInt(match[2], 10),
            documentType: match[3] || this.getDocumentTypeForAction(this.rc.todo?.name || ''),
          };
        }
      }

      // 如果消息数据中直接包含workspace选项
      if (data?.applicationId && data?.version) {
        return {
          applicationId: data.applicationId,
          projectId: data.projectId,
          version: data.version,
          documentType: this.getDocumentTypeForAction(this.rc.todo?.name || ''),
        };
      }
    }

    // 如果无法从消息中提取，尝试从 Context 中获取
    const applicationId = this.context?.get('applicationId');
    const projectId = this.context?.get('projectId');
    if (applicationId && projectId) {
      return {
        applicationId: applicationId as string,
        projectId: projectId as string,
        version: 1, // 默认版本为 1
        documentType: this.getDocumentTypeForAction(this.rc.todo?.name || ''),
      };
    }

    return undefined;
  }

  /**
   * Get document type for action
   */
  private getDocumentTypeForAction(actionName: string): string {
    const typeMap: Record<string, string> = {
      'WriteMRD': 'MRD',
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
      'WriteMRD',
      'WritePRD',
      'WriteDesign',
      'WriteSubProjectDesign',
      'BreakdownTasks',
      'GenerateTask',
      'WriteCode',
      'WriteTest',
      'ExecuteSubtask',
      'ImproveDocument',
      'MRDReview',
      'PRDReview',
      'DesignReview',
      'SubProjectDesignReview',
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
      case 'WriteMRD':
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

      case 'ImproveDocument':
        // ImproveDocument需要input和options，options需要包含documentType
        // 从input或context中检测文档类型
        const improveOptions = {
          ...workspaceOptions,
          documentType: this.detectDocumentTypeForImprove(input) as 'PRD' | 'MRD' | 'DESIGN',
        };
        return await (action as any).run(input, improveOptions);

      case 'MRDReview':
      case 'PRDReview':
      case 'DesignReview':
      case 'SubProjectDesignReview':
        // Review actions需要input和可选的options
        return await (action as any).run(input, workspaceOptions);

      default:
        // 默认情况，只传递input
        return await action.run(input);
    }
  }

  /**
   * Detect document type for ImproveDocument action
   */
  private detectDocumentTypeForImprove(input: string): string {
    // 检查input中是否包含文档类型标识
    if (input.includes('PRD') || input.includes('产品需求文档')) {
      return 'PRD';
    }
    if (input.includes('MRD') || input.includes('市场研究文档')) {
      return 'MRD';
    }
    if (input.includes('DESIGN') || input.includes('设计文档')) {
      return 'DESIGN';
    }

    // 从最近的文档消息中推断
    const prdMessages = this.rc.memory.getByAction('WritePRD');
    const mrdMessages = this.rc.memory.getByAction('WriteMRD');
    const designMessages = this.rc.memory.getByAction('WriteDesign');

    // 优先使用最近的文档类型
    if (designMessages.length > 0) {
      return 'DESIGN';
    }
    if (prdMessages.length > 0) {
      return 'PRD';
    }
    if (mrdMessages.length > 0) {
      return 'MRD';
    }

    // 默认返回PRD
    return 'PRD';
  }

  /**
   * Act: Execute the current action
   */
  async act(): Promise<Message | null> {
    if (!this.rc.todo) {
      return null;
    }

    const action = this.rc.todo;

    // 更新状态：action和role都设置为执行中
    action.status = ActionStatus.RUNNING;
    this.rc.status = RoleStatus.RUNNING;

    logger.info(`${this.profile} executing action: ${action.name}`, {
      actionStatus: action.status,
      roleStatus: this.rc.status,
    });

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

      // Log action execution start
      logger.info(`Action [${action.name}]: Starting execution`, {
        actionName: action.name,
        role: this.profile,
        description: action.description,
        inputLength: actionInput.length,
      });

      // Execute action with workspace options
      // 根据Action的签名决定如何传递参数
      const actionStartTime = Date.now();
      let result;
      try {
        if (workspaceOptions && this.actionAcceptsOptions(action.name)) {
          // 如果Action支持options参数，传递workspace选项
          result = await this.runActionWithOptions(action, actionInput, workspaceOptions);
        } else {
          // 否则使用默认方式
          result = await action.run(actionInput);
        }

        // Log action execution success
        const executionTime = Date.now() - actionStartTime;
        logger.info(`Action [${action.name}]: Execution completed successfully`, {
          actionName: action.name,
          role: this.profile,
          executionTimeMs: executionTime,
          outputType: result.data?.type,
          contentLength: result.content?.length || 0,
        });
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
        throw error;
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

      // 更新状态：action设置为已完成，role设置为空闲
      action.status = ActionStatus.COMPLETED;
      this.rc.status = RoleStatus.IDLE;

      logger.info(`${this.profile} completed action: ${action.name}`, {
        messageId: message.id,
        messageContentLength: message.content.length,
        messageInstructContent: message.instructContent,
        actionStatus: action.status,
        roleStatus: this.rc.status,
      });

      // In BY_ORDER mode, if there are more actions to execute, clear todo but keep news
      // This allows think() to select the next action in the sequence
      const hasMoreActions = this.rc.reactMode === RoleReactMode.BY_ORDER &&
        this.rc.state >= 0 &&
        this.rc.state < this.actions.length - 1;

      logger.info(`${this.profile} act() completed: action=${action.name}, state=${this.rc.state}, actions.length=${this.actions.length}, hasMoreActions=${hasMoreActions}`, {
        reactMode: this.rc.reactMode,
        currentState: this.rc.state,
        totalActions: this.actions.length,
        actionNames: this.actions.map(a => a.name).join(', '),
        nextActionIndex: this.rc.state + 1,
        nextActionName: hasMoreActions ? this.actions[this.rc.state + 1].name : 'none',
        newsCount: this.rc.news.length,
      });

      if (hasMoreActions) {
        logger.info(`${this.profile} has more actions in sequence (state=${this.rc.state}, total=${this.actions.length}), clearing todo to allow think() to select next action`);
        // Clear todo so think() can select the next action, but keep news for context
        this.rc.todo = null;
        // Keep news so thinkByOrder() can continue the sequence
        logger.debug(`${this.profile} cleared todo but kept news (${this.rc.news.length} messages) for next action in sequence`);
      } else {
        // Clear current action and news after successful execution
        // This allows the role to process new messages in the next cycle
        this.rc.todo = null;
        this.rc.news = [];
        logger.debug(`${this.profile} cleared todo and news after successful action execution (no more actions in sequence)`);
      }

      return message;
    } catch (error: any) {
      // 更新状态：action设置为失败，role设置为空闲
      action.status = ActionStatus.FAILED;
      this.rc.status = RoleStatus.IDLE;

      logger.error(`${this.profile} action failed:`, {
        actionName: action.name,
        error: error.message,
        errorStack: error.stack,
        contextLength: this.rc.news.map((msg) => msg.content).join('\n\n').length,
        actionStatus: action.status,
        roleStatus: this.rc.status,
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

