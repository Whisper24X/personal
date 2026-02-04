/**
 * Workflow Execution Controller
 * HTTP API for workflow execution management
 * Provides unified endpoints for workflow state management
 *
 * Default workflow configuration is loaded from database with fallback to migration config
 */

import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { WorkflowExecutionService, WorkflowRecoveryService, WorkflowState, WorkflowExecutor } from '../../workflow';
import { logger, WorkspaceManager } from '../../utils';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { MessageRepository } from '../../database/repositories/MessageRepository';
import { WorkflowService, getDefaultWorkflowConfig } from '../../services/WorkflowService';
import { WorkflowConfig } from '../../database/repositories/ApplicationWorkflowRepository';
import { CLIExecutor } from '../../executors/CLIExecutor';
import { Message } from '../../core/message/Message';

// Map to track running executors by projectId:versionId
const runningExecutors: Map<string, WorkflowExecutor> = new Map();

/**
 * Get executor key from projectId and versionId
 */
function getExecutorKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}

export class WorkflowExecutionController {
  private static executionService = new WorkflowExecutionService();
  private static recoveryService = new WorkflowRecoveryService(WorkflowExecutionController.executionService);
  private static projectRepository = new ProjectRepository();
  private static workflowService = new WorkflowService();
  private static messageRepository = new MessageRepository();

  /**
   * Get workflow execution state
   * GET /api/workflow/:projectId/state
   * Query: versionId (required)
   */
  static async getState(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const state = await WorkflowExecutionController.executionService.getCurrentState(projectId, versionId);

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
        versionId: req.query.versionId,
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
   * Query: versionId (required)
   */
  static async getExecution(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);

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
        versionId: req.query.versionId,
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
   * Body: { versionId: string, currentPosition?: { roleIndex: number, actionIndex: number } }
   * Automatically initializes workflow if not exists
   */
  static async start(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId, currentPosition } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      // Stop any running executor first (important for reset + start flow)
      WorkflowExecutionController._stopBackgroundExecution(projectId, versionId);

      // Check if execution exists, if not, auto-initialize
      let execution = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);

      if (!execution) {
        logger.info('WorkflowExecutionController: No execution found, auto-initializing', { projectId, versionId });

        // Get project to find application_id
        const project = await WorkflowExecutionController.projectRepository.findById(projectId);
        if (!project) {
          return res.status(404).json({
            success: false,
            error: 'Project not found',
          });
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
                versionId,
                applicationId: project.application_id,
                workflowId: appWorkflow.id,
              });
            }
          } catch (workflowError: any) {
            logger.warn('WorkflowExecutionController: Failed to get application workflow, using default', {
              projectId,
              versionId,
              applicationId: project.application_id,
              error: workflowError.message,
            });
          }
        }

        // Initialize execution
        execution = await WorkflowExecutionController.executionService.initialize(projectId, versionId, workflowConfig);
        logger.info('WorkflowExecutionController: Workflow initialized', {
          projectId,
          versionId,
          executionId: execution.id,
        });
      }

      // Now start the workflow (state transition), optionally from a specific position
      execution = await WorkflowExecutionController.executionService.start(projectId, versionId, currentPosition);

      logger.info('WorkflowExecutionController: Workflow started', {
        projectId,
        versionId,
        currentPosition: execution.currentPosition,
      });

      // Start execution in background (non-blocking)
      WorkflowExecutionController.startBackgroundExecution(projectId, versionId);

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
        versionId: req.body.versionId,
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
   * Body: { versionId: string }
   */
  static async confirm(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      // Get execution before confirm to preserve pendingConfirmation info
      // (confirm() will clear pendingConfirmation)
      const execBeforeConfirm = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);
      const confirmedRole = execBeforeConfirm?.pendingConfirmation?.role;
      const confirmedAction = execBeforeConfirm?.pendingConfirmation?.action;

      // Confirm the workflow
      const execution = await WorkflowExecutionController.executionService.confirm(projectId, versionId);

      // If a role was confirmed, trigger role completion handlers (e.g., git commit)
      if (confirmedRole && confirmedAction) {
        const executor = new WorkflowExecutor();
        try {
          await executor.onRoleConfirmed(projectId, versionId, confirmedRole, confirmedAction);
        } catch (error: any) {
          // Git commit failure shouldn't prevent confirmation process
          logger.error('WorkflowExecutionController: Role confirmation handler failed', {
            projectId,
            versionId,
            role: confirmedRole,
            action: confirmedAction,
            error: error.message,
          });
        }
      }

      // Continue execution in background after confirmation
      WorkflowExecutionController.startBackgroundExecution(projectId, versionId);

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
        versionId: req.body.versionId,
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
   * CLI edit pending confirmation content
   * POST /api/workflow/:projectId/pending-confirmation/cli-edit
   * Body: { versionId: string, message: string }
   */
  static async cliEditPendingConfirmation(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId, message, scope } = req.body;

      if (!projectId) {
        return res.status(400).json({ success: false, error: 'Project ID is required' });
      }
      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({ success: false, error: 'Version ID is required' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const execution = await WorkflowExecutionController.executionService.getExecution(projectId, versionId);
      if (!execution) {
        return res.status(404).json({ success: false, error: 'Workflow execution not found' });
      }

      const editScope: 'pending' | 'last_completed' = scope === 'last_completed' ? 'last_completed' : 'pending';

      let role: string | undefined;
      let action: string | undefined;

      if (editScope === 'pending') {
        if (execution.state !== WorkflowState.WAITING_CONFIRMATION || !execution.pendingConfirmation) {
          return res.status(400).json({
            success: false,
            error: 'Workflow is not waiting for confirmation',
          });
        }
        role = execution.pendingConfirmation.role;
        action = execution.pendingConfirmation.action;
      } else {
        const lastCompleted = WorkflowExecutionController._getLastCompletedStep(execution);
        if (!lastCompleted) {
          return res.status(400).json({
            success: false,
            error: '未找到已完成的步骤，无法修改',
          });
        }
        role = lastCompleted.role;
        action = lastCompleted.action;
      }

      const targetFiles = WorkflowExecutionController._getTargetFilesForRole(execution, role);
      if (targetFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: `当前角色无可通过 CLI 修改的产物: ${role}`,
        });
      }

      const project = await WorkflowExecutionController.projectRepository.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const applicationId = project.application_id || project.id;
      const workspaceDir = WorkspaceManager.getProjectWorkspacePath({
        applicationId,
        projectId,
        versionId,
      });
      const targetFilePaths = targetFiles.map((file) => path.join(workspaceDir, file.relativePath));
      const prompt = [
        '你需要根据用户要求修改以下文件内容：',
        ...targetFilePaths,
        `修改要求：${message}`,
        '要求：只修改以上文件，保持其它内容不变。',
      ].join('\n');

      const executor = new CLIExecutor();
      const cliOutput = await executor.execute(prompt, { workDir: workspaceDir });
      logger.info('WorkflowExecutionController: CLI execution output', {
        projectId,
        versionId,
        outputPreview: cliOutput.substring(0, 500),
      });

      const updatedFiles: Array<{ action: string; content: string; path: string }> = [];
      for (const file of targetFiles) {
        const filePath = path.join(workspaceDir, file.relativePath);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          updatedFiles.push({ action: file.action, content, path: filePath });
        } catch (readError: any) {
          logger.warn('WorkflowExecutionController: Failed to read updated file', {
            projectId,
            versionId,
            filePath,
            error: readError.message,
          });
        }
      }

      const currentActionFile = updatedFiles.find((file) => file.action === action);
      const displayContent = currentActionFile?.content || updatedFiles[0]?.content || '';

      if (displayContent && editScope === 'pending') {
        await WorkflowExecutionController.executionService.updatePendingConfirmationContent(projectId, versionId, displayContent);
      }

      for (const file of updatedFiles) {
        const msg = new Message({
          content: file.content,
          role: role || 'assistant',
          causeBy: file.action,
          sentFrom: role || 'assistant',
        });
        await WorkflowExecutionController.messageRepository.save(projectId, msg, role || undefined, versionId);
      }

      return res.json({
        success: true,
        data: {
          content: displayContent,
          updatedFiles: updatedFiles.map((file) => ({
            action: file.action,
            path: file.path,
          })),
          cliOutput,
        },
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: CLI edit failed', {
        error: error.message,
        projectId: req.params.projectId,
        versionId: req.body?.versionId,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to edit pending confirmation via CLI',
        message: error.message,
      });
    }
  }

  /**
   * Map action to target file path
   */
  private static _getTargetFilePath(action: string): string | null {
    const map: Record<string, string> = {
      WriteMRD: path.join('docs', 'mrd', 'MRD.md'),
      MRDReview: path.join('docs', 'mrd', 'MRD_REVIEW.md'),
      ImproveMRD: path.join('docs', 'mrd', 'MRD.md'),
      WritePRD: path.join('docs', 'prd', 'PRD.md'),
      PRDReview: path.join('docs', 'prd', 'PRD_REVIEW.md'),
      ImprovePRD: path.join('docs', 'prd', 'PRD.md'),
      GeneratePrototype: path.join('docs', 'prototype', 'index.html'),
      WriteDesign: path.join('docs', 'design', 'DESIGN.md'),
      DesignReview: path.join('docs', 'design', 'DESIGN_REVIEW.md'),
      ImproveDesign: path.join('docs', 'design', 'DESIGN.md'),
      WriteTestPlan: path.join('docs', 'test', 'TEST_PLAN.md'),
      WriteTest: path.join('docs', 'test', 'TEST.md'),
      TestReview: path.join('docs', 'test', 'TEST_REVIEW.md'),
      ImproveTest: path.join('docs', 'test', 'TEST.md'),
    };
    return map[action] || null;
  }

  private static _getTargetFilesForRole(
    execution: { workflowSnapshot?: { roles?: Array<{ profile: string; actions: string[] }> } },
    role?: string
  ): Array<{ action: string; relativePath: string }> {
    if (!role || !execution.workflowSnapshot?.roles) {
      return [];
    }
    const roleConfig = execution.workflowSnapshot.roles.find((r) => r.profile === role);
    if (!roleConfig || !roleConfig.actions) {
      return [];
    }
    const files: Array<{ action: string; relativePath: string }> = [];
    for (const actionName of roleConfig.actions) {
      const relativePath = WorkflowExecutionController._getTargetFilePath(actionName);
      if (relativePath) {
        files.push({ action: actionName, relativePath });
      }
    }
    return files;
  }

  private static _getLastCompletedStep(execution: {
    steps?: Array<{ role: string; action: string; state: string; completedAt?: string }>;
  }): { role: string; action: string } | null {
    if (!execution.steps || execution.steps.length === 0) {
      return null;
    }
    const completed = execution.steps.filter((step) => step.state === 'completed');
    if (completed.length === 0) return null;
    completed.sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });
    return { role: completed[0].role, action: completed[0].action };
  }

  /**
   * Reset workflow to a specific role
   * POST /api/workflow/:projectId/reset
   * Body: { versionId: string, targetRole: string }
   */
  static async reset(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId, targetRole } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      if (!targetRole) {
        return res.status(400).json({
          success: false,
          error: 'Target role is required',
        });
      }

      // Stop any running executor first to prevent it from continuing
      WorkflowExecutionController._stopBackgroundExecution(projectId, versionId);

      const execution = await WorkflowExecutionController.executionService.reset(projectId, versionId, targetRole);

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
        versionId: req.body.versionId,
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
   * Body: { versionId: string }
   */
  static async pause(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.pause(projectId, versionId);

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
        versionId: req.body.versionId,
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
   * Body: { versionId: string }
   */
  static async resume(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.resume(projectId, versionId);

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
        versionId: req.body.versionId,
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
   * Body: { versionId: string }
   */
  static async retry(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const execution = await WorkflowExecutionController.executionService.retry(projectId, versionId);

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
        versionId: req.body.versionId,
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
   * Body: { versionId: string }
   */
  static async recover(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const result = await WorkflowExecutionController.recoveryService.recover(projectId, versionId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to recover workflow', {
        error: error.message,
        projectId: req.params.projectId,
        versionId: req.body.versionId,
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
   * Query: versionId (required)
   */
  static async getRecoveryStatus(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const status = await WorkflowExecutionController.recoveryService.getRecoveryStatus(projectId, versionId);

      return res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('WorkflowExecutionController: Failed to get recovery status', {
        error: error.message,
        projectId: req.params.projectId,
        versionId: req.query.versionId,
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
   * Query: versionId (required)
   */
  static async delete(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { versionId } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      if (!versionId || typeof versionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Version ID is required',
        });
      }

      const deleted = await WorkflowExecutionController.executionService.delete(projectId, versionId);

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
        versionId: req.query.versionId,
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
      const activeStates = [WorkflowState.RUNNING, WorkflowState.WAITING_CONFIRMATION, WorkflowState.PAUSED];

      const executions = await WorkflowExecutionController.executionService.findByStates(activeStates);

      return res.json({
        success: true,
        data: executions.map((exec) => ({
          id: exec.id,
          projectId: exec.projectId,
          state: exec.state,
          currentPosition: exec.currentPosition,
          progress: (exec.steps.filter((s) => s.state === 'completed').length / exec.steps.length) * 100,
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
  private static startBackgroundExecution(projectId: string, versionId: string): void {
    const key = getExecutorKey(projectId, versionId);

    // Check if already executing
    if (runningExecutors.has(key)) {
      logger.info('WorkflowExecutionController: Executor already running', { projectId, versionId });
      return;
    }

    // Create new executor
    const executor = new WorkflowExecutor();
    runningExecutors.set(key, executor);

    // Start execution in background
    executor
      .execute(projectId, versionId)
      .then(() => {
        logger.info('WorkflowExecutionController: Background execution completed', { projectId, versionId });
      })
      .catch((error: any) => {
        logger.error('WorkflowExecutionController: Background execution failed', {
          projectId,
          versionId,
          error: error.message,
        });
      })
      .finally(() => {
        // Clean up executor reference
        runningExecutors.delete(key);
      });
  }

  /**
   * Stop background execution for a workflow (used when pausing/resetting)
   * Note: Prefixed with underscore as it's available for future use
   */
  static _stopBackgroundExecution(projectId: string, versionId: string): void {
    const key = getExecutorKey(projectId, versionId);
    const executor = runningExecutors.get(key);
    if (executor) {
      executor.stop();
      runningExecutors.delete(key);
      logger.info('WorkflowExecutionController: Background execution stopped', { projectId, versionId });
    }
  }
}
