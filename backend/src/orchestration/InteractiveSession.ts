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
import { StateManager } from './StateManager';
import { SessionMessageHandler, MessageQueueItem } from './SessionMessageHandler';
import { SessionWorkflowExecutor, WorkflowExecutorConfig } from './SessionWorkflowExecutor';
import { InteractiveSessionManager } from './InteractiveSessionManager';

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

  // State manager for unified state management
  private stateManager: StateManager;

  // Message handler for WebSocket and polling
  private messageHandler: SessionMessageHandler;

  // Workflow executor
  private workflowExecutor: SessionWorkflowExecutor | null = null;
  
  // Executor promise tracking for preventing concurrent execution
  private executorPromise: Promise<void> | null = null;
  
  // Executor lock to prevent concurrent executor operations
  private executorLock: Promise<void> | null = null;

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

    // Initialize state manager
    this.stateManager = new StateManager(
      projectId,
      this.team
    );

    // Store StateManager in context so Actions can access it
    ctx.set('stateManager', this.stateManager);

    // Hire roles - 按照 PRD 文档定义的完整流程
    this.team.hire([
      new Salesperson(ctx),
      new ProductManager(ctx),
      new Architect(ctx),
      new ProjectManager(ctx),
      new Engineer(ctx),
      new QAEngineer(ctx),
    ]);

    // Initialize state manager
    this.stateManager = new StateManager(
      projectId,
      this.team
    );

    // Initialize workflow in database
    this.stateManager.initialize().catch((error) => {
      logger.error(`InteractiveSession: Failed to initialize state manager for project ${projectId}`, error);
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

    // Check if executor is already running (prevent page refresh from creating duplicate executor)
    if (this.executorPromise) {
      logger.warn(`InteractiveSession: Executor already running for project ${this.projectId}, skipping start`);
      return;
    }

    // Check if there's an action running in database (prevent duplicate executor on page refresh)
    try {
      const runningStateWithTimestamp = await this.stateManager.getRunningStateWithTimestamp();
      if (runningStateWithTimestamp.role && runningStateWithTimestamp.action) {
        const { ActionStatus } = await import('@mind2build/shared');
        const actionStatus = await this.stateManager.getActionStatus(
          runningStateWithTimestamp.role,
          runningStateWithTimestamp.action
        );
        if (actionStatus === ActionStatus.RUNNING) {
          // Check if session is in memory (to detect orphaned executors)
          const sessionManager = InteractiveSessionManager.getInstance();
          const sessionInMemory = !!sessionManager.getSession(this.projectId);
          
          // Configure thresholds from environment variables or use defaults
          const STALE_ACTION_THRESHOLD_MS = process.env.STALE_ACTION_THRESHOLD_MINUTES
            ? parseInt(process.env.STALE_ACTION_THRESHOLD_MINUTES, 10) * 60 * 1000
            : 30 * 60 * 1000; // Default 30 minutes
          
          const ORPHANED_EXECUTOR_THRESHOLD_MS = process.env.ORPHANED_EXECUTOR_THRESHOLD_MINUTES
            ? parseInt(process.env.ORPHANED_EXECUTOR_THRESHOLD_MINUTES, 10) * 60 * 1000
            : 2 * 60 * 1000; // Default 2 minutes
          
          // Choose threshold based on whether session is in memory
          const threshold = sessionInMemory ? STALE_ACTION_THRESHOLD_MS : ORPHANED_EXECUTOR_THRESHOLD_MS;
          const thresholdType = sessionInMemory ? 'stale action' : 'orphaned executor';
          
          const now = Date.now();
          const updatedAt = runningStateWithTimestamp.updatedAt
            ? new Date(runningStateWithTimestamp.updatedAt).getTime()
            : null;
          
          const runningDuration = updatedAt ? now - updatedAt : 0;
          const runningMinutes = Math.round(runningDuration / 1000 / 60);
          const runningSeconds = Math.round((runningDuration % (60 * 1000)) / 1000);
          
          // Log detailed information for diagnosis
          logger.info(`InteractiveSession: Checking ${thresholdType} for action ${runningStateWithTimestamp.action}`, {
            projectId: this.projectId,
            role: runningStateWithTimestamp.role,
            action: runningStateWithTimestamp.action,
            sessionInMemory,
            updatedAt: runningStateWithTimestamp.updatedAt?.toISOString() || null,
            runningDurationMs: runningDuration,
            runningMinutes,
            runningSeconds,
            thresholdMs: threshold,
            thresholdMinutes: Math.round(threshold / 1000 / 60),
            thresholdType,
          });

          if (updatedAt && runningDuration > threshold) {
            // Action has been running for too long, consider it stale/orphaned and reset it
            logger.warn(
              `InteractiveSession: Action ${runningStateWithTimestamp.action} for role ${runningStateWithTimestamp.role} ` +
                `has been RUNNING for ${runningMinutes} minutes ${runningSeconds} seconds ` +
                `(threshold: ${Math.round(threshold / 1000 / 60)} minutes, type: ${thresholdType}) ` +
                `for project ${this.projectId}, resetting ${thresholdType} to allow session recovery`
            );
            
            // Reset the stale/orphaned action status to FAILED and clear running state
            try {
              await this.stateManager.setActionStatus(
                runningStateWithTimestamp.role,
                runningStateWithTimestamp.action,
                ActionStatus.FAILED
              );
              await this.stateManager.clearRunningState();
              logger.info(
                `InteractiveSession: Successfully reset ${thresholdType} ${runningStateWithTimestamp.action} ` +
                  `for role ${runningStateWithTimestamp.role} for project ${this.projectId}`
              );
            } catch (resetError: any) {
              logger.error(
                `InteractiveSession: Failed to reset ${thresholdType} for project ${this.projectId}`,
                {
                  error: resetError.message,
                  role: runningStateWithTimestamp.role,
                  action: runningStateWithTimestamp.action,
                  thresholdType,
                }
              );
              // Continue anyway to allow recovery
            }
            // Continue with session start after resetting stale/orphaned action
          } else {
            // Action is still running and not stale/orphaned, prevent duplicate executor
            logger.warn(
              `InteractiveSession: Action ${runningStateWithTimestamp.action} for role ${runningStateWithTimestamp.role} ` +
                `is already RUNNING for project ${this.projectId} ` +
                `(running for ${runningMinutes}m ${runningSeconds}s, threshold: ${Math.round(threshold / 1000 / 60)}m, ` +
                `sessionInMemory: ${sessionInMemory}), skipping start to prevent duplicate executor`
            );
            return;
          }
        }
      }
    } catch (error: any) {
      logger.warn(`InteractiveSession: Failed to check running state before start for project ${this.projectId}`, {
        error: error.message,
      });
      // Continue with start if check fails
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
        this.stateManager,
        this.messageHandler,
        executorConfig
      );

      // Execute workflow and track promise
      this.executorPromise = this.workflowExecutor.execute().finally(() => {
        // Clear executor promise when done
        this.executorPromise = null;
        this.workflowExecutor = null;
      });

      try {
        await this.executorPromise;
      } catch (error: any) {
        // Check if this is a cancellation error (expected during reset)
        if (error.message?.includes('cancelled') || error.message?.includes('Workflow execution cancelled')) {
          logger.info(`InteractiveSession: Executor cancelled for project ${this.projectId} (this is expected during reset)`);
          // Don't treat cancellation as an error - it's intentional
          return;
        }
        
        // Check if this is a reset error (expected during workflow reset)
        if (error.message?.includes('reset') || error.message?.includes('Workflow execution stopped due to reset')) {
          logger.info(`InteractiveSession: Executor stopped due to reset for project ${this.projectId}, restarting executor`);
          // Restart executor instead of treating as error
          await this.restartExecutor();
          return;
        }
        
        // Re-throw other errors
        throw error;
      }

      // Clear running state when session completes
      await this.stateManager.clearRunningState();

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
      // Check if this is a cancellation error (expected during reset)
      if (error.message?.includes('cancelled') || error.message?.includes('Workflow execution cancelled')) {
        logger.info(`InteractiveSession: Executor cancelled for project ${this.projectId} (this is expected during reset)`);
        // Clear executor promise on cancellation
        this.executorPromise = null;
        this.workflowExecutor = null;
        // Don't send error message for cancellation - it's intentional
        return;
      }

      // Check if this is a reset error (expected during workflow reset)
      if (error.message?.includes('reset') || error.message?.includes('Workflow execution stopped due to reset')) {
        logger.info(`InteractiveSession: Executor stopped due to reset for project ${this.projectId}, restarting executor`);
        // Clear executor promise on reset
        this.executorPromise = null;
        this.workflowExecutor = null;
        // Restart executor instead of sending error
        await this.restartExecutor();
        return;
      }

      logger.error(`InteractiveSession: Error in session for project ${this.projectId}`, error);
      // Clear executor promise on error
      this.executorPromise = null;
      this.workflowExecutor = null;
      // Clear running state on error
      await this.stateManager.clearRunningState();
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
      const workflowItems = await this.stateManager.getWorkflowItems();

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
    const workflowStructure = this.stateManager.getWorkflowStructure();
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
    const state = await this.stateManager.getRunningState();
    return state;
  }

  /**
   * Get state manager (for backward compatibility and external access)
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Stop workflow executor if it's running
   */
  stopWorkflowExecutor(): void {
    if (this.workflowExecutor) {
      logger.info(`InteractiveSession: Stopping workflow executor for project ${this.projectId}`);
      (this.workflowExecutor as any).cancel();
      this.workflowExecutor = null;
    }
  }

  /**
   * Wait for executor to stop completely
   * Returns a promise that resolves when executor stops or times out
   */
  private async waitForExecutorStop(timeoutMs: number = 5000): Promise<void> {
    if (!this.executorPromise) {
      return; // No executor running
    }

    logger.info(`InteractiveSession: Waiting for executor to stop for project ${this.projectId} (timeout: ${timeoutMs}ms)`);

    try {
      // Wait for executor promise to complete or timeout
      await Promise.race([
        this.executorPromise,
        new Promise<void>((resolve) => {
          setTimeout(() => {
            logger.warn(`InteractiveSession: Executor stop timeout for project ${this.projectId}, forcing stop`);
            resolve();
          }, timeoutMs);
        }),
      ]);
    } catch (error: any) {
      // Executor may have thrown an error, that's okay
      logger.debug(`InteractiveSession: Executor promise completed with error (expected): ${error.message}`);
    }

    // Clear executor promise and reference
    this.executorPromise = null;
    this.workflowExecutor = null;

    logger.info(`InteractiveSession: Executor stopped for project ${this.projectId}`);
  }

  /**
   * Restart workflow executor after reset
   * Creates a new executor and starts it asynchronously
   * This bypasses the isStarted check to allow restarting after reset
   */
  async restartExecutor(): Promise<void> {
    // Wait for executor lock if another restart is in progress
    if (this.executorLock) {
      logger.info(`InteractiveSession: Waiting for executor lock for project ${this.projectId}`);
      try {
        await this.executorLock;
      } catch (error: any) {
        logger.warn(`InteractiveSession: Executor lock completed with error: ${error.message}`);
      }
    }

    // Create executor lock
    const lockPromise = (async () => {
      try {
        // Ensure old executor is stopped
        this.stopWorkflowExecutor();

        // Wait for old executor to completely stop
        await this.waitForExecutorStop(5000);

        // Check if executor is already running (double-check after wait)
        if (this.executorPromise) {
          logger.warn(`InteractiveSession: Executor still running after wait for project ${this.projectId}, skipping restart`);
          return;
        }

        // Check if there's an action running in database
        try {
          const runningState = await this.stateManager.getRunningState();
          if (runningState.role && runningState.action) {
            const { ActionStatus } = await import('@mind2build/shared');
            const actionStatus = await this.stateManager.getActionStatus(runningState.role, runningState.action);
            if (actionStatus !== ActionStatus.RUNNING) {
              logger.warn(`InteractiveSession: Action ${runningState.action} for role ${runningState.role} is not RUNNING for project ${this.projectId}, skipping restart`);
              return;
            }
          } else {
            logger.warn(`InteractiveSession: No running state found for project ${this.projectId}, skipping restart`);
            return;
          }
        } catch (error: any) {
          logger.warn(`InteractiveSession: Failed to check running state before restart for project ${this.projectId}`, {
            error: error.message,
          });
          // Continue with restart if check fails
        }

        logger.info(`InteractiveSession: Restarting executor for project ${this.projectId}`);

        // Create new workflow executor
        const executorConfig: WorkflowExecutorConfig = {
          projectId: this.projectId,
          nRound: this.config.nRound,
          idea: this.config.idea,
        };
        this.workflowExecutor = new SessionWorkflowExecutor(
          this.projectId,
          this.team,
          this.stateManager,
          this.messageHandler,
          executorConfig
        );

        // Execute workflow asynchronously and track promise
        this.executorPromise = this.workflowExecutor.execute().finally(() => {
          // Clear executor promise when done
          this.executorPromise = null;
          this.workflowExecutor = null;
        });

        // Handle errors asynchronously (don't await - let it run in background)
        this.executorPromise.catch((error: any) => {
          logger.error(`InteractiveSession: Error in restarted executor for project ${this.projectId}`, error);
          // Clear running state on error
          this.stateManager.clearRunningState().catch((clearError: any) => {
            logger.error(`InteractiveSession: Failed to clear running state after executor error`, clearError);
          });
          this.sendMessage('error', {
            message: error.message || 'Unknown error occurred in restarted executor',
          });
        });

        logger.info(`InteractiveSession: Executor restarted successfully for project ${this.projectId}`);
      } finally {
        // Clear executor lock
        this.executorLock = null;
      }
    })();

    this.executorLock = lockPromise;

    // Don't await - let it run asynchronously
    lockPromise.catch((error: any) => {
      logger.error(`InteractiveSession: Failed to restart executor for project ${this.projectId}`, error);
      this.executorLock = null;
      this.workflowExecutor = null;
    });
  }
}

export default InteractiveSession;
