/**
 * Project Controller
 * Handles project-related HTTP requests
 */

import { Request, Response } from 'express';
import { ProjectRepository, MessageRepository, DocumentRepository } from '../../database';
import { Context } from '../../core/context/Context';
import { Team } from '../../orchestration/Team';
import { Salesperson } from '../../roles/Salesperson';
import { ProductManager } from '../../roles/ProductManager';
import { Architect } from '../../roles/Architect';
import { ProjectManager as ProjectManagerRole } from '../../roles/ProjectManager';
import { Engineer } from '../../roles/Engineer';
import { QAEngineer } from '../../roles/QAEngineer';
import { ProjectManager } from '../../orchestration/ProjectManager';
import { logger } from '../../utils';
import { ProjectStatus } from '@mind2build/shared';

const projectRepo = new ProjectRepository();
const messageRepo = new MessageRepository();
const documentRepo = new DocumentRepository();
const projectManager = new ProjectManager();

// Default user UUID (created during database migration)
const DEFAULT_USER_ID = '302769d6-247d-43db-a005-0519712255fb';

export class ProjectController {
  /**
   * Create a new project
   */
  static async create(req: Request, res: Response) {
    try {
      const { name, idea, description, investment, nRound, applicationId } = req.body;
      const userId = (req as any).userId || DEFAULT_USER_ID; // From auth middleware

      if (!name || !idea) {
        return res.status(400).json({
          error: 'Missing required fields: name, idea',
        });
      }

      // Create project in database
      const project = await projectRepo.create({
        userId,
        name,
        idea,
        description,
        investment: investment || 10.0,
        nRound: nRound || 5,
        applicationId,
      });

      logger.info(`Project created: ${project.id}`);

      return res.status(201).json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          createdAt: project.created_at,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create project:', error);
      return res.status(500).json({
        error: 'Failed to create project',
        message: error.message,
      });
    }
  }

  /**
   * Start project execution
   */
  static async start(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.status === ProjectStatus.RUNNING) {
        return res.status(400).json({ error: 'Project is already running' });
      }

      // Update status to running
      await projectRepo.updateStatus(id, ProjectStatus.RUNNING);

      // Start execution in background
      const userId = (req as any).userId || DEFAULT_USER_ID;
      ProjectController.executeProject(id, project.idea, project.investment, project.nRound, userId)
        .catch((error) => {
          logger.error(`Project ${id} execution failed:`, error);
        });

      return res.json({
        success: true,
        message: 'Project execution started',
        projectId: id,
      });
    } catch (error: any) {
      logger.error('Failed to start project:', error);
      return res.status(500).json({
        error: 'Failed to start project',
        message: error.message,
      });
    }
  }

  /**
   * Execute project (background task)
   */
  private static async executeProject(
    projectId: string,
    idea: string,
    investment: number,
    nRound: number,
    userId?: string
  ) {
    try {
      // Create context and team
      const ctx = new Context();
      // Set userId in context so roles can load their specific LLM configs
      if (userId) {
        ctx.set('userId', userId);
      }
      const team = new Team(ctx);

      // Hire roles - 按照 PRD 文档定义的完整流程
      team.hire([
        new Salesperson(ctx),
        new ProductManager(ctx),
        new Architect(ctx),
        new ProjectManagerRole(ctx),
        new Engineer(ctx),
        new QAEngineer(ctx),
      ]);

      // Set investment
      team.invest(investment);

      // Run the team
      const result = await team.run(idea, nRound);

      logger.info(`Project ${projectId} team run completed, saving data to database...`, {
        messageCount: result.messages.length,
        totalCost: result.cost,
      });

      // Save messages to database
      try {
        const savedCount = await messageRepo.saveMany(projectId, result.messages);
        logger.info(`Project ${projectId} saved ${savedCount} messages to database`);
      } catch (error: any) {
        logger.error(`Project ${projectId} failed to save messages:`, error);
        throw error;
      }

      // Update project cost
      try {
        await projectRepo.updateCost(projectId, result.cost);
        logger.info(`Project ${projectId} updated cost to ${result.cost}`);
      } catch (error: any) {
        logger.error(`Project ${projectId} failed to update cost:`, error);
        throw error;
      }

      // Extract and save documents
      const docActions = ['WriteRequirementSpec', 'WritePRD', 'WriteDesign', 'BreakdownTasks', 'WriteSubProjectDesign', 'GenerateTask', 'WriteCode', 'WriteTest'];
      const documents = result.messages.filter((msg) => docActions.includes(msg.causeBy));

      logger.info(`Project ${projectId} found ${documents.length} documents to save`);

      for (const doc of documents) {
        const docTypeMap: Record<string, string> = {
          'WriteRequirementSpec': 'requirement',
          'WritePRD': 'prd',
          'WriteDesign': 'design',
          'BreakdownTasks': 'task_breakdown',
          'WriteSubProjectDesign': 'sub_project_design',
          'GenerateTask': 'task',
          'WriteCode': 'code',
          'WriteTest': 'test',
        };

        const docType = docTypeMap[doc.causeBy] || 'unknown';

        try {
          await documentRepo.create({
            projectId,
            filename: `${docType.toUpperCase()}.md`,
            docType: docType as any,
            content: doc.content,
          });
          logger.info(`Project ${projectId} saved document: ${docType}`);
        } catch (error: any) {
          logger.error(`Project ${projectId} failed to save document ${docType}:`, error);
          // Continue with other documents even if one fails
        }
      }

      // Mark as completed
      try {
        await projectRepo.markCompleted(projectId);
        logger.info(`Project ${projectId} marked as completed`);
      } catch (error: any) {
        logger.error(`Project ${projectId} failed to mark as completed:`, error);
        throw error;
      }

      logger.info(`Project ${projectId} completed successfully`);
    } catch (error: any) {
      logger.error(`Project ${projectId} execution failed:`, error);
      await projectRepo.updateStatus(projectId, ProjectStatus.FAILED);
    }
  }

  /**
   * Get project status
   */
  static async getStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const messageCount = await messageRepo.countByProject(id);

      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          progress: project.progress || 0,
          currentRound: project.current_round || 0,
          nRound: project.n_round || 5,
          totalCost: parseFloat(project.total_cost?.toString() || '0'),
          investment: parseFloat(project.investment?.toString() || '10'),
          messageCount,
          createdAt: project.created_at,
          completedAt: project.completed_at,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get project status:', error);
      return res.status(500).json({
        error: 'Failed to get project status',
        message: error.message,
      });
    }
  }

  /**
   * List user projects
   */
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId || DEFAULT_USER_ID;
      const limit = parseInt(req.query.limit as string) || 50;

      const projects = await projectRepo.findByUserId(userId, limit);

      return res.json({
        success: true,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progress || 0,
          totalCost: parseFloat(p.total_cost?.toString() || '0'),
          createdAt: p.created_at,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to list projects:', error);
      return res.status(500).json({
        error: 'Failed to list projects',
        message: error.message,
      });
    }
  }

  /**
   * Get project messages
   */
  static async getMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const messages = await messageRepo.findByProjectId(id, limit);

      return res.json({
        success: true,
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          roleType: m.role_type,
          causeBy: m.cause_by,
          createdAt: m.created_at,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to get messages:', error);
      return res.status(500).json({
        error: 'Failed to get messages',
        message: error.message,
      });
    }
  }

  /**
   * Get project documents
   */
  static async getDocuments(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const documents = await documentRepo.findByProjectId(id);

      return res.json({
        success: true,
        documents: documents.map((d) => ({
          id: d.id,
          filename: d.filename,
          docType: d.doc_type,
          content: d.content,
          createdAt: d.created_at,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to get documents:', error);
      return res.status(500).json({
        error: 'Failed to get documents',
        message: error.message,
      });
    }
  }
}

export default ProjectController;

