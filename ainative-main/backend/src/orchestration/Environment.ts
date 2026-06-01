/**
 * Environment class
 * Manages roles and routes messages between them
 */

import { Role } from '../roles/Role';
import { Message } from '../core/message/Message';
import { hasIntersection, MESSAGE_ROUTE_TO_ALL } from '@mind2build/shared';
import { logger } from '../utils';
import { InteractiveHandler, UserAction } from '../utils/InteractiveHandler';

export class Environment {
  private roles: Map<string, Role> = new Map();
  private memberAddrs: Map<Role, Set<string>> = new Map();
  public history: Message[] = [];
  private interactiveHandler?: InteractiveHandler;
  private interactionHistory: Array<{
    role: string;
    action: string;
    userAction: UserAction;
  }> = [];

  constructor(interactiveHandler?: InteractiveHandler) {
    this.interactiveHandler = interactiveHandler;
  }

  /**
   * Add roles to the environment
   */
  addRoles(roles: Role[]): void {
    roles.forEach((role) => {
      this.roles.set(role.name, role);
      this.memberAddrs.set(role, role.getAddresses());
      // Set environment reference in role context
      role.rc.env = this;
      
      logger.info(`Environment: Added role ${role.profile}(${role.name})`);
    });
  }

  /**
   * Publish a message and route it to appropriate roles
   */
  publishMessage(message: Message): boolean {
    let found = false;
    
    logger.info(`Environment: Publishing message with causeBy: ${message.causeBy}, sendTo: [${Array.from(message.sendTo).join(', ')}]`);
    
    for (const [roleName, role] of this.roles.entries()) {
      const shouldReceive = this.isMessageFor(message, role);
      const watchSet = Array.from(role.rc.watch).join(', ');
      
      if (shouldReceive) {
        role.putMessage(message);
        found = true;
        const routeReason = message.sendTo.has(MESSAGE_ROUTE_TO_ALL) 
          ? 'broadcast' 
          : role.rc.watch.has(message.causeBy) 
            ? 'watch' 
            : 'direct';
        logger.info(`Environment: Routed message to ${role.profile} (${roleName}) via ${routeReason}`, {
          messageId: message.id,
          causeBy: message.causeBy,
          roleWatchSet: watchSet,
          roleBufferSize: role.rc.msgBuffer.length,
        });
      } else {
        logger.debug(`Environment: Message not routed to ${role.profile} (${roleName})`, {
          causeBy: message.causeBy,
          roleWatchSet: watchSet,
          isBroadcast: message.sendTo.has(MESSAGE_ROUTE_TO_ALL),
          matchesWatch: role.rc.watch.has(message.causeBy),
        });
      }
    }
    
    if (!found) {
      logger.warn('Environment: Message has no recipients', {
        messageId: message.id,
        causeBy: message.causeBy,
        sendTo: Array.from(message.sendTo),
        totalRoles: this.roles.size,
      });
    }
    
    // Add to history
    this.history.push(message);
    
    return found;
  }

  /**
   * Check if a message should be sent to a role
   */
  private isMessageFor(message: Message, role: Role): boolean {
    // Check if message is broadcast
    if (message.sendTo.has(MESSAGE_ROUTE_TO_ALL)) {
      return true;
    }
    
    // Check if role is watching this action type (subscription mechanism)
    if (role.rc.watch.has(message.causeBy)) {
      logger.debug(`Environment: Message routed to ${role.profile} via watch mechanism`, {
        causeBy: message.causeBy,
        watchedActions: Array.from(role.rc.watch),
      });
      return true;
    }
    
    // Check if there's any overlap between message recipients and role addresses
    const addresses = role.getAddresses();
    return hasIntersection(message.sendTo, addresses);
  }

  /**
   * Check if all roles are idle
   */
  get isIdle(): boolean {
    for (const role of this.roles.values()) {
      if (!role.isIdle) {
        return false;
      }
    }
    return true;
  }

  /**
   * Run all active roles once
   */
  async run(): Promise<void> {
    const activateRoles: Role[] = [];
    
    // Find roles that have work to do
    for (const role of this.roles.values()) {
      if (!role.isIdle) {
        activateRoles.push(role);
      }
    }
    
    if (activateRoles.length === 0) {
      logger.debug('Environment: No active roles');
      return;
    }
    
    logger.info(`Environment: Running ${activateRoles.length} active roles`);
    
    // Run roles sequentially in interactive mode, parallel otherwise
    if (this.interactiveHandler?.enabled) {
      await this.runRolesSequentially(activateRoles);
    } else {
      await this.runRolesInParallel(activateRoles);
    }
  }

  /**
   * Run roles in parallel (non-interactive mode)
   */
  private async runRolesInParallel(roles: Role[]): Promise<void> {
    const results = await Promise.allSettled(
      roles.map(async (role) => {
        try {
          const message = await role.run();
          if (message) {
            this.publishMessage(message);
          }
          return message;
        } catch (error: any) {
          logger.error(`Environment: Role ${role.profile} failed`, error);
          throw error;
        }
      })
    );
    
    // Log results
    results.forEach((result, index) => {
      const role = roles[index];
      if (result.status === 'fulfilled') {
        if (result.value) {
          logger.info(`Environment: ${role.profile} produced message`);
        }
      } else {
        logger.error(`Environment: ${role.profile} execution failed`, result.reason);
      }
    });
  }

  /**
   * Run roles sequentially with interactive confirmation (interactive mode)
   */
  private async runRolesSequentially(roles: Role[]): Promise<void> {
    for (const role of roles) {
      let shouldContinue = true;
      
      while (shouldContinue) {
        try {
          // Run the role
          const message = await role.run();
          
          if (!message) {
            logger.info(`Environment: ${role.profile} produced no output`);
            break;
          }

          // Wait for user confirmation
          const result = await this.interactiveHandler!.waitForConfirmation(
            role.profile,
            message.causeBy,
            message.content
          );

          // Record interaction
          this.interactionHistory.push({
            role: role.profile,
            action: message.causeBy,
            userAction: result.action,
          });

          // Handle user action
          switch (result.action) {
            case UserAction.CONTINUE:
              // Use modified content if provided
              if (result.modifiedContent) {
                message.content = result.modifiedContent;
              }
              this.publishMessage(message);
              shouldContinue = false;
              break;

            case UserAction.EDIT:
              // User edited the content
              if (result.modifiedContent) {
                message.content = result.modifiedContent;
              }
              this.publishMessage(message);
              shouldContinue = false;
              break;

            case UserAction.REGENERATE:
              // Re-run the same role
              logger.info(`Environment: Regenerating output for ${role.profile}`);
              shouldContinue = true;
              continue;

            case UserAction.SKIP:
              // Skip publishing this message
              logger.info(`Environment: Skipping ${role.profile} output`);
              shouldContinue = false;
              break;

            case UserAction.QUIT:
              // User wants to quit
              logger.info('Environment: User requested to quit');
              throw new Error('User quit the interactive session');

            default:
              // Default to continue
              this.publishMessage(message);
              shouldContinue = false;
          }
        } catch (error: any) {
          logger.error(`Environment: Role ${role.profile} failed`, error);
          throw error;
        }
      }
    }

    // Display interaction summary at the end
    if (this.interactionHistory.length > 0 && roles.length > 0) {
      this.interactiveHandler?.displaySummary(this.interactionHistory);
    }
  }

  /**
   * Run for multiple rounds
   */
  async runForRounds(rounds: number): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      if (this.isIdle) {
        logger.info(`Environment: All roles idle after ${i} rounds`);
        break;
      }
      
      logger.info(`Environment: Starting round ${i + 1}/${rounds}`);
      await this.run();
    }
  }

  /**
   * Get all roles
   */
  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get role by name
   */
  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      roles: Array.from(this.roles.values()).map((r) => r.toJSON()),
      history: this.history.map((m) => m.toJSON()),
    };
  }
}

export default Environment;

