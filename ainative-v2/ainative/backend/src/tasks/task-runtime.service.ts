import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Project } from '../projects/domain/project';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';
import { Task } from './domain/task';
import { resolveGitRemoteUrlWithHttpAuth } from '../git/git-remote-auth.util';
import {
  resolveSubRepoConfigs,
  buildSubRepoExcludePathspecs,
  type SubRepoConfig,
} from '../git/sub-repo.types';
import {
  isSnapshotSyncEnabled,
  hasSubRepoMode,
  isWorkspaceNativeEnabled,
} from '../git/snapshot-sync.types';
import { ProjectGitStateRepository } from '../projects/project-git-state.repository';
import { WorkspaceRepositoryService } from '../git/workspace-repository.service';
import {
  SubRepoDeployBranch,
  TaskDeleteStatus,
} from '../git/workspace-native.types';

type EnsureTaskRuntimeResult = {
  gitBranch: string;
  gitBaseBranch: string;
  gitWorktree: string;
  worktreePath: string;
};

type CleanupTaskRuntimeResult = {
  cleaned: boolean;
  errorMessage?: string;
  deleteStatus?: TaskDeleteStatus;
};

type GitDiffArtifact = {
  name: string;
  content: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class TaskRuntimeService {
  private readonly logger = new Logger(TaskRuntimeService.name);
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly gitlabHttpAuthHost = 'gitlab.yc345.tv';
  private readonly maxDiffLength = 120_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly projectWorkspacePathsService: ProjectWorkspacePathsService,
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
    private readonly gitStateRepository: ProjectGitStateRepository,
    private readonly workspaceRepoService: WorkspaceRepositoryService,
  ) {}

  async ensureRuntime(
    task: Task,
    project: Project,
  ): Promise<EnsureTaskRuntimeResult> {
    if (isWorkspaceNativeEnabled(project) && this.isWorkspaceNativeTask(task)) {
      return this.ensureWorkspaceNativeRuntime(task, project);
    }

    const gitBranch = this.resolveBranch(task, project);
    const gitBaseBranch = this.resolveGitBaseBranch(task, project);
    const allowedRoot = await this.resolveCanonicalPath(
      this.resolveWorktreeAllowedRoot(project),
    );
    const worktreeIdentifier = this.resolveGitWorktreeIdentifier(task);
    const gitWorktree = this.ensureWorktreePathAllowed(
      this.resolveGitWorktreePath(task, project),
      allowedRoot,
    );
    const gitRuntimeEnabled = this.isGitRuntimeEnabled(project);

    if (!gitRuntimeEnabled) {
      await fs.mkdir(gitWorktree, {
        recursive: true,
      });
      await this.enforceRuntimeDirectorySecurity(gitWorktree, allowedRoot);
    } else {
      await this.ensureGitWorktree({
        project,
        worktreePath: gitWorktree,
        allowedRoot,
        branch: gitBranch,
        gitBaseBranch,
      });

      if (!isSnapshotSyncEnabled(project)) {
        await this.ensureSubRepoWorktrees({
          project,
          worktreePath: gitWorktree,
          branch: gitBranch,
        });
      } else {
        const currentState = await this.gitStateRepository.getState(project.id);
        const alreadyActiveForThisTask =
          currentState.gitPhase === 'task_active' &&
          currentState.activeTaskId === task.id;

        if (!alreadyActiveForThisTask) {
          await this.gitStateRepository.transitionPhase(
            project.id,
            currentState.gitPhase,
            'task_active',
          );
          await this.gitStateRepository.setActiveTask(project.id, task.id);
        }
      }
    }

    return {
      gitBranch,
      gitBaseBranch,
      gitWorktree: worktreeIdentifier,
      worktreePath: gitWorktree,
    };
  }

  /**
   * workspace-native 模式：worktree 已由 WorkspaceRepositoryService.createTaskWorktree 创建，
   * 此处只验证 worktree 目录存在并返回已知路径。
   */
  private async ensureWorkspaceNativeRuntime(
    task: Task,
    project: Project,
  ): Promise<EnsureTaskRuntimeResult> {
    const worktreeIdentifier = this.resolveGitWorktreeIdentifier(task);
    const worktreePath = this.resolveGitWorktreePath(task, project);
    const gitBranch = task.gitBranch ?? this.resolveBranch(task, project);
    const gitBaseBranch =
      task.gitBaseBranch ?? this.resolveGitBaseBranch(task, project);
    const workspaceStatus = this.readWorkspaceStatus(task);

    if (workspaceStatus === 'provisioning') {
      throw new ConflictException(
        'workspace-native workspace is still provisioning; retry after workspace is ready.',
      );
    }

    if (workspaceStatus === 'failed') {
      const workspaceError = this.readWorkspaceError(task);
      throw new ConflictException(
        workspaceError
          ? `workspace-native workspace provisioning failed: ${workspaceError}`
          : 'workspace-native workspace provisioning failed. Task may need to be recreated.',
      );
    }

    const exists = await this.pathExists(worktreePath);
    if (!exists) {
      throw new Error(
        workspaceStatus === 'ready'
          ? `workspace-native worktree missing after provisioning ready at ${worktreePath}. Task may need to be recreated.`
          : `workspace-native worktree not found at ${worktreePath}. Task may need to be recreated.`,
      );
    }

    return {
      gitBranch,
      gitBaseBranch,
      gitWorktree: worktreeIdentifier,
      worktreePath,
    };
  }

  private readWorkspaceStatus(
    task: Task,
  ): 'provisioning' | 'ready' | 'failed' | undefined {
    const config = task.configJson;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return undefined;
    }
    const status = (config as Record<string, unknown>).workspaceStatus;
    return status === 'provisioning' ||
      status === 'ready' ||
      status === 'failed'
      ? status
      : undefined;
  }

  private readWorkspaceError(task: Task): string | undefined {
    const config = task.configJson;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return undefined;
    }
    const error = (config as Record<string, unknown>).workspaceError;
    return typeof error === 'string' && error.trim() ? error.trim() : undefined;
  }

  /**
   * workspace-native 模式的 runtime 清理：
   * 1. 删除 worktree
   * 2. 删除本地 task branch
   * 3. 删除远端 workspace task branch
   * 4. 删除子仓远端 task branches（如有部署过）
   */
  private async cleanupWorkspaceNativeRuntime(
    task: Task,
    project: Project,
    options?: { force?: boolean },
  ): Promise<CleanupTaskRuntimeResult> {
    const taskBranch = task.gitBranch?.trim();
    if (!taskBranch) {
      return { cleaned: true };
    }

    const repositoryRoot = this.resolveRepositoryRoot(project);
    const worktreePath = this.resolveGitWorktreePath(task, project);

    const taskConfigJson = (task.configJson ?? {}) as Record<string, unknown>;
    const subRepoDeployBranches = (taskConfigJson.subRepoDeployBranches ??
      []) as SubRepoDeployBranch[];

    const deployBranchesForCleanup = subRepoDeployBranches.map((b) => ({
      prefix: b.prefix,
      url: b.url,
      remoteBranch: b.remoteBranch,
    }));

    try {
      const result = await this.workspaceRepoService.removeTaskWorktree(
        repositoryRoot,
        taskBranch,
        worktreePath,
        deployBranchesForCleanup.length > 0
          ? deployBranchesForCleanup
          : undefined,
        options?.force ? { force: true } : undefined,
      );

      const warnings: string[] = [];
      const openMrs: { prefix: string; url: string; mrUrl: string }[] = [];
      const remoteFailures: string[] = [];

      if (!result.worktreeRemoved) {
        warnings.push('worktree not found or already removed');
      }
      if (!result.remoteBranchDeleted) {
        remoteFailures.push('remote workspace branch deletion failed');
      }
      for (const sub of result.subRepoBranchResults) {
        if (!sub.deleted) {
          if (sub.blockedByMR) {
            openMrs.push({
              prefix: sub.prefix,
              url: sub.url,
              mrUrl: sub.mrUrl ?? '',
            });
          } else {
            remoteFailures.push(
              `sub-repo ${sub.prefix} branch ${sub.remoteBranch}: ${sub.error ?? 'deletion failed'}`,
            );
          }
        }
      }

      if (!options?.force && openMrs.length > 0) {
        warnings.push('blocked_by_open_mr');
        return {
          cleaned: false,
          errorMessage: 'blocked_by_open_mr',
          deleteStatus: {
            status: 'failed',
            warnings,
            openMrs,
          },
        };
      }

      if (!options?.force && remoteFailures.length > 0) {
        warnings.push('blocked_by_remote_failure', ...remoteFailures);
        return {
          cleaned: false,
          errorMessage: 'blocked_by_remote_failure',
          deleteStatus: {
            status: 'failed',
            warnings,
            openMrs: openMrs.length > 0 ? openMrs : undefined,
          },
        };
      }

      warnings.push(...remoteFailures);

      if (warnings.length) {
        this.logger.warn(
          `workspace-native cleanup warnings for task ${task.id}: ${warnings.join('; ')}`,
        );
      }

      return {
        cleaned: true,
        deleteStatus: {
          status: 'done',
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `workspace-native cleanup failed for task ${task.id}: ${errMsg}`,
      );
      return {
        cleaned: false,
        errorMessage: errMsg,
        deleteStatus: {
          status: 'failed',
          warnings: [errMsg],
        },
      };
    }
  }

  async cleanupRuntime(
    task: Task,
    project: Project,
    options?: {
      deleteBranch?: boolean;
      force?: boolean;
    },
  ): Promise<CleanupTaskRuntimeResult> {
    if (isWorkspaceNativeEnabled(project) && this.isWorkspaceNativeTask(task)) {
      return this.cleanupWorkspaceNativeRuntime(task, project, options);
    }

    const worktreeIdentifier = task.gitWorktree?.trim();
    const shouldDeleteBranch = this.shouldDeleteTaskBranch(
      task,
      project,
      options,
    );

    if (!worktreeIdentifier && !shouldDeleteBranch) {
      return {
        cleaned: options?.deleteBranch === true,
      };
    }

    const cleanupErrors: string[] = [];
    let worktreeCleaned = !worktreeIdentifier;

    if (worktreeIdentifier) {
      const worktreePath = this.resolveGitWorktreePath(task, project);
      let worktreeRemoveError: string | null = null;
      const allowedRoot = await this.resolveCanonicalPath(
        this.resolveWorktreeAllowedRoot(project),
      );
      const resolvedWorktreePath =
        await this.resolveCanonicalPath(worktreePath);

      if (!this.isPathWithinAllowedRoot(resolvedWorktreePath, allowedRoot)) {
        return {
          cleaned: false,
          errorMessage:
            'cleanup rejected: worktree path is outside allowed root',
        };
      }

      const hasWorktreePath = await this.pathExists(worktreePath);
      if (hasWorktreePath) {
        try {
          const resolvedRealPath = await fs.realpath(worktreePath);

          if (!this.isPathWithinAllowedRoot(resolvedRealPath, allowedRoot)) {
            return {
              cleaned: false,
              errorMessage:
                'cleanup rejected: worktree realpath is outside allowed root',
            };
          }
        } catch {
          return {
            cleaned: false,
            errorMessage:
              'cleanup rejected: unable to resolve worktree realpath',
          };
        }
      }

      if (this.isGitRuntimeEnabled(project)) {
        const repositoryRoot = this.resolveRepositoryRoot(project);
        const removeResult = await this.runCommand('git', [
          '-C',
          repositoryRoot,
          'worktree',
          'remove',
          '--force',
          worktreePath,
        ]);

        if (!removeResult.success) {
          worktreeRemoveError =
            removeResult.stderr || 'git worktree remove failed';
        }
      }

      try {
        await fs.rm(worktreePath, {
          recursive: true,
          force: true,
        });
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error.message : 'Failed to cleanup worktree',
        );
      }

      worktreeCleaned = !(await this.pathExists(worktreePath));
      if (!worktreeCleaned) {
        if (worktreeRemoveError) {
          cleanupErrors.push(worktreeRemoveError);
        }
        if (cleanupErrors.length === 0) {
          cleanupErrors.push('Failed to cleanup worktree');
        }
      }
    }

    if (shouldDeleteBranch) {
      if (!worktreeCleaned) {
        cleanupErrors.push(
          'git branch cleanup skipped because worktree cleanup failed',
        );
      } else {
        const branchCleanupError = await this.deleteTaskBranch(task, project);
        if (branchCleanupError) {
          cleanupErrors.push(branchCleanupError);
        }
      }
    }

    if (cleanupErrors.length === 0) {
      return {
        cleaned: true,
      };
    }

    return {
      cleaned: false,
      errorMessage: cleanupErrors.join('; '),
    };
  }

  async cleanupTaskDataDir(task: Task, project: Project): Promise<void> {
    if (!task.id?.trim()) {
      return;
    }

    const taskDataDir = path.resolve(
      this.resolveProjectStorageBaseDir(project),
      'tasks',
      task.id,
    );

    const allowedRoot = this.resolveProjectStorageBaseDir(project);
    if (!taskDataDir.startsWith(`${allowedRoot}${path.sep}`)) {
      return;
    }

    try {
      await fs.rm(taskDataDir, { recursive: true, force: true });
    } catch {
      // Non-blocking: task data cleanup failure must not prevent task deletion
    }
  }

  async collectGitDiffArtifact(
    task: Task,
    project: Project,
  ): Promise<GitDiffArtifact | null> {
    const worktreeIdentifier = task.gitWorktree?.trim();
    if (!worktreeIdentifier) {
      return null;
    }

    const worktreePath = this.resolveGitWorktreePath(task, project);

    const allowedRoot = await this.resolveCanonicalPath(
      this.resolveWorktreeAllowedRoot(project),
    );
    const resolvedWorktree = await this.resolveCanonicalPath(worktreePath);
    if (!this.isPathWithinAllowedRoot(resolvedWorktree, allowedRoot)) {
      this.logger.warn(
        `collectGitDiffArtifact: worktree path ${worktreePath} is outside allowed root, skipping`,
      );
      return null;
    }

    const hasGit = await this.pathExists(path.join(resolvedWorktree, '.git'));
    if (!hasGit) {
      return null;
    }

    const managedSubRepos = hasSubRepoMode(project);
    const excludePathspecs = managedSubRepos
      ? []
      : buildSubRepoExcludePathspecs(resolveSubRepoConfigs(project.configJson));

    const [statusResult, diffResult, branchResult, headResult, subjectResult] =
      await Promise.all([
        this.runCommand('git', [
          '-C',
          worktreePath,
          'status',
          '--short',
          ...excludePathspecs,
        ]),
        this.runCommand('git', [
          '-C',
          worktreePath,
          'diff',
          '--no-color',
          ...excludePathspecs,
        ]),
        this.runCommand('git', [
          '-C',
          worktreePath,
          'rev-parse',
          '--abbrev-ref',
          'HEAD',
        ]),
        this.runCommand('git', ['-C', worktreePath, 'rev-parse', 'HEAD']),
        this.runCommand('git', [
          '-C',
          worktreePath,
          'log',
          '-1',
          '--pretty=%s',
        ]),
      ]);

    if (!statusResult.success || !diffResult.success) {
      return null;
    }

    const statusText = statusResult.stdout.trimEnd();
    const diffText = diffResult.stdout.trim();

    if (!statusText && !diffText) {
      return null;
    }

    const boundedDiff = diffText.slice(0, this.maxDiffLength);
    const boundedStatus = statusText.slice(0, 20_000);
    const diffTruncated = diffText.length > boundedDiff.length;
    const statusTruncated = statusText.length > boundedStatus.length;
    const patchBody = boundedDiff || '# no unstaged diff';
    const effectiveBranch =
      branchResult.success && branchResult.stdout
        ? branchResult.stdout.trim()
        : (task.gitBranch ?? null);
    const headCommit =
      headResult.success && headResult.stdout ? headResult.stdout.trim() : null;
    const headSubject =
      subjectResult.success && subjectResult.stdout
        ? subjectResult.stdout.trim()
        : null;
    const changedFiles = boundedStatus
      ? boundedStatus
          .split('\n')
          .map((line) => line.trimEnd())
          .filter(Boolean)
          .map((line) =>
            line.length >= 3 ? line.slice(3).trim() : line.trim(),
          )
          .filter(Boolean)
      : [];

    const content = [
      `# Task ${task.id} git diff`,
      '',
      '```diff',
      patchBody,
      '```',
      '',
      '## commit',
      '```',
      `branch: ${effectiveBranch ?? '# unknown'}`,
      `head: ${headCommit ?? '# unknown'}`,
      `subject: ${headSubject ?? '# unknown'}`,
      '```',
      '',
      '## status',
      '```',
      boundedStatus || '# clean',
      '```',
    ].join('\n');

    return {
      name: `task-${task.id.slice(0, 8)}-changes.diff`,
      content,
      metadata: {
        branch: effectiveBranch,
        gitBaseBranch: task.gitBaseBranch ?? null,
        worktreePath,
        headCommit,
        headSubject,
        changedFiles,
        diffTruncated,
        statusTruncated,
      },
    };
  }

  async resolveAndValidateCreateWorktreePath(
    project: Project,
    requestedWorktreePath: string,
  ): Promise<string> {
    const normalizedPath = requestedWorktreePath.trim();
    if (!normalizedPath) {
      throw new Error('gitWorktree cannot be empty');
    }

    const allowedRoot = await this.resolveCanonicalPath(
      this.resolveWorktreeAllowedRoot(project),
    );

    return this.ensureWorktreePathAllowed(normalizedPath, allowedRoot);
  }

  resolveTaskWorktreePath(task: Task, project: Project): string {
    return this.resolveGitWorktreePath(task, project, {
      preferLegacyExistingPath: true,
    });
  }

  private resolveBranch(task: Task, project: Project): string {
    if (task.gitBranch?.trim()) {
      return task.gitBranch.trim();
    }

    const prefix = this.sanitizeSegment(project.name) || 'ainative';
    return `feature/${prefix}-${task.id.slice(0, 8)}`;
  }

  private shouldDeleteTaskBranch(
    task: Task,
    project: Project,
    options?: {
      deleteBranch?: boolean;
    },
  ): boolean {
    if (!options?.deleteBranch || !this.isGitRuntimeEnabled(project)) {
      return false;
    }

    const branch = task.gitBranch?.trim();
    if (!branch) {
      return false;
    }

    const protectedBranches = new Set(
      [task.gitBaseBranch, project.defaultBranch, 'main', 'master']
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    );

    return !protectedBranches.has(branch);
  }

  private isWorkspaceNativeTask(task: Task): boolean {
    const config = task.configJson as
      | Record<string, unknown>
      | null
      | undefined;
    return Boolean(config?.workspaceSnapshot);
  }

  private resolveGitBaseBranch(task: Task, project: Project): string {
    if (task.gitBaseBranch?.trim()) {
      return task.gitBaseBranch.trim();
    }

    if (isWorkspaceNativeEnabled(project)) {
      return (
        project.defaultBranch?.trim() ||
        this.workspaceRepoService.getBaseBranch()
      );
    }

    return project.defaultBranch || 'main';
  }

  private resolveGitWorktreePath(
    task: Task,
    project: Project,
    options?: { preferLegacyExistingPath?: boolean },
  ): string {
    return this.projectWorkspacePathsService.resolveTaskWorktreePath(
      task,
      project,
      options,
    );
  }

  private resolveGitWorktreeIdentifier(task: Task): string {
    return this.projectWorkspacePathsService.resolveTaskWorktreeIdentifier(
      task,
    );
  }

  private resolveWorktreeBaseDir(project: Project): string {
    return this.projectWorkspacePathsService.resolveWorktreeBaseDir(project);
  }

  private sanitizeSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private isGitRuntimeEnabled(project: Project): boolean {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (typeof config.gitRuntimeEnabled === 'boolean') {
      return config.gitRuntimeEnabled;
    }

    const gitRuntimeEnabled = this.readTrimmedEnv(
      'AINATIVE_GIT_RUNTIME_ENABLED',
    );

    if (gitRuntimeEnabled === 'true') {
      return true;
    }

    if (gitRuntimeEnabled === 'false') {
      return false;
    }

    return true;
  }

  private resolveRepositoryRoot(project: Project): string {
    return this.projectWorkspacePathsService.resolveRepositoryRoot(project);
  }

  private resolveProjectStorageBaseDir(project: Project): string {
    return this.projectWorkspacePathsService.resolveProjectStorageBaseDir(
      project,
    );
  }

  private resolveProjectWorktreeBaseDir(project: Project): string {
    return this.projectWorkspacePathsService.resolveProjectWorktreeBaseDir(
      project,
    );
  }

  private resolveLegacyProjectWorktreeBaseDir(project: Project): string {
    return this.projectWorkspacePathsService.resolveLegacyProjectWorktreeBaseDir(
      project,
    );
  }

  private resolveRepositoryDirectoryName(project: Project): string {
    const parsedFromGitUrl = this.extractRepositoryName(project.gitUrl);
    if (parsedFromGitUrl) {
      return parsedFromGitUrl;
    }

    const projectSegment = this.sanitizeSegment(project.name) || 'project';
    return projectSegment;
  }

  private extractRepositoryName(gitUrl: string): string | null {
    const trimmedUrl = gitUrl.trim();
    if (!trimmedUrl) {
      return null;
    }

    const withoutQuery = trimmedUrl.replace(/[?#].*$/, '').replace(/\/+$/, '');
    const lastSeparatorIndex = Math.max(
      withoutQuery.lastIndexOf('/'),
      withoutQuery.lastIndexOf(':'),
    );
    const rawName =
      lastSeparatorIndex >= 0
        ? withoutQuery.slice(lastSeparatorIndex + 1)
        : withoutQuery;
    const withoutGitSuffix = rawName.replace(/\.git$/i, '');
    const normalized = this.sanitizeSegment(withoutGitSuffix);

    return normalized || null;
  }

  private async ensureProjectRepository(project: Project): Promise<string> {
    return this.projectRepositoryWorkspaceService.ensureProjectRepository(
      project,
    );
  }

  private async deleteTaskBranch(
    task: Task,
    project: Project,
  ): Promise<string | null> {
    const branch = task.gitBranch?.trim();
    if (!branch) {
      return null;
    }

    const repositoryRoot = this.resolveRepositoryRoot(project);
    const hasRepository = await this.pathExists(
      path.join(repositoryRoot, '.git'),
    );
    if (!hasRepository) {
      return null;
    }

    const branchExistsResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      `refs/heads/${branch}`,
    ]);
    if (!branchExistsResult.success) {
      return null;
    }

    const deleteResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'branch',
      '-D',
      branch,
    ]);
    if (deleteResult.success) {
      return null;
    }

    return deleteResult.stderr || `git branch -D ${branch} failed`;
  }

  private async ensureGitWorktree({
    project,
    worktreePath,
    allowedRoot,
    branch,
    gitBaseBranch,
  }: {
    project: Project;
    worktreePath: string;
    allowedRoot: string;
    branch: string;
    gitBaseBranch: string;
  }): Promise<void> {
    this.ensurePathWithinAllowedRoot(worktreePath, allowedRoot);

    const hasWorktreeGit = await this.pathExists(
      path.join(worktreePath, '.git'),
    );
    if (hasWorktreeGit) {
      await this.enforceRuntimeDirectorySecurity(worktreePath, allowedRoot);
      return;
    }

    await fs.rm(worktreePath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    const repositoryRoot = await this.ensureProjectRepository(project);
    const baseRef = await this.resolveBaseRef(repositoryRoot, gitBaseBranch);

    const addResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'worktree',
      'add',
      '--force',
      '-B',
      branch,
      worktreePath,
      baseRef,
    ]);

    if (!addResult.success) {
      throw new Error(addResult.stderr || 'git worktree add failed');
    }

    await this.enforceRuntimeDirectorySecurity(worktreePath, allowedRoot);
  }

  private async ensureSubRepoWorktrees({
    project,
    worktreePath,
    branch,
  }: {
    project: Project;
    worktreePath: string;
    branch: string;
  }): Promise<void> {
    const subRepos = resolveSubRepoConfigs(project.configJson);
    if (subRepos.length === 0) return;

    await this.writeDynamicGitignore(worktreePath, subRepos);

    const repositoryRoot = this.resolveRepositoryRoot(project);

    for (const sub of subRepos) {
      const subRepoBasePath = path.join(repositoryRoot, sub.prefix);
      const subRepoWorktreePath = path.join(worktreePath, sub.prefix);

      const hasSubGit = await this.pathExists(
        path.join(subRepoWorktreePath, '.git'),
      );
      if (hasSubGit) continue;

      const hasBaseGit = await this.pathExists(
        path.join(subRepoBasePath, '.git'),
      );
      if (!hasBaseGit) {
        const resolvedUrl = this.resolveGitRemoteUrl(sub.url);
        await fs.rm(subRepoBasePath, { recursive: true, force: true });
        await fs.mkdir(path.dirname(subRepoBasePath), { recursive: true });

        const cloneResult = await this.runCommand('git', [
          'clone',
          '--origin',
          'origin',
          '--no-checkout',
          resolvedUrl,
          subRepoBasePath,
        ]);

        if (!cloneResult.success) {
          this.logger.warn(
            `ensureSubRepoWorktrees: clone failed for sub-repo "${sub.prefix}": ${cloneResult.stderr}`,
          );
          continue;
        }

        const fetchResult = await this.runCommand('git', [
          '-C',
          subRepoBasePath,
          'fetch',
          '--all',
          '--prune',
        ]);

        if (!fetchResult.success) {
          this.logger.warn(
            `ensureSubRepoWorktrees: fetch failed for sub-repo "${sub.prefix}": ${fetchResult.stderr}`,
          );
        }
      }

      await fs.rm(subRepoWorktreePath, { recursive: true, force: true });

      const baseRef = await this.resolveBaseRef(subRepoBasePath, sub.branch);

      const addResult = await this.runCommand('git', [
        '-C',
        subRepoBasePath,
        'worktree',
        'add',
        '--force',
        '-B',
        branch,
        subRepoWorktreePath,
        baseRef,
      ]);

      if (!addResult.success) {
        throw new Error(
          `git worktree add failed for sub-repo ${sub.prefix}: ${addResult.stderr}`,
        );
      }
    }
  }

  private async writeDynamicGitignore(
    worktreePath: string,
    subRepos: SubRepoConfig[],
  ): Promise<void> {
    const gitignorePath = path.join(worktreePath, '.gitignore');
    let content = '';

    try {
      content = await fs.readFile(gitignorePath, 'utf-8');
    } catch {
      // file may not exist yet
    }

    const marker = '# --- ainative sub-repos (auto-generated) ---';
    const markerEnd = '# --- end ainative sub-repos ---';

    const markerIdx = content.indexOf(marker);
    if (markerIdx !== -1) {
      const endIdx = content.indexOf(markerEnd);
      if (endIdx !== -1) {
        content =
          content.slice(0, markerIdx) +
          content.slice(endIdx + markerEnd.length);
      } else {
        // markerEnd missing (corrupted file) — remove from marker to EOF
        content = content.slice(0, markerIdx);
      }
    }

    const block = [
      '',
      marker,
      ...subRepos.map((s) => `${s.prefix}/`),
      markerEnd,
      '',
    ].join('\n');

    content = content.trimEnd() + block;

    await fs.writeFile(gitignorePath, content, 'utf-8');
  }

  private async resolveBaseRef(
    repositoryRoot: string,
    gitBaseBranch: string,
  ): Promise<string> {
    const remoteRef = `origin/${gitBaseBranch}`;
    const [remoteVerifyResult, localVerifyResult] = await Promise.all([
      this.runCommand('git', [
        '-C',
        repositoryRoot,
        'rev-parse',
        '--verify',
        remoteRef,
      ]),
      this.runCommand('git', [
        '-C',
        repositoryRoot,
        'rev-parse',
        '--verify',
        gitBaseBranch,
      ]),
    ]);

    if (remoteVerifyResult.success && localVerifyResult.success) {
      const localContainsRemote = await this.runCommand('git', [
        '-C',
        repositoryRoot,
        'merge-base',
        '--is-ancestor',
        remoteRef,
        gitBaseBranch,
      ]);
      if (localContainsRemote.success) {
        return gitBaseBranch;
      }

      const remoteContainsLocal = await this.runCommand('git', [
        '-C',
        repositoryRoot,
        'merge-base',
        '--is-ancestor',
        gitBaseBranch,
        remoteRef,
      ]);
      return remoteContainsLocal.success ? remoteRef : gitBaseBranch;
    }

    if (remoteVerifyResult.success) {
      return remoteRef;
    }

    if (localVerifyResult.success) {
      return gitBaseBranch;
    }

    return 'HEAD';
  }

  private async runCommand(
    command: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, {
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf-8');
      });

      childProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, this.defaultGitTimeoutMs);

      childProcess.on('error', (error) => {
        clearTimeout(timeoutRef);
        resolve({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: error.message,
        });
      });

      childProcess.on('close', (code) => {
        clearTimeout(timeoutRef);
        resolve({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      });
    });
  }

  private resolveGitRemoteUrl(gitUrl: string): string {
    return resolveGitRemoteUrlWithHttpAuth(gitUrl, {
      targetHost: this.gitlabHttpAuthHost,
      username:
        this.configService.get<string>('GITLAB_USERNAME', { infer: true }) ??
        'oauth2',
      token: this.configService.get<string>('GITLAB_TOKEN', { infer: true }),
    });
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async listWorktreeFiles(
    task: Task,
    project: Project,
    options?: { prefix?: string },
  ): Promise<string[]> {
    const worktreeIdentifier = task.gitWorktree?.trim();
    if (!worktreeIdentifier) {
      return [];
    }

    const worktreePath = this.resolveGitWorktreePath(task, project);

    const exists = await this.pathExists(worktreePath);
    if (!exists) {
      return [];
    }

    const maxDepth = 8;
    const maxFiles = 200;
    const result: string[] = [];

    const walk = async (
      dir: string,
      relativePrefix: string,
      depth: number,
    ): Promise<void> => {
      if (depth > maxDepth || result.length >= maxFiles) {
        return;
      }

      let entries: { name: string; isFile: boolean }[];
      try {
        const names = await fs.readdir(dir);
        const stats = await Promise.all(
          names.map(async (name) => {
            if (name === '.git') {
              return null;
            }
            const fullPath = path.join(dir, name);
            const stat = await fs.stat(fullPath);
            return { name, isFile: stat.isFile() };
          }),
        );
        entries = stats.filter((s): s is { name: string; isFile: boolean } =>
          Boolean(s),
        );
      } catch {
        return;
      }

      for (const { name, isFile } of entries) {
        if (result.length >= maxFiles) {
          return;
        }
        const relativePath = relativePrefix
          ? `${relativePrefix}/${name}`
          : name;
        if (isFile) {
          result.push(relativePath);
        } else {
          await walk(path.join(dir, name), relativePath, depth + 1);
        }
      }
    };

    await walk(worktreePath, '', 0);

    const prefix = options?.prefix?.trim();
    const filtered =
      prefix && prefix.length > 0
        ? result.filter((p) => p === prefix || p.startsWith(`${prefix}/`))
        : result;

    return filtered.sort((a, b) => a.localeCompare(b));
  }

  async readFileFromWorktree(
    task: Task,
    project: Project,
    relativePath: string,
  ): Promise<string | null> {
    const worktreeIdentifier = task.gitWorktree?.trim();
    if (!worktreeIdentifier) {
      return null;
    }

    const worktreePath = this.resolveGitWorktreePath(task, project);

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      return null;
    }

    const fullPath = path.resolve(worktreePath, normalized);
    const worktreeResolved = path.resolve(worktreePath);
    const relative = path.relative(worktreeResolved, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    const exists = await this.pathExists(fullPath);
    if (!exists) {
      return null;
    }

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        return null;
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  private resolveWorktreeAllowedRoot(project: Project): string {
    return this.projectWorkspacePathsService.resolveWorktreeAllowedRoot(
      project,
    );
  }

  private ensureWorktreePathAllowed(
    worktreePath: string,
    allowedRoot: string,
  ): string {
    return this.projectWorkspacePathsService.ensurePathWithinAllowedRoot(
      worktreePath,
      allowedRoot,
      { allowEqual: false },
    );
  }

  private readTrimmedEnv(key: string): string | undefined {
    return this.configService.get<string>(key, { infer: true })?.trim();
  }

  private ensurePathWithinAllowedRoot(
    targetPath: string,
    allowedRoot: string,
  ): void {
    if (!this.isPathWithinAllowedRoot(targetPath, allowedRoot)) {
      throw new Error(
        `worktree path ${targetPath} is outside allowed root ${allowedRoot}`,
      );
    }
  }

  private isProtectedBranch(branchName: string): boolean {
    const protected_names = ['main', 'master', 'develop', 'dev', 'release'];
    const lower = branchName.toLowerCase();
    return protected_names.includes(lower) || lower.startsWith('release/');
  }

  private isPathWithinAllowedRoot(
    targetPath: string,
    allowedRoot: string,
  ): boolean {
    return this.projectWorkspacePathsService.isPathWithinAllowedRoot(
      targetPath,
      allowedRoot,
      {
        allowEqual: false,
      },
    );
  }

  private async enforceRuntimeDirectorySecurity(
    worktreePath: string,
    allowedRoot: string,
  ): Promise<void> {
    const resolvedWorktreePath = await fs.realpath(worktreePath);
    this.ensurePathWithinAllowedRoot(resolvedWorktreePath, allowedRoot);

    await fs.chmod(resolvedWorktreePath, 0o700);
  }

  private async resolveCanonicalPath(targetPath: string): Promise<string> {
    const resolvedPath = path.resolve(targetPath);

    try {
      return await fs.realpath(resolvedPath);
    } catch {
      return resolvedPath;
    }
  }
}
