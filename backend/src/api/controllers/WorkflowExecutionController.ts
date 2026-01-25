/**
 * Workflow Execution Controller
 * HTTP API for workflow execution management
 * Provides unified endpoints for workflow state management
 * 
 * Default workflow configuration is loaded from database with fallback to migration config
 */

import { Request, Response } from 'express';
import {
  WorkflowExecutionService,
  WorkflowRecoveryService,
  WorkflowState,
  WorkflowExecutor,
} from '../../workflow';
import { logger } from '../../utils';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WorkflowService, getDefaultWorkflowConfig } from '../../services/WorkflowService';
import { GitService } from '../../services/GitService';
import { WorkflowConfig } from '../../database/repositories/ApplicationWorkflowRepository';
import { WorkspaceManager } from '../../utils/WorkspaceManager';

// Map to track running executors by projectId
const runningExecutors: Map<string, WorkflowExecutor> = new Map();

export class WorkflowExecutionController {
  private static executionService = new WorkflowExecutionService();
  private static recoveryService = new WorkflowRecoveryService(
    WorkflowExecutionController.executionService
  );
  private static projectRepository = new ProjectRepository();
  private static workflowService = new WorkflowService();
  private static gitService = new GitService();

  /**
   * Get workflow execution state
   * GET /api/workflow/:projectId/state
   */
  static async getState(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const state = await WorkflowExecutionController.executionService.getCurrentState(projectId);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: 'Workflow execution not found',
        });
      }

      return res.json({
        success: true,
        data: state,
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to get state', {
        error: error.message,
        projectId: req.params.projectId,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to get workflow state',
        message: error.message,
      });
    }
  }

  /**
   * Get workflow execution details (full record)
   * GET /api/workflow/:projectId/execution
   */
  static async getExecution(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.getExecution(projectId);

      if (!execution) {
        return res.status(404).json({
          success: false,
          error: 'Workflow execution not found',
        });
      }

      return res.json({
        success: true,
        data: execution,
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to get execution', {
        error: error.message,
        projectId: req.params.projectId,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to get workflow execution',
        message: error.message,
      });
    }
  }

  /**
   * Start workflow execution
   * POST /api/workflow/:projectId/start
   * Body: { currentPosition?: { roleIndex: number, actionIndex: number } }
   * Automatically initializes workflow if not exists
   */
  static async start(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { currentPosition } = req.body;  // Optional: start from specific position

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      // Stop any running executor first (important for reset + start flow)
      WorkflowExecutionController._stopBackgroundExecution(projectId);

      // Check if execution exists, if not, auto-initialize
      let execution = await WorkflowExecutionController.executionService.getExecution(projectId);
      
      if (!execution) {
        logger.info('WorkflowExecutionController: No execution found, auto-initializing', { projectId });
        
        // Get project to find application_id
        const project = await WorkflowExecutionController.projectRepository.findById(projectId);
        if (!project) {
          return res.status(404).json({
            success: false,
            error: 'Project not found',
          });
        }

        // Prepare Git repository if configured
        if (project.git_repo_url && project.application_id) {
          await WorkflowExecutionController.prepareGitRepository(
            project.git_repo_url,
            project.application_id,
            projectId
          );
        }

        // Get workflow config from application or use default
        let workflowConfig: WorkflowConfig = getDefaultWorkflowConfig();
        
        if (project.application_id) {
          try {
            const appWorkflow = await WorkflowExecutionController.workflowService.getOrCreateDefaultWorkflow(project.application_id);
            if (appWorkflow && appWorkflow.workflow_config) {
              workflowConfig = appWorkflow.workflow_config;
              logger.info('WorkflowExecutionController: Using application workflow config', {
                projectId,
                applicationId: project.application_id,
                workflowId: appWorkflow.id,
              });
            }
          } catch (workflowError: any) {
            logger.warn('WorkflowExecutionController: Failed to get application workflow, using default', {
              projectId,
              applicationId: project.application_id,
              error: workflowError.message,
            });
          }
        }

        // Initialize execution
        execution = await WorkflowExecutionController.executionService.initialize(projectId, workflowConfig);
        logger.info('WorkflowExecutionController: Workflow initialized', {
          projectId,
          executionId: execution.id,
        });
      }

      // Now start the workflow (state transition), optionally from a specific position
      execution = await WorkflowExecutionController.executionService.start(projectId, currentPosition);

      logger.info('WorkflowExecutionController: Workflow started', {
        projectId,
        currentPosition: execution.currentPosition,
      });

      // Start execution in background (non-blocking)
      WorkflowExecutionController.startBackgroundExecution(projectId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Workflow started',
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to start workflow', {
        error: error.message,
        projectId: req.params.projectId,
      });

      const statusCode = error.message.includes('Cannot start') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to start workflow',
        message: error.message,
      });
    }
  }

  /**
   * Confirm and proceed to next step
   * POST /api/workflow/:projectId/confirm
   */
  static async confirm(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.confirm(projectId);

      // Continue execution in background after confirmation
      WorkflowExecutionController.startBackgroundExecution(projectId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Confirmation received, workflow continuing',
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to confirm', {
        error: error.message,
        projectId: req.params.projectId,
      });

      const statusCode = error.message.includes('not waiting') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to confirm workflow',
        message: error.message,
      });
    }
  }

  /**
   * Reset workflow to a specific role
   * POST /api/workflow/:projectId/reset
   * Body: { targetRole: string }
   */
  static async reset(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { targetRole } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!targetRole) {
        return res.status(400).json({
          success: false,
          error: 'Target role is required',
        });
      }

      // Stop any running executor first to prevent it from continuing
      WorkflowExecutionController._stopBackgroundExecution(projectId);

      const execution = await WorkflowExecutionController.executionService.reset(projectId, targetRole);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: `Workflow reset to role: ${targetRole}`,
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to reset workflow', {
        error: error.message,
        projectId: req.params.projectId,
        targetRole: req.body.targetRole,
      });

      const statusCode = error.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to reset workflow',
        message: error.message,
      });
    }
  }

  /**
   * Pause workflow execution
   * POST /api/workflow/:projectId/pause
   */
  static async pause(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.pause(projectId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          message: 'Workflow paused',
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to pause workflow', {
        error: error.message,
        projectId: req.params.projectId,
      });

      const statusCode = error.message.includes('Cannot pause') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to pause workflow',
        message: error.message,
      });
    }
  }

  /**
   * Resume workflow execution
   * POST /api/workflow/:projectId/resume
   */
  static async resume(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.resume(projectId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Workflow resumed',
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to resume workflow', {
        error: error.message,
        projectId: req.params.projectId,
      });

      const statusCode = error.message.includes('not paused') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to resume workflow',
        message: error.message,
      });
    }
  }

  /**
   * Retry failed workflow
   * POST /api/workflow/:projectId/retry
   */
  static async retry(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.retry(projectId);

      return res.json({
        success: true,
        data: {
          id: execution.id,
          state: execution.state,
          currentPosition: execution.currentPosition,
          message: 'Workflow retry initiated',
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to retry workflow', {
        error: error.message,
        projectId: req.params.projectId,
      });

      const statusCode = error.message.includes('not failed') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to retry workflow',
        message: error.message,
      });
    }
  }

  /**
   * Recover workflow (for page refresh, service restart, etc.)
   * POST /api/workflow/:projectId/recover
   */
  static async recover(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const result = await WorkflowExecutionController.recoveryService.recover(projectId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to recover workflow', {
        error: error.message,
        projectId: req.params.projectId,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to recover workflow',
        message: error.message,
      });
    }
  }

  /**
   * Get recovery status (check if recovery is needed)
   * GET /api/workflow/:projectId/recovery-status
   */
  static async getRecoveryStatus(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const status = await WorkflowExecutionController.recoveryService.getRecoveryStatus(projectId);

      return res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to get recovery status', {
        error: error.message,
        projectId: req.params.projectId,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to get recovery status',
        message: error.message,
      });
    }
  }

  /**
   * Delete workflow execution
   * DELETE /api/workflow/:projectId
   */
  static async delete(req: Request, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const deleted = await WorkflowExecutionController.executionService.delete(projectId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Workflow execution not found',
        });
      }

      return res.json({
        success: true,
        message: 'Workflow execution deleted',
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to delete workflow', {
        error: error.message,
        projectId: req.params.projectId,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to delete workflow execution',
        message: error.message,
      });
    }
  }

  /**
   * Get all active workflows (for admin/monitoring)
   * GET /api/workflow/active
   */
  static async getActiveWorkflows(_req: Request, res: Response) {
    try {
      const activeStates = [
        WorkflowState.RUNNING,
        WorkflowState.WAITING_CONFIRMATION,
        WorkflowState.PAUSED,
      ];

      const executions = await WorkflowExecutionController.executionService.findByStates(activeStates);

      return res.json({
        success: true,
        data: executions.map(exec => ({
          id: exec.id,
          projectId: exec.projectId,
          state: exec.state,
          currentPosition: exec.currentPosition,
          progress: exec.steps.filter(s => s.state === 'completed').length / exec.steps.length * 100,
          updatedAt: exec.updatedAt,
        })),
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to get active workflows', {
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to get active workflows',
        message: error.message,
      });
    }
  }

  /**
   * Start background execution for a workflow
   * This runs asynchronously and doesn't block the API response
   */
  private static startBackgroundExecution(projectId: string): void {
    // Check if already executing
    if (runningExecutors.has(projectId)) {
      logger.info('WorkflowExecutionController: Executor already running', { projectId });
      return;
    }

    // Create new executor
    const executor = new WorkflowExecutor();
    runningExecutors.set(projectId, executor);

    // Start execution in background
    executor.execute(projectId)
      .then(() => {
        logger.info('WorkflowExecutionController: Background execution completed', { projectId });
      })
      .catch((error: any) => {
        logger.error('WorkflowExecutionController: Background execution failed', {
          projectId,
          error: error.message,
        });
      })
      .finally(() => {
        // Clean up executor reference
        runningExecutors.delete(projectId);
      });
  }

  /**
   * Stop background execution for a workflow (used when pausing/resetting)
   * Note: Prefixed with underscore as it's available for future use
   */
  static _stopBackgroundExecution(projectId: string): void {
    const executor = runningExecutors.get(projectId);
    if (executor) {
      executor.stop();
      runningExecutors.delete(projectId);
      logger.info('WorkflowExecutionController: Background execution stopped', { projectId });
    }
  }

  /**
   * Prepare Git repository for a project
   * - Clone if not exists
   * - Pull main branch if exists
   * - Create project branch
   */
  private static async prepareGitRepository(
    gitRepoUrl: string,
    applicationId: string,
    projectId: string
  ): Promise<void> {
    try {
      // Get workspace path for the project
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId,
        projectId,
      });

      logger.info('WorkflowExecutionController: Preparing Git repository', {
        projectId,
        gitRepoUrl,
        workspacePath,
      });

      // Prepare the repository (clone or pull)
      const prepareResult = await WorkflowExecutionController.gitService.prepareRepository({
        gitRepoUrl,
        workspacePath,
        projectId,
      });

      if (!prepareResult.success) {
        logger.warn('WorkflowExecutionController: Git repository preparation failed', {
          projectId,
          message: prepareResult.message,
        });
        // Don't throw - allow workflow to continue even if Git fails
        return;
      }

      // Create project branch
      const branchResult = await WorkflowExecutionController.gitService.createProjectBranch(
        workspacePath,
        projectId
      );

      if (!branchResult.success) {
        logger.warn('WorkflowExecutionController: Git branch creation failed', {
          projectId,
          message: branchResult.message,
        });
        // Don't throw - allow workflow to continue even if branch creation fails
        return;
      }

      logger.info('WorkflowExecutionController: Git repository prepared successfully', {
        projectId,
        branchName: branchResult.branchName,
      });
    } catch (error: any) {
      // Log error but don't fail the workflow
      logger.error('WorkflowExecutionController: Git preparation error', {
        projectId,
        error: error.message,
      });
    }
  }
}
