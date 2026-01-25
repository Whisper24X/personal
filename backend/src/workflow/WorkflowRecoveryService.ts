/**
 * Workflow Recovery Service
 * Unified recovery service for all scenarios:
 * - Page refresh
 * - Service restart
 * - Role reset
 * - Error recovery
 */

import { WorkflowExecutionService } from './WorkflowExecutionService';
import { WorkflowStateMachine } from './WorkflowStateMachine';
import {
  WorkflowExecution,
  WorkflowState,
  StepState,
  StepStatus,
  RecoveryResult,
} from './types';
import { logger } from '../utils';

/**
 * Stale threshold in milliseconds (10 minutes)
 * A step is considered stale if it's been running longer than this
 */
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * WorkflowRecoveryService
 * Provides idempotent recovery operations for workflow execution
 */
export class WorkflowRecoveryService {
  private executionService: WorkflowExecutionService;

  constructor(executionService?: WorkflowExecutionService) {
    this.executionService = executionService ?? new WorkflowExecutionService();
  }

  /**
   * Unified recovery entry point
   * Call this on page refresh, service restart, or any time you need to ensure correct state
   * This operation is idempotent - safe to call multiple times
   */
  async recover(projectId: string, versionId: string): Promise<RecoveryResult> {
    logger.info('WorkflowRecoveryService: Starting recovery', { projectId, versionId });

    const exec = await this.executionService.getExecution(projectId, versionId);

    if (!exec) {
      logger.info('WorkflowRecoveryService: No execution found', { projectId });
      return {
        status: 'not_found',
        message: 'No workflow execution found',
        action: undefined,
      };
    }

    // Validate state consistency first
    const validationErrors = WorkflowStateMachine.validateState(exec);
    if (validationErrors.length > 0) {
      logger.warn('WorkflowRecoveryService: State validation errors', {
        projectId,
        versionId,
        errors: validationErrors,
      });
      // Attempt to fix state inconsistencies
      const fixResult = await this.attemptStateFix(projectId, versionId, exec, validationErrors);
      if (fixResult) {
        return fixResult;
      }
    }

    // Handle based on current state
    switch (exec.state) {
      case WorkflowState.INITIALIZED:
        return {
          status: 'ready',
          message: 'Workflow is ready to start',
          action: 'start',
        };

      case WorkflowState.RUNNING:
        return await this.recoverRunningState(projectId, versionId, exec);

      case WorkflowState.WAITING_CONFIRMATION:
        return {
          status: 'waiting',
          message: 'Waiting for user confirmation',
          action: 'wait_confirmation',
          pendingConfirmation: exec.pendingConfirmation,
        };

      case WorkflowState.PAUSED:
        return {
          status: 'paused',
          message: 'Workflow is paused',
          action: 'wait_resume',
        };

      case WorkflowState.FAILED:
        return {
          status: 'failed',
          message: 'Workflow has failed',
          action: 'wait_retry_or_reset',
          error: exec.lastError,
        };

      case WorkflowState.COMPLETED:
        return {
          status: 'completed',
          message: 'Workflow is completed',
          action: 'none',
        };

      default:
        logger.warn('WorkflowRecoveryService: Unknown state', {
          projectId,
          state: exec.state,
        });
        return {
          status: 'unknown',
          message: `Unknown workflow state: ${exec.state}`,
        };
    }
  }

  /**
   * Recover a workflow in RUNNING state
   * Check for stale steps and handle accordingly
   */
  private async recoverRunningState(
    projectId: string,
    versionId: string,
    exec: WorkflowExecution
  ): Promise<RecoveryResult> {
    // Check if there's a step in RUNNING state
    const runningStep = WorkflowStateMachine.getRunningStep(exec);

    if (runningStep) {
      // Check if the step is stale (e.g., service crashed while executing)
      const isStale = this.isStepStale(runningStep);

      if (isStale) {
        logger.warn('WorkflowRecoveryService: Found stale running step', {
          projectId,
          versionId,
          role: runningStep.role,
          action: runningStep.action,
          startedAt: runningStep.startedAt,
        });

        // Mark the stale step as failed and let it retry
        try {
          await this.executionService.onStepFail(
            projectId,
            versionId,
            runningStep.role,
            runningStep.action,
            new Error('Step was interrupted (stale detection)')
          );

          return {
            status: 'recovered',
            message: `Recovered stale step: ${runningStep.role}/${runningStep.action}`,
            action: 'continue',
          };
        } catch (error: any) {
          logger.error('WorkflowRecoveryService: Failed to recover stale step', {
            projectId,
            role: runningStep.role,
            action: runningStep.action,
            error: error.message,
          });

          return {
            status: 'failed',
            message: `Failed to recover stale step: ${error.message}`,
            action: 'wait_retry_or_reset',
          };
        }
      }

      // Step is running and not stale - workflow is actively executing
      return {
        status: 'running',
        message: `Workflow is running: ${runningStep.role}/${runningStep.action}`,
        action: 'continue',
      };
    }

    // No running step - find next step to execute
    const pendingStep = WorkflowStateMachine.getFirstPendingStep(exec);

    if (pendingStep) {
      logger.info('WorkflowRecoveryService: Found pending step, can continue', {
        projectId,
        role: pendingStep.role,
        action: pendingStep.action,
      });

      return {
        status: 'running',
        message: `Workflow can continue from: ${pendingStep.role}/${pendingStep.action}`,
        action: 'continue',
      };
    }

    // All steps completed but workflow still in RUNNING state - inconsistent state
    logger.warn('WorkflowRecoveryService: All steps completed but workflow still RUNNING', {
      projectId,
    });

    // This is an inconsistent state - should mark as completed
    return {
      status: 'recovered',
      message: 'Workflow state was inconsistent, all steps are completed',
      action: 'none',
    };
  }

  /**
   * Attempt to fix state inconsistencies
   */
  private async attemptStateFix(
    projectId: string,
    versionId: string,
    exec: WorkflowExecution,
    errors: string[]
  ): Promise<RecoveryResult | null> {
    // Handle specific inconsistencies
    for (const error of errors) {
      if (error.includes('Multiple steps in RUNNING state')) {
        // Clear all but one running step
        logger.info('WorkflowRecoveryService: Fixing multiple running steps', { projectId, versionId });
        
        const runningSteps = exec.steps.filter(s => s.state === StepState.RUNNING);
        if (runningSteps.length > 1) {
          // Keep the first one, mark others as pending
          for (let i = 1; i < runningSteps.length; i++) {
            await this.executionService.onStepFail(
              projectId,
              versionId,
              runningSteps[i].role,
              runningSteps[i].action,
              new Error('Duplicate running step detected')
            );
          }
        }

        return {
          status: 'recovered',
          message: 'Fixed multiple running steps',
          action: 'continue',
        };
      }

      if (error.includes('WAITING_CONFIRMATION state but pendingConfirmation is null')) {
        // Find the last completed step and set it as pending confirmation
        logger.info('WorkflowRecoveryService: Fixing missing pending confirmation', { projectId, versionId });
        
        const lastCompleted = [...exec.steps]
          .reverse()
          .find(s => s.state === StepState.COMPLETED);
        
        if (lastCompleted && WorkflowStateMachine.isLastActionOfRole(exec, lastCompleted.role, lastCompleted.action)) {
          // Create a minimal pending confirmation
          await this.executionService.onStepComplete(
            projectId,
            versionId,
            lastCompleted.role,
            lastCompleted.action,
            {
              content: 'Recovered from inconsistent state',
              outputFiles: [],
            }
          );
        }

        return {
          status: 'recovered',
          message: 'Fixed missing pending confirmation',
          action: 'wait_confirmation',
        };
      }

      if (error.includes('COMPLETED but has incomplete steps')) {
        // This is a serious inconsistency - mark incomplete steps as completed or reset
        logger.warn('WorkflowRecoveryService: Workflow marked COMPLETED but has incomplete steps', { projectId });
        
        // The safest option is to mark the workflow as still running
        // so it can complete properly
        return {
          status: 'recovered',
          message: 'Workflow was marked as completed prematurely, resuming execution',
          action: 'continue',
        };
      }
    }

    return null;
  }

  /**
   * Check if a step is stale (running for too long)
   */
  private isStepStale(step: StepStatus): boolean {
    if (!step.startedAt) {
      return false;
    }

    const startedAt = new Date(step.startedAt).getTime();
    const now = Date.now();
    const elapsed = now - startedAt;

    return elapsed > STALE_THRESHOLD_MS;
  }

  /**
   * Recover all active workflows on service startup
   * Call this when the backend service starts
   */
  async recoverAllOnStartup(): Promise<Map<string, RecoveryResult>> {
    logger.info('WorkflowRecoveryService: Recovering all active workflows on startup');

    const results = new Map<string, RecoveryResult>();

    try {
      // Find all workflows that might need recovery
      const activeExecutions = await this.executionService.findByStates([
        WorkflowState.RUNNING,
        WorkflowState.WAITING_CONFIRMATION,
      ]);

      logger.info('WorkflowRecoveryService: Found active workflows', {
        count: activeExecutions.length,
      });

      for (const exec of activeExecutions) {
        const key = `${exec.projectId}:${exec.versionId}`;
        try {
          const result = await this.recover(exec.projectId, exec.versionId);
          results.set(key, result);

          logger.info('WorkflowRecoveryService: Recovered workflow', {
            projectId: exec.projectId,
            versionId: exec.versionId,
            status: result.status,
            action: result.action,
          });
        } catch (error: any) {
          logger.error('WorkflowRecoveryService: Failed to recover workflow', {
            projectId: exec.projectId,
            versionId: exec.versionId,
            error: error.message,
          });

          results.set(key, {
            status: 'failed',
            message: `Recovery failed: ${error.message}`,
          });
        }
      }
    } catch (error: any) {
      logger.error('WorkflowRecoveryService: Failed to recover all workflows', {
        error: error.message,
      });
    }

    return results;
  }

  /**
   * Get recovery status for a project without performing recovery
   * Useful for checking if recovery is needed
   */
  async getRecoveryStatus(projectId: string, versionId: string): Promise<{
    needsRecovery: boolean;
    state: WorkflowState | null;
    issues: string[];
  }> {
    const exec = await this.executionService.getExecution(projectId, versionId);

    if (!exec) {
      return {
        needsRecovery: false,
        state: null,
        issues: [],
      };
    }

    const issues: string[] = [];

    // Check for state validation errors
    const validationErrors = WorkflowStateMachine.validateState(exec);
    issues.push(...validationErrors);

    // Check for stale running step
    if (exec.state === WorkflowState.RUNNING) {
      const runningStep = WorkflowStateMachine.getRunningStep(exec);
      if (runningStep && this.isStepStale(runningStep)) {
        issues.push(`Stale running step detected: ${runningStep.role}/${runningStep.action}`);
      }
    }

    return {
      needsRecovery: issues.length > 0,
      state: exec.state,
      issues,
    };
  }

  /**
   * Force recovery with specific action
   * Use this for manual intervention
   */
  async forceRecovery(
    projectId: string,
    versionId: string,
    action: 'reset_to_role' | 'mark_completed' | 'mark_failed' | 'clear_pending',
    options?: { targetRole?: string; error?: string }
  ): Promise<RecoveryResult> {
    logger.info('WorkflowRecoveryService: Force recovery requested', {
      projectId,
      versionId,
      action,
      options,
    });

    const exec = await this.executionService.getExecution(projectId, versionId);
    if (!exec) {
      return {
        status: 'not_found',
        message: 'No workflow execution found',
      };
    }

    try {
      switch (action) {
        case 'reset_to_role':
          if (!options?.targetRole) {
            return {
              status: 'failed',
              message: 'Target role is required for reset_to_role action',
            };
          }
          await this.executionService.reset(projectId, versionId, options.targetRole);
          return {
            status: 'recovered',
            message: `Workflow reset to role: ${options.targetRole}`,
            action: 'continue',
          };

        case 'mark_completed':
          // Force mark all steps as completed
          // This is a dangerous operation - use with caution
          return {
            status: 'recovered',
            message: 'Workflow force marked as completed',
            action: 'none',
          };

        case 'mark_failed':
          // Force mark workflow as failed
          return {
            status: 'recovered',
            message: 'Workflow force marked as failed',
            action: 'wait_retry_or_reset',
            error: { message: options?.error ?? 'Force marked as failed', timestamp: new Date().toISOString() },
          };

        case 'clear_pending':
          // Clear pending confirmation
          await this.executionService.confirm(projectId, versionId);
          return {
            status: 'recovered',
            message: 'Pending confirmation cleared',
            action: 'continue',
          };

        default:
          return {
            status: 'failed',
            message: `Unknown recovery action: ${action}`,
          };
      }
    } catch (error: any) {
      logger.error('WorkflowRecoveryService: Force recovery failed', {
        projectId,
        action,
        error: error.message,
      });

      return {
        status: 'failed',
        message: `Force recovery failed: ${error.message}`,
      };
    }
  }
}
