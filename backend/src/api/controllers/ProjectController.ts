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
// import { ProjectManager } from '../../orchestration/ProjectManager'; // Unused
import { logger } from '../../utils';
import { ProjectStatus } from '@mind2build/shared';
import { WorkflowService } from '../../services/WorkflowService';
import { RoleActionFactory } from '../../services/RoleActionFactory';
import * as fs from 'fs';
import * as path from 'path';

const projectRepo = new ProjectRepository();
const messageRepo = new MessageRepository();
const documentRepo = new DocumentRepository();
// const projectManager = new ProjectManager(); // Unused for now

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

      // Check for duplicate project name in the same application
      const exists = await projectRepo.existsByNameAndApplication(name, applicationId || null, userId);
      if (exists) {
        return res.status(409).json({
          error: 'Duplicate project name',
          message: applicationId
            ? `项目名称 "${name}" 在该应用下已存在，请使用不同的名称`
            : `项目名称 "${name}" 已存在，请使用不同的名称`,
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
      ProjectController.executeProject(id, project.idea, project.investment, project.n_round || 1, userId)
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
      // Get project to find application ID
      const project = await projectRepo.findById(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Create context
      const ctx = new Context();
      // Set userId in context so roles can load their specific LLM configs
      if (userId) {
        ctx.set('userId', userId);
      }

      let team: Team;

      // Try to get or create workflow from application if applicationId exists
      if (project.application_id) {
        const workflowService = new WorkflowService();
        const workflow = await workflowService.getOrCreateDefaultWorkflow(project.application_id);
        
        // Create team from workflow configuration
        team = RoleActionFactory.createTeamFromWorkflow(workflow.workflow_config, ctx);
        
        logger.info(`Project ${projectId} using workflow from application ${project.application_id}`, {
          workflowId: workflow.id,
          workflowName: workflow.name,
        });
      } else {
        // No application ID, use default hardcoded workflow
        logger.info(`Project ${projectId} has no application_id, using default hardcoded workflow`);
        team = new Team(ctx);
        team.hire([
          new Salesperson(ctx),
          new ProductManager(ctx),
          new Architect(ctx),
          new ProjectManagerRole(ctx),
          new Engineer(ctx),
          new QAEngineer(ctx),
        ]);
      }

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
      const docActions = ['WriteMRD', 'WritePRD', 'WriteDesign', 'BreakdownTasks', 'WriteSubProjectDesign', 'WriteCode', 'WriteTest'];
      const documents = result.messages.filter((msg) => docActions.includes(msg.causeBy));

      logger.info(`Project ${projectId} found ${documents.length} documents to save`);

      for (const doc of documents) {
        const docTypeMap: Record<string, string> = {
          'WriteMRD': 'mrd',
          'WritePRD': 'prd',
          'WriteDesign': 'design',
          'BreakdownTasks': 'task_breakdown',
          'WriteSubProjectDesign': 'sub_project_design',
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
        // If project not found in database, check if it exists in workspace
        const workspaceProject = ProjectController.findProjectInWorkspace(id);
        if (workspaceProject) {
          // Return basic project info from workspace
          return res.json({
            success: true,
            project: {
              id: id,
              name: workspaceProject.name || 'Unknown Project',
              status: 'pending',
              idea: workspaceProject.idea || '',
              progress: 0,
              totalCost: 0,
              investment: 10,
              messageCount: 0,
              createdAt: workspaceProject.createdAt || new Date(),
              completedAt: null,
              workspaceOnly: true, // Flag to indicate this is from workspace only
            },
          });
        }
        return res.status(404).json({ error: 'Project not found' });
      }

      const messageCount = await messageRepo.countByProject(id);

      return res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          idea: project.idea,
          progress: project.progress || 0,
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
   * Find project in workspace directory
   * Checks if project directory exists in workspace/{applicationId}/{projectId}/
   */
  private static findProjectInWorkspace(projectId: string): { name?: string; idea?: string; applicationId?: string; createdAt?: Date } | null {
    try {
      // Calculate workspace root
      const possibleRoots = [
        path.resolve(__dirname, '../../../'),
        path.resolve(__dirname, '../../../../'),
        process.cwd(),
      ];

      let projectRoot = possibleRoots[0];
      for (const root of possibleRoots) {
        if (
          fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
          fs.existsSync(path.join(root, 'package.json'))
        ) {
          projectRoot = root;
          break;
        }
      }

      const workspaceRoot = process.env.WORKSPACE_PATH || path.join(projectRoot, 'workspace');

      if (!fs.existsSync(workspaceRoot)) {
        return null;
      }

      // Search through all application directories
      const applicationDirs = fs.readdirSync(workspaceRoot, { withFileTypes: true });
      for (const appDir of applicationDirs) {
        if (!appDir.isDirectory()) continue;

        const applicationId = appDir.name;
        const projectDir = path.join(workspaceRoot, applicationId, projectId);

        if (fs.existsSync(projectDir)) {
          // Project directory exists, try to get basic info
          // Check if there's a version directory
          const versionDirs = fs.readdirSync(projectDir, { withFileTypes: true });
          let latestVersion = 1;
          for (const versionDir of versionDirs) {
            if (versionDir.isDirectory() && versionDir.name.startsWith('v')) {
              const versionNum = parseInt(versionDir.name.substring(1));
              if (versionNum > latestVersion) {
                latestVersion = versionNum;
              }
            }
          }

          // Try to read PRD or MRD to get project name/idea
          const prdPath = path.join(projectDir, `v${latestVersion}`, 'PRD', 'PRD.md');
          const mrdPath = path.join(projectDir, `v${latestVersion}`, 'MRD', 'MRD.md');

          let name: string | undefined;
          let idea: string | undefined;

          // Try to read PRD first
          if (fs.existsSync(prdPath)) {
            try {
              const content = fs.readFileSync(prdPath, 'utf-8');
              // Extract project name from PRD (usually in first few lines)
              const lines = content.split('\n').slice(0, 20);
              for (const line of lines) {
                if (line.includes('#') && line.length < 100) {
                  name = line.replace(/^#+\s*/, '').trim();
                  break;
                }
              }
            } catch (e) {
              // Ignore read errors
            }
          }

          // Try to read MRD if PRD didn't work
          if (!name && fs.existsSync(mrdPath)) {
            try {
              const content = fs.readFileSync(mrdPath, 'utf-8');
              const lines = content.split('\n').slice(0, 20);
              for (const line of lines) {
                if (line.includes('#') && line.length < 100) {
                  name = line.replace(/^#+\s*/, '').trim();
                  break;
                }
              }
            } catch (e) {
              // Ignore read errors
            }
          }

          // Get directory creation time as createdAt
          const stats = fs.statSync(projectDir);
          const createdAt = stats.birthtime || stats.mtime;

          return {
            name: name || `Project ${projectId.substring(0, 8)}`,
            idea: idea,
            applicationId,
            createdAt,
          };
        }
      }

      return null;
    } catch (error: any) {
      logger.debug('Failed to find project in workspace:', error.message);
      return null;
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
          idea: p.idea,
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

  /**
   * Download zip archive
   * GET /api/projects/:id/download/:zipPath
   */
  static async downloadZip(req: Request, res: Response) {
    try {
      const { zipPath } = req.params;
      const fs = await import('fs');
      const path = await import('path');

      // Decode the zip path (it might be URL encoded)
      const decodedPath = decodeURIComponent(zipPath);

      // Security: Only allow paths within the project directory
      const projectRoot = process.cwd();
      const tempDir = path.join(projectRoot, 'temp');
      const fullPath = path.resolve(tempDir, path.basename(decodedPath));

      // Verify the file is within the temp directory
      if (!fullPath.startsWith(path.resolve(tempDir))) {
        return res.status(403).json({
          error: 'Invalid file path',
        });
      }

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          error: 'File not found',
        });
      }

      // Get filename for download
      const filename = path.basename(fullPath);

      // Set headers and send file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);

      logger.info(`Project zip downloaded: ${fullPath}`);
      // Note: fileStream.pipe(res) handles the response, no explicit return needed
      return;
    } catch (error: any) {
      logger.error('Failed to download zip:', error);
      return res.status(500).json({
        error: 'Failed to download zip',
        message: error.message,
      });
    }
  }
}

export default ProjectController;

