/**
 * GitCommitOnRoleCompleteHandler
 * Handler that performs git commit and push when a role completes all its actions
 */

import { RoleCompletionHandler, RoleCompletionContext } from '../RoleCompletionService';
import { GitService } from '../../services/GitService';
import { logger } from '../../utils';

/**
 * Handler that commits changes to git when a role completes
 */
export class GitCommitOnRoleCompleteHandler implements RoleCompletionHandler {
  private gitService: GitService;

  constructor() {
    this.gitService = new GitService();
  }

  /**
   * Handle role completion by committing and pushing changes to git
   * @param context - Context information about the completed role
   */
  async handle(context: RoleCompletionContext): Promise<void> {
    const { role, workspacePath, projectId, versionId } = context;

    logger.info('GitCommitOnRoleCompleteHandler: Starting git commit', {
      role,
      projectId,
      versionId,
      workspacePath,
    });

    // Check if workspace is a git repository
    if (!this.gitService.isGitRepository(workspacePath)) {
      logger.warn('GitCommitOnRoleCompleteHandler: Workspace is not a git repository', {
        workspacePath,
        role,
        projectId,
      });
      return;
    }

    // Generate commit message following Conventional Commits format
    const commitMessage = `feat(workflow): complete ${role} role execution`;

    // Execute git commit
    const result = await this.gitService.commitChanges(workspacePath, commitMessage, true);

    if (result.success) {
      logger.info('GitCommitOnRoleCompleteHandler: Git commit successful', {
        role,
        projectId,
        versionId,
        message: result.message,
      });

      // Push changes to remote repository after successful commit
      const pushResult = await this.gitService.pushChanges(workspacePath);
      if (pushResult.success) {
        logger.info('GitCommitOnRoleCompleteHandler: Git push successful', {
          role,
          projectId,
          versionId,
          message: pushResult.message,
        });
      } else {
        // Log warning but don't throw - push failure shouldn't stop workflow
        logger.warn('GitCommitOnRoleCompleteHandler: Git push failed', {
          role,
          projectId,
          versionId,
          error: pushResult.message,
        });
      }
    } else {
      // Log warning but don't throw - commit failure shouldn't stop workflow
      logger.warn('GitCommitOnRoleCompleteHandler: Git commit failed', {
        role,
        projectId,
        versionId,
        error: result.message,
      });
    }
  }
}
