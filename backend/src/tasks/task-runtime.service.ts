import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { Project } from '../projects/domain/project';
import { Task } from './domain/task';

type EnsureTaskRuntimeResult = {
  branch: string;
  gitBaseBranch: string;
  gitWorktreePath: string;
  sandboxCleanupAt: Date;
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

type RuntimeMeta = {
  taskId: string;
  projectId: string;
  branch: string;
  gitBaseBranch: string;
  worktreePath: string;
  allowedRoot: string;
  repositoryRoot?: string;
  generatedAt: string;
  sandbox: {
    type: 'directory' | 'git-worktree';
    note: string;
  };
};

@Injectable()
export class TaskRuntimeService {
  private readonly defaultRetentionHours = 48;
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly maxDiffLength = 120_000;
  private readonly defaultBaseDir = path.resolve(
    process.cwd(),
    'tmp',
    'worktrees',
  );
  private readonly runtimeMetaFilename = '.ainative-runtime.json';

  async ensureRuntime(
    task: Task,
    project: Project,
  ): Promise<EnsureTaskRuntimeResult> {
    const branch = this.resolveBranch(task, project);
    const gitBaseBranch = this.resolveGitBaseBranch(task, project);
    const sandboxCleanupAt = this.resolveCleanupAt(task, project);
    const allowedRoot = await this.resolveCanonicalPath(
      this.resolveWorktreeAllowedRoot(project),
    );
    const gitWorktreePath = this.ensureWorktreePathAllowed(
      this.resolveGitWorktreePath(task, project),
      allowedRoot,
    );
    const runtimeMeta: RuntimeMeta = {
      taskId: task.id,
      projectId: project.id,
      branch,
      gitBaseBranch,
      worktreePath: gitWorktreePath,
      allowedRoot,
      generatedAt: new Date().toISOString(),
      sandbox: {
        type: 'directory',
        note: 'MVP sandbox uses process-local isolated directory.',
      },
    };

    const gitRuntimeEnabled = this.isGitRuntimeEnabled(project);

    if (!gitRuntimeEnabled) {
      await fs.mkdir(gitWorktreePath, {
        recursive: true,
      });
      await this.enforceRuntimeDirectorySecurity(gitWorktreePath, allowedRoot);

      runtimeMeta.sandbox = {
        type: 'directory',
        note: 'Git runtime disabled; using isolated directory sandbox.',
      };
    } else {
      try {
        const repositoryRoot = await this.ensureProjectRepository(project);
        await this.ensureGitWorktree({
          repositoryRoot,
          worktreePath: gitWorktreePath,
          allowedRoot,
          branch,
          gitBaseBranch,
        });
        runtimeMeta.repositoryRoot = repositoryRoot;

        runtimeMeta.sandbox = {
          type: 'git-worktree',
          note: 'Runtime prepared with git clone/fetch and worktree.',
        };
      } catch (error) {
        await fs.mkdir(gitWorktreePath, {
          recursive: true,
        });
        await this.enforceRuntimeDirectorySecurity(gitWorktreePath, allowedRoot);

        runtimeMeta.sandbox = {
          type: 'directory',
          note:
            error instanceof Error
              ? `Fallback to directory sandbox: ${error.message}`
              : 'Fallback to directory sandbox: git runtime preparation failed',
        };
      }
    }

    const metaPath = path.join(gitWorktreePath, this.runtimeMetaFilename);
    await fs.writeFile(metaPath, JSON.stringify(runtimeMeta, null, 2), 'utf-8');

    return {
      branch,
      gitBaseBranch,
      gitWorktreePath,
      sandboxCleanupAt,
    };
  }

  async cleanupRuntime(task: Task): Promise<CleanupTaskRuntimeResult> {
    const worktreePath = task.gitWorktreePath?.trim();
    if (!worktreePath) {
      return {
        cleaned: false,
      };
    }

    const cleanupErrors: string[] = [];
    const runtimeMeta = await this.readRuntimeMeta(worktreePath);
    const allowedRoot = await this.resolveCanonicalPath(
      runtimeMeta?.allowedRoot
        ? runtimeMeta.allowedRoot
        : this.resolveGlobalWorktreeAllowedRoot(),
    );
    const resolvedWorktreePath = await this.resolveCanonicalPath(worktreePath);

    if (!this.isPathWithinAllowedRoot(resolvedWorktreePath, allowedRoot)) {
      return {
        cleaned: false,
        errorMessage: 'cleanup rejected: worktree path is outside allowed root',
      };
    }

    if (runtimeMeta?.taskId && runtimeMeta.taskId !== task.id) {
      return {
        cleaned: false,
        errorMessage:
          'cleanup rejected: runtime metadata task ownership mismatch',
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
          errorMessage: 'cleanup rejected: unable to resolve worktree realpath',
        };
      }
    }

    if (
      runtimeMeta?.sandbox.type === 'git-worktree' &&
      runtimeMeta.repositoryRoot?.trim()
    ) {
      const removeResult = await this.runCommand('git', [
        '-C',
        runtimeMeta.repositoryRoot.trim(),
        'worktree',
        'remove',
        '--force',
        worktreePath,
      ]);

      if (!removeResult.success) {
        cleanupErrors.push(removeResult.stderr || 'git worktree remove failed');
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

    const stillExists = await this.pathExists(worktreePath);
    if (!stillExists) {
      return {
        cleaned: true,
      };
    }

    return {
      cleaned: false,
      errorMessage: cleanupErrors.join('; ') || 'Failed to cleanup worktree',
    };
  }

  async collectGitDiffArtifact(task: Task): Promise<GitDiffArtifact | null> {
    const worktreePath = task.gitWorktreePath?.trim();

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
        : (task.branch ?? null);
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

  private resolveBranch(task: Task, project: Project): string {
    if (task.branch?.trim()) {
      return task.branch.trim();
    }

    const prefix = this.sanitizeSegment(project.name) || 'ainative';
    return `${prefix}/task-${task.id.slice(0, 8)}`;
  }

  private resolveGitBaseBranch(task: Task, project: Project): string {
    if (task.gitBaseBranch?.trim()) {
      return task.gitBaseBranch.trim();
    }

    return project.defaultBranch || 'main';
  }

  private resolveGitWorktreePath(task: Task, project: Project): string {
    if (task.gitWorktreePath?.trim()) {
      return task.gitWorktreePath.trim();
    }

    const baseDir = this.resolveWorktreeBaseDir(project);
    const projectSegment = this.sanitizeSegment(project.name) || 'project';

    return path.join(baseDir, `${projectSegment}-${task.id}`);
  }

  private resolveCleanupAt(task: Task, project: Project): Date {
    if (task.sandboxCleanupAt) {
      return task.sandboxCleanupAt;
    }

    const retentionHours = this.resolveRetentionHours(project);
    return new Date(Date.now() + retentionHours * 60 * 60 * 1000);
  }

  private resolveWorktreeBaseDir(project: Project): string {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.worktreeBaseDir === 'string' &&
      config.worktreeBaseDir.trim()
    ) {
      return path.resolve(config.worktreeBaseDir);
    }

    if (process.env.AINATIVE_WORKTREE_BASE_DIR?.trim()) {
      return path.resolve(process.env.AINATIVE_WORKTREE_BASE_DIR);
    }

    return this.defaultBaseDir;
  }

  private resolveRetentionHours(project: Project): number {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    if (
      typeof config.worktreeRetentionHours === 'number' &&
      config.worktreeRetentionHours > 0
    ) {
      return Math.floor(config.worktreeRetentionHours);
    }

    return this.defaultRetentionHours;
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

    return process.env.AINATIVE_GIT_RUNTIME_ENABLED === 'true';
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
      (typeof config.repoCacheBaseDir === 'string' &&
      config.repoCacheBaseDir.trim()
        ? config.repoCacheBaseDir.trim()
        : process.env.AINATIVE_REPO_CACHE_BASE_DIR?.trim()) ||
      path.resolve(this.defaultBaseDir, '.repos');

    const projectSegment = this.sanitizeSegment(project.name) || 'project';

    return path.resolve(cacheBaseDir, `${projectSegment}-${project.id}`);
  }

  private async ensureProjectRepository(project: Project): Promise<string> {
    const repositoryRoot = this.resolveRepositoryRoot(project);
    const gitDirPath = path.join(repositoryRoot, '.git');
    const hasGit = await this.pathExists(gitDirPath);

    if (!hasGit) {
      await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });

      const cloneResult = await this.runCommand('git', [
        'clone',
        '--origin',
        'origin',
        '--no-checkout',
        project.gitUrl,
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
        project.gitUrl,
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

  private async ensureGitWorktree({
    repositoryRoot,
    worktreePath,
    allowedRoot,
    branch,
    gitBaseBranch,
  }: {
    repositoryRoot: string;
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

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async readRuntimeMeta(
    worktreePath: string,
  ): Promise<RuntimeMeta | null> {
    const metaPath = path.join(worktreePath, this.runtimeMetaFilename);
    const hasMeta = await this.pathExists(metaPath);

    if (!hasMeta) {
      return null;
    }

    try {
      const rawText = await fs.readFile(metaPath, 'utf-8');
      const parsed = JSON.parse(rawText) as RuntimeMeta;

      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return parsed;
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

    if (process.env.AINATIVE_WORKTREE_ALLOWED_ROOT?.trim()) {
      return path.resolve(process.env.AINATIVE_WORKTREE_ALLOWED_ROOT.trim());
    }

    return this.resolveWorktreeBaseDir(project);
  }

  private resolveGlobalWorktreeAllowedRoot(): string {
    if (process.env.AINATIVE_WORKTREE_ALLOWED_ROOT?.trim()) {
      return path.resolve(process.env.AINATIVE_WORKTREE_ALLOWED_ROOT.trim());
    }

    if (process.env.AINATIVE_WORKTREE_BASE_DIR?.trim()) {
      return path.resolve(process.env.AINATIVE_WORKTREE_BASE_DIR.trim());
    }

    return this.defaultBaseDir;
  }

  private ensureWorktreePathAllowed(
    worktreePath: string,
    allowedRoot: string,
  ): string {
    const resolvedWorktreePath = path.resolve(worktreePath);
    this.ensurePathWithinAllowedRoot(resolvedWorktreePath, allowedRoot);
    return resolvedWorktreePath;
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
