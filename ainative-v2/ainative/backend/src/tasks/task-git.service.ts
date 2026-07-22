import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { TaskAccessService } from './application/task-access.service';
import { TaskWorkspaceArtifactService } from './application/task-workspace-artifact.service';
import {
  SubRepoBranchInfoDto,
  TaskGitActionResultDto,
  TaskGitBranchDiffFilesDto,
  TaskGitBranchDiffQueryDto,
  TaskGitCommitDto,
  TaskGitDiffDto,
  TaskGitDiffQueryDto,
  TaskGitFilesDto,
  TaskGitPrLinkDto,
  TaskGitStatusDto,
} from './dto/task-git.dto';
import { Task } from './domain/task';
import {
  TaskWorkspaceFileQueryDto,
  TaskWorkspacePreviewDto,
  TaskWorkspaceTreeDto,
  TaskWorkspaceTreeQueryDto,
} from './dto/task-workspace.dto';
import { TaskRuntimeService } from './task-runtime.service';
import { buildPullRequestUrl } from '../git/pull-request-url.util';
import {
  SlowApiDiagnosticsSession,
  createSlowApiDiagnostics,
} from '../observability/slow-api-diagnostics';
import {
  resolveSubReposForWorktree,
  resolveSubRepoForPath,
  buildSubRepoExcludePathspecs,
  type SubRepoConfig,
  type ResolvedSubRepo,
  type GitSnapshot,
  type GitSnapshotRepo,
} from '../git/sub-repo.types';
import {
  hasSubRepoMode,
  isWorkspaceNativeEnabled,
} from '../git/snapshot-sync.types';
import { TaskRepository } from './infrastructure/persistence/task.repository';
import {
  WORKSPACE_NATIVE_PUSH_DIRTY_MESSAGE,
  WorkspaceNativeDeployService,
} from './application/workspace-native-deploy.service';

type GitExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type GitBinaryExecutionResult = {
  success: boolean;
  stdout: Buffer;
  stderr: string;
  exitCode: number | null;
};

type TaskGitAsyncOperation = {
  id: string;
  type: 'push' | 'merge' | 'deploy';
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  logs: string[];
  message?: string;
};

export type TaskGitCommitIfChangedResult = {
  committed: boolean;
  skippedReason?: 'no_changes';
  commitSha?: string | null;
  subject?: string | null;
};

@Injectable()
export class TaskGitService {
  private readonly logger = new Logger(TaskGitService.name);
  private readonly defaultGitTimeoutMs = 90_000;
  private readonly maxDiffTextLength = 180_000;
  private readonly fallbackCommitAuthorName =
    process.env.AINATIVE_GIT_USER_NAME?.trim() || 'AINative Bot';
  private readonly fallbackCommitAuthorEmail =
    process.env.AINATIVE_GIT_USER_EMAIL?.trim() || 'ainative@example.com';

  constructor(
    private readonly taskAccessService: TaskAccessService,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly taskWorkspaceArtifactService: TaskWorkspaceArtifactService,
    private readonly taskRepository: TaskRepository,
    @Optional()
    private readonly workspaceNativeDeployService?: WorkspaceNativeDeployService,
  ) {}

  async getStatus(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitStatusDto> {
    const diagnostics = createSlowApiDiagnostics('tasks.git.status', {
      taskId,
      userId: currentUser.sub,
    });

    try {
      const { task, project, worktreePath, subRepos } =
        await this.resolveTaskGitContext(taskId, currentUser, diagnostics);

      const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
      const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
      const allFiles: TaskGitStatusDto['files'] = [];
      let branchName: string | null = null;
      const subRepoBranches: SubRepoBranchInfoDto[] = [];

      for (const repo of allRepos) {
        const statusArgs = this.withGitUtf8Paths([
          'status',
          '--porcelain',
          '--untracked-files=all',
          ...(!repo.prefix ? excludePathspecs : []),
        ]);

        const [statusResult, branchResult] = await Promise.all([
          repo.prefix === ''
            ? this.measureGitCommand(diagnostics, 'gitStatus', () =>
                this.runGitCommand(repo.cwd, statusArgs),
              )
            : this.runGitCommand(repo.cwd, statusArgs),
          repo.prefix === ''
            ? this.measureGitCommand(diagnostics, 'gitBranch', () =>
                this.runGitCommand(repo.cwd, [
                  'rev-parse',
                  '--abbrev-ref',
                  'HEAD',
                ]),
              )
            : this.runGitCommand(repo.cwd, [
                'rev-parse',
                '--abbrev-ref',
                'HEAD',
              ]),
        ]);

        if (!statusResult.success) {
          throw this.toGitException('Failed to read git status', statusResult);
        }

        const files = this.parseChangedFiles(statusResult.stdout);
        allFiles.push(
          ...files.map((f) => ({
            ...f,
            path: this.prefixFilePath(repo.prefix, f.path),
          })),
        );

        const repoBranch = branchResult.success
          ? this.normalizeBranchName(branchResult.stdout)
          : null;

        if (branchName === null) {
          branchName = repoBranch;
        }

        if (repo.prefix) {
          const sub = subRepos.find((s) => s.prefix === repo.prefix);
          if (sub) {
            subRepoBranches.push({
              prefix: sub.prefix,
              branchName: repoBranch,
              baseBranch: sub.branch,
            });
          }
        }
      }

      diagnostics.add({
        baseBranch: task.gitBaseBranch ?? null,
        branchName,
        changedFileCount: allFiles.length,
      });

      return {
        branchName,
        baseBranch: task.gitBaseBranch ?? null,
        files: allFiles,
        operation: this.readGitOperation(task),
        ...(subRepoBranches.length > 0
          ? { subRepoBranches }
          : this.buildWorkspaceNativeSubRepoBranches(task, project)),
      };
    } finally {
      diagnostics.flush();
    }
  }

  async getDiff(
    taskId: string,
    query: TaskGitDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitDiffDto> {
    const { worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const filePath = query.path ? this.normalizeRelativePath(query.path) : null;

    if (filePath && subRepos.length > 0) {
      const match = resolveSubRepoForPath(subRepos, filePath);
      const cwd = match ? match.subRepo.worktreePath : worktreePath;
      const relPath = match ? match.relativePath : filePath;

      const args = this.withGitUtf8Paths(['diff', '--no-color']);
      if (query.staged) args.push('--cached');
      args.push('--', relPath);

      const result = await this.runGitCommand(cwd, args);
      if (!result.success) {
        throw this.toGitException('Failed to read git diff', result);
      }
      return { diffText: result.stdout.slice(0, this.maxDiffTextLength) };
    }

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
    const diffParts: string[] = [];

    for (const repo of allRepos) {
      const args = this.withGitUtf8Paths(['diff', '--no-color']);
      if (query.staged) args.push('--cached');
      if (!repo.prefix) args.push(...excludePathspecs);

      const result = await this.runGitCommand(repo.cwd, args);
      if (result.success && result.stdout.trim()) {
        diffParts.push(result.stdout);
      }
    }

    return {
      diffText: diffParts.join('\n').slice(0, this.maxDiffTextLength),
    };
  }

  async getBranchDiffFiles(
    taskId: string,
    query: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitBranchDiffFilesDto> {
    const { task, worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
    let currentBranch: string | null = null;
    let baseBranch: string | null = null;
    const allFiles: Array<{ path: string; status: string }> = [];

    for (const repo of allRepos) {
      const repoBaseBranch = repo.prefix
        ? await this.resolveBaseBranch(
            repo.cwd,
            task,
            subRepos.find((s) => s.prefix === repo.prefix)?.branch,
          )
        : await this.resolveBaseBranch(repo.cwd, task, query.baseBranch);
      if (!baseBranch) baseBranch = repoBaseBranch;

      const diffArgs = this.withGitUtf8Paths([
        'diff',
        '--name-status',
        `${repoBaseBranch}...HEAD`,
        ...(!repo.prefix ? excludePathspecs : []),
      ]);

      const [diffFilesResult, branchResult] = await Promise.all([
        this.runGitCommand(repo.cwd, diffArgs),
        this.runGitCommand(repo.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      ]);

      if (diffFilesResult.success) {
        const files = diffFilesResult.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [statusToken, ...pathParts] = line.split('\t');
            const rawPath = pathParts[pathParts.length - 1] ?? '';
            return {
              path: this.prefixFilePath(
                repo.prefix,
                this.decodeGitQuotedPath(rawPath),
              ),
              status: statusToken || '?',
            };
          });
        allFiles.push(...files);
      }

      if (branchResult.success && !currentBranch) {
        currentBranch = this.normalizeBranchName(branchResult.stdout);
      }
    }

    return {
      baseBranch,
      currentBranch,
      files: allFiles,
    };
  }

  async getBranchDiff(
    taskId: string,
    query: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitDiffDto> {
    const { task, worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    if (query.path && subRepos.length > 0) {
      const filePath = this.normalizeRelativePath(query.path);
      const match = resolveSubRepoForPath(subRepos, filePath);
      const cwd = match ? match.subRepo.worktreePath : worktreePath;
      const relPath = match ? match.relativePath : filePath;
      const subBranch = match?.subRepo.branch;
      const repoBaseBranch = await this.resolveBaseBranch(
        cwd,
        task,
        subBranch ?? query.baseBranch,
      );

      const args = this.withGitUtf8Paths([
        'diff',
        '--no-color',
        `${repoBaseBranch}...HEAD`,
        '--',
        relPath,
      ]);
      const result = await this.runGitCommand(cwd, args);
      if (!result.success) {
        throw this.toGitException('Failed to read branch diff', result);
      }
      return { diffText: result.stdout.slice(0, this.maxDiffTextLength) };
    }

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
    const diffParts: string[] = [];

    for (const repo of allRepos) {
      const repoBaseBranch = repo.prefix
        ? await this.resolveBaseBranch(
            repo.cwd,
            task,
            subRepos.find((s) => s.prefix === repo.prefix)?.branch,
          )
        : await this.resolveBaseBranch(repo.cwd, task, query.baseBranch);

      const args = this.withGitUtf8Paths([
        'diff',
        '--no-color',
        `${repoBaseBranch}...HEAD`,
        ...(!repo.prefix ? excludePathspecs : []),
      ]);

      const result = await this.runGitCommand(repo.cwd, args);
      if (result.success && result.stdout.trim()) {
        diffParts.push(result.stdout);
      }
    }

    return {
      diffText: diffParts.join('\n').slice(0, this.maxDiffTextLength),
    };
  }

  async getArtifactTree(
    taskId: string,
    query: TaskWorkspaceTreeQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspaceTreeDto> {
    return this.taskWorkspaceArtifactService.getArtifactTree(
      taskId,
      query,
      currentUser,
    );
  }

  async getArtifactPreview(
    taskId: string,
    query: TaskWorkspaceFileQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspacePreviewDto> {
    return this.taskWorkspaceArtifactService.getArtifactPreview(
      taskId,
      query,
      currentUser,
    );
  }

  async getArtifactRawFile(
    taskId: string,
    query: TaskWorkspaceFileQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    name: string;
    mimeType: string;
    size: number;
    content: Buffer;
  }> {
    return this.taskWorkspaceArtifactService.getArtifactRawFile(
      taskId,
      query,
      currentUser,
    );
  }

  async stageFiles(
    taskId: string,
    payload: TaskGitFilesDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const files = this.normalizeFilePaths(payload.files);
    const routed = this.routeFilesToRepos(worktreePath, subRepos, files);

    for (const entry of routed) {
      const result = await this.runGitCommand(entry.cwd, [
        'add',
        '--',
        ...entry.files,
      ]);
      if (!result.success) {
        throw this.toGitException('Failed to stage files', result);
      }
    }

    return {
      success: true,
      message: 'Files staged successfully',
    };
  }

  async unstageFiles(
    taskId: string,
    payload: TaskGitFilesDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const files = this.normalizeFilePaths(payload.files);
    const routed = this.routeFilesToRepos(worktreePath, subRepos, files);

    for (const entry of routed) {
      const result = await this.runGitCommand(entry.cwd, [
        'restore',
        '--staged',
        '--',
        ...entry.files,
      ]);
      if (!result.success) {
        throw this.toGitException('Failed to unstage files', result);
      }
    }

    return {
      success: true,
      message: 'Files unstaged successfully',
    };
  }

  async commit(
    taskId: string,
    payload: TaskGitCommitDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const task = await this.taskRepository.findById(taskId);
    if (task) {
      const running = this.readGitOperation(task);
      if (running?.status === 'running') {
        return {
          success: false,
          message: `${this.formatGitOperationType(running.type)}正在执行，请等待完成后再提交。`,
        };
      }
    }

    const result = await this.commitInTaskWorktree(
      taskId,
      payload.message,
      currentUser,
    );

    if (!result.success) {
      throw this.toGitException('Failed to commit changes', result);
    }

    return {
      success: true,
      message: result.stdout || 'Commit completed',
    };
  }

  async commitIfChanged(
    taskId: string,
    message: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitCommitIfChangedResult> {
    const { worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    return this.commitIfChangedInAllRepos(worktreePath, subRepos, message);
  }

  async commitIfChangedForTask(
    task: Task,
    project: Project,
    message: string,
  ): Promise<TaskGitCommitIfChangedResult> {
    const worktreePath = await this.resolveTaskGitWorktreePath(task, project);

    if (hasSubRepoMode(project)) {
      return this.commitIfChangedInWorktree(worktreePath, message);
    }

    const subRepos = resolveSubReposForWorktree(
      worktreePath,
      project.configJson,
    );

    return this.commitIfChangedInAllRepos(worktreePath, subRepos, message);
  }

  async resolveHeadCommitShaForTask(
    task: Task,
    project: Project,
  ): Promise<string | null> {
    try {
      const worktreePath = await this.resolveTaskGitWorktreePath(task, project);
      const result = await this.runGitCommand(worktreePath, [
        'rev-parse',
        'HEAD',
      ]);

      if (!result.success) {
        return null;
      }

      const sha = result.stdout.trim();
      return sha || null;
    } catch {
      return null;
    }
  }

  async resetHardToCommitForTask(
    task: Task,
    project: Project,
    commitSha: string,
  ): Promise<void> {
    const worktreePath = await this.resolveTaskGitWorktreePath(task, project);
    const normalizedCommitSha = commitSha.trim();

    if (!normalizedCommitSha) {
      throw new BadRequestException('Commit SHA cannot be empty');
    }

    const verifyResult = await this.runGitCommand(worktreePath, [
      'rev-parse',
      '--verify',
      normalizedCommitSha,
    ]);
    if (!verifyResult.success) {
      throw this.toGitException(
        'Failed to verify reset target commit',
        verifyResult,
      );
    }

    const resetResult = await this.runGitCommand(worktreePath, [
      'reset',
      '--hard',
      normalizedCommitSha,
    ]);
    if (!resetResult.success) {
      throw this.toGitException(
        'Failed to reset worktree to target commit',
        resetResult,
      );
    }

    const cleanResult = await this.runGitCommand(worktreePath, [
      'clean',
      '-fd',
    ]);
    if (!cleanResult.success) {
      throw this.toGitException(
        'Failed to clean worktree after reset',
        cleanResult,
      );
    }
  }

  async merge(
    taskId: string,
    payload: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { task, project, worktreePath, subRepos } =
      await this.resolveTaskGitContext(taskId, currentUser);

    if (isWorkspaceNativeEnabled(project)) {
      return this.startWorkspaceNativeGitOperation(task, project, 'merge', () =>
        this.mergeWorkspaceNativeTask(task, project, worktreePath, payload),
      );
    }

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const messages: string[] = [];
    let allSuccess = true;
    const allConflicts: string[] = [];

    for (const repo of allRepos) {
      const label = repo.prefix || 'main';
      const requestedBase = repo.prefix
        ? subRepos.find((s) => s.prefix === repo.prefix)?.branch
        : payload.baseBranch;

      const baseShort = this.resolveBaseShortName(requestedBase, task);
      const resolvedBaseRef = await this.resolveBaseBranch(
        repo.cwd,
        task,
        requestedBase,
      );

      const headRefResult = await this.runGitCommand(repo.cwd, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);
      if (!headRefResult.success) {
        allSuccess = false;
        messages.push(
          `[${label}] ${this.formatGitFailure('Failed to read current branch', headRefResult)}`,
        );
        continue;
      }

      const currentBranch = this.normalizeBranchName(headRefResult.stdout);
      if (!currentBranch) {
        allSuccess = false;
        messages.push(`[${label}] Cannot merge while in detached HEAD state`);
        continue;
      }

      if (currentBranch === baseShort) {
        messages.push(`[${label}] Already on the base branch; skipped`);
        continue;
      }

      const statusResult = await this.runGitCommand(
        repo.cwd,
        this.withGitUtf8Paths([
          'status',
          '--porcelain',
          '--untracked-files=all',
        ]),
      );
      if (!statusResult.success) {
        allSuccess = false;
        messages.push(
          `[${label}] ${this.formatGitFailure('Failed to read git status', statusResult)}`,
        );
        continue;
      }
      if (statusResult.stdout.trim()) {
        allSuccess = false;
        messages.push(
          `[${label}] Working tree is not clean; commit or discard changes before merging`,
        );
        continue;
      }

      const localBaseRef = await this.runGitCommand(repo.cwd, [
        'rev-parse',
        '--verify',
        `refs/heads/${baseShort}`,
      ]);

      const checkoutBaseResult = localBaseRef.success
        ? await this.runGitCommand(repo.cwd, ['checkout', baseShort])
        : await this.runGitCommand(repo.cwd, [
            'checkout',
            '-B',
            baseShort,
            resolvedBaseRef,
          ]);

      if (!checkoutBaseResult.success) {
        allSuccess = false;
        messages.push(
          `[${label}] ${this.formatGitFailure('Failed to checkout base branch', checkoutBaseResult)}`,
        );
        continue;
      }

      const mergeResult = await this.runGitCommand(repo.cwd, [
        'merge',
        '--no-ff',
        currentBranch,
      ]);

      if (!mergeResult.success) {
        allSuccess = false;
        const conflicts = await this.readConflictFiles(repo.cwd);
        await this.runGitCommand(repo.cwd, ['merge', '--abort']);
        await this.runGitCommand(repo.cwd, ['checkout', currentBranch]);
        allConflicts.push(
          ...conflicts.map((c) => this.prefixFilePath(repo.prefix, c)),
        );
        messages.push(
          `[${label}] ${this.formatGitFailure('Merge failed', mergeResult)}`,
        );
        continue;
      }

      const checkoutBackResult = await this.runGitCommand(repo.cwd, [
        'checkout',
        currentBranch,
      ]);
      if (!checkoutBackResult.success) {
        messages.push(
          `[${label}] Merged into ${baseShort} but failed to switch back to ${currentBranch}`,
        );
        continue;
      }

      const detail =
        mergeResult.stdout.trim() || mergeResult.stderr.trim() || '';
      messages.push(
        `[${label}] Merged "${currentBranch}" into local base "${baseShort}" and switched back` +
          (detail ? `: ${detail}` : ''),
      );
    }

    return {
      success: allSuccess,
      message: messages.join('\n'),
      conflicts: allConflicts.length > 0 ? allConflicts : undefined,
    };
  }

  /**
   * Merge task HEAD into the functional-group / base branch in the main workspace repo.
   * Classic `merge()` does this for the `prefix: ''` repo; workspace-native previously skipped it
   * and only ran sub-repo remote merges, so `gitBaseBranch` never advanced and later tasks forked stale tips.
   */
  private async mergeWorkspaceNativeMainRepo(
    task: Task,
    worktreePath: string,
    payload: TaskGitBranchDiffQueryDto,
  ): Promise<TaskGitActionResultDto> {
    const requestedBase =
      payload.baseBranch?.trim() || task.gitBaseBranch?.trim() || '';
    if (!requestedBase) {
      return {
        success: false,
        message:
          'Workspace-native：缺少基准分支，无法将任务分支合并入功能组分支（需要任务 gitBaseBranch 或请求参数 baseBranch）',
      };
    }

    const baseShort = this.resolveBaseShortName(
      payload.baseBranch ?? task.gitBaseBranch ?? undefined,
      task,
    );

    const headRefResult = await this.runGitCommand(worktreePath, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    if (!headRefResult.success) {
      return {
        success: false,
        message: `[main] ${this.formatGitFailure('Failed to read current branch', headRefResult)}`,
      };
    }

    const currentBranch = this.normalizeBranchName(headRefResult.stdout);
    if (!currentBranch) {
      return {
        success: false,
        message: '[main] Cannot merge while in detached HEAD state',
      };
    }

    if (currentBranch === baseShort) {
      return {
        success: true,
        message: `[main] Already on the base branch "${baseShort}"; skipped main-repo merge`,
      };
    }

    const statusResult = await this.runGitCommand(
      worktreePath,
      this.withGitUtf8Paths(['status', '--porcelain', '--untracked-files=all']),
    );
    if (!statusResult.success) {
      return {
        success: false,
        message: `[main] ${this.formatGitFailure('Failed to read git status', statusResult)}`,
      };
    }
    if (statusResult.stdout.trim()) {
      return {
        success: false,
        message:
          '[main] Working tree is not clean; commit or discard changes before merging',
      };
    }

    const localBaseRef = await this.runGitCommand(worktreePath, [
      'rev-parse',
      '--verify',
      `refs/heads/${baseShort}`,
    ]);

    let resolvedBaseRefForCheckout: string;
    if (localBaseRef.success) {
      resolvedBaseRefForCheckout = baseShort;
    } else {
      const originVerify = await this.runGitCommand(worktreePath, [
        'rev-parse',
        '--verify',
        `refs/remotes/origin/${baseShort}`,
      ]);
      if (originVerify.success) {
        resolvedBaseRefForCheckout = `origin/${baseShort}`;
      } else {
        resolvedBaseRefForCheckout = baseShort;
      }
    }

    const checkoutBaseResult = localBaseRef.success
      ? await this.runGitCommand(worktreePath, ['checkout', baseShort])
      : await this.runGitCommand(worktreePath, [
          'checkout',
          '-B',
          baseShort,
          resolvedBaseRefForCheckout,
        ]);

    if (!checkoutBaseResult.success) {
      return {
        success: false,
        message: `[main] ${this.formatGitFailure('Failed to checkout base branch', checkoutBaseResult)}`,
      };
    }

    const mergeResult = await this.runGitCommand(worktreePath, [
      'merge',
      '--no-ff',
      currentBranch,
    ]);

    if (!mergeResult.success) {
      const conflicts = await this.readConflictFiles(worktreePath);
      await this.runGitCommand(worktreePath, ['merge', '--abort']);
      await this.runGitCommand(worktreePath, ['checkout', currentBranch]);
      return {
        success: false,
        message: `[main] ${this.formatGitFailure('Merge failed', mergeResult)}`,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
    }

    const checkoutBackResult = await this.runGitCommand(worktreePath, [
      'checkout',
      currentBranch,
    ]);
    if (!checkoutBackResult.success) {
      return {
        success: false,
        message: `[main] Merged into ${baseShort} but failed to switch back to ${currentBranch}`,
      };
    }

    const detail = mergeResult.stdout.trim() || mergeResult.stderr.trim() || '';
    return {
      success: true,
      message:
        `[main] Merged "${currentBranch}" into local base "${baseShort}" and switched back` +
        (detail ? `: ${detail}` : ''),
    };
  }

  private async mergeWorkspaceNativeTask(
    task: Task,
    project: Project,
    worktreePath: string,
    payload: TaskGitBranchDiffQueryDto,
  ): Promise<TaskGitActionResultDto> {
    if (!this.workspaceNativeDeployService) {
      throw new ConflictException('Workspace-native merge service unavailable');
    }

    try {
      const mainResult = await this.mergeWorkspaceNativeMainRepo(
        task,
        worktreePath,
        payload,
      );
      if (!mainResult.success) {
        return mainResult;
      }

      const result =
        await this.workspaceNativeDeployService.mergeSubRepoBranches(
          task,
          project,
        );
      const allSuccess = result.results.every(
        (item) => item.status === 'success' || item.status === 'skipped',
      );
      const messages = result.results.map((item) => {
        if (item.status === 'success') {
          return `[${item.prefix}] Merged ${item.baseBranch} into ${item.remoteBranch}`;
        }
        if (item.status === 'skipped') {
          return `[${item.prefix}] ${item.remoteBranch} already includes ${item.baseBranch}`;
        }
        return `[${item.prefix}] Merge failed ${item.baseBranch} -> ${item.remoteBranch || '-'}: ${item.error ?? 'unknown error'}`;
      });

      return {
        success: allSuccess,
        message:
          [
            mainResult.message?.trim(),
            messages.join('\n') ||
              'No sub-repository merge operations were executed',
          ]
            .filter((line): line is string => Boolean(line?.length))
            .join('\n') || 'Merge completed',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Workspace-native merge failed',
      };
    }
  }

  private async startWorkspaceNativeGitOperation(
    task: Task,
    project: Project,
    type: 'push' | 'merge' | 'deploy',
    runner: () => Promise<TaskGitActionResultDto>,
  ): Promise<TaskGitActionResultDto> {
    const operation: TaskGitAsyncOperation = {
      id: `${type}-${Date.now()}`,
      type,
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: [`${this.formatGitOperationType(type)}已开始，后台执行中。`],
    };

    // Atomic compare-and-set: only acquire if no operation is running
    const acquired = await this.taskRepository.acquireGitOperationLock(
      task.id,
      operation as unknown as Record<string, unknown>,
    );

    if (!acquired) {
      const current = await this.taskRepository.findById(task.id);
      const running = current ? this.readGitOperation(current) : null;
      return {
        success: false,
        message: `${this.formatGitOperationType(running?.type ?? type)}正在执行，请等待完成后再操作。`,
        operationId: running?.id,
      };
    }
    this.logger.log(
      `[task:${task.id}] workspace-native ${type} operation started (${operation.id})`,
    );

    void (async () => {
      const logs = [...operation.logs];
      try {
        const latestTask = await this.taskRepository.findById(task.id);
        const result = await runner();
        logs.push(...this.splitOperationMessage(result.message));

        const finished: TaskGitAsyncOperation = {
          ...operation,
          status: result.success ? 'success' : 'failed',
          finishedAt: new Date().toISOString(),
          logs,
          message: result.message,
        };

        await this.writeGitOperation((latestTask ?? task).id, finished);
        this.logger[result.success ? 'log' : 'error'](
          `[task:${task.id}] workspace-native ${type} operation ${result.success ? 'succeeded' : 'failed'} (${operation.id}): ${result.message}`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Workspace git operation failed';
        logs.push(message);
        await this.writeGitOperation(task.id, {
          ...operation,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          logs,
          message,
        });
        this.logger.error(
          `[task:${task.id}] workspace-native ${type} operation failed (${operation.id}): ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    })();

    return {
      success: true,
      message: `${this.formatGitOperationType(type)}已在后台开始，可继续使用页面，完成后会显示结果。`,
      operationId: operation.id,
    };
  }

  private readGitOperation(task: Task): TaskGitAsyncOperation | undefined {
    const config = (task.configJson ?? {}) as Record<string, unknown>;
    const operation = config.gitOperation;
    if (!operation || typeof operation !== 'object') return undefined;
    const record = operation as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      (record.type !== 'push' &&
        record.type !== 'merge' &&
        record.type !== 'deploy') ||
      (record.status !== 'running' &&
        record.status !== 'success' &&
        record.status !== 'failed' &&
        record.status !== 'cancelled') ||
      typeof record.startedAt !== 'string'
    ) {
      return undefined;
    }

    return {
      id: record.id,
      type: record.type,
      status: record.status,
      startedAt: record.startedAt,
      finishedAt:
        typeof record.finishedAt === 'string' ? record.finishedAt : undefined,
      logs: Array.isArray(record.logs)
        ? record.logs.filter((line): line is string => typeof line === 'string')
        : [],
      message: typeof record.message === 'string' ? record.message : undefined,
    };
  }

  private async writeGitOperation(
    taskId: string,
    operation: TaskGitAsyncOperation,
  ): Promise<void> {
    const latestTask = await this.taskRepository.findById(taskId);
    if (!latestTask) return;
    await this.taskRepository.update(taskId, {
      configJson: {
        ...((latestTask.configJson ?? {}) as Record<string, unknown>),
        gitOperation: operation,
      } as any,
    });
  }

  private formatGitOperationType(type: string): string {
    switch (type) {
      case 'push':
        return '推送';
      case 'merge':
        return '同步子仓基准分支';
      case 'deploy':
        return '部署';
      default:
        return type;
    }
  }

  private splitOperationMessage(message: string): string[] {
    return message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async rebase(
    taskId: string,
    payload: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { task, worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const messages: string[] = [];
    let allSuccess = true;
    const allConflicts: string[] = [];

    for (const repo of allRepos) {
      const repoBaseBranch = repo.prefix
        ? await this.resolveBaseBranch(
            repo.cwd,
            task,
            subRepos.find((s) => s.prefix === repo.prefix)?.branch,
          )
        : await this.resolveBaseBranch(repo.cwd, task, payload.baseBranch);
      const result = await this.runGitCommand(repo.cwd, [
        'rebase',
        repoBaseBranch,
      ]);

      const label = repo.prefix || 'main';

      if (result.success) {
        messages.push(`[${label}] Rebased onto ${repoBaseBranch}`);
      } else {
        allSuccess = false;
        messages.push(
          `[${label}] ${this.formatGitFailure('Rebase failed', result)}`,
        );
        const conflicts = await this.readConflictFiles(repo.cwd);
        allConflicts.push(
          ...conflicts.map((c) => this.prefixFilePath(repo.prefix, c)),
        );
        await this.runGitCommand(repo.cwd, ['rebase', '--abort']);
      }
    }

    return {
      success: allSuccess,
      message: messages.join('\n'),
      conflicts: allConflicts.length > 0 ? allConflicts : undefined,
    };
  }

  async push(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { task, project, worktreePath, subRepos } =
      await this.resolveTaskGitContext(taskId, currentUser);

    if (isWorkspaceNativeEnabled(project)) {
      const running = this.readGitOperation(task);
      if (running?.status === 'running') {
        return {
          success: false,
          message: `${this.formatGitOperationType(running.type)}正在执行，请等待完成后再操作。`,
          operationId: running.id,
        };
      }

      const changedFiles = await this.listAllArtifactFiles(worktreePath, subRepos);
      if (changedFiles.length > 0) {
        return {
          success: false,
          message: WORKSPACE_NATIVE_PUSH_DIRTY_MESSAGE,
        };
      }

      return this.startWorkspaceNativeGitOperation(task, project, 'push', () =>
        this.pushWorkspaceNativeTask(task, project),
      );
    }

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const messages: string[] = [];
    const snapshotRepos: GitSnapshotRepo[] = [];
    let allSuccess = true;

    for (const repo of allRepos) {
      const result = await this.runGitCommand(repo.cwd, [
        'push',
        '--set-upstream',
        'origin',
        'HEAD',
      ]);

      const label = repo.prefix || 'main';

      if (!result.success) {
        const stderr = result.stderr?.trim() || 'unknown error';
        messages.push(`[${label}] Push failed: ${stderr}`);
        allSuccess = false;
        continue;
      }

      messages.push(`[${label}] Push completed`);

      if (repo.prefix) {
        const sub = subRepos.find((s) => s.prefix === repo.prefix);
        if (sub) {
          const [shaResult, msgResult, branchResult] = await Promise.all([
            this.runGitCommand(repo.cwd, ['rev-parse', 'HEAD']),
            this.runGitCommand(repo.cwd, ['log', '-1', '--pretty=%s']),
            this.runGitCommand(repo.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
          ]);

          snapshotRepos.push({
            prefix: sub.prefix,
            branch: branchResult.success ? branchResult.stdout.trim() : '',
            commitSha: shaResult.success ? shaResult.stdout.trim() : '',
            commitMessage: msgResult.success ? msgResult.stdout.trim() : '',
            remote: sub.url,
          });
        }
      }
    }

    if (snapshotRepos.length > 0) {
      await this.saveGitSnapshot(task.id, {
        updatedAt: new Date().toISOString(),
        repos: snapshotRepos,
      });
    }

    return {
      success: allSuccess,
      message: messages.join('\n'),
    };
  }

  private async pushWorkspaceNativeTask(
    task: Task,
    project: Project,
  ): Promise<TaskGitActionResultDto> {
    if (!this.workspaceNativeDeployService) {
      throw new ConflictException('Workspace-native push service unavailable');
    }

    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const workspaceSnapshot = taskConfig.workspaceSnapshot as
      | { taskBranch: string }
      | undefined;
    const taskBranch = workspaceSnapshot?.taskBranch || task.gitBranch;

    if (!taskBranch) {
      return {
        success: false,
        message: '无法确定任务分支，无法推送',
      };
    }

    const subReposSnapshot = (taskConfig.subReposSnapshot ?? []) as Array<{
      prefix: string;
    }>;
    const featureBranch = taskBranch.startsWith('feature/')
      ? taskBranch
      : `feature/${taskBranch}`;

    const targetBranches: Record<string, string> = {};
    for (const sub of subReposSnapshot) {
      targetBranches[sub.prefix] = featureBranch;
    }

    const messages: string[] = [];

    try {
      const result = await this.workspaceNativeDeployService.deploy(
        task,
        project,
        (event, data) => {
          if (event === 'deploy_step') {
            const prefix =
              typeof data.prefix === 'string' ? `[${data.prefix}] ` : '';
            messages.push(
              `${prefix}${String(data.message ?? data.step ?? event)}`,
            );
          }
          if (event === 'deploy_subrepo') {
            const prefix = String(data.prefix ?? 'subrepo');
            const status = String(data.status ?? 'unknown');
            const branch = data.branch ? ` → ${String(data.branch)}` : '';
            const error = data.error ? `: ${String(data.error)}` : '';
            messages.push(`[${prefix}] ${status}${branch}${error}`);
          }
        },
        { targetBranches, skipLock: true, mode: 'push' },
      );

      const pushResults = result.deployStatus.subRepoPushResults;
      const allSuccess = pushResults.every(
        (r) => r.status === 'success' || r.status === 'skipped',
      );

      return {
        success: allSuccess,
        message: messages.join('\n') || '推送完成',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '推送失败';
      return {
        success: false,
        message: [...messages, message].filter(Boolean).join('\n'),
      };
    }
  }

  private async saveGitSnapshot(
    taskId: string,
    snapshot: GitSnapshot,
  ): Promise<void> {
    try {
      const task = await this.taskRepository.findById(taskId);
      if (!task) return;

      const configJson = (task.configJson ?? {}) as Record<string, unknown>;
      configJson.gitSnapshot = snapshot;

      await this.taskRepository.update(taskId, {
        configJson: configJson as any,
      });
    } catch {
      // snapshot save is best-effort
    }
  }

  async getLog(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const logParts: string[] = [];

    for (const repo of allRepos) {
      const label = repo.prefix || 'main';
      const result = await this.runGitCommand(repo.cwd, [
        'log',
        '--oneline',
        '-20',
        '--no-color',
      ]);

      if (result.success && result.stdout.trim()) {
        logParts.push(`--- ${label} ---\n${result.stdout}`);
      }
    }

    return {
      success: true,
      message: logParts.join('\n\n') || 'No commits yet',
    };
  }

  async getPrLink(
    taskId: string,
    payload: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitPrLinkDto> {
    const { task, project, worktreePath, subRepos } =
      await this.resolveTaskGitContext(taskId, currentUser);

    if (isWorkspaceNativeEnabled(project)) {
      return this.getWorkspaceNativePrLinks(task);
    }

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const urls: Array<{ prefix: string; url: string | null }> = [];

    for (const repo of allRepos) {
      const repoBaseBranch = repo.prefix
        ? await this.resolveBaseBranch(
            repo.cwd,
            task,
            subRepos.find((s) => s.prefix === repo.prefix)?.branch,
          )
        : await this.resolveBaseBranch(repo.cwd, task, payload.baseBranch);

      const [remoteUrlResult, branchResult] = await Promise.all([
        this.runGitCommand(repo.cwd, ['config', '--get', 'remote.origin.url']),
        this.runGitCommand(repo.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      ]);

      if (!remoteUrlResult.success || !branchResult.success) {
        urls.push({ prefix: repo.prefix || 'main', url: null });
        continue;
      }

      const remoteUrl = remoteUrlResult.stdout.trim();
      const headBranch = this.normalizeBranchName(branchResult.stdout);

      urls.push({
        prefix: repo.prefix || 'main',
        url:
          remoteUrl && headBranch
            ? buildPullRequestUrl(
                remoteUrl,
                repoBaseBranch.replace(/^origin\//, ''),
                headBranch,
              )
            : null,
      });
    }

    const firstSubUrl = urls.find((u) => u.prefix !== 'main' && u.url);
    return {
      url: firstSubUrl?.url ?? urls[0]?.url ?? null,
      urls,
    };
  }

  private getWorkspaceNativeSubReposSnapshot(task: Task): SubRepoConfig[] {
    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const subRepos = taskConfig.subReposSnapshot;
    if (!Array.isArray(subRepos)) return [];

    return subRepos.filter((repo): repo is SubRepoConfig => {
      if (!repo || typeof repo !== 'object') return false;
      const record = repo as Record<string, unknown>;
      return (
        typeof record.url === 'string' &&
        typeof record.prefix === 'string' &&
        typeof record.branch === 'string'
      );
    });
  }

  private getWorkspaceNativeTaskBranch(task: Task): string | null {
    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const workspaceSnapshot = taskConfig.workspaceSnapshot as
      | { taskBranch?: unknown }
      | undefined;
    const snapshotBranch =
      typeof workspaceSnapshot?.taskBranch === 'string'
        ? workspaceSnapshot.taskBranch.trim()
        : '';

    return snapshotBranch || task.gitBranch?.trim() || null;
  }

  private buildWorkspaceNativeSubRepoBranches(
    task: Task,
    project: Project,
  ): { subRepoBranches?: SubRepoBranchInfoDto[] } {
    if (!isWorkspaceNativeEnabled(project)) {
      return {};
    }

    const taskBranch = this.getWorkspaceNativeTaskBranch(task);
    const branchByPrefix = this.getWorkspaceNativeDeployBranchMap(task);
    const subRepoBranches = this.getWorkspaceNativeSubReposSnapshot(task).map(
      (subRepo) => ({
        prefix: subRepo.prefix,
        branchName: branchByPrefix.get(subRepo.prefix) ?? taskBranch,
        baseBranch: subRepo.branch,
      }),
    );

    return subRepoBranches.length > 0 ? { subRepoBranches } : {};
  }

  private getWorkspaceNativePrLinks(task: Task): TaskGitPrLinkDto {
    const taskBranch = this.getWorkspaceNativeTaskBranch(task);
    if (!taskBranch) {
      return { url: null, urls: [] };
    }

    const branchByPrefix = this.getWorkspaceNativeDeployBranchMap(task);

    const urls = this.getWorkspaceNativeSubReposSnapshot(task).map(
      (subRepo) => {
        const headBranch = branchByPrefix.get(subRepo.prefix);
        if (!headBranch) {
          return {
            prefix: subRepo.prefix,
            url: null,
            hint: '请先推送到子仓再创建 PR',
          };
        }
        return {
          prefix: subRepo.prefix,
          url: buildPullRequestUrl(subRepo.url, subRepo.branch, headBranch),
        };
      },
    );

    return {
      url: urls.find((u) => u.url)?.url ?? null,
      urls,
    };
  }

  private getWorkspaceNativeDeployBranchMap(task: Task): Map<string, string> {
    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const deployBranches = Array.isArray(taskConfig.subRepoDeployBranches)
      ? (taskConfig.subRepoDeployBranches as Array<Record<string, unknown>>)
      : [];

    return new Map(
      deployBranches
        .filter(
          (branch) =>
            typeof branch.prefix === 'string' &&
            typeof branch.remoteBranch === 'string',
        )
        .map((branch) => [
          branch.prefix as string,
          branch.remoteBranch as string,
        ]),
    );
  }

  private async resolveTaskGitContext(
    taskId: string,
    currentUser: JwtPayloadType,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<{
    task: Task;
    project: Project;
    worktreePath: string;
    subRepos: ResolvedSubRepo[];
  }> {
    const { task, project } = diagnostics
      ? await diagnostics.measure(
          'access',
          () =>
            this.taskAccessService.assertCanAccessTaskProject(
              taskId,
              currentUser,
              diagnostics,
            ),
          (result) => ({
            projectId: result.project.id,
            gitWorktree: result.task.gitWorktree ?? null,
          }),
        )
      : await this.taskAccessService.assertCanAccessTaskProject(
          taskId,
          currentUser,
          diagnostics,
        );

    const worktreePath = await this.resolveTaskGitWorktreePath(
      task,
      project,
      diagnostics,
    );

    const subRepos = hasSubRepoMode(project)
      ? []
      : resolveSubReposForWorktree(worktreePath, project.configJson);

    return { task, project, worktreePath, subRepos };
  }

  private async resolveTaskGitWorktreePath(
    task: Task,
    project: Project,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<string> {
    if (!task.gitWorktree?.trim()) {
      throw new ConflictException('Task workspace is not initialized');
    }

    const runtimeWorktreePath = this.taskRuntimeService.resolveTaskWorktreePath(
      task,
      project,
    );

    let worktreePath = await fs.realpath(runtimeWorktreePath).catch(() => null);

    if (!worktreePath) {
      try {
        const runtime = await this.taskRuntimeService.ensureRuntime(
          task,
          project,
        );
        worktreePath = await fs
          .realpath(runtime.worktreePath)
          .catch(() => null);
      } catch {
        // recovery failed
      }
      if (!worktreePath) {
        throw new NotFoundException('Task workspace does not exist');
      }
    }

    if (diagnostics) {
      void diagnostics.measure(
        'realpath',
        () => Promise.resolve(worktreePath),
        (result) => ({ worktreePath: result }),
      );
    }

    const hasGitDir = diagnostics
      ? await diagnostics.measure(
          'gitDirStat',
          () =>
            fs
              .stat(path.join(worktreePath, '.git'))
              .then(() => true)
              .catch(() => false),
          (result) => ({
            hasGitDir: result,
          }),
        )
      : await fs
          .stat(path.join(worktreePath, '.git'))
          .then(() => true)
          .catch(() => false);

    if (!hasGitDir) {
      throw new BadRequestException('Task workspace is not a git repository');
    }

    return worktreePath;
  }

  private resolveAllRepoCwds(
    mainWorktreePath: string,
    subRepos: ResolvedSubRepo[],
  ): Array<{ cwd: string; prefix: string }> {
    const repos: Array<{ cwd: string; prefix: string }> = [
      { cwd: mainWorktreePath, prefix: '' },
    ];
    for (const sub of subRepos) {
      repos.push({ cwd: sub.worktreePath, prefix: sub.prefix });
    }
    return repos;
  }

  private routeFilesToRepos(
    mainWorktreePath: string,
    subRepos: ResolvedSubRepo[],
    files: string[],
  ): Array<{ cwd: string; prefix: string; files: string[] }> {
    const mainFiles: string[] = [];
    const subMap = new Map<string, string[]>();
    for (const sub of subRepos) {
      subMap.set(sub.prefix, []);
    }

    for (const file of files) {
      const match = resolveSubRepoForPath(subRepos, file);
      if (match) {
        subMap.get(match.subRepo.prefix)!.push(match.relativePath);
      } else {
        mainFiles.push(file);
      }
    }

    const result: Array<{ cwd: string; prefix: string; files: string[] }> = [];
    if (mainFiles.length > 0) {
      result.push({ cwd: mainWorktreePath, prefix: '', files: mainFiles });
    }
    for (const sub of subRepos) {
      const subFiles = subMap.get(sub.prefix)!;
      if (subFiles.length > 0) {
        result.push({
          cwd: sub.worktreePath,
          prefix: sub.prefix,
          files: subFiles,
        });
      }
    }
    return result;
  }

  private prefixFilePath(prefix: string, filePath: string): string {
    return prefix ? `${prefix}/${filePath}` : filePath;
  }

  private async measureGitCommand<T>(
    diagnostics: SlowApiDiagnosticsSession,
    name: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const startedAt = process.hrtime.bigint();

    try {
      return await work();
    } finally {
      diagnostics.record(
        name,
        Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      );
    }
  }

  private async commitInTaskWorktree(
    taskId: string,
    message: string,
    currentUser: JwtPayloadType,
  ): Promise<GitExecutionResult> {
    const { worktreePath, subRepos } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException('Commit message cannot be empty');
    }

    const allRepos = this.resolveAllRepoCwds(worktreePath, subRepos);
    const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
    let lastResult: GitExecutionResult | null = null;

    for (const repo of allRepos) {
      await this.ensureCommitIdentityConfigured(repo.cwd);

      const statusResult = await this.runGitCommand(
        repo.cwd,
        this.withGitUtf8Paths([
          'status',
          '--porcelain',
          ...(!repo.prefix ? excludePathspecs : []),
        ]),
      );
      const hasChanges =
        statusResult.success && statusResult.stdout.trim().length > 0;
      if (!hasChanges) continue;

      const result = await this.runGitCommand(repo.cwd, [
        'commit',
        '-m',
        normalizedMessage,
      ]);

      if (!result.success) {
        const label = repo.prefix || 'main';
        return {
          success: false,
          stdout: result.stdout,
          stderr: `[${label}] commit failed: ${result.stderr}`,
          exitCode: result.exitCode,
        };
      }

      lastResult = result;
    }

    return (
      lastResult ?? {
        success: true,
        stdout: 'Nothing to commit',
        stderr: '',
        exitCode: 0,
      }
    );
  }

  private async commitIfChangedInWorktree(
    worktreePath: string,
    message: string,
    excludePathspecs: string[] = [],
  ): Promise<TaskGitCommitIfChangedResult> {
    const changedFiles = await this.listArtifactFiles(
      worktreePath,
      excludePathspecs,
    );

    if (!changedFiles.length) {
      return {
        committed: false,
        skippedReason: 'no_changes',
      };
    }

    const stageResult = await this.runGitCommand(worktreePath, [
      'add',
      '-A',
      '--',
      '.',
    ]);
    if (!stageResult.success) {
      throw this.toGitException('Failed to stage changed files', stageResult);
    }

    await this.ensureCommitIdentityConfigured(worktreePath);

    const result = await this.runGitCommand(worktreePath, [
      'commit',
      '-m',
      message.trim(),
    ]);
    if (!result.success) {
      throw this.toGitException('Failed to commit changes', result);
    }

    const [headResult, subjectResult] = await Promise.all([
      this.runGitCommand(worktreePath, ['rev-parse', 'HEAD']),
      this.runGitCommand(worktreePath, ['log', '-1', '--pretty=%s']),
    ]);

    return {
      committed: true,
      commitSha: headResult.success ? headResult.stdout.trim() : null,
      subject: subjectResult.success
        ? subjectResult.stdout.trim()
        : message.trim(),
    };
  }

  private async commitIfChangedInAllRepos(
    mainWorktreePath: string,
    subRepos: ResolvedSubRepo[],
    message: string,
  ): Promise<TaskGitCommitIfChangedResult> {
    const allRepos = this.resolveAllRepoCwds(mainWorktreePath, subRepos);
    const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
    let anyCommitted = false;
    let lastSha: string | null = null;
    let lastSubject: string | null = null;

    for (const repo of allRepos) {
      const result = await this.commitIfChangedInWorktree(
        repo.cwd,
        message,
        !repo.prefix ? excludePathspecs : [],
      );
      if (result.committed) {
        anyCommitted = true;
        lastSha = result.commitSha ?? null;
        lastSubject = result.subject ?? null;
      }
    }

    if (!anyCommitted) {
      return { committed: false, skippedReason: 'no_changes' };
    }

    return {
      committed: true,
      commitSha: lastSha,
      subject: lastSubject,
    };
  }

  private async listAllArtifactFiles(
    mainWorktreePath: string,
    subRepos: ResolvedSubRepo[],
  ): Promise<string[]> {
    const allRepos = this.resolveAllRepoCwds(mainWorktreePath, subRepos);
    const excludePathspecs = buildSubRepoExcludePathspecs(subRepos);
    const allFiles: string[] = [];

    for (const repo of allRepos) {
      const files = await this.listArtifactFiles(
        repo.cwd,
        !repo.prefix ? excludePathspecs : [],
      );
      allFiles.push(...files.map((f) => this.prefixFilePath(repo.prefix, f)));
    }

    return allFiles;
  }

  private async ensureCommitIdentityConfigured(
    worktreePath: string,
  ): Promise<void> {
    const [nameResult, emailResult] = await Promise.all([
      this.runGitCommand(worktreePath, ['config', '--get', 'user.name']),
      this.runGitCommand(worktreePath, ['config', '--get', 'user.email']),
    ]);

    const updateArgsList: string[][] = [];

    if (!nameResult.success || !nameResult.stdout.trim()) {
      updateArgsList.push([
        'config',
        'user.name',
        this.fallbackCommitAuthorName,
      ]);
    }

    if (!emailResult.success || !emailResult.stdout.trim()) {
      updateArgsList.push([
        'config',
        'user.email',
        this.fallbackCommitAuthorEmail,
      ]);
    }

    if (!updateArgsList.length) {
      return;
    }

    for (const args of updateArgsList) {
      const result = await this.runGitCommand(worktreePath, args);

      if (!result.success) {
        throw this.toGitException(
          'Failed to configure git commit identity',
          result,
        );
      }
    }
  }

  private async runGitCommand(
    cwd: string,
    args: string[],
  ): Promise<GitExecutionResult> {
    return new Promise((resolve) => {
      const processRef = spawn('git', ['-C', cwd, ...args], {
        stdio: 'pipe',
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (result: GitExecutionResult) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      };

      processRef.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf-8');
      });

      processRef.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        this.logger.warn(
          `git command timed out after ${this.defaultGitTimeoutMs}ms: git -C ${cwd} ${args.join(' ')}`,
        );
        processRef.kill('SIGTERM');
      }, this.defaultGitTimeoutMs);

      processRef.on('error', (error) => {
        clearTimeout(timeoutRef);
        finish({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: error.message,
          exitCode: null,
        });
      });

      processRef.on('close', (code) => {
        clearTimeout(timeoutRef);
        finish({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          exitCode: code,
        });
      });
    });
  }

  private async runGitCommandBuffer(
    cwd: string,
    args: string[],
  ): Promise<GitBinaryExecutionResult> {
    return new Promise((resolve) => {
      const processRef = spawn('git', ['-C', cwd, ...args], {
        stdio: 'pipe',
        env: process.env,
      });

      const stdoutChunks: Buffer[] = [];
      let stderr = '';
      let settled = false;

      const finish = (result: GitBinaryExecutionResult) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(result);
      };

      processRef.stdout?.on('data', (chunk) => {
        stdoutChunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf-8'),
        );
      });

      processRef.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf-8');
      });

      const timeoutRef = setTimeout(() => {
        this.logger.warn(
          `git command (buffer) timed out after ${this.defaultGitTimeoutMs}ms: git -C ${cwd} ${args.join(' ')}`,
        );
        processRef.kill('SIGTERM');
      }, this.defaultGitTimeoutMs);

      processRef.on('error', (error) => {
        clearTimeout(timeoutRef);
        finish({
          success: false,
          stdout: Buffer.concat(stdoutChunks),
          stderr: error.message,
          exitCode: null,
        });
      });

      processRef.on('close', (code) => {
        clearTimeout(timeoutRef);
        finish({
          success: code === 0,
          stdout: Buffer.concat(stdoutChunks),
          stderr: stderr.trimEnd(),
          exitCode: code,
        });
      });
    });
  }

  private async listArtifactFiles(
    worktreePath: string,
    excludePathspecs: string[] = [],
  ): Promise<string[]> {
    const result = await this.runGitCommand(
      worktreePath,
      this.withGitUtf8Paths([
        'status',
        '--porcelain',
        '--untracked-files=all',
        ...excludePathspecs,
      ]),
    );

    if (!result.success) {
      throw this.toGitException(
        'Failed to read changed artifact files',
        result,
      );
    }

    const files = this.parseChangedFiles(result.stdout)
      .map((file) => this.normalizeRelativePath(file.path))
      .filter(Boolean);

    return Array.from(new Set(files));
  }

  private parseChangedFiles(statusText: string): TaskGitStatusDto['files'] {
    return statusText
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2);
        const rawPath = line.slice(3).trim();
        const normalizedPath = rawPath.includes(' -> ')
          ? (rawPath.split(' -> ').pop() ?? rawPath)
          : rawPath;

        return {
          path: this.decodeGitQuotedPath(normalizedPath),
          status,
          staged: status[0] !== ' ' && status[0] !== '?' && status[0] !== '!',
        };
      });
  }

  /**
   * Git may quote non-ASCII paths as C-style octal escapes (e.g. \\345\\244\\247 for UTF-8).
   * Prefer `-c core.quotePath=false` on commands; this decodes any remaining escaped output.
   */
  private decodeGitQuotedPath(input: string): string {
    const trimmed = input.trim();
    if (!trimmed.includes('\\')) {
      return trimmed;
    }

    let s = trimmed;
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1);
    }

    const bytes: number[] = [];
    for (let i = 0; i < s.length; ) {
      if (s[i] === '\\' && i + 1 < s.length && /[0-7]/.test(s[i + 1])) {
        let oct = '';
        let j = i + 1;
        while (j < s.length && oct.length < 3 && /[0-7]/.test(s[j])) {
          oct += s[j];
          j += 1;
        }
        bytes.push(parseInt(oct, 8));
        i = j;
      } else if (s[i] === '\\') {
        bytes.push(0x5c);
        i += 1;
      } else {
        bytes.push(s.charCodeAt(i) & 0xff);
        i += 1;
      }
    }

    return Buffer.from(bytes).toString('utf8');
  }

  /** Avoid Git escaping non-ASCII paths (shows \\345\\244\\247…); keep UTF-8 in stdout. */
  private withGitUtf8Paths(args: string[]): string[] {
    return ['-c', 'core.quotePath=false', ...args];
  }

  private normalizeBrowserPath(value?: string): string {
    if (!value?.trim()) {
      return '.';
    }

    const normalized = value.trim().replaceAll('\\', '/');

    if (path.isAbsolute(normalized)) {
      throw new BadRequestException('Absolute file path is not allowed');
    }

    const normalizedPosix = path.posix.normalize(normalized);

    if (
      normalizedPosix === '.' ||
      normalizedPosix === '' ||
      normalizedPosix === './'
    ) {
      return '.';
    }

    if (normalizedPosix === '..' || normalizedPosix.startsWith('../')) {
      throw new BadRequestException('File path cannot escape workspace root');
    }

    return normalizedPosix.replace(/\/+$/, '') || '.';
  }

  private normalizeRelativePath(value: string): string {
    const normalized = value.trim().replaceAll('\\', '/');

    if (!normalized) {
      throw new BadRequestException('File path cannot be empty');
    }

    if (path.isAbsolute(normalized)) {
      throw new BadRequestException('Absolute file path is not allowed');
    }

    const normalizedPosix = path.posix.normalize(normalized);

    if (
      normalizedPosix === '.' ||
      normalizedPosix === '..' ||
      normalizedPosix.startsWith('../')
    ) {
      throw new BadRequestException('File path cannot escape workspace root');
    }

    return normalizedPosix;
  }

  private normalizeFilePaths(files: string[]): string[] {
    const normalizedFiles = files
      .map((item) => this.normalizeRelativePath(item))
      .filter(Boolean);

    if (!normalizedFiles.length) {
      throw new BadRequestException('At least one file path is required');
    }

    return Array.from(new Set(normalizedFiles));
  }

  private resolveBaseShortName(
    requestedBaseBranch: string | undefined,
    task: Task,
  ): string {
    const raw =
      requestedBaseBranch?.trim() || task.gitBaseBranch?.trim() || 'main';

    if (raw.startsWith('origin/')) {
      const rest = raw.slice('origin/'.length).trim();
      return rest || 'main';
    }

    return raw;
  }

  private async resolveBaseBranch(
    worktreePath: string,
    task: Task,
    requestedBaseBranch?: string,
  ): Promise<string> {
    const snapshotSha = this.resolveWorkspaceSnapshotSha(task);
    if (snapshotSha) {
      return snapshotSha;
    }

    const baseBranch =
      requestedBaseBranch?.trim() || task.gitBaseBranch?.trim() || 'main';

    if (baseBranch.startsWith('origin/')) {
      return baseBranch;
    }

    const remoteRef = `origin/${baseBranch}`;
    const remoteResult = await this.runGitCommand(worktreePath, [
      'rev-parse',
      '--verify',
      remoteRef,
    ]);

    if (remoteResult.success) {
      return remoteRef;
    }

    return baseBranch;
  }

  private resolveWorkspaceSnapshotSha(task: Task): string | null {
    const config = task.configJson as Record<string, unknown> | null;
    if (!config) return null;
    const ws = config.workspaceSnapshot as Record<string, unknown> | undefined;
    if (!ws) return null;
    const sha =
      typeof ws.snapshotCommitSha === 'string'
        ? ws.snapshotCommitSha.trim()
        : null;
    return sha || null;
  }

  private normalizeBranchName(value: string): string | null {
    const normalized = value.trim();

    if (!normalized || normalized === 'HEAD') {
      return null;
    }

    return normalized;
  }

  private async readConflictFiles(worktreePath: string): Promise<string[]> {
    const result = await this.runGitCommand(
      worktreePath,
      this.withGitUtf8Paths(['diff', '--name-only', '--diff-filter=U']),
    );

    if (!result.success) {
      return [];
    }

    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.decodeGitQuotedPath(line));
  }

  private toGitException(
    summary: string,
    result: GitExecutionResult,
  ): BadRequestException {
    return new BadRequestException(this.formatGitFailure(summary, result));
  }

  private formatGitFailure(
    summary: string,
    result: Pick<GitExecutionResult, 'stdout' | 'stderr' | 'exitCode'>,
  ): string {
    const details = result.stderr || result.stdout;
    const normalizedDetails = details.trim();

    if (!normalizedDetails) {
      return result.exitCode === null
        ? summary
        : `${summary} (exit ${result.exitCode})`;
    }

    const boundedDetails =
      normalizedDetails.length > 400
        ? `${normalizedDetails.slice(0, 400)}...`
        : normalizedDetails;

    return `${summary}: ${boundedDetails}`;
  }
}
