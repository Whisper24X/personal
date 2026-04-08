import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import { RunnerOrchestrationService } from '../containers/runner-orchestration.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { resolveGitRemoteUrlWithHttpAuth } from '../git/git-remote-auth.util';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { Project } from './domain/project';
import { ProjectAccessService } from './project-access.service';

export type EnsureProjectRepositoryOptions = {
  syncRemote?: boolean;
};

@Injectable()
export class ProjectRepositoryWorkspaceService {
  private readonly logger = new Logger(ProjectRepositoryWorkspaceService.name);
  private readonly defaultGitTimeoutMs = 60_000;
  private readonly gitlabHttpAuthHost = 'gitlab.yc345.tv';
  private readonly repositorySyncLocks = new Map<
    string,
    { tail: Promise<void>; pending: number }
  >();

  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly configService: ConfigService,
    private readonly projectWorkspacePathsService: ProjectWorkspacePathsService,
    private readonly runnerOrchestration?: RunnerOrchestrationService,
  ) {}

  async ensureProjectRepositoryReady(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
    options: EnsureProjectRepositoryOptions = {},
  ): Promise<{ project: Project; repositoryRoot: string }> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    try {
      const repositoryRoot = await this.ensureProjectRepository(
        project,
        options,
      );

      return {
        project,
        repositoryRoot,
      };
    } catch (error) {
      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }
  }

  async runWithProjectRepositoryLock<T>(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
    options: EnsureProjectRepositoryOptions = {},
    operation: (ctx: {
      project: Project;
      repositoryRoot: string;
    }) => Promise<T>,
  ): Promise<T> {
    const project = await this.projectAccessService.assertCanAccessProject(
      projectId,
      currentUser,
    );
    const repositoryRoot = this.resolveRepositoryRoot(project);

    try {
      return await this.withRepositorySyncLock(repositoryRoot, async () => {
        await this.syncProjectRepositoryContent(
          project,
          repositoryRoot,
          options,
        );

        return operation({ project, repositoryRoot });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException(
        this.formatGitSyncFailureMessage(error, project.gitUrl),
      );
    }
  }

  async ensureProjectRepository(
    project: Project,
    options: EnsureProjectRepositoryOptions = {},
  ): Promise<string> {
    const repositoryRoot = this.resolveRepositoryRoot(project);

    return this.withRepositorySyncLock(repositoryRoot, async () => {
      await this.syncProjectRepositoryContent(project, repositoryRoot, options);

      return repositoryRoot;
    });
  }

  async syncRunnerConfigBackup(
    project: Project,
    repositoryRoot?: string,
  ): Promise<void> {
    if (!this.shouldWriteRunnerConfigBackup(project)) {
      return;
    }

    if (!this.runnerOrchestration) {
      return;
    }

    try {
      const resolvedRepositoryRoot =
        repositoryRoot ??
        (await this.ensureProjectRepository(project, { syncRemote: false }));

      await this.runnerOrchestration.writeProjectRunnerConfigFile(
        project,
        resolvedRepositoryRoot,
      );
    } catch (error) {
      this.logger.warn(
        `runner_config_backup_sync_failed ${JSON.stringify({
          projectId: project.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        })}`,
      );
    }
  }

  resolveRepositoryRoot(project: Project): string {
    return this.projectWorkspacePathsService.resolveRepositoryRoot(project);
  }

  normalizeProjectDocPath(value: string): string {
    return this.projectWorkspacePathsService.normalizeProjectDocPath(value);
  }

  private shouldWriteRunnerConfigBackup(project: Project): boolean {
    const config = (project.configJson ?? {}) as Record<string, unknown>;

    return Boolean(
      typeof config.repoLocalPath === 'string' && config.repoLocalPath.trim(),
    );
  }

  private async withRepositorySyncLock<T>(
    repositoryRoot: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let state = this.repositorySyncLocks.get(repositoryRoot);

    if (!state) {
      state = {
        tail: Promise.resolve(),
        pending: 0,
      };
      this.repositorySyncLocks.set(repositoryRoot, state);
    }

    const previous = state.tail;
    state.pending += 1;

    let releaseCurrent!: () => void;
    state.tail = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent();
      state.pending -= 1;

      if (state.pending === 0) {
        this.repositorySyncLocks.delete(repositoryRoot);
      }
    }
  }

  private async syncProjectRepositoryContent(
    project: Project,
    repositoryRoot: string,
    options: EnsureProjectRepositoryOptions = {},
  ): Promise<void> {
    const defaultBranch = project.defaultBranch?.trim() || 'main';
    const gitDirPath = path.join(repositoryRoot, '.git');
    const hasGit = await this.pathExists(gitDirPath);
    const shouldSyncRemote = options.syncRemote ?? true;
    const resolvedGitUrl = this.resolveGitRemoteUrl(project.gitUrl);

    if (!hasGit) {
      try {
        await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });
      } catch (mkdirError) {
        const message =
          mkdirError instanceof Error ? mkdirError.message : 'Unknown error';

        throw new Error(
          `Cannot create project repository directory: ${this.truncateError(message)}`,
        );
      }

      const cloneResult = await this.runCommand('git', [
        'clone',
        '--origin',
        'origin',
        '--branch',
        defaultBranch,
        resolvedGitUrl,
        repositoryRoot,
      ]);

      if (!cloneResult.success) {
        throw new Error(
          cloneResult.stderr || `git clone failed for ${project.gitUrl}`,
        );
      }
    } else if (shouldSyncRemote) {
      const setUrlResult = await this.runCommand('git', [
        '-C',
        repositoryRoot,
        'remote',
        'set-url',
        'origin',
        resolvedGitUrl,
      ]);

      if (!setUrlResult.success) {
        throw new Error(setUrlResult.stderr || 'git remote set-url failed');
      }
    }

    if (!shouldSyncRemote) {
      return;
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
  }

  private formatGitSyncFailureMessage(error: unknown, gitUrl: string): string {
    if (error instanceof BadRequestException) {
      return String(error.message);
    }

    if (error instanceof Error) {
      return `Failed to sync repository for ${gitUrl}: ${this.truncateError(error.message)}`;
    }

    return `Failed to sync repository for ${gitUrl}`;
  }

  private truncateError(message: string): string {
    const normalized = message.trim();
    if (!normalized) {
      return 'Unknown git error';
    }

    if (normalized.length <= 500) {
      return normalized;
    }

    return `${normalized.slice(0, 500)}...`;
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
}
