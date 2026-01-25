/**
 * Application Controller
 * Handles application-related HTTP requests
 */

import { Request, Response } from 'express';
import { ApplicationRepository } from '../../database/repositories/ApplicationRepository';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { WorkflowService } from '../../services/WorkflowService';
import { logger } from '../../utils';

const applicationRepo = new ApplicationRepository();
const projectRepo = new ProjectRepository();
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export class ApplicationController {
  /**
   * Create a new application
   * POST /api/applications
   */
  static async create(req: Request, res: Response) {
    try {
      const { name, description, metadata } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid name field',
        });
      }

      // For MVP, use default user ID (in real app, get from auth token)
      const userId = (req as any).userId || DEFAULT_USER_ID; // From auth middleware

      const application = await applicationRepo.create({
        userId,
        name,
        description,
        metadata,
      });

      logger.info(`ApplicationController: Application created`, {
        applicationId: application.id,
        name: application.name,
      });

      // Auto-create default workflow for the application
      try {
        const workflowService = new WorkflowService();
        await workflowService.getOrCreateDefaultWorkflow(application.id);
        logger.info(`ApplicationController: Auto-created default workflow for application ${application.id}`);
      } catch (workflowError: any) {
        // Log error but don't fail the application creation
        logger.warn(`ApplicationController: Failed to auto-create default workflow for application ${application.id}:`, workflowError.message);
      }

      return res.status(201).json({
        success: true,
        application: {
          id: application.id,
          name: application.name,
          description: application.description,
          metadata: application.metadata,
          createdAt: application.created_at,
        },
      });
    } catch (error: any) {
      logger.error('ApplicationController: Failed to create application:', error);
      return res.status(500).json({
        error: 'Failed to create application',
        message: error.message,
      });
    }
  }

  /**
   * List all applications for the user
   * GET /api/applications
   */
  static async list(req: Request, res: Response) {
    try {
      // For MVP, use default user ID (in real app, get from auth token)
      const userId = (req as any).userId || DEFAULT_USER_ID; // From auth middleware

      const applications = await applicationRepo.findByUserId(userId);

      // Get project counts for each application
      const applicationsWithCounts = await Promise.all(
        applications.map(async (app) => {
          const projectCount = await applicationRepo.getProjectsCount(app.id);
          return {
            id: app.id,
            name: app.name,
            description: app.description,
            metadata: app.metadata,
            projectCount,
            createdAt: app.created_at,
            updatedAt: app.updated_at,
          };
        })
      );

      return res.json({
        success: true,
        applications: applicationsWithCounts,
      });
    } catch (error: any) {
      logger.error('ApplicationController: Failed to list applications:', error);
      return res.status(500).json({
        error: 'Failed to list applications',
        message: error.message,
      });
    }
  }

  /**
   * Get application by ID
   * GET /api/applications/:id
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const application = await applicationRepo.findById(id);

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const projectCount = await applicationRepo.getProjectsCount(id);

      return res.json({
        success: true,
        application: {
          id: application.id,
          name: application.name,
          description: application.description,
          metadata: application.metadata,
          projectCount,
          createdAt: application.created_at,
          updatedAt: application.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('ApplicationController: Failed to get application:', error);
      return res.status(500).json({
        error: 'Failed to get application',
        message: error.message,
      });
    }
  }

  /**
   * Update application
   * PUT /api/applications/:id
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, metadata } = req.body;

      const application = await applicationRepo.update(id, {
        name,
        description,
        metadata,
      });

      logger.info(`ApplicationController: Application updated`, {
        applicationId: id,
      });

      return res.json({
        success: true,
        application: {
          id: application.id,
          name: application.name,
          description: application.description,
          metadata: application.metadata,
          updatedAt: application.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('ApplicationController: Failed to update application:', error);
      return res.status(500).json({
        error: 'Failed to update application',
        message: error.message,
      });
    }
  }

  /**
   * Delete application (soft delete)
   * DELETE /api/applications/:id
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const application = await applicationRepo.softDelete(id);

      logger.info(`ApplicationController: Application deleted`, {
        applicationId: id,
      });

      return res.json({
        success: true,
        message: 'Application deleted successfully',
        application: {
          id: application.id,
          deletedAt: application.deleted_at,
        },
      });
    } catch (error: any) {
      logger.error('ApplicationController: Failed to delete application:', error);
      return res.status(500).json({
        error: 'Failed to delete application',
        message: error.message,
      });
    }
  }

  /**
   * Get projects for an application
   * GET /api/applications/:id/projects
   */
  static async getProjects(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verify application exists
      const application = await applicationRepo.findById(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Get projects for this application
      const projects = await projectRepo.findByApplicationId(id);

      return res.json({
        success: true,
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          idea: project.idea,
          description: project.description,
          status: project.status,
          progress: project.progress,
          createdAt: project.created_at,
        })),
      });
    } catch (error: any) {
      logger.error('ApplicationController: Failed to get application projects:', error);
      return res.status(500).json({
        error: 'Failed to get application projects',
        message: error.message,
      });
    }
  }
}

export default ApplicationController;

