/**
 * Interactive Session
 * Manages an interactive project generation session with WebSocket communication
 */

import { WebSocket } from 'ws';
import { Team } from './Team';
import { Context } from '../core/context/Context';
import { Salesperson } from '../roles/Salesperson';
import { ProductManager } from '../roles/ProductManager';
import { Architect } from '../roles/Architect';
import { ProjectManager } from '../roles/ProjectManager';
import { Engineer } from '../roles/Engineer';
import { QAEngineer } from '../roles/QAEngineer';
import { logger } from '../utils';
import { WorkflowTracker } from './WorkflowTracker';
// import { UserAction } from '../utils/InteractiveHandler'; // Unused

export interface SessionConfig {
  name: string;
  idea: string;
  description?: string;
  investment: number;
  nRound: number;
  userId?: string;
  applicationId?: string;
  projectId?: string;
}

export interface UserActionMessage {
  action: string;
  modifiedContent?: string;
}

export interface MessageQueueItem {
  type: string;
  data: any;
  timestamp: number;
  id: string;
}

export class InteractiveSession {
  public readonly id: string;
  public readonly userId?: string;
  private team: Team;
  private ws: WebSocket | null = null;
  private isPaused: boolean = false;
  private lastActivity: number = Date.now();
  private userActionResolver: ((value: UserActionMessage) => void) | null = null;
  private config: SessionConfig;
  private startTime: number = Date.now();
  // Message queue for polling
  private messageQueue: MessageQueueItem[] = [];
  // @ts-ignore - Reserved for future use
  private lastPolledMessageId: string | null = null;
  private isStarted: boolean = false;
  // Workflow tracker for state management
  private workflowTracker: WorkflowTracker;

  constructor(id: string, config: SessionConfig) {
    this.id = id;
    this.userId = config.userId;
    this.config = config;

    // Create team with interactive mode enabled (but custom handler)
    const ctx = new Context(undefined, config.investment);
    // Set userId in context so roles can load their specific LLM configs
    if (this.userId) {
      ctx.set('userId', this.userId);
    }
    // Set applicationId and projectId in context for workspace operations
    if (config.applicationId) {
      ctx.set('applicationId', config.applicationId);
    }
    if (config.projectId) {
      ctx.set('projectId', config.projectId);
    } else {
      // Use session id as projectId if not provided
      ctx.set('projectId', id);
    }
    this.team = new Team(ctx, false); // We'll handle interaction via WebSocket

    // Hire roles - 按照 PRD 文档定义的完整流程
    this.team.hire([
      new Salesperson(ctx),
      new ProductManager(ctx),
      new Architect(ctx),
      new ProjectManager(ctx),
      new Engineer(ctx),
      new QAEngineer(ctx),
    ]);

    // Initialize workflow tracker
    this.workflowTracker = new WorkflowTracker(
      this.id,
      config.projectId || null,
      this.team
    );

    // Initialize workflow in database
    this.workflowTracker.initialize().catch((error) => {
      logger.error(`InteractiveSession: Failed to initialize workflow tracker for session ${id}`, error);
    });

    logger.info(`InteractiveSession: Created session ${id}`);
  }

  /**
   * Set WebSocket connection (optional, for backward compatibility)
   */
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
    this.updateActivity();

    logger.info(`InteractiveSession: WebSocket connected for session ${this.id}`);

    // Send connection confirmation
    this.sendMessage('connected', {
      sessionId: this.id,
      config: this.config,
    });
  }

  /**
   * Start session without WebSocket (for polling mode)
   */
  startWithoutWebSocket(): void {
    this.updateActivity();

    // Send connection confirmation
    this.sendMessage('connected', {
      sessionId: this.id,
      config: this.config,
    });

    // Start the session asynchronously
    this.start().catch((error) => {
      logger.error(`InteractiveSession: Error starting session ${this.id}`, error);
    });
  }

  /**
   * Start the interactive generation process
   * Can be started without WebSocket (for polling mode)
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn(`InteractiveSession: Session ${this.id} already started`);
      return;
    }

    this.isStarted = true;

    try {
      logger.info(`InteractiveSession: Starting session ${this.id}`);

      // Send start message
      this.sendMessage('started', {
        message: 'Interactive project generation started',
      });

      // Get environment and inject our custom wait logic
      const env = this.team.getEnvironment();

      // Run team with custom interactive handler
      await this.runWithWebSocketInteraction();

      // Clear running state when session completes
      await this.workflowTracker.clearState();

      // Send completion
      this.sendMessage('completed', {
        projectId: this.id,
        summary: {
          totalSteps: env.history.length,
          totalCost: this.team.getCostReport().totalCost,
          duration: Date.now() - this.startTime,
        },
      });

      logger.info(`InteractiveSession: Completed session ${this.id}`);
    } catch (error: any) {
      logger.error(`InteractiveSession: Error in session ${this.id}`, error);
      // Clear running state on error
      await this.workflowTracker.clearState();
      this.sendMessage('error', {
        message: error.message || 'Unknown error occurred',
      });
    }
  }

  /**
   * Run team with WebSocket-based interaction
   */
  private async runWithWebSocketInteraction(): Promise<void> {
    const env = this.team.getEnvironment();
    const roles = env.getRoles();

    this.sendMessage('progress', {
      message: 'Starting generation...',
      currentRound: 0,
      totalCost: 0,
    });

    // Publish initial user requirement message
    const { Message } = await import('../core/message/Message');
    const initialMessage = new Message({
      content: this.config.idea,
      role: 'user',
      causeBy: 'User',
      sentFrom: 'User',
    });
    env.publishMessage(initialMessage);
    logger.info(`InteractiveSession: Published initial requirement: ${this.config.idea.substring(0, 100)}...`);

    // Run through each role sequentially, one at a time
    // Each step requires user confirmation before proceeding
    let maxIterations = roles.length * 10; // Safety limit
    let iteration = 0;
    let roleIndex = 0; // Track current role index

    while (iteration < maxIterations) {
      iteration++;

      // Process one role at a time, cycling through all roles
      const role = roles[roleIndex];
      logger.info(`InteractiveSession: Processing role ${role.profile} (iteration ${iteration}, roleIndex ${roleIndex})`);
      const newsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
      const watchSet = Array.from(role.rc.watch).join(', ');
      logger.debug(`InteractiveSession: Role ${role.profile} state: ${role.rc.state}, todo: ${role.rc.todo ? role.rc.todo.name : 'null'}, news: ${role.rc.news.length} [${newsCauseBys}], watch: [${watchSet}]`);

      // Track role execution start
      logger.info(`InteractiveSession: onRoleStart called for role=${role.profile}, todo=${role.rc.todo ? role.rc.todo.name : 'null'}`);
      await this.workflowTracker.onRoleStart(role);
      logger.info(`InteractiveSession: onRoleStart completed for role=${role.profile}`);

      // Run the role (this will observe, think, and act)
      // role.run() will check if it has relevant messages and execute if needed
      logger.info(`InteractiveSession: About to call role.run() for role=${role.profile}`);

      // IMPORTANT: We need to update state after think() but before act() completes
      // Since role.run() is async and act() may take a long time, we need to track
      // when think() sets the todo, and update state immediately
      const workflowTracker = this.workflowTracker;
      const roleProfile = role.profile;
      let thinkCompleted = false;
      const originalThink = role.think.bind(role);
      role.think = async function () {
        const result = await originalThink();
        if (!thinkCompleted) {
          thinkCompleted = true;
          // After think() completes, check if todo was set and update state
          if (role.rc.todo) {
            const todoAction = role.rc.todo.name;
            logger.info(`InteractiveSession: think() completed for role=${roleProfile}, todo=${todoAction}, updating state immediately`);
            await workflowTracker.setRunningState(roleProfile, todoAction);
            logger.info(`InteractiveSession: State updated after think() - role=${roleProfile}, action=${todoAction}`);
          }
        }
        return result;
      };

      const message = await role.run();

      // Restore original think method
      role.think = originalThink;

      logger.info(`InteractiveSession: role.run() completed for role=${role.profile}, message=${message ? 'exists' : 'null'}`);

      if (message) {
        logger.info(`InteractiveSession: Message details - causeBy=${message.causeBy}, causeBy type=${typeof message.causeBy}, role=${message.role}, content length=${message.content?.length || 0}`);
      } else {
        logger.warn(`InteractiveSession: role.run() returned null message for role=${role.profile}`);
      }

      // Track role execution completion
      logger.info(`InteractiveSession: onRoleComplete called for role=${role.profile}, message=${message ? `exists, causeBy=${message.causeBy}` : 'null'}`);
      await this.workflowTracker.onRoleComplete(role, message);
      logger.info(`InteractiveSession: onRoleComplete completed for role=${role.profile}`);

      logger.debug(`InteractiveSession: Role ${role.profile} run() returned: ${message ? message.causeBy : 'null'}`);

      // CRITICAL: Immediately ensure state is set after onRoleComplete
      // This is needed because onRoleComplete might have set action to null
      if (message && message.causeBy && typeof message.causeBy === 'string' && message.causeBy.trim().length > 0) {
        logger.info(`InteractiveSession: Immediately setting state after onRoleComplete - role=${role.profile}, action=${message.causeBy}`);
        await this.workflowTracker.setRunningState(role.profile, message.causeBy);
        logger.info(`InteractiveSession: State set immediately after onRoleComplete - role=${role.profile}, action=${message.causeBy}`);
      } else {
        logger.warn(`InteractiveSession: Cannot set state immediately after onRoleComplete - message=${!!message}, causeBy=${message?.causeBy}, type=${typeof message?.causeBy}`);
      }

      if (!message) {
        // Role produced no message - still need to wait for user confirmation to proceed
        logger.info(`InteractiveSession: Role ${role.profile} produced no message, but waiting for confirmation to proceed`);

        // Track role idle state (this clears the state)
        await this.workflowTracker.onRoleIdle(role);

        // Wait for user confirmation even when no message (to ensure step-by-step flow)
        // Debug: Log why role is idle
        const newsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
        const watchSet = Array.from(role.rc.watch).join(', ');
        logger.warn(`InteractiveSession: Role ${role.profile} is idle. News: [${newsCauseBys}], Watch: [${watchSet}], News count: ${role.rc.news.length}`);

        // IMPORTANT: Set state to 'idle' before waiting for confirmation
        // This ensures the API can return the correct state during confirmation
        logger.info(`InteractiveSession: Setting running state to 'idle' before confirmation - role=${role.profile}`);
        await this.workflowTracker.setRunningState(role.profile, 'idle');
        logger.info(`InteractiveSession: Running state set to 'idle' completed - role=${role.profile}`);

        const userAction = await this.waitForUserConfirmation({
          role: role.profile,
          action: 'idle',
          content: `**${role.profile} 状态检查**\n\n当前 ${role.profile} 没有需要执行的任务。\n\n- 已观察的消息数: ${role.rc.news.length}\n- 消息类型: ${newsCauseBys || '无'}\n- 待办任务: ${role.rc.todo ? role.rc.todo.name : '无'}\n- 关注的动作: ${watchSet || '无'}\n\n可以继续下一步，让其他角色继续工作。`,
          outputFiles: [],
        });

        logger.info(`InteractiveSession: User action received for idle role: ${userAction.action}`);

        // Handle user action
        const shouldContinue = await this.processUserAction(userAction, null);

        if (!shouldContinue) {
          logger.info(`InteractiveSession: User requested to quit`);
          return;
        }

        // Check if we're about to cycle back to the first role (last role just went idle)
        const isLastRole = roleIndex === roles.length - 1;
        const nextRoleIndex = (roleIndex + 1) % roles.length;

        // If the last role just went idle, check if all roles are done before moving to first role
        if (isLastRole && nextRoleIndex === 0) {
          // Check if any role has pending work
          const hasPendingWork = roles.some(r => {
            return r.rc.news.length > 0 || r.rc.todo !== null;
          });

          if (!hasPendingWork) {
            logger.info(`InteractiveSession: Last role (${role.profile}) is idle and all roles are idle, session complete`);
            // Clear running state before exiting
            await this.workflowTracker.clearState();
            break;
          } else {
            logger.info(`InteractiveSession: Last role (${role.profile}) is idle, but some roles have pending work. Continuing to next cycle...`);
          }
        }

        // Move to next role
        roleIndex = nextRoleIndex;

        continue;
      }

      logger.info(`InteractiveSession: Role ${role.profile} produced message: ${message.causeBy}`);

      // Notify role started (after execution, before confirmation)
      // Note: WorkflowTracker already updated the state in onRoleComplete()
      this.sendMessage('role_start', {
        role: role.profile,
        action: message.causeBy,
      });

      // Extract output files from message
      const outputFiles = this.extractOutputFiles(message);

      logger.info(`InteractiveSession: Waiting for user confirmation for ${role.profile}`);

      // Ensure state is correctly set before waiting for confirmation
      // This is important because onRoleComplete might have set action to null
      // if message.causeBy was not available at that time
      // Double-check that we have a valid action name before waiting
      logger.info(`InteractiveSession: Checking message.causeBy before confirmation - causeBy=${message.causeBy}, type=${typeof message.causeBy}`);
      if (message.causeBy && typeof message.causeBy === 'string' && message.causeBy.trim().length > 0) {
        logger.info(`InteractiveSession: Setting running state before confirmation - role=${role.profile}, action=${message.causeBy}`);
        await this.workflowTracker.setRunningState(role.profile, message.causeBy);
        logger.info(`InteractiveSession: Running state set before confirmation completed - role=${role.profile}, action=${message.causeBy}`);
      } else {
        logger.warn(`InteractiveSession: message.causeBy is invalid, cannot set running state - causeBy=${message.causeBy}, type=${typeof message.causeBy}, trimmed=${message.causeBy ? message.causeBy.trim() : 'N/A'}`);
      }

      // Wait for user confirmation (keep running state during this time)
      const userAction = await this.waitForUserConfirmation({
        role: role.profile,
        action: message.causeBy,
        content: message.content,
        outputFiles: outputFiles,
        instructContent: message.instructContent,
      });

      logger.info(`InteractiveSession: User action received: ${userAction.action}`);

      // Handle user action and determine if should continue
      const shouldContinue = await this.processUserAction(userAction, message);

      if (!shouldContinue) {
        logger.info(`InteractiveSession: User requested to quit`);
        // Clear running state when quitting
        await this.workflowTracker.clearState();
        return; // Exit the function
      }

      // Handle regenerate action
      if (userAction.action === 'regenerate') {
        logger.info(`InteractiveSession: User requested regeneration, re-running role ${role.profile}`);
        // Keep running state for regeneration, will be updated on next run
        continue; // This will re-run the same role
      }

      // If user edited content, update message
      if (userAction.modifiedContent) {
        message.content = userAction.modifiedContent;
      }

      // Publish message to environment BEFORE moving to next role
      // This ensures the next role can observe the message immediately
      env.publishMessage(message);
      logger.info(`InteractiveSession: Published message from ${role.profile} (causeBy: ${message.causeBy}) to environment`);

      // Log which roles should receive this message
      const nextRoleIndex = (roleIndex + 1) % roles.length;

      // Check if we're about to cycle back to the first role (last role just completed)
      const isLastRole = roleIndex === roles.length - 1;

      // If the last role just completed, check if all roles are done before moving to first role
      if (isLastRole && nextRoleIndex === 0) {
        // Check if any role has pending work
        const hasPendingWork = roles.some(r => {
          return r.rc.news.length > 0 || r.rc.todo !== null;
        });

        if (!hasPendingWork) {
          logger.info(`InteractiveSession: Last role (${role.profile}) completed and all roles are idle, session complete`);
          // Clear running state before exiting
          await this.workflowTracker.clearState();
          break;
        } else {
          logger.info(`InteractiveSession: Last role (${role.profile}) completed, but some roles have pending work. Continuing to next cycle...`);
        }
      }

      const nextRole = roles[nextRoleIndex];
      const nextRoleWatchSet = Array.from(nextRole.rc.watch).join(', ');
      logger.info(`InteractiveSession: Next role will be ${nextRole.profile}, watching: [${nextRoleWatchSet}], message causeBy: ${message.causeBy}`);

      // Send progress update
      this.sendMessage('progress', {
        message: `${role.profile} completed`,
        currentRound: iteration,
        totalCost: this.team.getCostReport().totalCost,
      });

      // Move to next role (one step at a time)
      roleIndex = nextRoleIndex;

      // Clear current running state when moving to next role
      // (will be set again when next role starts)
      await this.workflowTracker.clearState();
    }

    logger.info(`InteractiveSession: All roles processed, session complete`);
  }

  /**
   * Wait for user confirmation via WebSocket
   */
  private async waitForUserConfirmation(roleInfo: {
    role: string;
    action: string;
    content: string;
    outputFiles?: Array<{ path: string; content: string }>;
    instructContent?: Record<string, any>;
  }): Promise<UserActionMessage> {
    logger.info(`InteractiveSession: waitForUserConfirmation called for ${roleInfo.role}, clearing old resolver if any`);

    // Clear any existing resolver (shouldn't happen, but safety check)
    if (this.userActionResolver) {
      logger.warn(`InteractiveSession: Found existing resolver, clearing it`);
      this.userActionResolver = null;
    }

    this.isPaused = true;

    // Send confirmation request
    logger.info(`InteractiveSession: Sending confirmation_required message for ${roleInfo.role}`);
    this.sendMessage('confirmation_required', roleInfo);

    // Wait for user response
    logger.info(`InteractiveSession: Setting up Promise resolver for ${roleInfo.role}`);
    return new Promise<UserActionMessage>((resolve) => {
      this.userActionResolver = resolve;
      logger.info(`InteractiveSession: Promise resolver set, waiting for user action...`);
    });
  }

  /**
   * Handle user action message
   */
  handleUserAction(message: UserActionMessage): void {
    try {
      logger.info(`InteractiveSession: handleUserAction called with action: ${message.action}, hasResolver: ${!!this.userActionResolver}, isPaused: ${this.isPaused}`);
      this.updateActivity();

      if (!this.userActionResolver) {
        logger.warn(`InteractiveSession: No resolver waiting for user action (isPaused: ${this.isPaused})`);
        return;
      }

      logger.info(`InteractiveSession: User action received: ${message.action}, resolving promise`);

      this.isPaused = false;
      const resolver = this.userActionResolver;
      this.userActionResolver = null; // Clear before resolving to prevent double resolution

      logger.info(`InteractiveSession: About to resolve promise with action: ${message.action}`);
      resolver(message);
      logger.info(`InteractiveSession: Promise resolved successfully for action: ${message.action}`);
    } catch (error: any) {
      logger.error(`InteractiveSession: Error in handleUserAction:`, error);
      logger.error(`InteractiveSession: Error stack:`, error.stack);
      throw error;
    }
  }

  /**
   * Process user action and determine if should continue
   */
  private async processUserAction(
    userAction: UserActionMessage,
    _originalMessage: any
  ): Promise<boolean> {
    switch (userAction.action) {
      case 'continue':
      case 'edit':
        return true;

      case 'skip':
        logger.info(`InteractiveSession: User skipped step`);
        return true;

      case 'regenerate':
        // Regeneration is handled in the main loop by re-running the current role
        logger.info(`InteractiveSession: User requested regeneration`);
        return true;

      case 'quit':
        logger.info(`InteractiveSession: User quit session`);
        this.sendMessage('info', {
          message: 'Session terminated by user',
        });
        return false;

      default:
        logger.warn(`InteractiveSession: Unknown action: ${userAction.action}`);
        return true;
    }
  }

  /**
   * Extract output files from message
   * First tries to get files from instructContent (for WriteCode action),
   * then falls back to parsing content
   */
  private extractOutputFiles(message: any): Array<{ path: string; content: string }> {
    // Check if message has instructContent with files (from WriteCode action)
    if (message.instructContent && message.instructContent.files && Array.isArray(message.instructContent.files)) {
      return message.instructContent.files.map((f: any) => ({
        path: f.path || f,
        content: f.content || '',
      }));
    }

    // Fallback: parse files from content (simple heuristic)
    const files: Array<{ path: string; content: string }> = [];
    const content = message.content;

    // Look for markdown code blocks with file paths
    const filePattern = /```[\w]*:?([\w/\-.]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = filePattern.exec(content)) !== null) {
      if (match[1]) {
        files.push({
          path: match[1],
          content: match[2] || '',
        });
      }
    }

    // Look for "Generated files:" sections
    const generatedPattern = /Generated files?:\s*\n([\s\S]*?)(?:\n\n|$)/i;
    const generatedMatch = content.match(generatedPattern);

    if (generatedMatch) {
      const fileList = generatedMatch[1];
      const fileLines = fileList.split('\n');

      fileLines.forEach((line: string) => {
        const fileMatch = line.match(/[-*]\s+([\w/\-.]+)/);
        if (fileMatch) {
          // Check if we already have this file
          if (!files.find(f => f.path === fileMatch[1])) {
            files.push({
              path: fileMatch[1],
              content: '',
            });
          }
        }
      });
    }

    // Remove duplicates based on path
    const uniqueFiles = new Map<string, { path: string; content: string }>();
    files.forEach(f => {
      if (!uniqueFiles.has(f.path) || f.content) {
        uniqueFiles.set(f.path, f);
      }
    });

    return Array.from(uniqueFiles.values());
  }

  /**
   * Send message to client via WebSocket or add to queue for polling
   */
  private sendMessage(type: string, data: any): void {
    // Add message to queue for polling
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queueItem: MessageQueueItem = {
      type,
      data,
      timestamp: Date.now(),
      id: messageId,
    };
    this.messageQueue.push(queueItem);

    // Keep only last 100 messages to prevent memory issues
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }

    // Also send via WebSocket if available (for backward compatibility)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type, data }));
      } catch (error: any) {
        logger.error(`InteractiveSession: Error sending message via WebSocket`, error);
      }
    }
  }

  /**
   * Get messages since last poll (for polling mechanism)
   */
  getMessagesSince(lastMessageId: string | null = null): MessageQueueItem[] {
    if (!lastMessageId) {
      // Return all messages if no last message ID provided
      return [...this.messageQueue];
    }

    // Find the index of the last polled message
    const lastIndex = this.messageQueue.findIndex(msg => msg.id === lastMessageId);
    if (lastIndex === -1) {
      // Last message not found, return all messages
      return [...this.messageQueue];
    }

    // Return messages after the last polled one
    return this.messageQueue.slice(lastIndex + 1);
  }

  /**
   * Get all pending messages and clear them (alternative polling method)
   */
  getAndClearMessages(): MessageQueueItem[] {
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    return messages;
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Check if session has expired
   */
  isExpired(timeoutMs: number = 30 * 60 * 1000): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.userActionResolver) {
      this.userActionResolver({ action: 'quit' });
      this.userActionResolver = null;
    }

    logger.info(`InteractiveSession: Cleaned up session ${this.id}`);
  }

  /**
   * Get session info
   */
  getInfo(): any {
    return {
      id: this.id,
      config: this.config,
      isPaused: this.isPaused,
      isStarted: this.isStarted,
      lastActivity: this.lastActivity,
      costReport: this.team.getCostReport(),
      messageHistory: this.team.getHistory().map(m => ({
        role: m.role,
        causeBy: m.causeBy,
        contentPreview: m.content.substring(0, 100),
      })),
      messageQueueLength: this.messageQueue.length,
    };
  }

  /**
   * Get workflow information (all roles and their actions)
   */
  getWorkflowInfo(): {
    roles: Array<{
      role: string;
      actions: Array<{
        name: string;
        description: string;
      }>;
    }>;
  } {
    const workflowStructure = this.workflowTracker.getWorkflowStructure();
    return { roles: workflowStructure };
  }

  /**
   * Get current running role and action
   * Uses WorkflowTracker for reliable state management
   */
  async getCurrentRunning(): Promise<{
    role: string | null;
    action: string | null;
  }> {
    logger.info(`InteractiveSession: getCurrentRunning called - sessionId=${this.id}`);
    const state = await this.workflowTracker.getCurrentState();
    logger.info(`InteractiveSession: getCurrentRunning returning - role=${state.role}, action=${state.action}, sessionId=${this.id}`);
    return state;
  }
}

export default InteractiveSession;

