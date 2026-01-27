/**
 * Workflow State Machine
 * Pure state machine logic for workflow state transitions
 * This class contains no side effects - it only validates and computes state transitions
 */

import {
  WorkflowState,
  StepState,
  WorkflowExecution,
  StepStatus,
  CurrentPosition,
} from './types';
import { logger } from '../utils';

/**
 * State transition definition
 */
interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  event: string;
  condition?: (exec: WorkflowExecution) => boolean;
}

/**
 * WorkflowStateMachine
 * Implements state machine pattern for workflow state management
 */
export class WorkflowStateMachine {
  /**
   * Valid state transitions
   */
  private static readonly transitions: StateTransition[] = [
    // From INITIALIZED
    { from: WorkflowState.INITIALIZED, to: WorkflowState.RUNNING, event: 'start' },

    // From RUNNING
    { from: WorkflowState.RUNNING, to: WorkflowState.WAITING_CONFIRMATION, event: 'step_complete_needs_confirm' },
    { from: WorkflowState.RUNNING, to: WorkflowState.COMPLETED, event: 'workflow_complete' },
    { from: WorkflowState.RUNNING, to: WorkflowState.FAILED, event: 'max_retries_exceeded' },
    { from: WorkflowState.RUNNING, to: WorkflowState.PAUSED, event: 'pause' },
    // RUNNING -> RUNNING is implicit (step complete, continue to next)

    // From WAITING_CONFIRMATION
    { from: WorkflowState.WAITING_CONFIRMATION, to: WorkflowState.RUNNING, event: 'confirm' },
    { from: WorkflowState.WAITING_CONFIRMATION, to: WorkflowState.RUNNING, event: 'reset' },

    // From PAUSED
    { from: WorkflowState.PAUSED, to: WorkflowState.RUNNING, event: 'resume' },
    { from: WorkflowState.PAUSED, to: WorkflowState.RUNNING, event: 'reset' },

    // From FAILED
    { from: WorkflowState.FAILED, to: WorkflowState.RUNNING, event: 'retry' },
    { from: WorkflowState.FAILED, to: WorkflowState.RUNNING, event: 'reset' },

    // COMPLETED is terminal - no transitions out
  ];

  /**
   * Check if a state transition is valid
   */
  static canTransition(from: WorkflowState, to: WorkflowState): boolean {
    // Same state is always valid (no-op)
    if (from === to) return true;

    return this.transitions.some(t => t.from === from && t.to === to);
  }

  /**
   * Get valid target states from a given state
   */
  static getValidTargetStates(from: WorkflowState): WorkflowState[] {
    const targets = new Set<WorkflowState>();
    this.transitions
      .filter(t => t.from === from)
      .forEach(t => targets.add(t.to));
    return Array.from(targets);
  }

  /**
   * Get the event name for a transition
   */
  static getTransitionEvent(from: WorkflowState, to: WorkflowState): string | null {
    const transition = this.transitions.find(t => t.from === from && t.to === to);
    return transition?.event ?? null;
  }

  /**
   * Check if a state is terminal (no further transitions possible)
   */
  static isTerminalState(state: WorkflowState): boolean {
    return state === WorkflowState.COMPLETED;
  }

  /**
   * Check if a state requires external action (user confirmation, resume, etc.)
   */
  static requiresExternalAction(state: WorkflowState): boolean {
    return [
      WorkflowState.WAITING_CONFIRMATION,
      WorkflowState.PAUSED,
      WorkflowState.FAILED,
    ].includes(state);
  }

  /**
   * Find the next step to execute based on current position
   * Returns null if workflow is complete
   */
  static getNextPosition(
    execution: WorkflowExecution,
    currentRole: string,
    currentAction: string
  ): CurrentPosition | null {
    const steps = execution.steps;

    // Find current step
    const currentStep = steps.find(
      s => s.role === currentRole && s.action === currentAction
    );

    if (!currentStep) {
      logger.warn('WorkflowStateMachine: Current step not found', {
        currentRole,
        currentAction,
      });
      return null;
    }

    // Try to find next action in same role
    const nextInRole = steps.find(
      s =>
        s.role === currentRole &&
        s.actionIndex === currentStep.actionIndex + 1 &&
        s.state === StepState.PENDING
    );

    if (nextInRole) {
      return {
        roleIndex: currentStep.roleIndex,
        actionIndex: nextInRole.actionIndex,
      };
    }

    // Try to find first action in next role
    const nextRole = steps.find(
      s =>
        s.roleIndex === currentStep.roleIndex + 1 &&
        s.actionIndex === 0 &&
        s.state === StepState.PENDING
    );

    if (nextRole) {
      return {
        roleIndex: nextRole.roleIndex,
        actionIndex: 0,
      };
    }

    // No more steps - workflow complete
    return null;
  }

  /**
   * Get the first pending step in the workflow
   */
  static getFirstPendingStep(execution: WorkflowExecution): StepStatus | null {
    return execution.steps.find(s => s.state === StepState.PENDING) ?? null;
  }

  /**
   * Get the currently running step
   */
  static getRunningStep(execution: WorkflowExecution): StepStatus | null {
    return execution.steps.find(s => s.state === StepState.RUNNING) ?? null;
  }

  /**
   * Check if a role is complete (all actions completed)
   */
  static isRoleComplete(execution: WorkflowExecution, role: string): boolean {
    const roleSteps = execution.steps.filter(s => s.role === role);
    return roleSteps.every(s => s.state === StepState.COMPLETED);
  }

  /**
   * Check if a step is the last action of its role
   */
  static isLastActionOfRole(execution: WorkflowExecution, role: string, action: string): boolean {
    const step = execution.steps.find(s => s.role === role && s.action === action);
    if (!step) return false;

    // Check if there are any pending steps with higher action index in the same role
    const hasMoreActions = execution.steps.some(
      s => s.role === role && s.actionIndex > step.actionIndex && s.state === StepState.PENDING
    );

    return !hasMoreActions;
  }

  /**
   * Check if a step is the last step of the entire workflow
   */
  static isLastStep(execution: WorkflowExecution, role: string, action: string): boolean {
    const step = execution.steps.find(s => s.role === role && s.action === action);
    if (!step) return false;

    // Check if there are any pending steps after this one (in same or later roles)
    const hasMoreSteps = execution.steps.some(
      s =>
        s.state === StepState.PENDING &&
        (s.roleIndex > step.roleIndex ||
          (s.roleIndex === step.roleIndex && s.actionIndex > step.actionIndex))
    );

    return !hasMoreSteps;
  }

  /**
   * Get step by role and action name
   */
  static getStep(execution: WorkflowExecution, role: string, action: string): StepStatus | null {
    return execution.steps.find(s => s.role === role && s.action === action) ?? null;
  }

  /**
   * Get step by position
   */
  static getStepByPosition(execution: WorkflowExecution, position: CurrentPosition): StepStatus | null {
    return execution.steps.find(
      s => s.roleIndex === position.roleIndex && s.actionIndex === position.actionIndex
    ) ?? null;
  }

  /**
   * Calculate workflow progress
   */
  static calculateProgress(execution: WorkflowExecution): {
    completed: number;
    total: number;
    percentage: number;
  } {
    const total = execution.steps.length;
    const completed = execution.steps.filter(s => s.state === StepState.COMPLETED).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  /**
   * Get all steps for a specific role
   */
  static getRoleSteps(execution: WorkflowExecution, role: string): StepStatus[] {
    return execution.steps.filter(s => s.role === role);
  }

  /**
   * Get failed steps
   */
  static getFailedSteps(execution: WorkflowExecution): StepStatus[] {
    return execution.steps.filter(s => s.state === StepState.FAILED);
  }

  /**
   * Check if any step has exceeded max retries
   */
  static hasExceededMaxRetries(execution: WorkflowExecution, maxRetries: number = 3): boolean {
    return execution.steps.some(s => s.retryCount >= maxRetries);
  }

  /**
   * Get the step that exceeded max retries
   */
  static getStepExceedingMaxRetries(execution: WorkflowExecution, maxRetries: number = 3): StepStatus | null {
    return execution.steps.find(s => s.retryCount >= maxRetries) ?? null;
  }

  /**
   * Validate workflow execution state consistency
   * Returns array of validation errors
   */
  static validateState(execution: WorkflowExecution): string[] {
    const errors: string[] = [];

    // Check state consistency
    if (execution.state === WorkflowState.RUNNING) {
      const runningSteps = execution.steps.filter(s => s.state === StepState.RUNNING);
      if (runningSteps.length > 1) {
        errors.push(`Multiple steps in RUNNING state: ${runningSteps.map(s => `${s.role}/${s.action}`).join(', ')}`);
      }
    }

    if (execution.state === WorkflowState.WAITING_CONFIRMATION && !execution.pendingConfirmation) {
      errors.push('Workflow is in WAITING_CONFIRMATION state but pendingConfirmation is null');
    }

    if (execution.state === WorkflowState.FAILED && !execution.lastError) {
      errors.push('Workflow is in FAILED state but lastError is null');
    }

    if (execution.state === WorkflowState.COMPLETED) {
      const incompleteSteps = execution.steps.filter(
        s => s.state !== StepState.COMPLETED && s.state !== StepState.SKIPPED
      );
      if (incompleteSteps.length > 0) {
        errors.push(`Workflow is COMPLETED but has incomplete steps: ${incompleteSteps.map(s => `${s.role}/${s.action}`).join(', ')}`);
      }
    }

    // Check position consistency
    if (execution.currentPosition) {
      const step = this.getStepByPosition(execution, execution.currentPosition);
      if (!step) {
        errors.push(`Current position points to non-existent step: roleIndex=${execution.currentPosition.roleIndex}, actionIndex=${execution.currentPosition.actionIndex}`);
      }
    }

    return errors;
  }

  /**
   * Log state transition for debugging
   */
  static logTransition(
    projectId: string,
    from: WorkflowState,
    to: WorkflowState,
    event: string
  ): void {
    logger.info('WorkflowStateMachine: State transition', {
      projectId,
      from,
      to,
      event,
      valid: this.canTransition(from, to),
    });
  }
}
