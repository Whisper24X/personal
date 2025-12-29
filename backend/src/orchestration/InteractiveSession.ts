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
import { UserAction } from '../utils/InteractiveHandler';

export interface SessionConfig {
  name: string;
  idea: string;
  description?: string;
  investment: number;
  nRound: number;
  userId?: string;
}

export interface UserActionMessage {
  action: string;
  modifiedContent?: string;
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

  constructor(id: string, config: SessionConfig) {
    this.id = id;
    this.userId = config.userId;
    this.config = config;
    
    // Create team with interactive mode enabled (but custom handler)
    const ctx = new Context(undefined, config.investment);
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
    
    logger.info(`InteractiveSession: Created session ${id}`);
  }

  /**
   * Set WebSocket connection
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
   * Start the interactive generation process
   */
  async start(): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

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
      causeBy: 'UserRequirement',
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
      
      // Run the role (this will observe, think, and act)
      // role.run() will check if it has relevant messages and execute if needed
      const message = await role.run();
      
      logger.debug(`InteractiveSession: Role ${role.profile} run() returned: ${message ? message.causeBy : 'null'}`);
      
      if (!message) {
        // Role produced no message - still need to wait for user confirmation to proceed
        logger.info(`InteractiveSession: Role ${role.profile} produced no message, but waiting for confirmation to proceed`);
        
        // Wait for user confirmation even when no message (to ensure step-by-step flow)
        // Debug: Log why role is idle
        const newsCauseBys = role.rc.news.map((msg: any) => msg.causeBy).join(', ');
        const watchSet = Array.from(role.rc.watch).join(', ');
        logger.warn(`InteractiveSession: Role ${role.profile} is idle. News: [${newsCauseBys}], Watch: [${watchSet}], News count: ${role.rc.news.length}`);
        
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
        
        // Move to next role
        roleIndex = (roleIndex + 1) % roles.length;
        
        // If we've cycled through all roles without any producing messages, check if we're done
        if (roleIndex === 0) {
          // Check if any role has pending work
          const hasPendingWork = roles.some(r => {
            return r.rc.news.length > 0 || r.rc.todo !== null;
          });
          
          if (!hasPendingWork) {
            logger.info(`InteractiveSession: All roles are idle, session complete`);
            break;
          }
        }
        
        continue;
      }
      
      logger.info(`InteractiveSession: Role ${role.profile} produced message: ${message.causeBy}`);
      
      // Notify role started (after execution, before confirmation)
      this.sendMessage('role_start', {
        role: role.profile,
        action: message.causeBy,
      });
      
      // Extract output files from message
      const outputFiles = this.extractOutputFiles(message);
      
      logger.info(`InteractiveSession: Waiting for user confirmation for ${role.profile}`);
      
      // Wait for user confirmation
      const userAction = await this.waitForUserConfirmation({
        role: role.profile,
        action: message.causeBy,
        content: message.content,
        outputFiles: outputFiles,
      });
      
      logger.info(`InteractiveSession: User action received: ${userAction.action}`);
      
      // Handle user action and determine if should continue
      const shouldContinue = await this.processUserAction(userAction, message);
      
      if (!shouldContinue) {
        logger.info(`InteractiveSession: User requested to quit`);
        return; // Exit the function
      }
      
      // Handle regenerate action
      if (userAction.action === 'regenerate') {
        logger.info(`InteractiveSession: User requested regeneration, re-running role ${role.profile}`);
        // Don't move to next role, stay on current role to regenerate
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
      
      // If we've cycled through all roles, check if we're done
      if (roleIndex === 0) {
        // Check if any role has pending work
        const hasPendingWork = roles.some(r => {
          return r.rc.news.length > 0 || r.rc.todo !== null;
        });
        
        if (!hasPendingWork) {
          logger.info(`InteractiveSession: All roles are idle, session complete`);
          break;
        }
      }
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
    originalMessage: any
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
      
      fileLines.forEach(line => {
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
   * Send message to client via WebSocket
   */
  private sendMessage(type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn(`InteractiveSession: Cannot send message, WebSocket not open`);
      return;
    }
    
    try {
      this.ws.send(JSON.stringify({ type, data }));
    } catch (error: any) {
      logger.error(`InteractiveSession: Error sending message`, error);
    }
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
      lastActivity: this.lastActivity,
      costReport: this.team.getCostReport(),
      messageHistory: this.team.getHistory().map(m => ({
        role: m.role,
        causeBy: m.causeBy,
        contentPreview: m.content.substring(0, 100),
      })),
    };
  }
}

export default InteractiveSession;

