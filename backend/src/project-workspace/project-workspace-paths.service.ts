import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import type { Project } from '../projects/domain/project';
import type { Task } from '../tasks/domain/task';

type ProjectPathIdentity = Pick<Project, 'id' | 'businessLineId'>;
type RepositoryIdentity = Pick<Project, 'name' | 'gitUrl' | 'configJson'> &
  ProjectPathIdentity;
type WorktreeIdentity = Pick<Project, 'configJson'> & ProjectPathIdentity;
type TaskWorktreeIdentity = Pick<Task, 'id' | 'gitWorktree'>;

@Injectable()
export class ProjectWorkspacePathsService {
  constructor(private readonly configService: ConfigService) {}

  resolveAinativeDataRootDir(): string {
    const configuredPath = this.readTrimmedEnv('AINATIVE_DATA_ROOT_DIR');
    if (!configuredPath) {
      throw new Error(
        'AINATIVE_DATA_ROOT_DIR is required. Set it in the active backend .env file.',
      );
    }

    return path.resolve(this.expandHomePath(configuredPath));
  }

  resolveProjectStorageBaseDir(project: ProjectPathIdentity): string {
    return this.resolveProjectStorageBaseDirByIds(
      project.businessLineId,
      project.id,
    );
  }

  resolveProjectStorageBaseDirByIds(
    businessLineId?: string | null,
    projectId?: string | null,
  ): string {
    return path.resolve(
      this.resolveAinativeDataRootDir(),
      businessLineId?.trim() || 'unknown-business-line',
      'projects',
      projectId?.trim() || 'unknown-project',
    );
  }

  resolveRepositoryRoot(project: RepositoryIdentity): string {
    const config = this.toObjectRecord(project.configJson);

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

  resolveProjectWorktreeBaseDir(project: ProjectPathIdentity): string {
    return path.resolve(
      this.resolveProjectStorageBaseDir(project),
      'worktrees',
    );
  }

  resolveLegacyProjectWorktreeBaseDir(project: ProjectPathIdentity): string {
    return path.resolve(
      this.resolveAinativeDataRootDir(),
      project.businessLineId?.trim() || 'unknown-business-line',
      'worktrees',
      project.id?.trim() || 'unknown-project',
    );
  }

  resolveWorktreeBaseDir(project: WorktreeIdentity): string {
    const config = this.toObjectRecord(project.configJson);

    if (
      typeof config.worktreeBaseDir === 'string' &&
      config.worktreeBaseDir.trim()
    ) {
      return path.resolve(config.worktreeBaseDir.trim());
    }

    const worktreeBaseDir = this.readTrimmedEnv('AINATIVE_WORKTREE_BASE_DIR');
    if (worktreeBaseDir) {
      return path.resolve(worktreeBaseDir);
    }

    return this.resolveProjectWorktreeBaseDir(project);
  }

  resolveWorktreeAllowedRoot(project: WorktreeIdentity): string {
    const config = this.toObjectRecord(project.configJson);

    if (
      typeof config.worktreeAllowedRoot === 'string' &&
      config.worktreeAllowedRoot.trim()
    ) {
      return path.resolve(config.worktreeAllowedRoot.trim());
    }

    const worktreeAllowedRoot = this.readTrimmedEnv(
      'AINATIVE_WORKTREE_ALLOWED_ROOT',
    );
    if (worktreeAllowedRoot) {
      return path.resolve(worktreeAllowedRoot);
    }

    return this.resolveWorktreeBaseDir(project);
  }

  resolveTaskWorktreeIdentifier(task: TaskWorktreeIdentity): string {
    const gitWorktree = task.gitWorktree?.trim();
    if (gitWorktree) {
      return gitWorktree;
    }

    return `wk-${task.id}`;
  }

  resolveTaskWorktreePath(
    task: TaskWorktreeIdentity,
    project: WorktreeIdentity,
    options?: {
      preferLegacyExistingPath?: boolean;
    },
  ): string {
    const gitWorktree = this.resolveTaskWorktreeIdentifier(task);

    if (path.isAbsolute(gitWorktree)) {
      return path.resolve(gitWorktree);
    }

    const nextPath = path.join(
      this.resolveWorktreeBaseDir(project),
      gitWorktree,
    );
    if (!options?.preferLegacyExistingPath) {
      return nextPath;
    }

    const legacyPath = path.join(
      this.resolveLegacyProjectWorktreeBaseDir(project),
      gitWorktree,
    );
    if (legacyPath !== nextPath && existsSync(legacyPath)) {
      return legacyPath;
    }

    return nextPath;
  }

  normalizeProjectDocPath(value: string): string {
    const raw = value?.trim();
    if (!raw) {
      throw new BadRequestException('Project doc path is required');
    }

    if (path.isAbsolute(raw)) {
      throw new BadRequestException('Absolute path is not allowed');
    }

    const normalized = path
      .normalize(raw.replace(/\\/g, '/'))
      .replace(/^\.(?:[\\/]|$)/, '')
      .replace(/[\\/]+$/, '');

    if (!normalized || normalized === '.') {
      throw new BadRequestException('Project doc path is required');
    }

    const pathSegments = normalized.split(path.sep);
    if (pathSegments.some((segment) => segment === '..')) {
      throw new BadRequestException('Project doc path cannot escape docs root');
    }

    return pathSegments.join('/');
  }

  isPathWithinAllowedRoot(
    targetPath: string,
    allowedRoot: string,
    options?: { allowEqual?: boolean },
  ): boolean {
    const normalizedRoot = path.resolve(allowedRoot);
    const normalizedTarget = path.resolve(targetPath);
    const relativePath = path.relative(normalizedRoot, normalizedTarget);

    if (relativePath === '') {
      return options?.allowEqual ?? true;
    }

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  ensurePathWithinAllowedRoot(
    targetPath: string,
    allowedRoot: string,
    options?: { allowEqual?: boolean },
  ): string {
    const resolvedTargetPath = path.resolve(targetPath);
    if (
      !this.isPathWithinAllowedRoot(resolvedTargetPath, allowedRoot, options)
    ) {
      throw new Error(
        `worktree path ${resolvedTargetPath} is outside allowed root ${path.resolve(allowedRoot)}`,
      );
    }

    return resolvedTargetPath;
  }

  private readTrimmedEnv(key: string): string | undefined {
    return this.configService.get<string>(key, { infer: true })?.trim();
  }

  private toObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private resolveRepositoryDirectoryName(
    project: Pick<Project, 'name' | 'gitUrl'>,
  ): string {
    const parsedFromGitUrl = this.extractRepositoryName(project.gitUrl);
    if (parsedFromGitUrl) {
      return parsedFromGitUrl;
    }

    return this.sanitizeSegment(project.name) || 'project';
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

  private sanitizeSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private expandHomePath(inputPath: string): string {
    const trimmedPath = inputPath.trim();

    if (trimmedPath === '~') {
      return os.homedir();
    }

    if (trimmedPath.startsWith('~/')) {
      return path.join(os.homedir(), trimmedPath.slice(2));
    }

    return trimmedPath;
  }
}
