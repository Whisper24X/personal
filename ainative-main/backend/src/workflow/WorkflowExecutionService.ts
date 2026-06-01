/**
 * Workflow Execution Service
 * Main service for managing workflow execution state
 * Replaces StateManager with a simpler, database-centric approach
 */

import { WorkflowExecutionRepository } from './WorkflowExecutionRepository';
import { WorkflowStateMachine } from './WorkflowStateMachine';
import {
  WorkflowExecution,
  WorkflowState,
  StepState,
  StepOutput,
  StepCompleteResult,
  StepFailResult,
  WorkflowCurrentState,
  CurrentPosition,
} from './types';
import { WorkflowConfig } from '../database/repositories/ApplicationWorkflowRepository';
import { logger } from '../utils';

/**
 * Maximum retry count before marking step as failed
 */
const MAX_RETRIES = 3;

/**
 * WorkflowExecutionService
 * Provides a clean interface for managing workflow execution state
 */
export class WorkflowExecutionService {
  private repository: WorkflowExecutionRepository;

  constructor() {
    this.repository = new WorkflowExecutionRepository();
  }

  // ===== Query Methods =====

  /**
   * Get workflow execution by project ID and version ID
   */
  async getExecution(projectId: string, versionId: string): Promise<WorkflowExecution | null> {
    return this.repository.findByProjectAndVersion(projectId, versionId);
  }

  /**
   * Get workflow execution by project ID (deprecated, returns first found)
   * @deprecated Use getExecution(projectId, versionId) instead
   */
  async getExecutionByProjectId(projectId: string): Promise<WorkflowExecution | null> {
    return this.repository.findByProjectId(projectId);
  }

  /**
   * Get workflow executions by states
   */
  async findByStates(states: WorkflowState[]): Promise<WorkflowExecution[]> {
    return this.repository.findByStates(states);
  }

  /**
   * Get current workflow state (formatted for API response)
   */
  async getCurrentState(projectId: string, versionId: string): Promise<WorkflowCurrentState | null> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      return null;
    }

    const currentStep = exec.currentPosition
      ? WorkflowStateMachine.getStepByPosition(exec, exec.currentPosition)
      : null;

    const progress = WorkflowStateMachine.calculateProgress(exec);

    return {
      state: exec.state,
      currentRole: currentStep?.role ?? null,
      currentAction: currentStep?.action ?? null,
      steps: exec.steps,
      pendingConfirmation: exec.pendingConfirmation,
      lastError: exec.lastError,
      progress,
      deployFailed: exec.executionContext?.deployFailed ?? false,
    };
  }

  // ===== Lifecycle Methods =====

  /**
   * Initialize a new workflow execution for a project version
   */
  async initialize(
    projectId: string,
    versionId: string,
    workflowConfig: WorkflowConfig
  ): Promise<WorkflowExecution> {
    logger.info('WorkflowExecutionService: Initializing workflow', { projectId, versionId });

    const execution = await this.repository.getOrCreate(projectId, versionId, workflowConfig);

    logger.info('WorkflowExecutionService: Workflow initialized', {
      projectId,
      versionId,
      executionId: execution.id,
      stepsCount: execution.steps.length,
      state: execution.state,
    });

    return execution;
  }

  /**
   * Start workflow execution
   * @param projectId - Project ID
   * @param versionId - Version ID
   * @param startPosition - Optional: start from specific position (e.g., from reset)
   */
  async start(projectId: string, versionId: string, startPosition?: CurrentPosition): Promise<WorkflowExecution> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    if (!WorkflowStateMachine.canTransition(exec.state, WorkflowState.RUNNING)) {
      throw new Error(`Cannot start workflow from state ${exec.state}`);
    }

    // Update execution
    const updatedExec = this.cloneExecution(exec);
    updatedExec.state = WorkflowState.RUNNING;
    
    // Use provided position, or existing position (from reset), or default to {0, 0}
    updatedExec.currentPosition = startPosition 
      ?? exec.currentPosition 
      ?? { roleIndex: 0, actionIndex: 0 };

    // Find the step at current position and set it to running
    const targetStep = updatedExec.steps.find(
      s => s.roleIndex === updatedExec.currentPosition!.roleIndex 
        && s.actionIndex === updatedExec.currentPosition!.actionIndex
    );
    if (targetStep) {
      targetStep.state = StepState.RUNNING;
      targetStep.startedAt = new Date().toISOString();
    }

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    const result = await this.repository.update(updatedExec);

    WorkflowStateMachine.logTransition(
      projectId,
      exec.state,
      WorkflowState.RUNNING,
      'start'
    );

    logger.info('WorkflowExecutionService: Workflow started', {
      projectId,
      currentPosition: result.currentPosition,
    });

    return result;
  }

  // ===== Step Lifecycle Methods =====

  /**
   * Mark a step as started
   */
  async onStepStart(projectId: string, versionId: string, role: string, action: string): Promise<void> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    const updatedExec = this.cloneExecution(exec);

    // Clear all running states (ensure only one step runs at a time)
    updatedExec.steps.forEach(s => {
      if (s.state === StepState.RUNNING) {
        s.state = StepState.PENDING;
      }
    });

    // Find and update the target step
    const step = updatedExec.steps.find(s => s.role === role && s.action === action);
    if (!step) {
      throw new Error(`Step not found: ${role}/${action}`);
    }

    step.state = StepState.RUNNING;
    step.startedAt = new Date().toISOString();

    // 当开始执行 Deploy action 时，清除之前的 deployFailed 状态
    // 这样重试 Deploy 时不会因为之前的失败状态影响确认按钮
    if (action === 'Deploy') {
      updatedExec.executionContext = {
        ...updatedExec.executionContext,
        deployFailed: false,
      };
      logger.info('WorkflowExecutionService: Cleared deployFailed on Deploy start', {
        projectId,
        versionId,
      });
    }

    // Update current position
    updatedExec.currentPosition = {
      roleIndex: step.roleIndex,
      actionIndex: step.actionIndex,
    };

    // Ensure workflow is in RUNNING state
    if (updatedExec.state !== WorkflowState.RUNNING) {
      if (WorkflowStateMachine.canTransition(updatedExec.state, WorkflowState.RUNNING)) {
        updatedExec.state = WorkflowState.RUNNING;
      }
    }

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    await this.repository.update(updatedExec);

    logger.info('WorkflowExecutionService: Step started', {
      projectId,
      role,
      action,
    });
  }

  /**
   * Mark a step as completed
   */
  async onStepComplete(
    projectId: string,
    versionId: string,
    role: string,
    action: string,
    output?: StepOutput
  ): Promise<StepCompleteResult> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    const updatedExec = this.cloneExecution(exec);

    // Find and update the step
    const step = updatedExec.steps.find(s => s.role === role && s.action === action);
    if (!step) {
      throw new Error(`Step not found: ${role}/${action}`);
    }

    step.state = StepState.COMPLETED;
    step.completedAt = new Date().toISOString();
    step.retryCount = 0; // Reset retry count on success
    step.error = undefined;

    // 检测 Deploy action 结果，更新 deployFailed 状态
    if (action === 'Deploy' && output?.instructContent?.isCompleted !== undefined) {
      const deployFailed = output.instructContent.isCompleted === false;
      updatedExec.executionContext = {
        ...updatedExec.executionContext,
        deployFailed,
      };
      logger.info('WorkflowExecutionService: Deploy status updated', {
        projectId,
        versionId,
        deployFailed,
        isCompleted: output.instructContent.isCompleted,
      });
    }

    let needsConfirmation = false;
    let isCompleted = false;

    // Check if this is the last action of the role
    const isLastActionOfRole = WorkflowStateMachine.isLastActionOfRole(updatedExec, role, action);

    if (isLastActionOfRole) {
      // Check if this is the last step of the entire workflow
      const nextPosition = WorkflowStateMachine.getNextPosition(updatedExec, role, action);

      if (!nextPosition) {
        // Workflow complete
        updatedExec.state = WorkflowState.COMPLETED;
        updatedExec.currentPosition = null;
        updatedExec.pendingConfirmation = null;
        isCompleted = true;

        logger.info('WorkflowExecutionService: Workflow completed', { projectId });
      } else {
        // Need user confirmation before proceeding to next role
        updatedExec.state = WorkflowState.WAITING_CONFIRMATION;
        updatedExec.pendingConfirmation = output
          ? {
              role,
              action,
              content: output.content,
              outputFiles: output.outputFiles,
              instructContent: output.instructContent,
              createdAt: new Date().toISOString(),
              deployFailed: updatedExec.executionContext?.deployFailed ?? false,
            }
          : null;
        needsConfirmation = true;

        logger.info('WorkflowExecutionService: Step complete, waiting for confirmation', {
          projectId,
          role,
          action,
          deployFailed: updatedExec.executionContext?.deployFailed ?? false,
        });
      }
    } else {
      // Continue with next action in same role
      const nextAction = updatedExec.steps.find(
        s => s.role === role && s.actionIndex === step.actionIndex + 1
      );
      if (nextAction) {
        updatedExec.currentPosition = {
          roleIndex: nextAction.roleIndex,
          actionIndex: nextAction.actionIndex,
        };
      }

      logger.info('WorkflowExecutionService: Step complete, continuing', {
        projectId,
        role,
        action,
        nextAction: nextAction?.action,
      });
    }

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    await this.repository.update(updatedExec);

    return { needsConfirmation, isCompleted };
  }

  /**
   * Mark a step as failed
   */
  async onStepFail(
    projectId: string,
    versionId: string,
    role: string,
    action: string,
    error: Error
  ): Promise<StepFailResult> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    const updatedExec = this.cloneExecution(exec);

    // Find and update the step
    const step = updatedExec.steps.find(s => s.role === role && s.action === action);
    if (!step) {
      throw new Error(`Step not found: ${role}/${action}`);
    }

    step.retryCount = (step.retryCount || 0) + 1;
    step.error = error.message;

    let shouldRetry = false;

    if (step.retryCount < MAX_RETRIES) {
      // Can retry
      step.state = StepState.PENDING;
      shouldRetry = true;

      logger.info('WorkflowExecutionService: Step failed, will retry', {
        projectId,
        role,
        action,
        retryCount: step.retryCount,
        maxRetries: MAX_RETRIES,
      });
    } else {
      // Max retries exceeded, mark as failed
      step.state = StepState.FAILED;
      updatedExec.state = WorkflowState.FAILED;
      updatedExec.lastError = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };

      logger.error('WorkflowExecutionService: Step failed, max retries exceeded', {
        projectId,
        role,
        action,
        retryCount: step.retryCount,
        error: error.message,
      });
    }

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    await this.repository.update(updatedExec);

    return { shouldRetry, retryCount: step.retryCount };
  }

  // ===== User Action Methods =====

  /**
   * Confirm and proceed to next step
   */
  async confirm(projectId: string, versionId: string): Promise<WorkflowExecution> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    if (exec.state !== WorkflowState.WAITING_CONFIRMATION) {
      throw new Error(`Workflow is not waiting for confirmation. Current state: ${exec.state}`);
    }

    const updatedExec = this.cloneExecution(exec);

    // Find next step to execute
    const confirmedRole = exec.pendingConfirmation?.role;
    const confirmedAction = exec.pendingConfirmation?.action;

    if (confirmedRole && confirmedAction) {
      const nextPosition = WorkflowStateMachine.getNextPosition(exec, confirmedRole, confirmedAction);
      updatedExec.currentPosition = nextPosition;
    }

    updatedExec.state = WorkflowState.RUNNING;
    updatedExec.pendingConfirmation = null;

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    const result = await this.repository.update(updatedExec);

    WorkflowStateMachine.logTransition(
      projectId,
      exec.state,
      WorkflowState.RUNNING,
      'confirm'
    );

    logger.info('WorkflowExecutionService: Workflow confirmed', { projectId });

    return result;
  }

  /**
   * Reset workflow to a specific role
   */
  async reset(projectId: string, versionId: string, targetRole: string): Promise<WorkflowExecution> {
    const result = await this.repository.resetToRole(projectId, versionId, targetRole);
    if (!result) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    logger.info('WorkflowExecutionService: Workflow reset', {
      projectId,
      versionId,
      targetRole,
    });

    return result;
  }

  /**
   * Pause workflow execution
   */
  async pause(projectId: string, versionId: string): Promise<WorkflowExecution> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    if (!WorkflowStateMachine.canTransition(exec.state, WorkflowState.PAUSED)) {
      throw new Error(`Cannot pause workflow from state ${exec.state}`);
    }

    const updatedExec = this.cloneExecution(exec);
    updatedExec.state = WorkflowState.PAUSED;

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    const result = await this.repository.update(updatedExec);

    WorkflowStateMachine.logTransition(
      projectId,
      exec.state,
      WorkflowState.PAUSED,
      'pause'
    );

    return result;
  }

  /**
   * Resume workflow execution
   */
  async resume(projectId: string, versionId: string): Promise<WorkflowExecution> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    if (exec.state !== WorkflowState.PAUSED) {
      throw new Error(`Workflow is not paused. Current state: ${exec.state}`);
    }

    const updatedExec = this.cloneExecution(exec);
    updatedExec.state = WorkflowState.RUNNING;

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    const result = await this.repository.update(updatedExec);

    WorkflowStateMachine.logTransition(
      projectId,
      exec.state,
      WorkflowState.RUNNING,
      'resume'
    );

    return result;
  }

  /**
   * Retry failed workflow
   */
  async retry(projectId: string, versionId: string): Promise<WorkflowExecution> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    if (exec.state !== WorkflowState.FAILED) {
      throw new Error(`Workflow is not failed. Current state: ${exec.state}`);
    }

    const updatedExec = this.cloneExecution(exec);

    // Find the failed step and reset it
    const failedStep = updatedExec.steps.find(s => s.state === StepState.FAILED);
    if (failedStep) {
      failedStep.state = StepState.PENDING;
      failedStep.retryCount = 0;
      failedStep.error = undefined;

      updatedExec.currentPosition = {
        roleIndex: failedStep.roleIndex,
        actionIndex: failedStep.actionIndex,
      };
    }

    updatedExec.state = WorkflowState.RUNNING;
    updatedExec.lastError = null;

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    const result = await this.repository.update(updatedExec);

    WorkflowStateMachine.logTransition(
      projectId,
      exec.state,
      WorkflowState.RUNNING,
      'retry'
    );

    logger.info('WorkflowExecutionService: Workflow retry', { projectId });

    return result;
  }

  // ===== Context Methods =====

  /**
   * Update execution context
   */
  async updateContext(
    projectId: string,
    versionId: string,
    context: Record<string, any>
  ): Promise<void> {
    const exec = await this.getExecution(projectId, versionId);
    if (!exec) {
      throw new Error(`Workflow execution not found for project ${projectId} version ${versionId}`);
    }

    const updatedExec = this.cloneExecution(exec);
    updatedExec.executionContext = {
      ...updatedExec.executionContext,
      ...context,
    };

    updatedExec.version += 1;
    updatedExec.updatedAt = new Date().toISOString();

    await this.repository.update(updatedExec);
  }

  /**
   * Get execution context
   */
  async getContext(projectId: string, versionId: string): Promise<Record<string, any>> {
    const exec = await this.getExecution(projectId, versionId);
    return exec?.executionContext ?? {};
  }

  // ===== Delete Methods =====

  /**
   * Delete workflow execution
   */
  async delete(projectId: string, versionId: string): Promise<boolean> {
    return this.repository.deleteByProjectAndVersion(projectId, versionId);
  }

  /**
   * Delete all workflow executions for a project
   * @deprecated Use delete(projectId, versionId) for specific version
   */
  async deleteAllByProjectId(projectId: string): Promise<boolean> {
    return this.repository.deleteByProjectId(projectId);
  }

  // ===== Helper Methods =====

  /**
   * Clone execution for immutable updates
   */
  private cloneExecution(exec: WorkflowExecution): WorkflowExecution {
    return {
      ...exec,
      currentPosition: exec.currentPosition ? { ...exec.currentPosition } : null,
      steps: exec.steps.map(s => ({ ...s })),
      pendingConfirmation: exec.pendingConfirmation ? { ...exec.pendingConfirmation } : null,
      lastError: exec.lastError ? { ...exec.lastError } : null,
      executionContext: { ...exec.executionContext },
    };
  }
}
