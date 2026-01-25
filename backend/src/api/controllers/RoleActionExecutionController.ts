/**
 * Role Action Execution Controller
 * Handles standalone execution of role actions without workflow
 */

import { Request, Response } from 'express';
import { Context } from '../../core/context/Context';
import { Message } from '../../core/message/Message';
import { logger } from '../../utils';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { MessageRepository } from '../../database/repositories/MessageRepository';
import { RoleActionFactory } from '../../services/RoleActionFactory';

export class RoleActionExecutionController {
  /**
   * Execute a role action independently
   * POST /api/projects/:projectId/roles/:roleProfile/actions/:actionName/execute
   */
  static async execute(req: Request, res: Response) {
    const startTime = Date.now();
    const { projectId, roleProfile, actionName } = req.params;
    const { input, workspaceOptions, contextMessages } = req.body;

    try {
      // Step 1: Validate project existence
      const projectRepo = new ProjectRepository();
      const project = await projectRepo.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          message: `Project with ID ${projectId} does not exist`,
        });
      }

      logger.info(`RoleActionExecutionController: Executing ${actionName} for role ${roleProfile} in project ${projectId}`);

      // Step 2: Validate role and action
      const availableRoleProfiles = RoleActionFactory.getAvailableRoleProfiles();
      if (!availableRoleProfiles.includes(roleProfile)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role profile',
          message: `Role profile '${roleProfile}' is not valid. Available roles: ${availableRoleProfiles.join(', ')}`,
        });
      }

      // Step 3: Create context with project configuration
      const context = new Context(undefined, project.budget || 10.0);
      context.set('projectId', projectId);
      if (project.application_id) {
        context.set('applicationId', project.application_id);
      }
      if (project.user_id) {
        context.set('userId', project.user_id);
      }

      // Step 4: Create role instance
      const role = RoleActionFactory.createRoleFromDefinition(roleProfile, context);

      // Wait for LLM config to load (if applicable)
      if (role['llmLoadPromise']) {
        await role['llmLoadPromise'];
      }

      // Step 5: Validate action exists for this role
      const targetAction = role.actions.find(a => a.name === actionName);
      if (!targetAction) {
        const availableActions = role.actions.map(a => a.name).join(', ');
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
          message: `Action '${actionName}' is not available for role '${roleProfile}'. Available actions: ${availableActions}`,
        });
      }

      // Step 6: Prepare context messages
      if (contextMessages && Array.isArray(contextMessages)) {
        // Add context messages to role memory
        for (const msgData of contextMessages) {
          const message = new Message({
            content: msgData.content,
            role: msgData.role || roleProfile,
            causeBy: msgData.causeBy || actionName,
            sentFrom: msgData.role || roleProfile,
          });
          role['rc'].memory.add(message);
        }
        logger.info(`RoleActionExecutionController: Added ${contextMessages.length} context messages to role memory`);
      } else {
        // If no context messages provided, try to load relevant messages from project history
        await RoleActionExecutionController.loadRelevantMessagesFromHistory(
          projectId,
          role,
          actionName
        );
      }

      // Step 7: Handle custom input
      if (input && typeof input === 'string') {
        // Create a generic message with the input
        const inputMessage = new Message({
          content: input,
          role: 'User',
          causeBy: 'UserInput',
          sentFrom: 'User',
        });
        role['rc'].memory.add(inputMessage);
        logger.info(`RoleActionExecutionController: Added custom input to role memory (length: ${input.length})`);
      }

      // Step 8: Set workspace options if provided
      if (workspaceOptions) {
        // Mock workspace options extractor
        role['workspaceExtractor'].extractWorkspaceOptions = () => workspaceOptions;
        logger.info(`RoleActionExecutionController: Set workspace options:`, workspaceOptions);
      }

      // Step 9: Set action as todo
      role['rc'].todo = targetAction;

      // Step 10: Execute action (timeout handled by individual actions)
      logger.info(`RoleActionExecutionController: Starting action execution for ${actionName}`);
      const message = await role.act();

      if (!message) {
        return res.status(500).json({
          success: false,
          error: 'Action execution failed',
          message: `Action ${actionName} did not produce any output`,
        });
      }

      // Step 11: Save message to project history
      const messageRepo = new MessageRepository();
      await messageRepo.save(projectId, message);
      logger.info(`RoleActionExecutionController: Saved message ${message.id} to project ${projectId}`);

      // Step 12: Return execution result
      const executionTime = Date.now() - startTime;
      logger.info(`RoleActionExecutionController: Action ${actionName} completed successfully in ${executionTime}ms`);

      return res.json({
        success: true,
        message: {
          id: message.id,
          role: message.role,
          content: message.content,
          causeBy: message.causeBy,
          instructContent: message.instructContent,
        },
        executionTime,
      });

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error(`RoleActionExecutionController: Error executing ${actionName} for role ${roleProfile}`, {
        error: error.message,
        stack: error.stack,
        projectId,
        executionTime,
      });

      // Check if timeout error
      if (error.message?.includes('timeout')) {
        return res.status(504).json({
          success: false,
          error: 'Action execution timeout',
          message: error.message,
          executionTime,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Action execution failed',
        message: error.message,
        executionTime,
      });
    }
  }

  /**
   * Load relevant messages from project history based on action requirements
   */
  private static async loadRelevantMessagesFromHistory(
    projectId: string,
    role: any,
    actionName: string
  ): Promise<void> {
    try {
      const messageRepo = new MessageRepository();
      const messages = await messageRepo.findByProjectId(projectId);

      if (messages.length === 0) {
        logger.info(`RoleActionExecutionController: No messages found in project history for project ${projectId}`);
        return;
      }

      // Determine which message types are relevant for this action
      const relevantMessageTypes = RoleActionExecutionController.getRelevantMessageTypes(actionName);

      if (relevantMessageTypes.length === 0) {
        logger.info(`RoleActionExecutionController: No relevant message types defined for action ${actionName}, loading all messages`);
        // Load all messages if no specific requirements
        for (const dbMessage of messages) {
          const message = new Message({
            content: dbMessage.content,
            role: dbMessage.role,
            causeBy: dbMessage.cause_by,
            sentFrom: dbMessage.sent_from,
          });
          role['rc'].memory.add(message);
        }
        logger.info(`RoleActionExecutionController: Loaded ${messages.length} messages from project history`);
        return;
      }

      // Load only relevant messages
      let loadedCount = 0;
      for (const dbMessage of messages) {
        if (relevantMessageTypes.includes(dbMessage.cause_by)) {
          const message = new Message({
            content: dbMessage.content,
            role: dbMessage.role,
            causeBy: dbMessage.cause_by,
            sentFrom: dbMessage.sent_from,
          });
          role['rc'].memory.add(message);
          loadedCount++;
        }
      }

      logger.info(`RoleActionExecutionController: Loaded ${loadedCount} relevant messages from project history for action ${actionName}`);
    } catch (error: any) {
      logger.warn(`RoleActionExecutionController: Failed to load messages from project history`, {
        error: error.message,
        projectId,
        actionName,
      });
      // Don't fail the execution, just log the warning
    }
  }

  /**
   * Get relevant message types (causeBy) for a specific action
   */
  private static getRelevantMessageTypes(actionName: string): string[] {
    // Define which message types are relevant for each action
    const relevanceMap: Record<string, string[]> = {
      // Product Manager actions
      WritePRD: ['WriteMRD', 'UserInput'],
      PRDReview: ['WritePRD'],
      ImprovePRD: ['WritePRD', 'PRDReview'],
      SearchEnhancedQA: ['WritePRD', 'UserInput'],

      // Architect actions
      WriteDesign: ['WritePRD'],
      DesignReview: ['WriteDesign'],
      ImproveDesign: ['WriteDesign', 'DesignReview'],

      // Project Manager actions
      BreakdownTasks: ['WritePRD', 'WriteDesign'],
      WriteSubProjectDesign: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
      SubProjectDesignReview: ['WriteSubProjectDesign'],

      // Engineer actions
      WriteCode: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
      ExecuteSubtask: ['WritePRD', 'WriteDesign', 'BreakdownTasks', 'WriteSubProjectDesign'],
      RunCode: ['WriteCode'],
      FixBug: ['WriteCode', 'WriteTest'],

      // QA Engineer actions
      WriteTest: ['WritePRD', 'WriteCode'],
      WriteTestPlan: ['WritePRD', 'WriteCode'],
      TestabilityReview: ['WritePRD', 'WriteDesign'],
      TestCaseReview: ['WriteTest', 'WriteTestPlan'],
      TestReview: ['WriteTest'],
      ImproveTest: ['WriteTest', 'TestReview'],
      AutomationPlanning: ['WriteTest', 'WriteTestPlan'],
      AutomationExecution: ['WriteTest', 'AutomationPlanning'],
      CoverageQualityCheck: ['WriteTest', 'AutomationExecution'],
      QAConclusion: ['WriteTest', 'CoverageQualityCheck'],

      // Salesperson actions
      WriteMRD: ['UserInput'],
      MRDReview: ['WriteMRD'],
      ImproveMRD: ['WriteMRD', 'MRDReview'],

      // Team Leader actions
      Coordinate: [], // Will load all messages

      // Data Analyst actions
      DataAnalysis: ['UserInput'],
    };

    return relevanceMap[actionName] || [];
  }
}
