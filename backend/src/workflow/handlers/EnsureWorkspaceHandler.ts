/**
 * EnsureWorkspaceHandler
 * Handler that ensures workspace exists before workflow starts
 *
 * If workspace folder is missing, this handler will re-clone the repository
 * (either user's custom git repo or template repository)
 */

import { WorkflowStartupHandler, WorkflowStartupContext } from '../WorkflowStartupService';
import { WorkspaceManager } from '../../utils/WorkspaceManager';
import { GitService } from '../../services/GitService';
import { logger } from '../../utils';

/**
 * Handler that ensures workspace exists before workflow execution
 */
export class EnsureWorkspaceHandler implements WorkflowStartupHandler {
  private gitService: GitService;

  constructor() {
    this.gitService = new GitService();
  }

  /**
   * Handle workflow startup by ensuring workspace exists
   * @param context - Context information about the workflow startup
   */
  async handle(context: WorkflowStartupContext): Promise<void> {
    const { project, versionId, workspacePath } = context;

    if (!project.application_id) {
      logger.warn('EnsureWorkspaceHandler: No application_id, skipping workspace check', {
        projectId: project.id,
        versionId,
      });
      return;
    }

    const workspaceOptions = {
      applicationId: project.application_id,
      projectId: project.id,
      versionId,
    };

    const workspaceExists = WorkspaceManager.versionWorkspaceExists(workspaceOptions);

    if (workspaceExists) {
      logger.debug('EnsureWorkspaceHandler: Workspace already exists', {
        projectId: project.id,
        versionId,
        workspacePath,
      });

      // Check if workspace is empty
      const isEmpty = await WorkspaceManager.isWorkspaceEmpty(workspaceOptions);
      if (isEmpty) {
        logger.info('EnsureWorkspaceHandler: Workspace is empty, reinitializing', {
          projectId: project.id,
          versionId,
          workspacePath,
        });

        // Reinitialize workspace using the generic method
        const reinitResult = await WorkspaceManager.reinitializeWorkspace(
          workspaceOptions,
          project.git_repo_url || undefined,
          context.version?.branch_name
        );

        if (reinitResult.success) {
          logger.info('EnsureWorkspaceHandler: Successfully reinitialized workspace', {
            projectId: project.id,
            versionId,
          });
        } else {
          logger.warn('EnsureWorkspaceHandler: Failed to reinitialize workspace', {
            projectId: project.id,
            versionId,
            error: reinitResult.message,
          });
        }
        return;
      }

      // If workspace exists and is not empty, check if branch exists and pull
      if (this.gitService.isGitRepository(workspacePath) && context.version && context.version.branch_name) {
        const branchName = context.version.branch_name;

        // Check if branch exists locally or remotely
        const localExists = await this.gitService.branchExistsLocally(workspacePath, branchName);
        const remoteExists = await this.gitService.branchExistsRemotely(workspacePath, branchName);

        if (localExists || remoteExists) {
          logger.info('EnsureWorkspaceHandler: Branch exists, pulling latest changes', {
            projectId: project.id,
            versionId,
            branchName,
            localExists,
            remoteExists,
          });

          const pullResult = await this.gitService.pullBranch(workspacePath, branchName, project.id);

          if (pullResult.success) {
            logger.info('EnsureWorkspaceHandler: Successfully pulled latest changes', {
              projectId: project.id,
              versionId,
              branchName,
            });
          } else {
            logger.warn('EnsureWorkspaceHandler: Failed to pull latest changes', {
              projectId: project.id,
              versionId,
              branchName,
              error: pullResult.message,
            });
          }
          return;
        } else {
          // Branch does not exist, create it
          logger.info('EnsureWorkspaceHandler: Branch does not exist, creating it', {
            projectId: project.id,
            versionId,
            branchName,
          });

          const branchResult = await this.gitService.createBranch(workspacePath, branchName, true);

          if (branchResult.success) {
            logger.info('EnsureWorkspaceHandler: Created version branch', {
              projectId: project.id,
              versionId,
              branchName: branchName,
            });

            // Push branch to remote with upstream tracking
            const pushResult = await this.gitService.pushChanges(workspacePath, branchName);
            if (pushResult.success) {
              logger.info('EnsureWorkspaceHandler: Pushed version branch to remote', {
                projectId: project.id,
                versionId,
                branchName: branchName,
              });
            } else {
              logger.warn('EnsureWorkspaceHandler: Failed to push version branch to remote', {
                projectId: project.id,
                versionId,
                branchName: branchName,
                error: pushResult.message,
              });
            }
          } else {
            logger.warn('EnsureWorkspaceHandler: Failed to create version branch', {
              projectId: project.id,
              versionId,
              branchName: branchName,
              error: branchResult.message,
            });
          }
          return;
        }
      } else {
        // Workspace exists but no branch to check or not a git repo
        return;
      }
    }

    logger.info('EnsureWorkspaceHandler: Workspace not found, reinitializing', {
      projectId: project.id,
      versionId,
      workspacePath,
      hasGitRepo: !!project.git_repo_url,
    });

    try {
      // Use the generic reinitializeWorkspace method
      const reinitResult = await WorkspaceManager.reinitializeWorkspace(
        workspaceOptions,
        project.git_repo_url || undefined,
        context.version?.branch_name
      );

      if (reinitResult.success) {
        logger.info('EnsureWorkspaceHandler: Successfully reinitialized workspace', {
          projectId: project.id,
          versionId,
        });
      } else {
        logger.warn('EnsureWorkspaceHandler: Failed to reinitialize workspace', {
          projectId: project.id,
          versionId,
          error: reinitResult.message,
        });
      }
    } catch (error: any) {
      logger.error('EnsureWorkspaceHandler: Failed to ensure workspace exists', {
        projectId: project.id,
        versionId,
        error: error.message,
      });
      // Don't throw - allow workflow to continue, workspace might be created later
      // The error is already logged, so we just return
    }
  }
}
