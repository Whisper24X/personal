/**
 * Project Controller
 * Handles project-related HTTP requests
 */

import { Request, Response } from 'express';
import { ProjectRepository, MessageRepository, DocumentRepository } from '../../database';
import { logger, WorkspaceManager } from '../../utils';
import { createLLM } from '../../providers/llm/factory';
import { LLMConfigRepository } from '../../database/repositories/LLMConfigRepository';
import * as fs from 'fs';
import * as path from 'path';

const projectRepo = new ProjectRepository();
const messageRepo = new MessageRepository();
const documentRepo = new DocumentRepository();
// const projectManager = new ProjectManager(); // Unused for now

// Default user UUID (created during database migration)
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Check if a string contains Chinese characters
 */
function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * Translate project name to English alias using LLM
 * Returns the original name formatted as slug if translation fails or no Chinese
 */
async function translateToAlias(name: string): Promise<string> {
  // If no Chinese, just convert to slug format
  if (!containsChinese(name)) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  try {
    const llmConfigRepo = new LLMConfigRepository();
    // Use findActive with DEFAULT_USER_ID to get the active LLM config
    const configRow = await llmConfigRepo.findActive(DEFAULT_USER_ID);
    if (!configRow) {
      logger.warn('No LLM config found for translation, using original name');
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Convert database row to ILLMConfig format
    const config = llmConfigRepo.toILLMConfig(configRow);
    const llm = createLLM(config);
    const result = await llm.aask(
      `Translate the following project name to English, output ONLY lowercase words separated by hyphens (like "user-management-system"), no explanation or other text:\n\n${name}`,
      ['You are a translator. Output only the translation in slug format (lowercase-with-hyphens), nothing else.']
    );

    const alias = result
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');

    logger.info('Translated project name to alias', { name, alias });
    return alias;
  } catch (error: any) {
    logger.warn('Failed to translate project name, using original', { name, error: error.message });
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export class ProjectController {
  /**
   * Create a new project
   */
  static async create(req: Request, res: Response) {
    try {
      const { name, idea, description, investment, nRound: _nRound, applicationId, gitRepoUrl, cliApiKey } = req.body;
      const userId = (req as any).userId || DEFAULT_USER_ID; // From auth middleware

      if (!name) {
        return res.status(400).json({
          error: 'Missing required field: name',
        });
      }

      if (!cliApiKey || typeof cliApiKey !== 'string' || cliApiKey.trim().length === 0) {
        return res.status(400).json({
          error: 'Missing required field: cliApiKey',
          message: 'CLI API Key 是必填字段，请提供有效的 API Key',
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

      // Generate English alias for Git branch names
      const nameAlias = await translateToAlias(name);

      // Create project in database
      const project = await projectRepo.create({
        userId,
        name,
        nameAlias,
        idea,
        description,
        budget: investment || 10.0,  // V2: renamed from investment to budget
        applicationId,
        gitRepoUrl,
        cliApiKey: cliApiKey.trim(),
      });

      logger.info(`Project created: ${project.id}`, { 
        gitRepoUrl: gitRepoUrl || 'none',
        nameAlias,
      });

      // Note: Version must be created manually through the version management page

      return res.status(201).json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          nameAlias: project.name_alias,
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
          budget: parseFloat(project.budget?.toString() || '10'),
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
      // 统一使用 WorkspaceManager 获取 workspace 根目录（绝对路径）
      const workspaceRoot = WorkspaceManager.getWorkspaceRoot();

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
   * Delete a project
   * DELETE /api/projects/:id
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Soft delete the project
      await projectRepo.softDelete(id);

      logger.info(`Project deleted: ${id}`);

      return res.json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete project:', error);
      return res.status(500).json({
        error: 'Failed to delete project',
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

  /**
   * Download workspace code (full ainative-workspace directory)
   * GET /api/projects/:id/download/code
   */
  static async downloadCode(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;
      const { versionId } = req.query;

      // Get project to find applicationId
      const project = await projectRepo.findById(projectId);

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
        });
      }

      if (!project.application_id) {
        return res.status(400).json({
          error: 'Project does not have an associated application',
        });
      }

      const { WorkspaceManager } = await import('../../utils/WorkspaceManager');
      const { createZipFromDirectory } = await import('../../utils/zipUtils');

      // Get workspace path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
        versionId: versionId as string | undefined,
      });

      // Check if workspace exists
      if (!fs.existsSync(workspacePath)) {
        return res.status(404).json({
          error: 'Workspace not found',
          message: '工作区目录不存在，可能还未生成代码',
        });
      }

      // Create temp directory for zip
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate zip file with clean filename
      // Format: 项目名称-全部代码-YYYYMMDD-HHMMSS.zip
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const safeProjectName = (project.name || 'project').replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 50);
      const zipFileName = `${safeProjectName}-全部代码-${dateStr}-${timeStr}.zip`;
      const zipPath = path.join(tempDir, zipFileName);

      await createZipFromDirectory(workspacePath, zipPath, { includeRoot: true });

      // Send file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`);

      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);

      // Clean up zip file after sending (with delay to ensure stream completes)
      fileStream.on('close', () => {
        setTimeout(() => {
          try {
            fs.unlinkSync(zipPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 5000);
      });

      logger.info(`API: Downloaded workspace code for project ${projectId}`, {
        projectId,
        applicationId: project.application_id,
        zipPath,
      });
      // File is being streamed, no explicit return needed
      return;
    } catch (error: any) {
      logger.error('API: Error downloading workspace code', error);
      return res.status(500).json({
        error: error.message || 'Failed to download workspace code',
      });
    }
  }

  /**
   * Download workspace docs (docs and openspec directories)
   * GET /api/projects/:id/download/docs
   */
  static async downloadDocs(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;
      const { versionId } = req.query;

      // Get project to find applicationId
      const project = await projectRepo.findById(projectId);

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
        });
      }

      if (!project.application_id) {
        return res.status(400).json({
          error: 'Project does not have an associated application',
        });
      }

      const { WorkspaceManager } = await import('../../utils/WorkspaceManager');
      const archiver = (await import('archiver')).default;

      // Get workspace path
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: projectId,
        versionId: versionId as string | undefined,
      });

      // Check if workspace exists
      if (!fs.existsSync(workspacePath)) {
        return res.status(404).json({
          error: 'Workspace not found',
          message: '工作区目录不存在，可能还未生成文档',
        });
      }

      const docsPath = path.join(workspacePath, 'docs');
      const openspecPath = path.join(workspacePath, 'openspec');

      // Check if at least one directory exists
      const docsExists = fs.existsSync(docsPath);
      const openspecExists = fs.existsSync(openspecPath);

      if (!docsExists && !openspecExists) {
        return res.status(404).json({
          error: 'No documents found',
          message: 'docs 和 openspec 目录均不存在',
        });
      }

      // Create temp directory for zip
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate zip file with clean filename
      // Format: 项目名称-文档-YYYYMMDD-HHMMSS.zip
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const safeProjectName = (project.name || 'project').replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 50);
      const zipFileName = `${safeProjectName}-文档-${dateStr}-${timeStr}.zip`;
      const zipPath = path.join(tempDir, zipFileName);

      // Create zip with both directories
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
          zlib: { level: 9 },
        });

        output.on('close', () => {
          resolve();
        });

        archive.on('error', (err: Error) => {
          reject(err);
        });

        archive.pipe(output);

        // Add docs directory if exists
        if (docsExists) {
          archive.directory(docsPath, 'docs');
        }

        // Add openspec directory if exists
        if (openspecExists) {
          archive.directory(openspecPath, 'openspec');
        }

        archive.finalize();
      });

      // Send file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`);

      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);

      // Clean up zip file after sending (with delay to ensure stream completes)
      fileStream.on('close', () => {
        setTimeout(() => {
          try {
            fs.unlinkSync(zipPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 5000);
      });

      logger.info(`API: Downloaded workspace docs for project ${projectId}`, {
        projectId,
        applicationId: project.application_id,
        docsExists,
        openspecExists,
        zipPath,
      });
      // File is being streamed, no explicit return needed
      return;
    } catch (error: any) {
      logger.error('API: Error downloading workspace docs', error);
      return res.status(500).json({
        error: error.message || 'Failed to download workspace docs',
      });
    }
  }

  /**
   * Save improve suggestion to docs/code/ImproveCode.md
   * POST /api/projects/:id/versions/:versionId/improve-suggestion
   * Body: { content: string }
   */
  static async saveImproveSuggestion(req: Request, res: Response) {
    try {
      const { id: projectId, versionId } = req.params;
      const { content } = req.body;

      if (!projectId || !versionId) {
        return res.status(400).json({
          error: 'Project ID and Version ID are required',
        });
      }

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          error: 'Content is required and must be a string',
        });
      }

      // 获取项目信息
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
        });
      }

      // 获取 workspace 路径
      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId,
        versionId,
      });

      // 确保目录存在
      const improveDir = path.join(workspacePath, 'docs/code');
      if (!fs.existsSync(improveDir)) {
        fs.mkdirSync(improveDir, { recursive: true });
      }

      // 写入文件
      const improveFilePath = path.join(improveDir, 'ImproveCode.md');
      fs.writeFileSync(improveFilePath, content, 'utf-8');

      logger.info('API: Saved improve suggestion', {
        projectId,
        versionId,
        filePath: improveFilePath,
        contentLength: content.length,
      });

      return res.json({
        success: true,
        message: 'Improve suggestion saved successfully',
        filePath: 'docs/code/ImproveCode.md',
      });
    } catch (error: any) {
      logger.error('API: Error saving improve suggestion', {
        error: error.message,
        stack: error.stack,
      });
      return res.status(500).json({
        error: error.message || 'Failed to save improve suggestion',
      });
    }
  }

  /**
   * Update CLI API key for a project
   * PUT /api/projects/:id/cli-api-key
   */
  static async updateCliApiKey(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { apiKey } = req.body;

      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
          message: `Project with ID ${id} does not exist`,
        });
      }

      // Update API key (can be null to clear it)
      const updatedProject = await projectRepo.updateCliApiKey(id, apiKey || null);

      logger.info(`Updated CLI API key for project ${id}`, {
        projectId: id,
        hasApiKey: !!updatedProject.cli_api_key,
      });

      return res.json({
        success: true,
        message: apiKey ? 'CLI API key updated successfully' : 'CLI API key cleared successfully',
        project: {
          id: updatedProject.id,
          cliApiKey: updatedProject.cli_api_key ? '***' : null, // Don't return full key for security
        },
      });
    } catch (error: any) {
      logger.error('Failed to update CLI API key:', error);
      return res.status(500).json({
        error: 'Failed to update CLI API key',
        message: error.message,
      });
    }
  }

  /**
   * Get CLI API key for a project
   * GET /api/projects/:id/cli-api-key
   */
  static async getCliApiKey(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const project = await projectRepo.findById(id);
      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
          message: `Project with ID ${id} does not exist`,
        });
      }

      const apiKey = await projectRepo.getCliApiKey(id);

      return res.json({
        success: true,
        hasApiKey: !!apiKey,
        // Return masked key for display (first 8 chars + ***)
        maskedKey: apiKey ? `${apiKey.substring(0, 8)}***` : null,
      });
    } catch (error: any) {
      logger.error('Failed to get CLI API key:', error);
      return res.status(500).json({
        error: 'Failed to get CLI API key',
        message: error.message,
      });
    }
  }
}

export default ProjectController;

