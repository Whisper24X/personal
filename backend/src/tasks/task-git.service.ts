import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { TaskAccessService } from './application/task-access.service';
import { TaskWorkspaceArtifactService } from './application/task-workspace-artifact.service';
import {
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

export type TaskGitCommitIfChangedResult = {
  committed: boolean;
  skippedReason?: 'no_changes';
  commitSha?: string | null;
  subject?: string | null;
};

@Injectable()
export class TaskGitService {
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
      const { task, worktreePath } = await this.resolveTaskGitContext(
        taskId,
        currentUser,
        diagnostics,
      );

      const [statusResult, branchResult] = await Promise.all([
        this.measureGitCommand(diagnostics, 'gitStatus', () =>
          this.runGitCommand(
            worktreePath,
            this.withGitUtf8Paths([
              'status',
              '--porcelain',
              '--untracked-files=all',
            ]),
          ),
        ),
        this.measureGitCommand(diagnostics, 'gitBranch', () =>
          this.runGitCommand(worktreePath, [
            'rev-parse',
            '--abbrev-ref',
            'HEAD',
          ]),
        ),
      ]);

      if (!statusResult.success) {
        throw this.toGitException('Failed to read git status', statusResult);
      }

      if (!branchResult.success) {
        throw this.toGitException(
          'Failed to read current branch',
          branchResult,
        );
      }

      const files = this.parseChangedFiles(statusResult.stdout);
      diagnostics.add({
        baseBranch: task.gitBaseBranch ?? null,
        branchName: this.normalizeBranchName(branchResult.stdout),
        changedFileCount: files.length,
      });

      return {
        branchName: this.normalizeBranchName(branchResult.stdout),
        baseBranch: task.gitBaseBranch ?? null,
        files,
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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const args = this.withGitUtf8Paths(['diff', '--no-color']);
    if (query.staged) {
      args.push('--cached');
    }

    const filePath = query.path ? this.normalizeRelativePath(query.path) : null;
    if (filePath) {
      args.push('--', filePath);
    }

    const result = await this.runGitCommand(worktreePath, args);
    if (!result.success) {
      throw this.toGitException('Failed to read git diff', result);
    }

    return {
      diffText: result.stdout.slice(0, this.maxDiffTextLength),
    };
  }

  async getBranchDiffFiles(
    taskId: string,
    query: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitBranchDiffFilesDto> {
    const { task, worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const baseBranch = await this.resolveBaseBranch(
      worktreePath,
      task,
      query.baseBranch,
    );
    const [diffFilesResult, branchResult] = await Promise.all([
      this.runGitCommand(
        worktreePath,
        this.withGitUtf8Paths([
          'diff',
          '--name-status',
          `${baseBranch}...HEAD`,
        ]),
      ),
      this.runGitCommand(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']),
    ]);

    if (!diffFilesResult.success) {
      throw this.toGitException(
        'Failed to read branch diff files',
        diffFilesResult,
      );
    }

    if (!branchResult.success) {
      throw this.toGitException('Failed to read current branch', branchResult);
    }

    const files = diffFilesResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [statusToken, ...pathParts] = line.split('\t');
        const rawPath = pathParts[pathParts.length - 1] ?? '';

        return {
          path: this.decodeGitQuotedPath(rawPath),
          status: statusToken || '?',
        };
      });

    return {
      baseBranch,
      currentBranch: this.normalizeBranchName(branchResult.stdout),
      files,
    };
  }

  async getBranchDiff(
    taskId: string,
    query: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitDiffDto> {
    const { task, worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const baseBranch = await this.resolveBaseBranch(
      worktreePath,
      task,
      query.baseBranch,
    );
    const args = this.withGitUtf8Paths([
      'diff',
      '--no-color',
      `${baseBranch}...HEAD`,
    ]);

    if (query.path) {
      args.push('--', this.normalizeRelativePath(query.path));
    }

    const result = await this.runGitCommand(worktreePath, args);
    if (!result.success) {
      throw this.toGitException('Failed to read branch diff', result);
    }

    return {
      diffText: result.stdout.slice(0, this.maxDiffTextLength),
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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const files = this.normalizeFilePaths(payload.files);

    const result = await this.runGitCommand(worktreePath, [
      'add',
      '--',
      ...files,
    ]);

    if (!result.success) {
      throw this.toGitException('Failed to stage files', result);
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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const files = this.normalizeFilePaths(payload.files);

    const result = await this.runGitCommand(worktreePath, [
      'restore',
      '--staged',
      '--',
      ...files,
    ]);

    if (!result.success) {
      throw this.toGitException('Failed to unstage files', result);
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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    return this.commitIfChangedInWorktree(worktreePath, message);
  }

  async commitIfChangedForTask(
    task: Task,
    project: Project,
    message: string,
  ): Promise<TaskGitCommitIfChangedResult> {
    const worktreePath = await this.resolveTaskGitWorktreePath(task, project);

    return this.commitIfChangedInWorktree(worktreePath, message);
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
    const { task, worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const baseShort = this.resolveBaseShortName(payload.baseBranch, task);
    const resolvedBaseRef = await this.resolveBaseBranch(
      worktreePath,
      task,
      payload.baseBranch,
    );

    const headRefResult = await this.runGitCommand(worktreePath, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    if (!headRefResult.success) {
      throw this.toGitException('Failed to read current branch', headRefResult);
    }

    const currentBranch = this.normalizeBranchName(headRefResult.stdout);
    if (!currentBranch) {
      throw new BadRequestException(
        'Cannot merge while in detached HEAD state',
      );
    }

    if (currentBranch === baseShort) {
      throw new BadRequestException(
        'Already on the base branch; check out a feature branch to merge into the base',
      );
    }

    const statusResult = await this.runGitCommand(
      worktreePath,
      this.withGitUtf8Paths(['status', '--porcelain', '--untracked-files=all']),
    );
    if (!statusResult.success) {
      throw this.toGitException('Failed to read git status', statusResult);
    }
    if (statusResult.stdout.trim()) {
      throw new BadRequestException(
        'Working tree is not clean; commit or discard changes before merging',
      );
    }

    const localBaseRef = await this.runGitCommand(worktreePath, [
      'rev-parse',
      '--verify',
      `refs/heads/${baseShort}`,
    ]);

    const checkoutBaseResult = localBaseRef.success
      ? await this.runGitCommand(worktreePath, ['checkout', baseShort])
      : await this.runGitCommand(worktreePath, [
          'checkout',
          '-B',
          baseShort,
          resolvedBaseRef,
        ]);

    if (!checkoutBaseResult.success) {
      throw this.toGitException(
        'Failed to checkout base branch',
        checkoutBaseResult,
      );
    }

    const mergeResult = await this.runGitCommand(worktreePath, [
      'merge',
      '--no-ff',
      currentBranch,
    ]);

    if (!mergeResult.success) {
      const conflicts = await this.readConflictFiles(worktreePath);
      await this.runGitCommand(worktreePath, ['merge', '--abort']);
      const checkoutBackAfterFailure = await this.runGitCommand(worktreePath, [
        'checkout',
        currentBranch,
      ]);

      const failureMessage = this.formatGitFailure('Merge failed', mergeResult);
      if (!checkoutBackAfterFailure.success) {
        return {
          success: false,
          message: `${failureMessage} Failed to return to ${currentBranch}: ${this.formatGitFailure('Checkout failed', checkoutBackAfterFailure)}`,
          conflicts,
        };
      }

      return {
        success: false,
        message: failureMessage,
        conflicts,
      };
    }

    const checkoutBackResult = await this.runGitCommand(worktreePath, [
      'checkout',
      currentBranch,
    ]);
    if (!checkoutBackResult.success) {
      throw this.toGitException(
        `Merged into ${baseShort} but failed to switch back to ${currentBranch}`,
        checkoutBackResult,
      );
    }

    const detail = mergeResult.stdout.trim() || mergeResult.stderr.trim() || '';

    return {
      success: true,
      message:
        `Merged "${currentBranch}" into local base "${baseShort}" and switched back. Remote base was not updated.` +
        (detail ? ` ${detail}` : ''),
    };
  }

  async rebase(
    taskId: string,
    payload: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { task, worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const baseBranch = await this.resolveBaseBranch(
      worktreePath,
      task,
      payload.baseBranch,
    );

    const result = await this.runGitCommand(worktreePath, [
      'rebase',
      baseBranch,
    ]);

    if (result.success) {
      return {
        success: true,
        message: result.stdout || `Rebased onto ${baseBranch}`,
      };
    }

    const conflicts = await this.readConflictFiles(worktreePath);

    return {
      success: false,
      message: this.formatGitFailure('Rebase failed', result),
      conflicts,
    };
  }

  async push(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const result = await this.runGitCommand(worktreePath, [
      'push',
      '--set-upstream',
      'origin',
      'HEAD',
    ]);

    if (!result.success) {
      throw this.toGitException('Failed to push changes', result);
    }

    return {
      success: true,
      message: result.stderr || result.stdout || 'Push completed',
    };
  }

  async getLog(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const result = await this.runGitCommand(worktreePath, [
      'log',
      '--oneline',
      '-20',
      '--no-color',
    ]);

    if (!result.success) {
      throw this.toGitException('Failed to read git log', result);
    }

    return {
      success: true,
      message: result.stdout || 'No commits yet',
    };
  }

  async getPrLink(
    taskId: string,
    payload: TaskGitBranchDiffQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitPrLinkDto> {
    const { task, worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const baseBranch = await this.resolveBaseBranch(
      worktreePath,
      task,
      payload.baseBranch,
    );

    const [remoteUrlResult, branchResult] = await Promise.all([
      this.runGitCommand(worktreePath, [
        'config',
        '--get',
        'remote.origin.url',
      ]),
      this.runGitCommand(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']),
    ]);

    if (!remoteUrlResult.success || !branchResult.success) {
      return {
        url: null,
      };
    }

    const remoteUrl = remoteUrlResult.stdout.trim();
    const headBranch = this.normalizeBranchName(branchResult.stdout);

    if (!remoteUrl || !headBranch) {
      return {
        url: null,
      };
    }

    return {
      url: buildPullRequestUrl(remoteUrl, baseBranch, headBranch),
    };
  }

  private async resolveTaskGitContext(
    taskId: string,
    currentUser: JwtPayloadType,
    diagnostics?: SlowApiDiagnosticsSession,
  ): Promise<{ task: Task; worktreePath: string }> {
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

    return {
      task,
      worktreePath: await this.resolveTaskGitWorktreePath(
        task,
        project,
        diagnostics,
      ),
    };
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

    const worktreePath = diagnostics
      ? await diagnostics.measure(
          'realpath',
          () =>
            fs.realpath(runtimeWorktreePath).catch(() => {
              throw new NotFoundException('Task workspace does not exist');
            }),
          (result) => ({
            worktreePath: result,
          }),
        )
      : await fs.realpath(runtimeWorktreePath).catch(() => {
          throw new NotFoundException('Task workspace does not exist');
        });

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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException('Commit message cannot be empty');
    }

    await this.ensureCommitIdentityConfigured(worktreePath);

    return this.runGitCommand(worktreePath, [
      'commit',
      '-m',
      normalizedMessage,
    ]);
  }

  private async commitIfChangedInWorktree(
    worktreePath: string,
    message: string,
  ): Promise<TaskGitCommitIfChangedResult> {
    const changedFiles =
      await this.taskWorkspaceArtifactService.listArtifactFiles({
        worktreePath,
        source: {
          sourceType: 'workspace_unstaged_fallback',
          nodeId: null,
          beforeCommitSha: null,
          afterCommitSha: null,
        },
      });

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
