/**
 * WorkflowStartupService
 * Manages handlers that execute before workflow starts
 * 
 * This service provides a hook mechanism for executing operations before a workflow
 * starts executing. Handlers are registered and called sequentially when a workflow
 * execution begins.
 */

import { Project } from '../database/repositories/ProjectRepository';
import { ProjectVersion } from '../database/repositories/ProjectVersionRepository';
import { logger } from '../utils';

/**
 * Context information passed to workflow startup handlers
 */
export interface WorkflowStartupContext {
  projectId: string;
  versionId: string;
  project: Project;
  version: ProjectVersion;
  workspacePath: string;
}

/**
 * Handler interface for workflow startup events
 */
export interface WorkflowStartupHandler {
  /**
   * Handle workflow startup event
   * @param context - Context information about the workflow startup
   */
  handle(context: WorkflowStartupContext): Promise<void>;
}

/**
 * WorkflowStartupService
 * Manages and executes workflow startup handlers
 */
export class WorkflowStartupService {
  private handlers: WorkflowStartupHandler[] = [];

  /**
   * Register a handler to be called when a workflow starts
   * @param handler - Handler to register
   */
  register(handler: WorkflowStartupHandler): void {
    this.handlers.push(handler);
    logger.info('WorkflowStartupService: Registered handler', {
      handlerName: handler.constructor.name,
      totalHandlers: this.handlers.length,
    });
  }

  /**
   * Execute all registered handlers when a workflow starts
   * Each handler's errors are handled independently and don't affect other handlers
   * @param context - Context information about the workflow startup
   */
  async onWorkflowStart(context: WorkflowStartupContext): Promise<void> {
    if (this.handlers.length === 0) {
      logger.debug('WorkflowStartupService: No handlers registered', {
        projectId: context.projectId,
        versionId: context.versionId,
      });
      return;
    }

    logger.info('WorkflowStartupService: Executing workflow startup handlers', {
      projectId: context.projectId,
      versionId: context.versionId,
      handlerCount: this.handlers.length,
    });

    // Execute all handlers sequentially
    // Errors in one handler don't prevent others from executing
    for (const handler of this.handlers) {
      try {
        await handler.handle(context);
        logger.debug('WorkflowStartupService: Handler executed successfully', {
          handlerName: handler.constructor.name,
          projectId: context.projectId,
          versionId: context.versionId,
        });
      } catch (error: any) {
        // Log error but continue with other handlers
        logger.error('WorkflowStartupService: Handler execution failed', {
          handlerName: handler.constructor.name,
          projectId: context.projectId,
          versionId: context.versionId,
          error: error.message,
          stack: error.stack,
        });
      }
    }

    logger.info('WorkflowStartupService: All handlers executed', {
      projectId: context.projectId,
      versionId: context.versionId,
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
    logger.info('WorkflowStartupService: All handlers cleared');
  }
}
