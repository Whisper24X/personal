/**
 * ProjectVersion Controller
 * Handles project version-related HTTP requests
 * 
 * 版本工作空间目录结构：
 * workspace/{applicationId}/{projectId}/versions/{versionId}/ainative-workspace
 */

import { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectVersionRepository } from '../../database/repositories/ProjectVersionRepository';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { KnowledgeBaseRepository } from '../../database/repositories/KnowledgeBaseRepository';
import { GitService } from '../../services/GitService';
import { WorkspaceManager, WorkspaceOptions } from '../../utils/WorkspaceManager';
import { logger } from '../../utils';

const versionRepo = new ProjectVersionRepository();
const projectRepo = new ProjectRepository();
const knowledgeRepo = new KnowledgeBaseRepository();
const gitService = new GitService();

/**
 * Helper function to get version workspace path
 */
function getVersionWorkspacePath(applicationId: string | undefined, projectId: string, versionId: string): string | undefined {
  if (!applicationId) return undefined;
  try {
    return WorkspaceManager.getProjectWorkspacePath({
      applicationId,
      projectId,
      versionId,
    });
  } catch {
    return undefined;
  }
}

export class ProjectVersionController {
  /**
   * Create a new version for a project
   * POST /api/projects/:id/versions
   */
  static async create(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;
      const { versionName, description, idea } = req.body;

      if (!versionName || typeof versionName !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid versionName field',
        });
      }

      if (!idea || typeof idea !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid idea field',
          message: '请填写版本想法/需求描述',
        });
      }

      // Get project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if version name already exists
      const exists = await versionRepo.existsByProjectAndName(projectId, versionName);
      if (exists) {
        return res.status(409).json({
          error: 'Version name already exists',
          message: `版本 "${versionName}" 已存在，请使用不同的版本名称`,
        });
      }

      // Generate branch name using name_alias (English alias for Git compatibility)
      const branchName = gitService.generateVersionBranchName(
        project.name_alias || project.name,  // Fallback to name if alias not set
        versionName
      );

      // Check if branch name already exists
      const branchExists = await versionRepo.existsByProjectAndBranch(projectId, branchName);
      if (branchExists) {
        return res.status(409).json({
          error: 'Branch name already exists',
          message: `分支 "${branchName}" 已存在，请使用不同的版本名称`,
        });
      }

      // Create version in database
      const version = await versionRepo.create({
        projectId,
        versionName,
        description,
        idea,
        branchName,
        isActive: true, // New version is active by default
      });

      // Create version workspace directory
      if (project.application_id) {
        const baseWorkspaceOptions: WorkspaceOptions = {
          applicationId: project.application_id,
          projectId: project.id,
        };

        const versionWorkspaceOptions: WorkspaceOptions = {
          ...baseWorkspaceOptions,
          versionId: version.id,
        };

        try {
          const versionWorkspacePath = WorkspaceManager.getProjectWorkspacePath(versionWorkspaceOptions);

          // If project has custom git repo, ALWAYS clone from Git repository
          if (project.git_repo_url) {
            // Always clone user's repo directly to version workspace (no copying from base)
            const prepareResult = await gitService.prepareRepository({
              gitRepoUrl: project.git_repo_url,
              workspacePath: versionWorkspacePath,
              projectId: project.id,
            });
            
            if (prepareResult.success) {
              logger.info('ProjectVersionController: Cloned user repo to version workspace', {
                versionId: version.id,
                gitRepoUrl: project.git_repo_url,
              });
            } else {
              logger.warn('ProjectVersionController: Failed to clone user repo, falling back to template', {
                versionId: version.id,
                gitRepoUrl: project.git_repo_url,
                error: prepareResult.message,
              });
              // Fall back to template if user repo clone fails
              await WorkspaceManager.initWorkspace(versionWorkspaceOptions);
            }

            // Create version branch in the workspace
            if (gitService.isGitRepository(versionWorkspacePath)) {
              const result = await gitService.createBranch(versionWorkspacePath, branchName, true);
              if (!result.success) {
                logger.warn('Failed to create git branch for version', {
                  versionId: version.id,
                  branchName,
                  error: result.message,
                });
              } else {
                logger.info('ProjectVersionController: Created version branch', {
                  versionId: version.id,
                  branchName,
                });

                // Push branch to remote with upstream tracking
                const pushResult = await gitService.pushChanges(versionWorkspacePath, branchName);
                if (pushResult.success) {
                  logger.info('ProjectVersionController: Pushed version branch to remote', {
                    versionId: version.id,
                    branchName,
                  });
                } else {
                  logger.warn('ProjectVersionController: Failed to push version branch to remote', {
                    versionId: version.id,
                    branchName,
                    error: pushResult.message,
                  });
                }
              }
            }
          } else {
            // No custom git repo - use template/base workspace
            if (WorkspaceManager.isTemplateCloned(baseWorkspaceOptions)) {
              // Copy from base workspace to version workspace
              await WorkspaceManager.copyWorkspaceToVersion(baseWorkspaceOptions, version.id);
              logger.info('ProjectVersionController: Created version workspace from template base', {
                versionId: version.id,
              });
            } else {
              // Initialize fresh version workspace with template
              await WorkspaceManager.initWorkspace(versionWorkspaceOptions);
              logger.info('ProjectVersionController: Initialized fresh version workspace with template', {
                versionId: version.id,
              });
            }
          }

          // Inject knowledge base documents to version workspace
          try {
            await ProjectVersionController.injectKnowledgeBase(projectId, versionWorkspacePath);
          } catch (kbError: any) {
            logger.warn('ProjectVersionController: Failed to inject knowledge base', {
              versionId: version.id,
              error: kbError.message,
            });
            // Don't fail version creation if knowledge injection fails
          }
        } catch (workspaceError: any) {
          logger.warn('ProjectVersionController: Failed to create version workspace', {
            versionId: version.id,
            error: workspaceError.message,
          });
          // Don't fail the version creation, workspace can be created later
        }
      }

      logger.info('ProjectVersionController: Version created', {
        versionId: version.id,
        projectId,
        versionName,
        branchName,
      });

      return res.status(201).json({
        success: true,
        version: {
          id: version.id,
          projectId: version.project_id,
          versionName: version.version_name,
          description: version.description,
          idea: version.idea,
          branchName: version.branch_name,
          isActive: version.is_active,
          workspacePath: getVersionWorkspacePath(project.application_id, project.id, version.id),
          createdAt: version.created_at,
        },
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to create version:', error);
      return res.status(500).json({
        error: 'Failed to create version',
        message: error.message,
      });
    }
  }

  /**
   * List all versions for a project
   * GET /api/projects/:id/versions
   */
  static async list(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const versions = await versionRepo.findByProjectId(projectId);

      return res.json({
        success: true,
        versions: versions.map((v) => ({
          id: v.id,
          projectId: v.project_id,
          versionName: v.version_name,
          description: v.description,
          idea: v.idea,
          branchName: v.branch_name,
          isActive: v.is_active,
          workspacePath: getVersionWorkspacePath(project.application_id, projectId, v.id),
          createdAt: v.created_at,
          updatedAt: v.updated_at,
        })),
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to list versions:', error);
      return res.status(500).json({
        error: 'Failed to list versions',
        message: error.message,
      });
    }
  }

  /**
   * Get the active version for a project
   * GET /api/projects/:id/versions/active
   */
  static async getActive(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;

      // Verify project exists
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const version = await versionRepo.findActiveVersion(projectId);

      if (!version) {
        return res.json({
          success: true,
          version: null,
        });
      }

      return res.json({
        success: true,
        version: {
          id: version.id,
          projectId: version.project_id,
          versionName: version.version_name,
          description: version.description,
          idea: version.idea,
          branchName: version.branch_name,
          isActive: version.is_active,
          workspacePath: getVersionWorkspacePath(project.application_id, projectId, version.id),
          createdAt: version.created_at,
          updatedAt: version.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to get active version:', error);
      return res.status(500).json({
        error: 'Failed to get active version',
        message: error.message,
      });
    }
  }

  /**
   * Get a specific version
   * GET /api/projects/:id/versions/:versionId
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id: projectId, versionId } = req.params;

      const version = await versionRepo.findById(versionId);

      if (!version || version.project_id !== projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // Get project for applicationId
      const project = await projectRepo.findById(projectId);

      return res.json({
        success: true,
        version: {
          id: version.id,
          projectId: version.project_id,
          versionName: version.version_name,
          description: version.description,
          idea: version.idea,
          branchName: version.branch_name,
          isActive: version.is_active,
          workspacePath: getVersionWorkspacePath(project?.application_id, projectId, version.id),
          metadata: version.metadata,
          createdAt: version.created_at,
          updatedAt: version.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to get version:', error);
      return res.status(500).json({
        error: 'Failed to get version',
        message: error.message,
      });
    }
  }

  /**
   * Update a version
   * PUT /api/projects/:id/versions/:versionId
   */
  static async update(req: Request, res: Response) {
    try {
      const { id: projectId, versionId } = req.params;
      const { description, metadata } = req.body;

      const version = await versionRepo.findById(versionId);

      if (!version || version.project_id !== projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const updatedVersion = await versionRepo.update(versionId, {
        description,
        metadata,
      });

      logger.info('ProjectVersionController: Version updated', {
        versionId,
        projectId,
      });

      return res.json({
        success: true,
        version: {
          id: updatedVersion.id,
          projectId: updatedVersion.project_id,
          versionName: updatedVersion.version_name,
          description: updatedVersion.description,
          branchName: updatedVersion.branch_name,
          isActive: updatedVersion.is_active,
          updatedAt: updatedVersion.updated_at,
        },
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to update version:', error);
      return res.status(500).json({
        error: 'Failed to update version',
        message: error.message,
      });
    }
  }

  /**
   * Delete a version
   * DELETE /api/projects/:id/versions/:versionId
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id: projectId, versionId } = req.params;

      const version = await versionRepo.findById(versionId);

      if (!version || version.project_id !== projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // Don't allow deleting active version if it's the only one
      if (version.is_active) {
        const count = await versionRepo.countByProjectId(projectId);
        if (count <= 1) {
          return res.status(400).json({
            error: 'Cannot delete the only version',
            message: '不能删除唯一的版本',
          });
        }
      }

      // Get project to find applicationId
      const project = await projectRepo.findById(projectId);

      // Delete version workspace directory
      if (project?.application_id) {
        try {
          await WorkspaceManager.deleteVersionWorkspace({
            applicationId: project.application_id,
            projectId,
            versionId,
          });
        } catch (workspaceError: any) {
          logger.warn('ProjectVersionController: Failed to delete version workspace', {
            versionId,
            error: workspaceError.message,
          });
          // Don't fail the version deletion
        }
      }

      await versionRepo.delete(versionId);

      logger.info('ProjectVersionController: Version deleted', {
        versionId,
        projectId,
      });

      return res.json({
        success: true,
        message: 'Version deleted successfully',
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to delete version:', error);
      return res.status(500).json({
        error: 'Failed to delete version',
        message: error.message,
      });
    }
  }

  /**
   * Activate a version (switch to this version's branch)
   * POST /api/projects/:id/versions/:versionId/activate
   */
  static async activate(req: Request, res: Response) {
    try {
      const { id: projectId, versionId } = req.params;

      // Get project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get version
      const version = await versionRepo.findById(versionId);
      if (!version || version.project_id !== projectId) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // If already active, just return success
      if (version.is_active) {
        return res.json({
          success: true,
          message: 'Version is already active',
          version: {
            id: version.id,
            versionName: version.version_name,
            branchName: version.branch_name,
            isActive: true,
          },
        });
      }

      // Set version as active (trigger will deactivate others)
      const updatedVersion = await versionRepo.setActiveVersion(projectId, versionId);

      // If project has git repo configured, checkout the branch in version workspace
      if (project.git_repo_url && project.application_id) {
        const versionWorkspacePath = WorkspaceManager.getProjectWorkspacePath({
          applicationId: project.application_id,
          projectId: project.id,
          versionId,  // Use version-specific workspace path
        });

        // Check if version workspace exists and is a git repo
        if (gitService.isGitRepository(versionWorkspacePath)) {
          const result = await gitService.checkoutBranch(versionWorkspacePath, version.branch_name);
          if (!result.success) {
            logger.warn('Failed to checkout git branch for version', {
              versionId,
              branchName: version.branch_name,
              workspacePath: versionWorkspacePath,
              error: result.message,
            });
            // Don't fail the request, just log the warning
          }
        }
      }

      logger.info('ProjectVersionController: Version activated', {
        versionId,
        projectId,
        branchName: version.branch_name,
      });

      return res.json({
        success: true,
        message: `Switched to version ${updatedVersion.version_name}`,
        version: {
          id: updatedVersion.id,
          versionName: updatedVersion.version_name,
          branchName: updatedVersion.branch_name,
          isActive: true,
        },
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to activate version:', error);
      return res.status(500).json({
        error: 'Failed to activate version',
        message: error.message,
      });
    }
  }

  /**
   * Get git branches info for a project
   * GET /api/projects/:id/branches
   */
  static async getBranches(req: Request, res: Response) {
    try {
      const { id: projectId } = req.params;

      // Get project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.application_id) {
        return res.json({
          success: true,
          branches: {
            local: [],
            remote: [],
            current: null,
          },
        });
      }

      const workspacePath = WorkspaceManager.getProjectWorkspacePath({
        applicationId: project.application_id,
        projectId: project.id,
      });

      if (!gitService.isGitRepository(workspacePath)) {
        return res.json({
          success: true,
          branches: {
            local: [],
            remote: [],
            current: null,
          },
        });
      }

      const branches = await gitService.listBranches(workspacePath);

      return res.json({
        success: true,
        branches,
      });
    } catch (error: any) {
      logger.error('ProjectVersionController: Failed to get branches:', error);
      return res.status(500).json({
        error: 'Failed to get branches',
        message: error.message,
      });
    }
  }

  /**
   * Inject knowledge base documents from database to version workspace
   * Creates docs/business-knowledge/*.md files
   * 
   * @param projectId Project ID to get knowledge documents for
   * @param versionWorkspacePath Path to the version workspace directory
   */
  private static async injectKnowledgeBase(
    projectId: string,
    versionWorkspacePath: string
  ): Promise<void> {
    // Get all active knowledge documents for the project
    const documents = await knowledgeRepo.findByProjectId(projectId);
    
    if (documents.length === 0) {
      logger.info('ProjectVersionController: No knowledge documents to inject', { projectId });
      return;
    }

    // Create business-knowledge directory
    const knowledgeDir = path.join(versionWorkspacePath, 'docs', 'business-knowledge');
    await fs.mkdir(knowledgeDir, { recursive: true });

    // Write each document as a markdown file
    for (const doc of documents) {
      // Sanitize filename (remove invalid characters, limit length)
      const safeTitle = doc.title
        .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars
        .replace(/\s+/g, '_')           // Replace spaces
        .substring(0, 100);             // Limit length
      
      const filename = `${safeTitle}.md`;
      const filePath = path.join(knowledgeDir, filename);

      // Build file content with metadata header
      const content = `---
title: ${doc.title}
description: ${doc.description || ''}
tags: ${(doc.tags || []).join(', ')}
created_at: ${doc.created_at}
updated_at: ${doc.updated_at}
---

${doc.content}
`;

      await fs.writeFile(filePath, content, 'utf-8');
    }

    logger.info('ProjectVersionController: Knowledge base injected', {
      projectId,
      documentCount: documents.length,
      knowledgeDir,
    });
  }
}

export default ProjectVersionController;
