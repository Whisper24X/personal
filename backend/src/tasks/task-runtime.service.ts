import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { Project } from '../projects/domain/project';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
import { Task } from './domain/task';
import { resolveGitRemoteUrlWithHttpAuth } from '../git/git-remote-auth.util';

type EnsureTaskRuntimeResult = {
  gitBranch: string;
  gitBaseBranch: string;
  gitWorktree: string;
  worktreePath: string;
};

type CleanupTaskRuntimeResult = {
  cleaned: boolean;
  errorMessage?: string;
};

type GitDiffArtifact = {
  name: string;
  content: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class TaskRuntimeService {
  private readonly configService = new ConfigService();
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly gitlabHttpAuthHost = 'gitlab.yc345.tv';
  private readonly maxDiffLength = 120_000;
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
  );
  private readonly legacyDefaultWorktreeBaseDir = path.resolve(
    process.cwd(),
    'tmp',
    'worktrees',
  );

  async ensureRuntime(
    task: Task,
    project: Project,
  ): Promise<EnsureTaskRuntimeResult> {
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
    }

    return {
      gitBranch,
      gitBaseBranch,
      gitWorktree: worktreeIdentifier,
      worktreePath: gitWorktree,
    };
  }

  async cleanupRuntime(
    task: Task,
    project: Project,
    options?: {
      deleteBranch?: boolean;
    },
  ): Promise<CleanupTaskRuntimeResult> {
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

  async collectGitDiffArtifact(task: Task): Promise<GitDiffArtifact | null> {
    const worktreePath = task.gitWorktree?.trim();

    if (!worktreePath) {
      return null;
    }

    const hasGit = await this.pathExists(path.join(worktreePath, '.git'));
    if (!hasGit) {
      return null;
    }

    const [statusResult, diffResult, branchResult, headResult, subjectResult] =
      await Promise.all([
        this.runCommand('git', ['-C', worktreePath, 'status', '--short']),
        this.runCommand('git', ['-C', worktreePath, 'diff', '--no-color']),
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

  private resolveGitBaseBranch(task: Task, project: Project): string {
    if (task.gitBaseBranch?.trim()) {
      return task.gitBaseBranch.trim();
    }

    return project.defaultBranch || 'main';
  }

  private resolveGitWorktreePath(
    task: Task,
    project: Project,
    options?: { preferLegacyExistingPath?: boolean },
  ): string {
    const gitWorktree = this.resolveGitWorktreeIdentifier(task);

    if (path.isAbsolute(gitWorktree)) {
      return gitWorktree;
    }

    const baseDir = this.resolveWorktreeBaseDir(project);
    const nextPath = path.join(baseDir, gitWorktree);

    if (options?.preferLegacyExistingPath) {
      const legacyBaseDir = this.resolveLegacyProjectWorktreeBaseDir(project);
      const legacyPath = path.join(legacyBaseDir, gitWorktree);

      if (legacyPath !== nextPath && existsSync(legacyPath)) {
        return legacyPath;
      }
    }

    return nextPath;
  }

  private resolveGitWorktreeIdentifier(task: Task): string {
    const gitWorktree = task.gitWorktree?.trim();

    if (gitWorktree) {
      return gitWorktree;
    }

    return `wk-${task.id}`;
  }

  private resolveWorktreeBaseDir(project: Project): string {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.worktreeBaseDir === 'string' &&
      config.worktreeBaseDir.trim()
    ) {
      return path.resolve(config.worktreeBaseDir);
    }

    const worktreeBaseDir = this.readTrimmedEnv('AINATIVE_WORKTREE_BASE_DIR');
    if (worktreeBaseDir) {
      return path.resolve(worktreeBaseDir);
    }

    return this.resolveProjectWorktreeBaseDir(project);
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
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.repoLocalPath === 'string' &&
      config.repoLocalPath.trim()
    ) {
      return path.resolve(config.repoLocalPath.trim());
    }

    const cacheBaseDir =
      typeof config.repoCacheBaseDir === 'string' &&
      config.repoCacheBaseDir.trim()
        ? config.repoCacheBaseDir.trim()
        : this.readTrimmedEnv('AINATIVE_REPO_CACHE_BASE_DIR');

    const repositoryDirName = this.resolveRepositoryDirectoryName(project);

    if (!cacheBaseDir) {
      return path.join(
        this.resolveProjectStorageBaseDir(project),
        repositoryDirName,
      );
    }

    return path.resolve(cacheBaseDir, `${repositoryDirName}-${project.id}`);
  }

  private resolveProjectStorageBaseDir(project: Project): string {
    const businessLineId =
      project.businessLineId?.trim() || 'unknown-business-line';
    const projectId = project.id?.trim() || 'unknown-project';

    return path.resolve(
      this.defaultDataRootDir,
      businessLineId,
      'projects',
      projectId,
    );
  }

  private resolveProjectWorktreeBaseDir(project: Project): string {
    return path.join(this.resolveProjectStorageBaseDir(project), 'worktrees');
  }

  private resolveLegacyProjectWorktreeBaseDir(project: Project): string {
    const businessLineId =
      project.businessLineId?.trim() || 'unknown-business-line';
    const projectId = project.id?.trim() || 'unknown-project';

    return path.resolve(
      this.defaultDataRootDir,
      businessLineId,
      'worktrees',
      projectId,
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
    const repositoryRoot = this.resolveRepositoryRoot(project);
    const gitDirPath = path.join(repositoryRoot, '.git');
    const hasGit = await this.pathExists(gitDirPath);
    const resolvedGitUrl = this.resolveGitRemoteUrl(project.gitUrl);

    if (!hasGit) {
      await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });

      const cloneResult = await this.runCommand('git', [
        'clone',
        '--origin',
        'origin',
        '--no-checkout',
        resolvedGitUrl,
        repositoryRoot,
      ]);

      if (!cloneResult.success) {
        throw new Error(
          cloneResult.stderr || `git clone failed for ${project.gitUrl}`,
        );
      }
    } else {
      await this.runCommand('git', [
        '-C',
        repositoryRoot,
        'remote',
        'set-url',
        'origin',
        resolvedGitUrl,
      ]);
    }

    const fetchResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'fetch',
      '--all',
      '--prune',
    ]);

    if (!fetchResult.success) {
      throw new Error(fetchResult.stderr || 'git fetch failed');
    }

    return repositoryRoot;
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

  private async resolveBaseRef(
    repositoryRoot: string,
    gitBaseBranch: string,
  ): Promise<string> {
    const remoteRef = `origin/${gitBaseBranch}`;
    const remoteVerifyResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      remoteRef,
    ]);

    if (remoteVerifyResult.success) {
      return remoteRef;
    }

    const localVerifyResult = await this.runCommand('git', [
      '-C',
      repositoryRoot,
      'rev-parse',
      '--verify',
      gitBaseBranch,
    ]);

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
    options?: { prefix?: string },
  ): Promise<string[]> {
    const worktreePath = task.gitWorktree?.trim();
    if (!worktreePath) {
      return [];
    }

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
    relativePath: string,
  ): Promise<string | null> {
    const worktreePath = task.gitWorktree?.trim();
    if (!worktreePath) {
      return null;
    }

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
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.worktreeAllowedRoot === 'string' &&
      config.worktreeAllowedRoot.trim()
    ) {
      return path.resolve(config.worktreeAllowedRoot.trim());
    }

    const allowedRoot = this.readTrimmedEnv('AINATIVE_WORKTREE_ALLOWED_ROOT');
    if (allowedRoot) {
      return path.resolve(allowedRoot);
    }

    return this.resolveWorktreeBaseDir(project);
  }

  private resolveGlobalWorktreeAllowedRoot(): string {
    const allowedRoot = this.readTrimmedEnv('AINATIVE_WORKTREE_ALLOWED_ROOT');
    if (allowedRoot) {
      return path.resolve(allowedRoot);
    }

    const worktreeBaseDir = this.readTrimmedEnv('AINATIVE_WORKTREE_BASE_DIR');
    if (worktreeBaseDir) {
      return path.resolve(worktreeBaseDir);
    }

    return this.legacyDefaultWorktreeBaseDir;
  }

  private ensureWorktreePathAllowed(
    worktreePath: string,
    allowedRoot: string,
  ): string {
    const resolvedWorktreePath = path.resolve(worktreePath);
    this.ensurePathWithinAllowedRoot(resolvedWorktreePath, allowedRoot);
    return resolvedWorktreePath;
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
    const normalizedRoot = path.resolve(allowedRoot);
    const normalizedTarget = path.resolve(targetPath);
    const relativePath = path.relative(normalizedRoot, normalizedTarget);

    return (
      relativePath !== '' &&
      !relativePath.startsWith('..') &&
      !path.isAbsolute(relativePath)
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
