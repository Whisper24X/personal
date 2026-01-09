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
import { RoleReactMode } from '@mind2build/shared';
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

      // Check if all workflow items are completed and update project status
      const projectId = this.config.projectId || this.id;
      if (projectId) {
        try {
          const workflowItems = await this.workflowTracker.getWorkflowItems();

          // Check if there are any workflow items and if all are completed (no pending or running items)
          const hasWorkflowItems = workflowItems.length > 0;
          const completedCount = workflowItems.filter(item => item.status === 'completed').length;
          const pendingCount = workflowItems.filter(item => item.status === 'pending').length;
          const runningCount = workflowItems.filter(item => item.status === 'running').length;

          // Mark as completed if:
          // 1. There are workflow items AND
          // 2. No pending or running items (all are either completed or failed/skipped)
          const shouldMarkCompleted = hasWorkflowItems && pendingCount === 0 && runningCount === 0;

          if (shouldMarkCompleted) {
            logger.info(`InteractiveSession: All workflow items finished (${completedCount}/${workflowItems.length} completed, ${workflowItems.length - completedCount} failed/skipped), marking project ${projectId} as completed`);
            const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
            const projectRepo = new ProjectRepository();
            await projectRepo.markCompleted(projectId);
            logger.info(`InteractiveSession: Project ${projectId} marked as completed`);
          } else {
            logger.info(`InteractiveSession: Workflow not fully completed (${completedCount}/${workflowItems.length} completed, ${pendingCount} pending, ${runningCount} running), project status not updated`);
          }
        } catch (error: any) {
          logger.error(`InteractiveSession: Failed to update project status for ${projectId}`, {
            error: error.message,
            stack: error.stack,
          });
          // Don't throw - continue with completion message even if status update fails
        }
      }

      // Send completion
      this.sendMessage('completed', {
        projectId: projectId || this.id,
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

    // Restore message history from database if projectId is provided
    const projectId = this.config.projectId || this.id;
    if (projectId) {
      try {
        const { MessageRepository } = await import('../database/repositories/MessageRepository');
        const messageRepo = new MessageRepository();
        const dbMessages = await messageRepo.findByProjectId(projectId, 1000);

        logger.info(`InteractiveSession: Checking messages for project ${projectId}, found ${dbMessages.length} messages in database`);

        if (dbMessages.length > 0) {
          logger.info(`InteractiveSession: Found ${dbMessages.length} messages in database for project ${projectId}, restoring message history`);
          // Log message details for debugging
          dbMessages.forEach((msg, idx) => {
            logger.debug(`InteractiveSession: Message ${idx + 1}/${dbMessages.length}: role=${msg.role_type}, causeBy=${msg.cause_by}, id=${msg.message_uuid}`);
          });

          // Restore messages to environment
          const { Message } = await import('../core/message/Message');
          const { MESSAGE_ROUTE_TO_ALL } = await import('@mind2build/shared');

          for (const dbMsg of dbMessages) {
            try {
              // Ensure sendTo is properly set - if empty, use broadcast
              let sendTo = Array.isArray(dbMsg.send_to) ? dbMsg.send_to : [];
              if (sendTo.length === 0) {
                // If sendTo is empty, use broadcast to ensure message reaches all roles
                // This is safe because roles will filter via watch mechanism
                sendTo = [MESSAGE_ROUTE_TO_ALL];
              }

              // Use fromJSON to properly restore message with original ID
              const restoredMessage = Message.fromJSON({
                id: dbMsg.message_uuid,
                content: dbMsg.content,
                role: dbMsg.role_type,
                causeBy: dbMsg.cause_by,
                sentFrom: dbMsg.sent_from,
                sendTo: sendTo,
                instructContent: dbMsg.instruct_content,
                metadata: dbMsg.metadata || {},
              });

              const published = env.publishMessage(restoredMessage);
              logger.info(`InteractiveSession: Restored message ${dbMsg.message_uuid} - role: ${dbMsg.role_type}, causeBy: ${dbMsg.cause_by}, published: ${published}, sendTo: [${sendTo.join(', ')}]`);
            } catch (error: any) {
              logger.warn(`InteractiveSession: Failed to restore message ${dbMsg.message_uuid}`, {
                error: error.message,
                stack: error.stack,
              });
            }
          }

          logger.info(`InteractiveSession: Successfully restored ${dbMessages.length} messages to environment`);

          // After restoring messages, check if we need to restore messages for completed actions
          // that roles are watching for
          try {
            const workflowItems = await this.workflowTracker.getWorkflowItems();
            const completedActions = new Set<string>();
            workflowItems.forEach(item => {
              if (item.status === 'completed') {
                completedActions.add(item.action);
              }
            });

            // Check which completed actions have messages in environment history
            const envHistoryCauseBys = new Set(env.history.map(msg => msg.causeBy));
            const missingActions = Array.from(completedActions).filter(action => !envHistoryCauseBys.has(action));

            if (missingActions.length > 0) {
              logger.info(`InteractiveSession: Found ${missingActions.length} completed actions without messages in environment: [${missingActions.join(', ')}]`);
              logger.info(`InteractiveSession: Attempting to restore missing messages from database...`);

              // Try to restore missing messages from database
              const { MessageRepository } = await import('../database/repositories/MessageRepository');
              const messageRepo = new MessageRepository();
              const allDbMessages = await messageRepo.findByProjectId(projectId, 1000);

              // Find messages for missing actions
              const missingMessages = allDbMessages.filter(dbMsg =>
                missingActions.includes(dbMsg.cause_by) &&
                !env.history.some(msg => msg.id === dbMsg.message_uuid)
              );

              if (missingMessages.length > 0) {
                logger.info(`InteractiveSession: Found ${missingMessages.length} missing messages in database, restoring...`);
                const { Message } = await import('../core/message/Message');
                const { MESSAGE_ROUTE_TO_ALL } = await import('@mind2build/shared');

                for (const dbMsg of missingMessages) {
                  try {
                    let sendTo = Array.isArray(dbMsg.send_to) ? dbMsg.send_to : [];
                    if (sendTo.length === 0) {
                      sendTo = [MESSAGE_ROUTE_TO_ALL];
                    }

                    const restoredMessage = Message.fromJSON({
                      id: dbMsg.message_uuid,
                      content: dbMsg.content,
                      role: dbMsg.role_type,
                      causeBy: dbMsg.cause_by,
                      sentFrom: dbMsg.sent_from,
                      sendTo: sendTo,
                      instructContent: dbMsg.instruct_content,
                      metadata: dbMsg.metadata || {},
                    });

                    const published = env.publishMessage(restoredMessage);
                    logger.info(`InteractiveSession: Restored missing message ${dbMsg.message_uuid} - role: ${dbMsg.role_type}, causeBy: ${dbMsg.cause_by}, published: ${published}`);
                  } catch (error: any) {
                    logger.warn(`InteractiveSession: Failed to restore missing message ${dbMsg.message_uuid}`, {
                      error: error.message,
                    });
                  }
                }
                logger.info(`InteractiveSession: Successfully restored ${missingMessages.length} missing messages`);
              } else {
                logger.warn(`InteractiveSession: Missing actions [${missingActions.join(', ')}] are marked as completed but no messages found in database`);
              }
            }
          } catch (error: any) {
            logger.warn(`InteractiveSession: Failed to check and restore missing messages`, {
              error: error.message,
            });
          }
        } else {
          logger.info(`InteractiveSession: No messages found in database for project ${projectId}, will publish initial message`);

          // Publish initial user requirement message if no messages found
          const { Message } = await import('../core/message/Message');
          const initialMessage = new Message({
            content: this.config.idea,
            role: 'user',
            causeBy: 'User',
            sentFrom: 'User',
          });
          env.publishMessage(initialMessage);
          logger.info(`InteractiveSession: Published initial requirement: ${this.config.idea.substring(0, 100)}...`);

          // Save initial message to database
          try {
            const { MessageRepository } = await import('../database/repositories/MessageRepository');
            const messageRepo = new MessageRepository();
            await messageRepo.save(projectId, initialMessage);
            logger.info(`InteractiveSession: Saved initial message ${initialMessage.id} to database for project ${projectId}`);
          } catch (error: any) {
            logger.warn(`InteractiveSession: Failed to save initial message to database`, {
              error: error.message,
              projectId,
            });
          }
        }
      } catch (error: any) {
        logger.warn(`InteractiveSession: Failed to restore message history for project ${projectId}`, {
          error: error.message,
        });

        // Fallback: publish initial message
        const { Message } = await import('../core/message/Message');
        const initialMessage = new Message({
          content: this.config.idea,
          role: 'user',
          causeBy: 'User',
          sentFrom: 'User',
        });
        env.publishMessage(initialMessage);
        logger.info(`InteractiveSession: Published initial requirement (fallback): ${this.config.idea.substring(0, 100)}...`);

        // Save initial message to database
        try {
          const { MessageRepository } = await import('../database/repositories/MessageRepository');
          const messageRepo = new MessageRepository();
          await messageRepo.save(projectId, initialMessage);
          logger.info(`InteractiveSession: Saved initial message (fallback) ${initialMessage.id} to database for project ${projectId}`);
        } catch (error: any) {
          logger.warn(`InteractiveSession: Failed to save initial message (fallback) to database`, {
            error: error.message,
            projectId,
          });
        }
      }
    } else {
      // No projectId, just publish initial message
      const { Message } = await import('../core/message/Message');
      const initialMessage = new Message({
        content: this.config.idea,
        role: 'user',
        causeBy: 'User',
        sentFrom: 'User',
      });
      env.publishMessage(initialMessage);
      logger.info(`InteractiveSession: Published initial requirement: ${this.config.idea.substring(0, 100)}...`);

      // Note: Cannot save message without projectId
      logger.debug(`InteractiveSession: Skipping message save - no projectId available`);
    }

    // Run through each role sequentially, one at a time
    // Each step requires user confirmation before proceeding
    let maxIterations = roles.length * 10; // Safety limit
    let iteration = 0;
    let roleIndex = 0; // Track current role index

    // Restore state from previous session (if resuming)
    const currentState = await this.workflowTracker.getCurrentState();
    let shouldFindNextIncompleteRole = false;

    if (currentState.role && currentState.action) {
      logger.info(`InteractiveSession: Resuming session - current role: ${currentState.role}, action: ${currentState.action}`);

      // If action is 'idle', it means the role has no work to do, skip to next role
      if (currentState.action === 'idle') {
        logger.info(`InteractiveSession: Current role ${currentState.role} is idle, will find next incomplete role`);
        shouldFindNextIncompleteRole = true;
        // Clear the running state since we're moving to next role
        await this.workflowTracker.clearState();
      } else {
        // Find the role index for the current role
        const currentRoleIndex = roles.findIndex(r => r.profile === currentState.role);
        if (currentRoleIndex !== -1) {
          // Check if the current action is already completed
          const isCompleted = await this.workflowTracker.isActionCompleted(
            currentState.role,
            currentState.action
          );

          if (isCompleted) {
            logger.info(`InteractiveSession: Current action ${currentState.action} for role ${currentState.role} is already completed, will find next incomplete role`);
            shouldFindNextIncompleteRole = true;
            // Clear the running state since we're moving to next role
            await this.workflowTracker.clearState();
          } else {
            logger.info(`InteractiveSession: Current action ${currentState.action} for role ${currentState.role} is not completed, will continue from here`);
            roleIndex = currentRoleIndex;
          }
        } else {
          logger.warn(`InteractiveSession: Could not find role ${currentState.role} in roles list, will find next incomplete role`);
          shouldFindNextIncompleteRole = true;
        }
      }
    } else {
      logger.info(`InteractiveSession: No previous state found, will find next incomplete role`);
      shouldFindNextIncompleteRole = true;
    }

    // If we need to find the next incomplete role, iterate through roles to find the first one with incomplete actions
    if (shouldFindNextIncompleteRole) {
      logger.info(`InteractiveSession: Finding next incomplete role...`);
      let foundIncompleteRole = false;

      // Get all workflow items to check completion status
      const workflowItems = await this.workflowTracker.getWorkflowItems();
      const completedActions = new Set<string>();
      workflowItems.forEach(item => {
        if (item.status === 'completed') {
          completedActions.add(`${item.role}:${item.action}`);
        }
      });

      // Try to find the first role with incomplete actions
      // Check roles in order to respect workflow dependencies
      for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const roleActions = role.actions.map(a => a.name);

        // Check if this role has any incomplete actions
        const incompleteActions = roleActions.filter(action => {
          const actionKey = `${role.profile}:${action}`;
          return !completedActions.has(actionKey);
        });

        if (incompleteActions.length > 0) {
          // Check if this role is waiting for messages from previous roles
          const watchSet = Array.from(role.rc.watch);
          if (watchSet.length > 0 && i > 0) {
            // Check if messages matching watch set exist in environment history
            const envHistory = env.history;
            const hasWatchedMessages = envHistory.some(msg => watchSet.includes(msg.causeBy));

            if (!hasWatchedMessages) {
              // This role is waiting for messages from previous roles
              // Check if previous roles have completed their primary actions
              let previousRolesCompleted = true;
              for (let j = 0; j < i; j++) {
                const prevRole = roles[j];
                const prevRoleActions = prevRole.actions.map(a => a.name);
                // Check if previous role has completed at least one action
                const prevRoleCompleted = prevRoleActions.some(action => {
                  const actionKey = `${prevRole.profile}:${action}`;
                  return completedActions.has(actionKey);
                });
                if (!prevRoleCompleted) {
                  previousRolesCompleted = false;
                  break;
                }
              }

              if (!previousRolesCompleted) {
                // Previous roles haven't completed, skip this role for now
                logger.info(`InteractiveSession: Role ${role.profile} is waiting for messages from previous roles that haven't completed, skipping for now`);
                continue;
              } else {
                // Previous roles completed but messages not restored
                // This means messages should be in database but weren't restored
                // Try this role anyway - it might be able to proceed with restored messages
                logger.warn(`InteractiveSession: Role ${role.profile} is waiting for messages (watch: [${watchSet.join(', ')}]) but messages not found in environment. Previous roles completed. Will try this role anyway.`);
              }
            }
          }

          logger.info(`InteractiveSession: Found incomplete role: ${role.profile} at index ${i}, incomplete actions: [${incompleteActions.join(', ')}]`);
          roleIndex = i;
          foundIncompleteRole = true;
          break;
        }
      }

      if (!foundIncompleteRole) {
        logger.info(`InteractiveSession: All roles are completed, starting from beginning`);
        roleIndex = 0;
      }
    }

    logger.info(`InteractiveSession: Starting from role index ${roleIndex} (${roles[roleIndex].profile})`);

    while (iteration < maxIterations) {
      iteration++;

      // Process one role at a time, cycling through all roles
      const role = roles[roleIndex];
      logger.info(`InteractiveSession: Processing role ${role.profile} (iteration ${iteration}, roleIndex ${roleIndex})`);
      const currentNewsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
      const watchSet = Array.from(role.rc.watch).join(', ');
      logger.info(`InteractiveSession: Role ${role.profile} state BEFORE observe/think: state=${role.rc.state}, todo=${role.rc.todo ? role.rc.todo.name : 'null'}, news=${role.rc.news.length} [${currentNewsCauseBys}], watch=[${watchSet}], actions.length=${role.actions.length}, reactMode=${role.rc.reactMode}`);

      // Let role observe and think first to determine what action it wants to take
      // This is needed to check if the todo action is already completed
      logger.info(`InteractiveSession: Letting role ${role.profile} observe and think to determine todo`);

      // Log message buffer state before observe (peek at buffer without consuming)
      const bufferMessages = role.rc.msgBuffer.toJSON();
      const bufferSize = bufferMessages.length;
      const bufferCauseBys = bufferMessages.map((msg: any) => msg.causeBy).join(', ');
      logger.info(`InteractiveSession: Role ${role.profile} message buffer before observe: size=${bufferSize}, causeBys=[${bufferCauseBys}], watch=[${Array.from(role.rc.watch).join(', ')}]`);

      await role.observe();

      // Log news after observe
      const newsSize = role.rc.news.length;
      const newsCauseBysAfterObserve = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
      logger.info(`InteractiveSession: Role ${role.profile} news after observe: size=${newsSize}, causeBys=[${newsCauseBysAfterObserve}]`);

      const hasTodo = await role.think();

      // Log todo after think
      logger.info(`InteractiveSession: Role ${role.profile} after think: hasTodo=${hasTodo}, todo=${role.rc.todo ? role.rc.todo.name : 'null'}`);

      // Check if the todo action is already completed (if role has a todo)
      if (hasTodo && role.rc.todo) {
        const todoAction = role.rc.todo.name;
        const isTodoCompleted = await this.workflowTracker.isActionCompleted(
          role.profile,
          todoAction
        );

        if (isTodoCompleted) {
          logger.info(`InteractiveSession: Role ${role.profile} todo action ${todoAction} is already completed, skipping execution`);

          // Mark role as idle and move to next role
          await this.workflowTracker.onRoleIdle(role);

          // Move to next role
          const nextRoleIndex = (roleIndex + 1) % roles.length;

          // Check if we've cycled through all roles
          if (nextRoleIndex === 0) {
            const hasPendingWork = roles.some(r => {
              return r.rc.news.length > 0 || r.rc.todo !== null;
            });
            if (!hasPendingWork) {
              logger.info(`InteractiveSession: All roles are idle, session complete`);
              break;
            }
          }

          roleIndex = nextRoleIndex;
          continue;
        }
      }

      // If role has no todo after think(), mark as idle and move to next role
      if (!hasTodo || !role.rc.todo) {
        logger.info(`InteractiveSession: Role ${role.profile} has no todo after think(), marking as idle and moving to next role`);

        // Mark role as idle
        await this.workflowTracker.onRoleIdle(role);

        // Set state to 'idle' before waiting for confirmation
        await this.workflowTracker.setRunningState(role.profile, 'idle');

        // Wait for user confirmation for idle state
        const newsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
        const watchSet = Array.from(role.rc.watch).join(', ');
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

        // Check if we're about to cycle back to the first role
        const isLastRole = roleIndex === roles.length - 1;
        const nextRoleIndex = (roleIndex + 1) % roles.length;

        // If the last role just went idle, stop execution immediately
        if (isLastRole && nextRoleIndex === 0) {
          logger.info(`InteractiveSession: Last role (${role.profile}) is idle, stopping execution`);
          // Clear running state before exiting
          await this.workflowTracker.clearState();
          break;
        }

        // Move to next role
        roleIndex = nextRoleIndex;
        continue;
      }

      // Track role execution start (after checking completion)
      logger.info(`InteractiveSession: onRoleStart called for role=${role.profile}, todo=${role.rc.todo ? role.rc.todo.name : 'null'}`);
      await this.workflowTracker.onRoleStart(role);
      logger.info(`InteractiveSession: onRoleStart completed for role=${role.profile}`);

      // Run the role's act() method (observe and think already done above)
      // Only execute act() since we already called observe() and think()
      logger.info(`InteractiveSession: About to call role.act() for role=${role.profile}`);

      // IMPORTANT: Update state before act() completes
      // Since act() may take a long time, we update state immediately after think()
      if (role.rc.todo) {
        const todoAction = role.rc.todo.name;
        logger.info(`InteractiveSession: Setting running state before act() - role=${role.profile}, action=${todoAction}`);
        await this.workflowTracker.setRunningState(role.profile, todoAction);
        logger.info(`InteractiveSession: State updated before act() - role=${role.profile}, action=${todoAction}`);
      }

      // Execute act() only (observe and think already done)
      const message = await role.act();

      logger.info(`InteractiveSession: role.act() completed for role=${role.profile}, message=${message ? 'exists' : 'null'}`);

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

        // If the last role just went idle, stop execution immediately
        if (isLastRole && nextRoleIndex === 0) {
          logger.info(`InteractiveSession: Last role (${role.profile}) is idle, stopping execution`);
          // Clear running state before exiting
          await this.workflowTracker.clearState();
          break;
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

      // IMPORTANT: Check if role has more actions BEFORE waiting for user confirmation
      // If role has more actions, skip confirmation and continue executing actions
      // Only wait for confirmation when all actions for this role are completed
      const hasMoreActions = role.rc.reactMode === RoleReactMode.BY_ORDER &&
        role.rc.state >= 0 &&
        role.rc.state < role.actions.length - 1;

      logger.info(`InteractiveSession: Checking if role ${role.profile} has more actions before confirmation`, {
        reactMode: role.rc.reactMode,
        state: role.rc.state,
        actionsLength: role.actions.length,
        hasMoreActions: hasMoreActions,
        actionNames: role.actions.map(a => a.name).join(', '),
        nextActionIndex: role.rc.state + 1,
        nextActionName: hasMoreActions ? role.actions[role.rc.state + 1].name : 'none',
        todo: role.rc.todo ? role.rc.todo.name : 'null',
        newsCount: role.rc.news.length,
      });

      if (hasMoreActions) {
        // Role has more actions to execute - skip user confirmation and continue
        logger.info(`InteractiveSession: Role ${role.profile} has more actions in sequence (state=${role.rc.state}, total=${role.actions.length}), skipping confirmation and continuing with next action`);

        // Publish message to environment (for other roles to observe)
        env.publishMessage(message);
        logger.info(`InteractiveSession: Published message from ${role.profile} (causeBy: ${message.causeBy}) to environment`);

        // Save message to database for persistence
        const projectId = this.config.projectId || this.id;
        if (projectId) {
          try {
            const { MessageRepository } = await import('../database/repositories/MessageRepository');
            const messageRepo = new MessageRepository();
            await messageRepo.save(projectId, message);
            logger.info(`InteractiveSession: Saved message ${message.id} to database for project ${projectId}`);
          } catch (error: any) {
            logger.warn(`InteractiveSession: Failed to save message to database`, {
              error: error.message,
              messageId: message.id,
              projectId,
            });
            // Don't throw - continue even if save fails
          }
        }

        // Continue with the same role to execute next action
        continue;
      }

      // All actions for this role are completed - wait for user confirmation
      logger.info(`InteractiveSession: All actions completed for ${role.profile}, waiting for user confirmation`);

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

      // Save message to database for persistence
      const projectId = this.config.projectId || this.id;
      if (projectId) {
        try {
          const { MessageRepository } = await import('../database/repositories/MessageRepository');
          const messageRepo = new MessageRepository();
          await messageRepo.save(projectId, message);
          logger.info(`InteractiveSession: Saved message ${message.id} to database for project ${projectId}`);
        } catch (error: any) {
          logger.warn(`InteractiveSession: Failed to save message to database`, {
            error: error.message,
            messageId: message.id,
            projectId,
          });
          // Don't throw - continue even if save fails
        }
      }

      // Log which roles should receive this message
      const nextRoleIndex = (roleIndex + 1) % roles.length;

      // Check if we're about to cycle back to the first role (last role just completed)
      const isLastRole = roleIndex === roles.length - 1;

      // If the last role just completed, check if project should be marked as completed
      if (isLastRole && nextRoleIndex === 0) {
        logger.info(`InteractiveSession: Last role (${role.profile}) completed, checking if project should be marked as completed`);

        // Ensure current role's workflow item is marked as completed if message was produced
        // Note: onRoleComplete should have already updated the status, but we'll verify it's completed
        if (message && message.causeBy) {
          const currentActionName = message.causeBy;
          const isCompleted = await this.workflowTracker.isActionCompleted(role.profile, currentActionName);
          if (!isCompleted) {
            logger.warn(`InteractiveSession: Workflow item ${role.profile}:${currentActionName} is not marked as completed, this may cause status check to fail`);
          }
        }

        // Wait a bit to ensure workflow item status is updated in database
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if all workflow items are completed and update project status
        const projectId = this.config.projectId || this.id;
        if (projectId) {
          try {
            const workflowItems = await this.workflowTracker.getWorkflowItems();

            // Check if there are any workflow items and if all are completed (no pending or running items)
            const hasWorkflowItems = workflowItems.length > 0;
            const completedCount = workflowItems.filter(item => item.status === 'completed').length;
            const pendingCount = workflowItems.filter(item => item.status === 'pending').length;
            const runningCount = workflowItems.filter(item => item.status === 'running').length;

            logger.info(`InteractiveSession: Workflow status check - total: ${workflowItems.length}, completed: ${completedCount}, pending: ${pendingCount}, running: ${runningCount}`);

            // Mark as completed if:
            // 1. There are workflow items AND
            // 2. No pending or running items (all are either completed or failed/skipped)
            const shouldMarkCompleted = hasWorkflowItems && pendingCount === 0 && runningCount === 0;

            if (shouldMarkCompleted) {
              logger.info(`InteractiveSession: All workflow items finished (${completedCount}/${workflowItems.length} completed, ${workflowItems.length - completedCount} failed/skipped), marking project ${projectId} as completed`);
              const { ProjectRepository } = await import('../database/repositories/ProjectRepository');
              const projectRepo = new ProjectRepository();
              await projectRepo.markCompleted(projectId);
              logger.info(`InteractiveSession: Project ${projectId} marked as completed`);
            } else {
              logger.info(`InteractiveSession: Workflow not fully completed (${completedCount}/${workflowItems.length} completed, ${pendingCount} pending, ${runningCount} running), project status not updated`);
            }
          } catch (error: any) {
            logger.error(`InteractiveSession: Failed to update project status for ${projectId}`, {
              error: error.message,
              stack: error.stack,
            });
            // Don't throw - continue even if status update fails
          }
        }

        // Clear running state before exiting
        await this.workflowTracker.clearState();
        break;
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
    const state = await this.workflowTracker.getCurrentState();
    return state;
  }
}

export default InteractiveSession;

