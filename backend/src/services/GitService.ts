/**
 * GitService
 * Manages Git repository operations for project workspaces
 * 
 * Responsibilities:
 * - Clone remote Git repositories
 * - Pull latest changes from main branch
 * - Create and manage project branches
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils';

const execAsync = promisify(exec);

/**
 * Options for preparing a repository
 */
export interface PrepareRepositoryOptions {
  /** Git repository URL (SSH or HTTPS) */
  gitRepoUrl: string;
  /** Local workspace path where the repository will be cloned */
  workspacePath: string;
  /** Project ID for logging */
  projectId: string;
}

/**
 * Result of Git operations
 */
export interface GitOperationResult {
  success: boolean;
  message: string;
  branchName?: string;
}

/**
 * GitService class
 * Provides Git operations for project management
 */
export class GitService {
  /** Default main branch name */
  private readonly defaultBranch = 'main';
  
  /** Git command timeout in milliseconds (5 minutes for clone operations) */
  private readonly gitTimeout = 300000;

  /**
   * Check if a directory is a Git repository
   */
  isGitRepository(dirPath: string): boolean {
    const gitDir = path.join(dirPath, '.git');
    return fs.existsSync(gitDir);
  }

  /**
   * Check if a directory exists
   */
  private directoryExists(dirPath: string): boolean {
    return fs.existsSync(dirPath);
  }

  /**
   * Get the project branch name format
   */
  getProjectBranchName(projectId: string): string {
    return `project/${projectId}`;
  }

  /**
   * Prepare the repository for a project
   * - If directory doesn't exist or is not a git repo: clone the repository
   * - If directory exists and is a git repo: checkout main and pull latest changes
   */
  async prepareRepository(options: PrepareRepositoryOptions): Promise<GitOperationResult> {
    const { gitRepoUrl, workspacePath, projectId } = options;

    logger.info('GitService: Preparing repository', {
      projectId,
      gitRepoUrl,
      workspacePath,
    });

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(workspacePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (this.directoryExists(workspacePath) && this.isGitRepository(workspacePath)) {
        // Repository already exists, pull latest changes
        return await this.pullRepository(workspacePath, projectId);
      } else {
        // Clone the repository
        return await this.cloneRepository(gitRepoUrl, workspacePath, projectId);
      }
    } catch (error: any) {
      logger.error('GitService: Failed to prepare repository', {
        projectId,
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to prepare repository: ${error.message}`,
      };
    }
  }

  /**
   * Clone a Git repository
   */
  async cloneRepository(
    gitRepoUrl: string,
    workspacePath: string,
    projectId: string
  ): Promise<GitOperationResult> {
    logger.info('GitService: Cloning repository', {
      projectId,
      gitRepoUrl,
      workspacePath,
    });

    try {
      // If directory exists but is not a git repo, remove it
      if (this.directoryExists(workspacePath) && !this.isGitRepository(workspacePath)) {
        logger.info('GitService: Removing non-git directory before clone', {
          projectId,
          workspacePath,
        });
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }

      // Clone the repository
      const parentDir = path.dirname(workspacePath);
      const dirName = path.basename(workspacePath);
      
      await execAsync(`git clone "${gitRepoUrl}" "${dirName}"`, {
        cwd: parentDir,
        timeout: this.gitTimeout,
      });

      logger.info('GitService: Repository cloned successfully', {
        projectId,
        workspacePath,
      });

      return {
        success: true,
        message: 'Repository cloned successfully',
      };
    } catch (error: any) {
      logger.error('GitService: Clone failed', {
        projectId,
        gitRepoUrl,
        error: error.message,
      });
      return {
        success: false,
        message: `Clone failed: ${error.message}`,
      };
    }
  }

  /**
   * Pull latest changes from main branch
   */
  async pullRepository(workspacePath: string, projectId: string): Promise<GitOperationResult> {
    logger.info('GitService: Pulling latest changes', {
      projectId,
      workspacePath,
    });

    try {
      // First, fetch to get the latest remote state
      await execAsync('git fetch origin', {
        cwd: workspacePath,
        timeout: this.gitTimeout,
      });

      // Check out main branch (handle both 'main' and 'master')
      let branch = this.defaultBranch;
      try {
        await execAsync(`git checkout ${this.defaultBranch}`, {
          cwd: workspacePath,
          timeout: 30000,
        });
      } catch {
        // Try 'master' if 'main' doesn't exist
        try {
          await execAsync('git checkout master', {
            cwd: workspacePath,
            timeout: 30000,
          });
          branch = 'master';
        } catch (e: any) {
          logger.warn('GitService: Could not checkout main or master branch', {
            projectId,
            error: e.message,
          });
        }
      }

      // Pull latest changes
      await execAsync(`git pull origin ${branch}`, {
        cwd: workspacePath,
        timeout: this.gitTimeout,
      });

      logger.info('GitService: Pull completed successfully', {
        projectId,
        branch,
      });

      return {
        success: true,
        message: `Pulled latest changes from ${branch}`,
      };
    } catch (error: any) {
      logger.error('GitService: Pull failed', {
        projectId,
        error: error.message,
      });
      return {
        success: false,
        message: `Pull failed: ${error.message}`,
      };
    }
  }

  /**
   * Create and checkout a project branch
   */
  async createProjectBranch(
    workspacePath: string,
    projectId: string
  ): Promise<GitOperationResult> {
    const branchName = this.getProjectBranchName(projectId);

    logger.info('GitService: Creating project branch', {
      projectId,
      branchName,
      workspacePath,
    });

    try {
      // Check if branch already exists locally
      const localBranchExists = await this.branchExistsLocally(workspacePath, branchName);
      
      if (localBranchExists) {
        // Branch exists, just checkout
        logger.info('GitService: Branch already exists, checking out', {
          projectId,
          branchName,
        });
        await execAsync(`git checkout "${branchName}"`, {
          cwd: workspacePath,
          timeout: 30000,
        });
      } else {
        // Check if branch exists on remote
        const remoteBranchExists = await this.branchExistsRemotely(workspacePath, branchName);
        
        if (remoteBranchExists) {
          // Create local branch tracking remote
          logger.info('GitService: Remote branch exists, creating local tracking branch', {
            projectId,
            branchName,
          });
          await execAsync(`git checkout -b "${branchName}" "origin/${branchName}"`, {
            cwd: workspacePath,
            timeout: 30000,
          });
        } else {
          // Create new branch
          logger.info('GitService: Creating new branch', {
            projectId,
            branchName,
          });
          await execAsync(`git checkout -b "${branchName}"`, {
            cwd: workspacePath,
            timeout: 30000,
          });
        }
      }

      logger.info('GitService: Project branch ready', {
        projectId,
        branchName,
      });

      return {
        success: true,
        message: `Branch ${branchName} is ready`,
        branchName,
      };
    } catch (error: any) {
      logger.error('GitService: Failed to create project branch', {
        projectId,
        branchName,
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to create branch: ${error.message}`,
      };
    }
  }

  /**
   * Check if a branch exists locally
   */
  private async branchExistsLocally(workspacePath: string, branchName: string): Promise<boolean> {
    try {
      await execAsync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
        cwd: workspacePath,
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a branch exists on remote
   */
  private async branchExistsRemotely(workspacePath: string, branchName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`git ls-remote --heads origin "${branchName}"`, {
        cwd: workspacePath,
        timeout: 30000,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(workspacePath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspacePath,
        timeout: 10000,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Commit changes with a message
   * Note: This is a helper method for potential future use
   */
  async commitChanges(
    workspacePath: string,
    message: string,
    addAll: boolean = true
  ): Promise<GitOperationResult> {
    try {
      if (addAll) {
        await execAsync('git add -A', {
          cwd: workspacePath,
          timeout: 30000,
        });
      }

      // Check if there are any changes to commit
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: workspacePath,
        timeout: 10000,
      });

      if (!status.trim()) {
        return {
          success: true,
          message: 'No changes to commit',
        };
      }

      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: workspacePath,
        timeout: 30000,
      });

      return {
        success: true,
        message: 'Changes committed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Commit failed: ${error.message}`,
      };
    }
  }

  /**
   * Push changes to remote
   * Note: This is a helper method for potential future use
   */
  async pushChanges(workspacePath: string, branchName?: string): Promise<GitOperationResult> {
    try {
      const branch = branchName || await this.getCurrentBranch(workspacePath) || 'main';
      
      await execAsync(`git push -u origin "${branch}"`, {
        cwd: workspacePath,
        timeout: this.gitTimeout,
      });

      return {
        success: true,
        message: `Pushed to ${branch}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Push failed: ${error.message}`,
      };
    }
  }

  // ============================================================================
  // Version Branch Operations
  // ============================================================================

  /**
   * Create a new branch for a version
   * Creates from current HEAD and optionally checks out to it
   */
  async createBranch(
    workspacePath: string,
    branchName: string,
    checkout: boolean = true
  ): Promise<GitOperationResult> {
    logger.info('GitService: Creating branch', {
      branchName,
      workspacePath,
      checkout,
    });

    try {
      // Check if branch already exists locally
      const localExists = await this.branchExistsLocally(workspacePath, branchName);
      
      if (localExists) {
        logger.info('GitService: Branch already exists locally', { branchName });
        if (checkout) {
          return await this.checkoutBranch(workspacePath, branchName);
        }
        return {
          success: true,
          message: `Branch ${branchName} already exists`,
          branchName,
        };
      }

      // Check if branch exists on remote
      const remoteExists = await this.branchExistsRemotely(workspacePath, branchName);

      if (remoteExists) {
        // Create local branch tracking remote
        logger.info('GitService: Remote branch exists, creating local tracking branch', {
          branchName,
        });
        await execAsync(`git checkout -b "${branchName}" "origin/${branchName}"`, {
          cwd: workspacePath,
          timeout: 30000,
        });
      } else {
        // Create new branch
        if (checkout) {
          await execAsync(`git checkout -b "${branchName}"`, {
            cwd: workspacePath,
            timeout: 30000,
          });
        } else {
          await execAsync(`git branch "${branchName}"`, {
            cwd: workspacePath,
            timeout: 30000,
          });
        }
      }

      logger.info('GitService: Branch created successfully', {
        branchName,
      });

      return {
        success: true,
        message: `Branch ${branchName} created successfully`,
        branchName,
      };
    } catch (error: any) {
      logger.error('GitService: Failed to create branch', {
        branchName,
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to create branch: ${error.message}`,
      };
    }
  }

  /**
   * Checkout to a specific branch
   */
  async checkoutBranch(workspacePath: string, branchName: string): Promise<GitOperationResult> {
    logger.info('GitService: Checking out branch', {
      branchName,
      workspacePath,
    });

    try {
      // First, try to checkout directly
      try {
        await execAsync(`git checkout "${branchName}"`, {
          cwd: workspacePath,
          timeout: 30000,
        });
      } catch (checkoutError: any) {
        // If local branch doesn't exist, check if remote branch exists
        const remoteExists = await this.branchExistsRemotely(workspacePath, branchName);
        
        if (remoteExists) {
          // Fetch and create local tracking branch
          await execAsync('git fetch origin', {
            cwd: workspacePath,
            timeout: this.gitTimeout,
          });
          await execAsync(`git checkout -b "${branchName}" "origin/${branchName}"`, {
            cwd: workspacePath,
            timeout: 30000,
          });
        } else {
          throw new Error(`Branch ${branchName} does not exist locally or remotely`);
        }
      }

      logger.info('GitService: Checked out branch successfully', {
        branchName,
      });

      return {
        success: true,
        message: `Checked out to ${branchName}`,
        branchName,
      };
    } catch (error: any) {
      logger.error('GitService: Failed to checkout branch', {
        branchName,
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to checkout branch: ${error.message}`,
      };
    }
  }

  /**
   * List all branches (local and remote)
   */
  async listBranches(workspacePath: string): Promise<{ local: string[]; remote: string[]; current: string | null }> {
    try {
      // Get local branches
      const { stdout: localOutput } = await execAsync('git branch --format="%(refname:short)"', {
        cwd: workspacePath,
        timeout: 10000,
      });
      const localBranches = localOutput.trim().split('\n').filter(b => b.trim());

      // Get remote branches
      const { stdout: remoteOutput } = await execAsync('git branch -r --format="%(refname:short)"', {
        cwd: workspacePath,
        timeout: 10000,
      });
      const remoteBranches = remoteOutput.trim().split('\n')
        .filter(b => b.trim() && !b.includes('HEAD'))
        .map(b => b.replace('origin/', ''));

      // Get current branch
      const current = await this.getCurrentBranch(workspacePath);

      return {
        local: localBranches,
        remote: remoteBranches,
        current,
      };
    } catch (error: any) {
      logger.error('GitService: Failed to list branches', {
        error: error.message,
      });
      return {
        local: [],
        remote: [],
        current: null,
      };
    }
  }

  /**
   * Delete a branch (local only, optionally remote)
   */
  async deleteBranch(
    workspacePath: string,
    branchName: string,
    deleteRemote: boolean = false
  ): Promise<GitOperationResult> {
    logger.info('GitService: Deleting branch', {
      branchName,
      deleteRemote,
    });

    try {
      // Cannot delete current branch
      const currentBranch = await this.getCurrentBranch(workspacePath);
      if (currentBranch === branchName) {
        return {
          success: false,
          message: `Cannot delete the currently checked out branch: ${branchName}`,
        };
      }

      // Delete local branch
      await execAsync(`git branch -D "${branchName}"`, {
        cwd: workspacePath,
        timeout: 30000,
      });

      // Optionally delete remote branch
      if (deleteRemote) {
        try {
          await execAsync(`git push origin --delete "${branchName}"`, {
            cwd: workspacePath,
            timeout: this.gitTimeout,
          });
        } catch (remoteError: any) {
          logger.warn('GitService: Failed to delete remote branch (may not exist)', {
            branchName,
            error: remoteError.message,
          });
        }
      }

      logger.info('GitService: Branch deleted successfully', {
        branchName,
      });

      return {
        success: true,
        message: `Branch ${branchName} deleted successfully`,
      };
    } catch (error: any) {
      logger.error('GitService: Failed to delete branch', {
        branchName,
        error: error.message,
      });
      return {
        success: false,
        message: `Failed to delete branch: ${error.message}`,
      };
    }
  }

  /**
   * Generate a branch name from project alias and version
   * Uses the English alias (name_alias) for Git branch compatibility
   * 
   * @param nameAlias - The English alias of the project (from projects.name_alias)
   * @param versionName - The version name (e.g., "v1.0")
   * @returns Branch name in format: {alias}/{version}
   */
  generateVersionBranchName(nameAlias: string, versionName: string): string {
    // Convert alias to slug format (should already be in English)
    const projectSlug = nameAlias
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .substring(0, 50);
    
    return `${projectSlug}/${versionName}`;
  }
}

export default GitService;
