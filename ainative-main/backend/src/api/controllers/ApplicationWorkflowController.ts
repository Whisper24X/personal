/**
 * Application Workflow Controller
 * Handles application workflow configuration-related HTTP requests
 */

import { Request, Response } from 'express';
import { WorkflowService } from '../../services/WorkflowService';
import { logger } from '../../utils';
import { WorkflowConfig } from '../../database/repositories/ApplicationWorkflowRepository';

export class ApplicationWorkflowController {
  private static workflowService = new WorkflowService();

  /**
   * Get all workflows for an application
   * GET /api/applications/:applicationId/workflows
   */
  static async getWorkflows(req: Request, res: Response) {
    try {
      const { applicationId } = req.params;

      if (!applicationId) {
        return res.status(400).json({
          success: false,
          error: 'Application ID is required',
        });
      }

      // Validate application exists
      await ApplicationWorkflowController.workflowService.validateApplicationExists(applicationId);

      let workflows = await ApplicationWorkflowController.workflowService.getApplicationWorkflows(applicationId);

      // If no workflows exist, auto-create default workflow
      if (workflows.length === 0) {
        try {
          await ApplicationWorkflowController.workflowService.getOrCreateDefaultWorkflow(applicationId);
          // Re-query workflows after creation
          workflows = await ApplicationWorkflowController.workflowService.getApplicationWorkflows(applicationId);
        } catch (error: any) {
          logger.warn(`ApplicationWorkflowController: Failed to auto-create default workflow for application ${applicationId}:`, error.message);
          // Continue with empty list if creation fails
        }
      }

      return res.json({
        success: true,
        workflows: workflows,
      });
    } catch (error: any) {
      logger.error('ApplicationWorkflowController: Failed to get workflows:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get workflows',
        message: error.message,
      });
    }
  }

  /**
   * Get default workflow for an application
   * GET /api/applications/:applicationId/workflows/default
   */
  static async getDefaultWorkflow(req: Request, res: Response) {
    try {
      const { applicationId } = req.params;

      if (!applicationId) {
        return res.status(400).json({
          success: false,
          error: 'Application ID is required',
        });
      }

      // Validate application exists
      await ApplicationWorkflowController.workflowService.validateApplicationExists(applicationId);

      const workflow = await ApplicationWorkflowController.workflowService.getDefaultWorkflow(applicationId);

      return res.json({
        success: true,
        workflow: workflow,
      });
    } catch (error: any) {
      logger.error('ApplicationWorkflowController: Failed to get default workflow:', error);
      // Return 404 if workflow not found, 500 for other errors
      if (error.message?.includes('No default workflow found')) {
        return res.status(404).json({
          success: false,
          error: 'Default workflow not found',
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to get default workflow',
        message: error.message,
      });
    }
  }

  /**
   * Create a new workflow
   * POST /api/applications/:applicationId/workflows
   */
  static async createWorkflow(req: Request, res: Response) {
    try {
      const { applicationId } = req.params;
      const { name, description, isDefault, workflowConfig } = req.body;

      if (!applicationId) {
        return res.status(400).json({
          success: false,
          error: 'Application ID is required',
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Workflow name is required',
        });
      }

      if (!workflowConfig || !workflowConfig.roles || !Array.isArray(workflowConfig.roles)) {
        return res.status(400).json({
          success: false,
          error: 'Workflow config with roles array is required',
        });
      }

      // Validate application exists
      await ApplicationWorkflowController.workflowService.validateApplicationExists(applicationId);

      // Validate workflow config structure (basic validation)
      for (const role of workflowConfig.roles) {
        if (!role.profile || typeof role.order !== 'number' || !Array.isArray(role.actions)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid workflow config: each role must have profile, order, and actions array',
          });
        }
      }

      // Validate workflow config (full validation including role/action existence)
      await ApplicationWorkflowController.workflowService.validateWorkflowConfig(
        workflowConfig as WorkflowConfig
      );

      const workflow = await ApplicationWorkflowController.workflowService.createWorkflow(applicationId, {
        name,
        description,
        isDefault,
        workflowConfig: workflowConfig as WorkflowConfig,
      });

      return res.status(201).json({
        success: true,
        workflow: workflow,
      });
    } catch (error: any) {
      logger.error('ApplicationWorkflowController: Failed to create workflow:', error);
      // Return 400 for validation errors, 500 for other errors
      if (error.message?.includes('not found') || error.message?.includes('Invalid') || error.message?.includes('must')) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to create workflow',
        message: error.message,
      });
    }
  }

  /**
   * Update workflow
   * PUT /api/applications/:applicationId/workflows/:workflowId
   */
  static async updateWorkflow(req: Request, res: Response) {
    try {
      const { applicationId, workflowId } = req.params;
      const { name, description, isDefault, workflowConfig } = req.body;

      if (!applicationId || !workflowId) {
        return res.status(400).json({
          success: false,
          error: 'Application ID and Workflow ID are required',
        });
      }

      // Validate application exists
      await ApplicationWorkflowController.workflowService.validateApplicationExists(applicationId);

      // Verify workflow belongs to this application
      const existingWorkflow = await ApplicationWorkflowController.workflowService.getWorkflowById(workflowId);
      if (!existingWorkflow) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
        });
      }
      if (existingWorkflow.application_id !== applicationId) {
        return res.status(403).json({
          success: false,
          error: 'Workflow does not belong to this application',
        });
      }

      // Validate workflow config if provided
      if (workflowConfig) {
        if (!workflowConfig.roles || !Array.isArray(workflowConfig.roles)) {
          return res.status(400).json({
            success: false,
            error: 'Workflow config must have roles array',
          });
        }

        // Basic structure validation
        for (const role of workflowConfig.roles) {
          if (!role.profile || typeof role.order !== 'number' || !Array.isArray(role.actions)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid workflow config: each role must have profile, order, and actions array',
            });
          }
        }

        // Full validation including role/action existence
        await ApplicationWorkflowController.workflowService.validateWorkflowConfig(
          workflowConfig as WorkflowConfig
        );
      }

      const workflow = await ApplicationWorkflowController.workflowService.updateWorkflow(workflowId, applicationId, {
        name,
        description,
        isDefault,
        workflowConfig: workflowConfig as WorkflowConfig | undefined,
      });

      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
        });
      }

      return res.json({
        success: true,
        workflow: workflow,
      });
    } catch (error: any) {
      logger.error('ApplicationWorkflowController: Failed to update workflow:', error);
      // Return appropriate status codes based on error type
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
          message: error.message,
        });
      }
      if (error.message?.includes('Invalid') || error.message?.includes('must')) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to update workflow',
        message: error.message,
      });
    }
  }

  /**
   * Delete workflow
   * DELETE /api/applications/:applicationId/workflows/:workflowId
   */
  static async deleteWorkflow(req: Request, res: Response) {
    try {
      const { applicationId, workflowId } = req.params;

      if (!applicationId || !workflowId) {
        return res.status(400).json({
          success: false,
          error: 'Application ID and Workflow ID are required',
        });
      }

      // Validate application exists
      await ApplicationWorkflowController.workflowService.validateApplicationExists(applicationId);

      // Verify workflow belongs to this application and is not default
      const existingWorkflow = await ApplicationWorkflowController.workflowService.getWorkflowById(workflowId);
      if (!existingWorkflow) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
        });
      }
      if (existingWorkflow.application_id !== applicationId) {
        return res.status(403).json({
          success: false,
          error: 'Workflow does not belong to this application',
        });
      }
      if (existingWorkflow.is_default) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete default workflow. Please set another workflow as default first.',
        });
      }

      const deleted = await ApplicationWorkflowController.workflowService.deleteWorkflow(workflowId, applicationId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
        });
      }

      return res.json({
        success: true,
        message: 'Workflow deleted successfully',
      });
    } catch (error: any) {
      logger.error('ApplicationWorkflowController: Failed to delete workflow:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete workflow',
        message: error.message,
      });
    }
  }

  /**
   * Set workflow as default
   * POST /api/applications/:applicationId/workflows/:workflowId/set-default
   */
  static async setDefaultWorkflow(req: Request, res: Response) {
    try {
      const { applicationId, workflowId } = req.params;

      if (!applicationId || !workflowId) {
        return res.status(400).json({
          success: false,
          error: 'Application ID and Workflow ID are required',
        });
      }

      // Validate application exists
      await ApplicationWorkflowController.workflowService.validateApplicationExists(applicationId);

      const success = await ApplicationWorkflowController.workflowService.setDefaultWorkflow(applicationId, workflowId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found or does not belong to the application',
        });
      }

      return res.json({
        success: true,
        message: 'Default workflow set successfully',
      });
    } catch (error: any) {
      logger.error('ApplicationWorkflowController: Failed to set default workflow:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to set default workflow',
        message: error.message,
      });
    }
  }
}
