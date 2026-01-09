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
import { SessionMessageHandler, MessageQueueItem } from './SessionMessageHandler';
import { SessionWorkflowExecutor, WorkflowExecutorConfig } from './SessionWorkflowExecutor';

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

export class InteractiveSession {
  public readonly projectId: string;
  public readonly userId?: string;
  private team: Team;
  private config: SessionConfig;
  private startTime: number = Date.now();
  private isStarted: boolean = false;
  private lastActivity: number = Date.now();
  private isPaused: boolean = false;
  private userActionResolver: ((value: UserActionMessage) => void) | null = null;

  // Workflow tracker for state management
  private workflowTracker: WorkflowTracker;

  // Message handler for WebSocket and polling
  private messageHandler: SessionMessageHandler;

  // Workflow executor
  private workflowExecutor: SessionWorkflowExecutor | null = null;

  constructor(projectId: string, config: SessionConfig) {
    if (!projectId) {
      throw new Error('projectId is required for InteractiveSession');
    }
    this.projectId = projectId;
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
    ctx.set('projectId', projectId);
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
      projectId,
      this.team
    );

    // Initialize workflow in database
    this.workflowTracker.initialize().catch((error) => {
      logger.error(`InteractiveSession: Failed to initialize workflow tracker for project ${projectId}`, error);
    });

    // Initialize message handler
    this.messageHandler = new SessionMessageHandler();

    logger.info(`InteractiveSession: Created session for project ${projectId}`);
  }

  /**
   * Set WebSocket connection (optional, for backward compatibility)
   */
  setWebSocket(ws: WebSocket): void {
    this.messageHandler.setWebSocket(ws);
    this.updateActivity();

    logger.info(`InteractiveSession: WebSocket connected for project ${this.projectId}`);

    // Send connection confirmation
    this.sendMessage('connected', {
      projectId: this.projectId,
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
      projectId: this.projectId,
      config: this.config,
    });

    // Start the session asynchronously
    this.start().catch((error) => {
      logger.error(`InteractiveSession: Error starting session for project ${this.projectId}`, error);
    });
  }

  /**
   * Start the interactive generation process
   * Can be started without WebSocket (for polling mode)
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn(`InteractiveSession: Session for project ${this.projectId} already started`);
      return;
    }

    this.isStarted = true;

    try {
      logger.info(`InteractiveSession: Starting session for project ${this.projectId}`);

      // Send start message
      this.sendMessage('started', {
        message: 'Interactive project generation started',
      });

      // Create workflow executor
      const executorConfig: WorkflowExecutorConfig = {
        projectId: this.projectId,
        nRound: this.config.nRound,
        idea: this.config.idea,
      };
      this.workflowExecutor = new SessionWorkflowExecutor(
        this.projectId,
        this.team,
        this.workflowTracker,
        this.messageHandler,
        executorConfig
      );

      // Execute workflow
      await this.workflowExecutor.execute();

      // Clear running state when session completes
      await this.workflowTracker.clearState();

      // Check if all workflow items are completed and update project status
      await this.checkAndUpdateProjectStatus();

      // Send completion
      const env = this.team.getEnvironment();
      this.sendMessage('completed', {
        projectId: this.projectId,
        summary: {
          totalSteps: env.history.length,
          totalCost: this.team.getCostReport().totalCost,
          duration: Date.now() - this.startTime,
        },
      });

      logger.info(`InteractiveSession: Completed session for project ${this.projectId}`);
    } catch (error: any) {
      logger.error(`InteractiveSession: Error in session for project ${this.projectId}`, error);
      // Clear running state on error
      await this.workflowTracker.clearState();
      this.sendMessage('error', {
        message: error.message || 'Unknown error occurred',
      });
    }
  }

  /**
   * Check and update project status
   */
  private async checkAndUpdateProjectStatus(): Promise<void> {
    if (!this.projectId) {
      return;
    }

    try {
      const workflowItems = await this.workflowTracker.getWorkflowItems();

      const hasWorkflowItems = workflowItems.length > 0;
      const completedCount = workflowItems.filter(item => item.status === 'completed').length;
      const pendingCount = workflowItems.filter(item => item.status === 'pending').length;
      const runningCount = workflowItems.filter(item => item.status === 'running').length;
      const totalCount = workflowItems.length;

      // Only mark as completed if:
      // 1. There are workflow items
      // 2. No pending or running items
      // 3. All items are completed (completedCount === totalCount)
      const shouldMarkCompleted = hasWorkflowItems &&
        pendingCount === 0 &&
        runningCount === 0 &&
        completedCount > 0 &&
        completedCount === totalCount;

      if (shouldMarkCompleted) {
        logger.info(`InteractiveSession: All workflow items completed (${completedCount}/${totalCount}), marking project ${this.projectId} as completed`);
        const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
        const projectRepo = new ProjectRepository();
        await projectRepo.markCompleted(this.projectId);
        logger.info(`InteractiveSession: Project ${this.projectId} marked as completed`);
      } else {
        logger.info(`InteractiveSession: Workflow not fully completed (${completedCount}/${totalCount} completed, ${pendingCount} pending, ${runningCount} running), project status not updated`);
      }
    } catch (error: any) {
      logger.error(`InteractiveSession: Failed to update project status for ${this.projectId}`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Handle user action message
   * NOTE: This method is kept for backward compatibility but is no longer used in the main flow.
   * User actions are now processed via API (/interactive/:projectId/confirm).
   * @deprecated Use API confirmation instead
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
   * Send message to client via WebSocket or add to queue for polling
   */
  private sendMessage(type: string, data: any): void {
    this.messageHandler.sendMessage(type, data);
  }

  /**
   * Get messages since last poll (for polling mechanism)
   */
  getMessagesSince(lastMessageId: string | null = null): MessageQueueItem[] {
    return this.messageHandler.getMessagesSince(lastMessageId);
  }

  /**
   * Get all pending messages and clear them (alternative polling method)
   */
  getAndClearMessages(): MessageQueueItem[] {
    return this.messageHandler.getAndClearMessages();
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
    this.messageHandler.cleanup();

    if (this.userActionResolver) {
      this.userActionResolver({ action: 'quit' });
      this.userActionResolver = null;
    }

    logger.info(`InteractiveSession: Cleaned up session for project ${this.projectId}`);
  }

  /**
   * Get session info
   */
  getInfo(): any {
    return {
      projectId: this.projectId,
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
      messageQueueLength: this.messageHandler.getMessageQueueLength(),
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
    const state = await this.workflowTracker.getCurrentState();
    return state;
  }
}

export default InteractiveSession;
