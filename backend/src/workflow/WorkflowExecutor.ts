/**
 * WorkflowExecutor
 * Connects workflow state management with actual role/action execution
 * 
 * This is the execution engine that:
 * 1. Reads current state from WorkflowExecutionService
 * 2. Creates and executes Role/Action instances
 * 3. Updates state via WorkflowExecutionService callbacks
 * 4. Handles confirmation flow and step continuation
 */

import { WorkflowExecutionService } from './WorkflowExecutionService';
import { WorkflowState, StepOutput } from './types';
import { RoleActionFactory } from '../services/RoleActionFactory';
import { Context } from '../core/context/Context';
import { Message } from '../core/message/Message';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { logger } from '../utils';

/**
 * Message handler callback type
 */
export type WorkflowMessageHandler = (type: string, data: any) => void;

/**
 * Executor configuration
 */
export interface WorkflowExecutorConfig {
  /** Whether to auto-continue without confirmation (for testing) */
  autoConfirm?: boolean;
}

const DEFAULT_CONFIG: WorkflowExecutorConfig = {
  autoConfirm: false,
};

/**
 * WorkflowExecutor class
 * Manages the execution loop for a workflow
 */
export class WorkflowExecutor {
  private executionService: WorkflowExecutionService;
  private projectRepository: ProjectRepository;
  private messageRepository: MessageRepository;
  private config: WorkflowExecutorConfig;
  private messageHandler?: WorkflowMessageHandler;
  private isExecuting: boolean = false;
  private shouldStop: boolean = false;

  constructor(config?: WorkflowExecutorConfig) {
    this.executionService = new WorkflowExecutionService();
    this.projectRepository = new ProjectRepository();
    this.messageRepository = new MessageRepository();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set message handler for sending updates to frontend
   */
  setMessageHandler(handler: WorkflowMessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Send message to frontend via handler
   */
  private sendMessage(type: string, data: any): void {
    if (this.messageHandler) {
      try {
        this.messageHandler(type, data);
      } catch (error: any) {
        logger.warn('WorkflowExecutor: Failed to send message', {
          type,
          error: error.message,
        });
      }
    }
  }

  /**
   * Stop the current execution loop
   */
  stop(): void {
    this.shouldStop = true;
    logger.info('WorkflowExecutor: Stop requested');
  }

  /**
   * Execute workflow from current position
   * This is the main entry point for starting/continuing execution
   */
  async execute(projectId: string): Promise<void> {
    if (this.isExecuting) {
      logger.warn('WorkflowExecutor: Already executing', { projectId });
      return;
    }

    this.isExecuting = true;
    this.shouldStop = false;

    try {
      await this.executeLoop(projectId);
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Main execution loop
   */
  private async executeLoop(projectId: string): Promise<void> {
    while (!this.shouldStop) {
      // Get current state
      const state = await this.executionService.getCurrentState(projectId);
      
      if (!state) {
        logger.error('WorkflowExecutor: Workflow execution not found', { projectId });
        break;
      }

      // Check if we should continue based on state
      if (state.state === WorkflowState.COMPLETED) {
        logger.info('WorkflowExecutor: Workflow completed', { projectId });
        this.sendMessage('completed', { projectId });
        break;
      }

      if (state.state === WorkflowState.FAILED) {
        logger.info('WorkflowExecutor: Workflow failed', { projectId });
        this.sendMessage('error', { 
          message: state.lastError?.message || 'Workflow execution failed',
          projectId,
        });
        break;
      }

      if (state.state === WorkflowState.WAITING_CONFIRMATION) {
        logger.info('WorkflowExecutor: Waiting for confirmation', { projectId });
        this.sendMessage('confirmation_required', {
          role: state.pendingConfirmation?.role,
          action: state.pendingConfirmation?.action,
          content: state.pendingConfirmation?.content,
          outputFiles: state.pendingConfirmation?.outputFiles,
          instructContent: state.pendingConfirmation?.instructContent,
        });
        break;
      }

      if (state.state === WorkflowState.PAUSED) {
        logger.info('WorkflowExecutor: Workflow paused', { projectId });
        break;
      }

      if (state.state !== WorkflowState.RUNNING) {
        logger.warn('WorkflowExecutor: Unexpected state', { 
          projectId, 
          state: state.state,
        });
        break;
      }

      // Get current step to execute
      const { currentRole, currentAction } = state;
      
      if (!currentRole || !currentAction) {
        logger.error('WorkflowExecutor: No current step to execute', { projectId });
        break;
      }

      // Execute the current step
      logger.info('WorkflowExecutor: Executing step', { 
        projectId, 
        role: currentRole, 
        action: currentAction,
      });

      this.sendMessage('role_start', {
        role: currentRole,
        action: currentAction,
      });

      try {
        await this.executeStep(projectId, currentRole, currentAction);
      } catch (error: any) {
        logger.error('WorkflowExecutor: Step execution error', {
          projectId,
          role: currentRole,
          action: currentAction,
          error: error.message,
        });

        // Step failure is already handled by onStepFail
        // Check if we should retry
        const newState = await this.executionService.getCurrentState(projectId);
        if (newState?.state === WorkflowState.FAILED) {
          this.sendMessage('error', { 
            message: error.message,
            projectId,
          });
          break;
        }
        // If not failed, loop will continue and retry
      }
    }

    logger.info('WorkflowExecutor: Execution loop ended', { projectId });
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    projectId: string,
    role: string,
    action: string
  ): Promise<void> {
    // Mark step as started
    await this.executionService.onStepStart(projectId, role, action);

    // Get project info for context
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Create context
    const context = new Context(undefined, project.investment || 10.0);
    context.set('projectId', projectId);
    if (project.application_id) {
      context.set('applicationId', project.application_id);
    }
    if (project.user_id) {
      context.set('userId', project.user_id);
    }

    // Get workflow config for role actions
    const execution = await this.executionService.getExecution(projectId);
    if (!execution) {
      throw new Error(`Workflow execution not found: ${projectId}`);
    }

    // Find role config in workflow snapshot
    const roleConfig = execution.workflowSnapshot.roles.find(r => r.profile === role);
    if (!roleConfig) {
      throw new Error(`Role not found in workflow config: ${role}`);
    }

    // Create role instance with configured actions
    const roleInstance = RoleActionFactory.createRoleFromDefinition(
      role,
      context,
      roleConfig.name,
      roleConfig.actions,
      roleConfig.watch_actions
    );

    // Wait for LLM config to load
    if ((roleInstance as any)['llmLoadPromise']) {
      await (roleInstance as any)['llmLoadPromise'];
    }

    // Find the target action
    const targetAction = roleInstance.actions.find(a => a.name === action);
    if (!targetAction) {
      throw new Error(`Action not found: ${action}`);
    }

    // Load relevant messages from project history
    await this.loadRelevantMessages(projectId, roleInstance, action);

    // For the first action (WriteMRD), add user idea as initial input
    if (action === 'WriteMRD' && project.idea) {
      const userMessage = new Message({
        content: project.idea,
        role: 'User',
        causeBy: 'User',
        sentFrom: 'User',
      });
      roleInstance['rc'].memory.add(userMessage);
      roleInstance.putMessage(userMessage);
      logger.info('WorkflowExecutor: Added user idea as initial message', {
        projectId,
        ideaLength: project.idea.length,
      });
    }

    // Call observe() to move buffered messages to rc.news
    // This is required because prepareActionInput() reads from rc.news
    const observedCount = await roleInstance.observe();
    logger.info('WorkflowExecutor: Observed messages', {
      projectId,
      observedCount,
      newsCount: roleInstance['rc'].news.length,
    });

    // Set the action as todo
    roleInstance['rc'].todo = targetAction;

    // Execute action (timeout handled by individual actions)
    const result = await roleInstance.act();

    if (!result) {
      throw new Error(`Action ${action} produced no output`);
    }

    // Save message to project history
    await this.messageRepository.save(projectId, result);
    logger.info('WorkflowExecutor: Saved message to history', {
      projectId,
      messageId: result.id,
    });

    // Create step output
    const output: StepOutput = {
      content: result.content,
      outputFiles: result.instructContent?.outputFiles || [],
      instructContent: result.instructContent,
    };

    // Mark step as completed
    const { needsConfirmation, isCompleted } = await this.executionService.onStepComplete(
      projectId,
      role,
      action,
      output
    );

    logger.info('WorkflowExecutor: Step completed', {
      projectId,
      role,
      action,
      needsConfirmation,
      isCompleted,
    });
  }

  /**
   * Load relevant messages from project history
   */
  private async loadRelevantMessages(
    projectId: string,
    role: any,
    actionName: string
  ): Promise<void> {
    try {
      const messages = await this.messageRepository.findByProjectId(projectId);

      if (messages.length === 0) {
        logger.info('WorkflowExecutor: No messages in project history', { projectId });
        return;
      }

      // Determine relevant message types based on action
      const relevantTypes = this.getRelevantMessageTypes(actionName);

      // Load messages
      let loadedCount = 0;
      for (const dbMessage of messages) {
        // If no specific types required, or message matches required type
        if (relevantTypes.length === 0 || relevantTypes.includes(dbMessage.cause_by)) {
          const message = new Message({
            content: dbMessage.content,
            role: dbMessage.role_type,
            causeBy: dbMessage.cause_by,
            sentFrom: dbMessage.sent_from,
          });
          role['rc'].memory.add(message);
          role.putMessage(message);
          loadedCount++;
        }
      }

      logger.info('WorkflowExecutor: Loaded messages from history', {
        projectId,
        loadedCount,
        totalMessages: messages.length,
      });
    } catch (error: any) {
      logger.warn('WorkflowExecutor: Failed to load messages', {
        projectId,
        error: error.message,
      });
    }
  }

  /**
   * Get relevant message types for an action
   */
  private getRelevantMessageTypes(actionName: string): string[] {
    const relevantMap: Record<string, string[]> = {
      // PRD needs MRD output
      WritePRD: ['WriteMRD', 'MRDReview', 'ImproveMRD', 'User'],
      PRDReview: ['WritePRD'],
      ImprovePRD: ['PRDReview', 'WritePRD'],
      
      // Design needs PRD
      WriteDesign: ['WritePRD', 'PRDReview', 'ImprovePRD'],
      DesignReview: ['WriteDesign'],
      ImproveDesign: ['DesignReview', 'WriteDesign'],
      
      // Code needs PRD and Design
      WriteCode: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
      
      // Test needs PRD and Code
      WriteTest: ['WritePRD', 'WriteCode'],
      WriteTestPlan: ['WritePRD', 'WriteCode'],
      TestabilityReview: ['WritePRD', 'WriteCode'],
      TestCaseReview: ['WriteTest', 'WriteTestPlan'],
      
      // MRD is the first step, needs User input
      WriteMRD: ['User'],
      MRDReview: ['WriteMRD'],
      ImproveMRD: ['MRDReview', 'WriteMRD'],
      
      // Task breakdown needs PRD
      BreakdownTasks: ['WritePRD', 'WriteDesign'],
    };

    return relevantMap[actionName] || [];
  }
}

// Export singleton creator for convenience
let executorInstance: WorkflowExecutor | null = null;

export function getWorkflowExecutor(config?: WorkflowExecutorConfig): WorkflowExecutor {
  if (!executorInstance) {
    executorInstance = new WorkflowExecutor(config);
  }
  return executorInstance;
}

export function clearWorkflowExecutor(): void {
  executorInstance = null;
}
