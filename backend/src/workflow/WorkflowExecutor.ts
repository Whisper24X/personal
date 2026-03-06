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
import { RoleActionFactory, API_AUTOMATION_ACTIONS } from '../services/RoleActionFactory';
import { Context } from '../core/context/Context';
import { Message } from '../core/message/Message';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { ProjectVersionRepository } from '../database/repositories/ProjectVersionRepository';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { DocumentArchiveService } from '../services/DocumentArchiveService';
import { WorkspaceManager } from '../utils/WorkspaceManager';
import { RoleCompletionService } from './RoleCompletionService';
import { GitCommitOnRoleCompleteHandler } from './handlers/GitCommitOnRoleCompleteHandler';
import { WorkflowStartupService } from './WorkflowStartupService';
import { EnsureWorkspaceHandler } from './handlers/EnsureWorkspaceHandler';
import { actionRelevanceMap } from '../../../config/defaultWorkflowConfig';
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

/**
 * WorkflowExecutor class
 * Manages the execution loop for a workflow
 */
export class WorkflowExecutor {
  private executionService: WorkflowExecutionService;
  private projectRepository: ProjectRepository;
  private versionRepository: ProjectVersionRepository;
  private messageRepository: MessageRepository;
  private roleCompletionService: RoleCompletionService;
  private workflowStartupService: WorkflowStartupService;
  private messageHandler?: WorkflowMessageHandler;
  private isExecuting: boolean = false;
  private shouldStop: boolean = false;
  private abortController?: AbortController;

  constructor(_config?: WorkflowExecutorConfig) {
    this.executionService = new WorkflowExecutionService();
    this.projectRepository = new ProjectRepository();
    this.versionRepository = new ProjectVersionRepository();
    this.messageRepository = new MessageRepository();

    // Initialize role completion service and register handlers
    this.roleCompletionService = new RoleCompletionService();
    this.roleCompletionService.register(new GitCommitOnRoleCompleteHandler());

    // Initialize workflow startup service and register handlers
    this.workflowStartupService = new WorkflowStartupService();
    this.workflowStartupService.register(new EnsureWorkspaceHandler());

    // Config is currently unused but parameter is kept for future use
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
   * Stop the current execution loop and abort any running action
   */
  stop(): void {
    this.shouldStop = true;

    // Abort any running action
    if (this.abortController) {
      this.abortController.abort();
      logger.info('WorkflowExecutor: Aborted running action');
    }

    logger.info('WorkflowExecutor: Stop requested');
  }

  /**
   * Execute workflow from current position
   * This is the main entry point for starting/continuing execution
   */
  async execute(projectId: string, versionId: string): Promise<void> {
    if (this.isExecuting) {
      logger.warn('WorkflowExecutor: Already executing', { projectId, versionId });
      return;
    }

    this.isExecuting = true;
    this.shouldStop = false;
    // Create a new AbortController for this execution
    this.abortController = new AbortController();

    try {
      // Execute workflow startup hooks (e.g., ensure workspace exists)
      await this.executeWorkflowStartupHooks(projectId, versionId);

      await this.executeLoop(projectId, versionId);
    } finally {
      this.isExecuting = false;
      this.abortController = undefined;
    }
  }

  /**
   * Main execution loop
   */
  private async executeLoop(projectId: string, versionId: string): Promise<void> {
    while (!this.shouldStop) {
      // Get current state
      const state = await this.executionService.getCurrentState(projectId, versionId);

      if (!state) {
        logger.error('WorkflowExecutor: Workflow execution not found', { projectId, versionId });
        break;
      }

      // Check if we should continue based on state
      if (state.state === WorkflowState.COMPLETED) {
        logger.info('WorkflowExecutor: Workflow completed', { projectId, versionId });

        // 归档所有文档（工作流完全完成后执行）
        await this.archiveDocumentsOnComplete(projectId, versionId);

        this.sendMessage('completed', { projectId, versionId });
        break;
      }

      if (state.state === WorkflowState.FAILED) {
        logger.info('WorkflowExecutor: Workflow failed', { projectId, versionId });
        this.sendMessage('error', {
          message: state.lastError?.message || 'Workflow execution failed',
          projectId,
          versionId,
        });
        break;
      }

      if (state.state === WorkflowState.WAITING_CONFIRMATION) {
        logger.info('WorkflowExecutor: Waiting for confirmation', { projectId, versionId });
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
        logger.info('WorkflowExecutor: Workflow paused', { projectId, versionId });
        break;
      }

      if (state.state !== WorkflowState.RUNNING) {
        logger.warn('WorkflowExecutor: Unexpected state', {
          projectId,
          versionId,
          state: state.state,
        });
        break;
      }

      // Get current step to execute
      const { currentRole, currentAction } = state;

      if (!currentRole || !currentAction) {
        logger.error('WorkflowExecutor: No current step to execute', { projectId, versionId });
        break;
      }

      // Execute the current step
      logger.info('WorkflowExecutor: Executing step', {
        projectId,
        versionId,
        role: currentRole,
        action: currentAction,
      });

      this.sendMessage('role_start', {
        role: currentRole,
        action: currentAction,
      });

      try {
        await this.executeStep(projectId, versionId, currentRole, currentAction);
      } catch (error: any) {
        // Check if this was a cancellation
        const isCancelled = error.message?.includes('cancelled') || error.message?.includes('was cancelled') || this.shouldStop;

        if (isCancelled) {
          logger.info('WorkflowExecutor: Step execution cancelled', {
            projectId,
            role: currentRole,
            action: currentAction,
          });
          // Don't mark as failed, just exit the loop
          break;
        }

        logger.error('WorkflowExecutor: Step execution error', {
          projectId,
          versionId,
          role: currentRole,
          action: currentAction,
          error: error.message,
        });

        // Step failure is already handled by onStepFail
        // Check if we should retry
        const newState = await this.executionService.getCurrentState(projectId, versionId);
        if (newState?.state === WorkflowState.FAILED) {
          this.sendMessage('error', {
            message: error.message,
            projectId,
            versionId,
          });
          break;
        }
        // If not failed, loop will continue and retry
      }
    }

    logger.info('WorkflowExecutor: Execution loop ended', { projectId, versionId });
  }

  /**
   * Execute workflow startup hooks before workflow execution begins
   * This handles operations like ensuring workspace exists
   */
  private async executeWorkflowStartupHooks(projectId: string, versionId: string): Promise<void> {
    try {
      // Get project and version info for context
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        logger.warn('WorkflowExecutor: Project not found for startup hooks', { projectId });
        return;
      }

      const version = await this.versionRepository.findById(versionId);
      if (!version) {
        logger.warn('WorkflowExecutor: Version not found for startup hooks', { versionId });
        return;
      }

      // Get workspace path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId,
        versionId,
      });

      // Execute startup handlers
      await this.workflowStartupService.onWorkflowStart({
        projectId,
        versionId,
        project,
        version,
        workspacePath,
      });
    } catch (error: any) {
      // Startup hooks failure shouldn't stop workflow execution
      logger.error('WorkflowExecutor: Workflow startup hooks failed', {
        projectId,
        versionId,
        error: error.message,
      });
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(projectId: string, versionId: string, role: string, action: string): Promise<void> {
    // Mark step as started
    await this.executionService.onStepStart(projectId, versionId, role, action);

    // Get project info for context
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Get version info for idea
    const version = await this.versionRepository.findById(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Create context
    const context = new Context(undefined, project.budget || 10.0);
    context.set('projectId', projectId);
    context.set('versionId', versionId); // Add versionId to context
    if (project.application_id) {
      context.set('applicationId', project.application_id);
    }
    if (project.user_id) {
      context.set('userId', project.user_id);
    }

    // Get workflow config for role actions
    const execution = await this.executionService.getExecution(projectId, versionId);
    if (!execution) {
      throw new Error(`Workflow execution not found: ${projectId} version ${versionId}`);
    }

    // Find role config in workflow snapshot
    const roleConfig = execution.workflowSnapshot.roles.find((r) => r.profile === role);
    if (!roleConfig) {
      throw new Error(`Role not found in workflow config: ${role}`);
    }

    // Create role instance with configured actions
    const roleInstance = RoleActionFactory.createRoleFromDefinition(role, context, roleConfig.name, roleConfig.actions, roleConfig.watch_actions);

    // Wait for LLM config to load
    if ((roleInstance as any)['llmLoadPromise']) {
      await (roleInstance as any)['llmLoadPromise'];
    }

    // Find the target action
    const targetAction = roleInstance.actions.find((a) => a.name === action);
    if (!targetAction) {
      // 接口自动化被 env 关闭时，RoleActionFactory 会过滤掉这两个 action，步骤视为跳过并标记完成
      if (API_AUTOMATION_ACTIONS.includes(action) && process.env.ENABLE_API_AUTOMATION !== 'true') {
        logger.info('WorkflowExecutor: Skipping step (ENABLE_API_AUTOMATION is not true)', { role, action });
        await this.executionService.onStepComplete(projectId, versionId, role, action, {
          content: '[Skipped] ENABLE_API_AUTOMATION is not true',
          outputFiles: [],
        });
        return;
      }
      throw new Error(`Action not found: ${action}`);
    }

    // Set abort signal on the target action for cancellation support
    if (this.abortController) {
      targetAction.setAbortSignal(this.abortController.signal);
    }

    // Load relevant messages from project history (with version isolation and deduplication)
    await this.loadRelevantMessages(projectId, versionId, roleInstance, action);

    // For the first action in the workflow (order 0, action index 0), add user idea as initial input
    // This is more flexible than hardcoding 'WriteMRD' - it works regardless of which action is first
    // Reuse execution variable already declared above
    if (execution && execution.workflowSnapshot) {
      const sortedRoles = [...execution.workflowSnapshot.roles].sort((a, b) => a.order - b.order);
      const firstRole = sortedRoles[0];
      const isFirstAction = firstRole && firstRole.profile === role && firstRole.actions && firstRole.actions[0] === action;

      if (isFirstAction && version.idea) {
        const userMessage = new Message({
          content: version.idea,
          role: 'User',
          causeBy: 'UserInput',
          sentFrom: 'User',
        });
        roleInstance['rc'].memory.add(userMessage);
        roleInstance.putMessage(userMessage);
        logger.info('WorkflowExecutor: Added user idea as initial message for first action', {
          projectId,
          versionId,
          role,
          action,
          ideaLength: version.idea.length,
        });
      }
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

    // Save message to project history (with versionId for isolation)
    await this.messageRepository.save(projectId, result, undefined, versionId);
    logger.info('WorkflowExecutor: Saved message to history', {
      projectId,
      versionId,
      messageId: result.id,
    });

    // Create step output
    const output: StepOutput = {
      content: result.content,
      outputFiles: result.instructContent?.outputFiles || [],
      instructContent: result.instructContent,
    };

    // Mark step as completed
    const { needsConfirmation, isCompleted } = await this.executionService.onStepComplete(projectId, versionId, role, action, output);

    logger.info('WorkflowExecutor: Step completed', {
      projectId,
      versionId,
      role,
      action,
      needsConfirmation,
      isCompleted,
    });
  }

  /**
   * Handle role confirmation - called after user confirms a role completion
   * This triggers role completion handlers (e.g., git commit)
   * @param projectId - Project ID
   * @param versionId - Version ID
   * @param role - Role that was confirmed
   * @param action - Action that was confirmed
   */
  async onRoleConfirmed(projectId: string, versionId: string, role: string, action: string): Promise<void> {
    try {
      // Get project info
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        logger.warn('WorkflowExecutor: Project not found for role confirmation', { projectId });
        return;
      }

      // Get version info
      const version = await this.versionRepository.findById(versionId);
      if (!version) {
        logger.warn('WorkflowExecutor: Version not found for role confirmation', { versionId });
        return;
      }

      // Get workspace path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId,
        versionId,
      });

      // Execute role completion handlers
      await this.roleCompletionService.onRoleComplete({
        projectId,
        versionId,
        role,
        action,
        project,
        version,
        workspacePath,
      });
    } catch (error: any) {
      // Role completion handlers failure shouldn't stop confirmation process
      logger.error('WorkflowExecutor: Role confirmation handler failed', {
        projectId,
        versionId,
        role,
        action,
        error: error.message,
      });
    }
  }

  /**
   * Load relevant messages from project history
   * Uses version isolation and role_profile + cause_by deduplication to prevent duplicate messages
   *
   * @param projectId - Project ID
   * @param versionId - Version ID for isolation
   * @param role - Role instance to load messages into
   * @param actionName - Action name to determine relevant message types
   */
  private async loadRelevantMessages(projectId: string, versionId: string, role: any, actionName: string): Promise<void> {
    try {
      // Use findByVersionWithDedup for version isolation and deduplication
      // This ensures only one message per role_profile + cause_by combination is loaded
      const messages = await this.messageRepository.findByVersionWithDedup(projectId, versionId);

      if (messages.length === 0) {
        logger.info('WorkflowExecutor: No messages in project history', { projectId, versionId });
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

      logger.info('WorkflowExecutor: Loaded messages from history (deduplicated)', {
        projectId,
        versionId,
        loadedCount,
        totalMessages: messages.length,
        relevantTypes,
      });
    } catch (error: any) {
      logger.warn('WorkflowExecutor: Failed to load messages', {
        projectId,
        versionId,
        error: error.message,
      });
    }
  }

  /**
   * Get relevant message types for an action
   * Uses centralized configuration from defaultWorkflowConfig.ts
   */
  private getRelevantMessageTypes(actionName: string): string[] {
    // Use centralized actionRelevanceMap from defaultWorkflowConfig.ts
    // This ensures consistency across the codebase and automatic updates when config changes
    const relevantTypes = actionRelevanceMap[actionName] || [];

    // Handle special case: 'User' should be mapped to 'UserInput' for consistency
    // Some actions may reference 'User' in watch_actions, but messages use 'UserInput' as causeBy
    return relevantTypes.map((type) => (type === 'User' ? 'UserInput' : type));
  }

  /**
   * 归档所有文档（工作流完全完成后执行）
   * 将 docs/ 中的 MRD、PRD、Design 文档归档到 docs-archive/
   */
  private async archiveDocumentsOnComplete(projectId: string, versionId: string): Promise<void> {
    try {
      // 获取项目信息
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        logger.warn('WorkflowExecutor: Project not found for archiving', { projectId, versionId });
        return;
      }

      // 获取版本化的 ainative-workspace 路径
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
        versionId: versionId,
      });

      // 执行归档
      const archiveService = new DocumentArchiveService();
      const results = await archiveService.archiveAllDocuments(workspacePath);

      if (results.length > 0) {
        logger.info('WorkflowExecutor: Documents archived on workflow completion', {
          projectId,
          versionId,
          archivedCount: results.length,
          docTypes: results.map((r) => r.docType),
          versions: results.map((r) => r.versionDir),
        });

        // 发送归档完成消息
        this.sendMessage('documents_archived', {
          projectId,
          versionId,
          archives: results.map((r) => ({
            docType: r.docType,
            version: r.versionDir,
            fileCount: r.files.length,
          })),
        });
      } else {
        logger.info('WorkflowExecutor: No documents to archive', { projectId, versionId });
      }
    } catch (error: any) {
      // 归档失败不应该影响工作流完成状态
      logger.error('WorkflowExecutor: Failed to archive documents', {
        projectId,
        versionId,
        error: error.message,
      });
    }
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
