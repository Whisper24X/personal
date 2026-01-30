/**
 * RoleCompletionService
 * Manages handlers that execute when a role completes all its actions
 * 
 * This service provides a hook mechanism for executing operations when a role
 * finishes executing all its actions. Handlers are registered and called
 * sequentially when a role completes.
 */

import { Project } from '../database/repositories/ProjectRepository';
import { ProjectVersion } from '../database/repositories/ProjectVersionRepository';
import { logger } from '../utils';

/**
 * Context information passed to role completion handlers
 */
export interface RoleCompletionContext {
  projectId: string;
  versionId: string;
  role: string;
  action: string;
  project: Project;
  version: ProjectVersion;
  workspacePath: string;
}

/**
 * Handler interface for role completion events
 */
export interface RoleCompletionHandler {
  /**
   * Handle role completion event
   * @param context - Context information about the completed role
   */
  handle(context: RoleCompletionContext): Promise<void>;
}

/**
 * RoleCompletionService
 * Manages and executes role completion handlers
 */
export class RoleCompletionService {
  private handlers: RoleCompletionHandler[] = [];

  /**
   * Register a handler to be called when a role completes
   * @param handler - Handler to register
   */
  register(handler: RoleCompletionHandler): void {
    this.handlers.push(handler);
    logger.info('RoleCompletionService: Registered handler', {
      handlerName: handler.constructor.name,
      totalHandlers: this.handlers.length,
    });
  }

  /**
   * Execute all registered handlers when a role completes
   * Each handler's errors are handled independently and don't affect other handlers
   * @param context - Context information about the completed role
   */
  async onRoleComplete(context: RoleCompletionContext): Promise<void> {
    if (this.handlers.length === 0) {
      logger.debug('RoleCompletionService: No handlers registered', {
        role: context.role,
        projectId: context.projectId,
      });
      return;
    }

    logger.info('RoleCompletionService: Executing role completion handlers', {
      role: context.role,
      projectId: context.projectId,
      versionId: context.versionId,
      handlerCount: this.handlers.length,
    });

    // Execute all handlers sequentially
    // Errors in one handler don't prevent others from executing
    for (const handler of this.handlers) {
      try {
        await handler.handle(context);
        logger.debug('RoleCompletionService: Handler executed successfully', {
          handlerName: handler.constructor.name,
          role: context.role,
        });
      } catch (error: any) {
        // Log error but continue with other handlers
        logger.error('RoleCompletionService: Handler execution failed', {
          handlerName: handler.constructor.name,
          role: context.role,
          projectId: context.projectId,
          versionId: context.versionId,
          error: error.message,
          stack: error.stack,
        });
      }
    }

    logger.info('RoleCompletionService: All handlers executed', {
      role: context.role,
      projectId: context.projectId,
      handlerCount: this.handlers.length,
    });
  }

  /**
   * Get the number of registered handlers
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers = [];
    logger.info('RoleCompletionService: All handlers cleared');
  }
}
