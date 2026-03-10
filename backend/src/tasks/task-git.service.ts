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
import { TaskRuntimeService } from './task-runtime.service';
import { TasksService } from './tasks.service';

type GitExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

@Injectable()
export class TaskGitService {
  private readonly defaultGitTimeoutMs = 90_000;
  private readonly maxDiffTextLength = 180_000;

  constructor(
    private readonly tasksService: TasksService,
    private readonly taskRuntimeService: TaskRuntimeService,
  ) {}

  async getStatus(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitStatusDto> {
    const { task, worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const [statusResult, branchResult] = await Promise.all([
      this.runGitCommand(worktreePath, ['status', '--porcelain']),
      this.runGitCommand(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']),
    ]);

    if (!statusResult.success) {
      throw this.toGitException('Failed to read git status', statusResult);
    }

    if (!branchResult.success) {
      throw this.toGitException('Failed to read current branch', branchResult);
    }

    return {
      branchName: this.normalizeBranchName(branchResult.stdout),
      baseBranch: task.gitBaseBranch ?? null,
      files: this.parseChangedFiles(statusResult.stdout),
    };
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

    const args = ['diff', '--no-color'];
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

    const baseBranch = this.resolveBaseBranch(task, query.baseBranch);
    const [diffFilesResult, branchResult] = await Promise.all([
      this.runGitCommand(worktreePath, [
        'diff',
        '--name-status',
        `${baseBranch}...HEAD`,
      ]),
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
          path: rawPath,
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

    const baseBranch = this.resolveBaseBranch(task, query.baseBranch);
    const args = ['diff', '--no-color', `${baseBranch}...HEAD`];

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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );

    const message = payload.message.trim();
    if (!message) {
      throw new BadRequestException('Commit message cannot be empty');
    }

    const result = await this.runGitCommand(worktreePath, [
      'commit',
      '-m',
      message,
    ]);

    if (!result.success) {
      throw this.toGitException('Failed to commit changes', result);
    }

    return {
      success: true,
      message: result.stdout || 'Commit completed',
    };
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
    const baseBranch = this.resolveBaseBranch(task, payload.baseBranch);

    const result = await this.runGitCommand(worktreePath, [
      'merge',
      '--no-ff',
      baseBranch,
    ]);

    if (result.success) {
      return {
        success: true,
        message: result.stdout || `Merged ${baseBranch}`,
      };
    }

    const conflicts = await this.readConflictFiles(worktreePath);

    return {
      success: false,
      message: this.formatGitFailure('Merge failed', result),
      conflicts,
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
    const baseBranch = this.resolveBaseBranch(task, payload.baseBranch);

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

    const baseBranch = this.resolveBaseBranch(task, payload.baseBranch);

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
      url: this.buildPullRequestUrl(remoteUrl, baseBranch, headBranch),
    };
  }

  private async resolveTaskGitContext(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; worktreePath: string }> {
    const { task, project } =
      await this.tasksService.assertCanAccessTaskProject(taskId, currentUser);

    if (!task.gitWorktree?.trim()) {
      throw new ConflictException('Task workspace is not initialized');
    }

    const runtimeWorktreePath = this.taskRuntimeService.resolveTaskWorktreePath(
      task,
      project,
    );

    const worktreePath = await fs.realpath(runtimeWorktreePath).catch(() => {
      throw new NotFoundException('Task workspace does not exist');
    });

    const hasGitDir = await fs
      .stat(path.join(worktreePath, '.git'))
      .then(() => true)
      .catch(() => false);

    if (!hasGitDir) {
      throw new BadRequestException('Task workspace is not a git repository');
    }

    return {
      task,
      worktreePath,
    };
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
          path: normalizedPath,
          status,
          staged: status[0] !== ' ',
        };
      });
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

  private resolveBaseBranch(task: Task, requestedBaseBranch?: string): string {
    const baseBranch =
      requestedBaseBranch?.trim() || task.gitBaseBranch?.trim();

    if (!baseBranch) {
      return 'main';
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
    const result = await this.runGitCommand(worktreePath, [
      'diff',
      '--name-only',
      '--diff-filter=U',
    ]);

    if (!result.success) {
      return [];
    }

    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
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

  private parseRemoteUrl(
    remoteUrl: string,
  ): { host: string; path: string; protocol: string } | null {
    const trimmed = remoteUrl.trim().replace(/\.git$/i, '');
    if (!trimmed) {
      return null;
    }

    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('ssh://')
    ) {
      try {
        const parsedUrl = new URL(trimmed);

        return {
          host: parsedUrl.host,
          path: parsedUrl.pathname.replace(/^\/+/, ''),
          protocol: parsedUrl.protocol.replace(':', '') || 'https',
        };
      } catch {
        return null;
      }
    }

    const scpMatch = trimmed.match(/^(?:[^@]+@)?([^:]+):(.+)$/);
    if (scpMatch) {
      return {
        host: scpMatch[1],
        path: scpMatch[2],
        protocol: 'https',
      };
    }

    return null;
  }

  private buildRepositoryUrl(remoteUrl: string): string | null {
    const parsed = this.parseRemoteUrl(remoteUrl);
    if (!parsed) {
      return null;
    }

    const protocol = parsed.protocol === 'http' ? 'http' : 'https';

    return `${protocol}://${parsed.host}/${parsed.path}`;
  }

  private buildPullRequestUrl(
    remoteUrl: string,
    baseBranch: string,
    headBranch: string,
  ): string | null {
    const parsed = this.parseRemoteUrl(remoteUrl);
    if (!parsed) {
      return null;
    }

    const repositoryUrl = this.buildRepositoryUrl(remoteUrl);
    if (!repositoryUrl) {
      return null;
    }

    const encodedBaseBranch = encodeURIComponent(baseBranch);
    const encodedHeadBranch = encodeURIComponent(headBranch);
    const host = parsed.host.toLowerCase();

    if (host.includes('github.com')) {
      return `${repositoryUrl}/compare/${encodedBaseBranch}...${encodedHeadBranch}?expand=1`;
    }

    if (host.includes('gitlab')) {
      return `${repositoryUrl}/-/merge_requests/new?merge_request[source_branch]=${encodedHeadBranch}&merge_request[target_branch]=${encodedBaseBranch}`;
    }

    if (host.includes('bitbucket')) {
      return `${repositoryUrl}/pull-requests/new?source=${encodedHeadBranch}&dest=${encodedBaseBranch}`;
    }

    return null;
  }
}
