/**
 * Workflow Startup
 * Initialize workflow module on backend startup
 * This file should be imported in the main app to enable automatic recovery
 */

import { WorkflowRecoveryService } from './WorkflowRecoveryService';
import { WorkflowExecutionService } from './WorkflowExecutionService';
import { logger } from '../utils';

let recoveryService: WorkflowRecoveryService | null = null;
let initialized = false;

/**
 * Initialize workflow module
 * Call this during backend startup after database connection
 */
export async function initializeWorkflowModule(): Promise<void> {
  if (initialized) {
    logger.warn('WorkflowStartup: Workflow module already initialized');
    return;
  }

  logger.info('WorkflowStartup: Initializing workflow module');

  try {
    const executionService = new WorkflowExecutionService();
    recoveryService = new WorkflowRecoveryService(executionService);

    // Recover all active workflows on startup
    const useNewSystem = process.env.USE_NEW_WORKFLOW_SYSTEM === 'true';
    
    if (useNewSystem) {
      logger.info('WorkflowStartup: New workflow system enabled, recovering active workflows');
      const results = await recoveryService.recoverAllOnStartup();
      
      // Log recovery results
      let recovered = 0;
      let waiting = 0;
      let failed = 0;

      results.forEach((result) => {
        switch (result.status) {
          case 'recovered':
          case 'running':
            recovered++;
            break;
          case 'waiting':
            waiting++;
            break;
          case 'failed':
            failed++;
            break;
        }
      });

      logger.info('WorkflowStartup: Recovery completed', {
        total: results.size,
        recovered,
        waiting,
        failed,
      });
    } else {
      logger.info('WorkflowStartup: New workflow system disabled, skipping recovery');
    }

    initialized = true;
    logger.info('WorkflowStartup: Workflow module initialized successfully');

  } catch (error: any) {
    logger.error('WorkflowStartup: Failed to initialize workflow module', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - allow the app to start even if recovery fails
  }
}

/**
 * Get the recovery service instance
 */
export function getRecoveryService(): WorkflowRecoveryService | null {
  return recoveryService;
}

/**
 * Check if workflow module is initialized
 */
export function isWorkflowModuleInitialized(): boolean {
  return initialized;
}

/**
 * Shutdown workflow module (for graceful shutdown)
 */
export async function shutdownWorkflowModule(): Promise<void> {
  logger.info('WorkflowStartup: Shutting down workflow module');
  
  // Nothing to do for now
  initialized = false;
  recoveryService = null;
  
  logger.info('WorkflowStartup: Workflow module shut down');
}
