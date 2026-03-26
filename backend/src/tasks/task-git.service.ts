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
import { TaskAccessService } from './application/task-access.service';
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
  private readonly maxTextPreviewBytes = 256 * 1024;
  private readonly maxImagePreviewBytes = 4 * 1024 * 1024;

  constructor(
    private readonly taskAccessService: TaskAccessService,
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
      this.runGitCommand(
        worktreePath,
        this.withGitUtf8Paths([
          'status',
          '--porcelain',
          '--untracked-files=all',
        ]),
      ),
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

    const baseBranch = this.resolveBaseBranch(task, query.baseBranch);
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

    const baseBranch = this.resolveBaseBranch(task, query.baseBranch);
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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const cwd = this.normalizeBrowserPath(query.path);
    const changedFiles = await this.listArtifactFiles(worktreePath);

    return {
      cwd,
      entries: this.buildArtifactEntries(changedFiles, cwd),
    };
  }

  async getArtifactPreview(
    taskId: string,
    query: TaskWorkspaceFileQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspacePreviewDto> {
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const relativePath = this.normalizeRelativePath(query.path);
    const fileBuffer = await this.readArtifactBuffer(
      worktreePath,
      relativePath,
    );

    if (!fileBuffer) {
      throw new NotFoundException('Artifact not found');
    }

    const mimeType = this.resolveMimeType(relativePath);

    if (mimeType === 'application/pdf') {
      return {
        path: relativePath,
        previewType: 'pdf',
        tooLarge: false,
        size: fileBuffer.length,
        mimeType,
      };
    }

    if (mimeType.startsWith('video/')) {
      return {
        path: relativePath,
        previewType: 'video',
        tooLarge: false,
        size: fileBuffer.length,
        mimeType,
      };
    }

    if (mimeType.startsWith('audio/')) {
      return {
        path: relativePath,
        previewType: 'audio',
        tooLarge: false,
        size: fileBuffer.length,
        mimeType,
      };
    }

    if (mimeType.startsWith('image/')) {
      if (fileBuffer.length > this.maxImagePreviewBytes) {
        return {
          path: relativePath,
          previewType: 'image',
          tooLarge: true,
          size: fileBuffer.length,
          mimeType,
          dataUrl: null,
        };
      }

      return {
        path: relativePath,
        previewType: 'image',
        tooLarge: false,
        size: fileBuffer.length,
        mimeType,
        dataUrl: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
      };
    }

    if (fileBuffer.length > this.maxTextPreviewBytes) {
      return {
        path: relativePath,
        previewType: this.isTextLikeMime(mimeType) ? 'text' : 'binary',
        tooLarge: true,
        size: fileBuffer.length,
        mimeType,
      };
    }

    const isText =
      this.isTextLikeMime(mimeType) || this.isTextBuffer(fileBuffer);

    if (!isText) {
      return {
        path: relativePath,
        previewType: 'binary',
        tooLarge: false,
        size: fileBuffer.length,
        mimeType,
      };
    }

    return {
      path: relativePath,
      previewType: 'text',
      tooLarge: false,
      size: fileBuffer.length,
      mimeType,
      text: fileBuffer.toString('utf-8'),
    };
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
    const { worktreePath } = await this.resolveTaskGitContext(
      taskId,
      currentUser,
    );
    const relativePath = this.normalizeRelativePath(query.path);
    const fileBuffer = await this.readArtifactBuffer(
      worktreePath,
      relativePath,
    );

    if (!fileBuffer) {
      throw new NotFoundException('Artifact not found');
    }

    return {
      name: path.basename(relativePath),
      mimeType: this.resolveMimeType(relativePath),
      size: fileBuffer.length,
      content: fileBuffer,
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
    const changedFiles = await this.listArtifactFiles(worktreePath);

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

    const result = await this.commitInTaskWorktree(
      taskId,
      message,
      currentUser,
    );
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
      url: buildPullRequestUrl(remoteUrl, baseBranch, headBranch),
    };
  }

  private async resolveTaskGitContext(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; worktreePath: string }> {
    const { task, project } =
      await this.taskAccessService.assertCanAccessTaskProject(
        taskId,
        currentUser,
      );

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

    return this.runGitCommand(worktreePath, [
      'commit',
      '-m',
      normalizedMessage,
    ]);
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

  private async listArtifactFiles(worktreePath: string): Promise<string[]> {
    const result = await this.runGitCommand(
      worktreePath,
      this.withGitUtf8Paths(['status', '--porcelain', '--untracked-files=all']),
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

  private buildArtifactEntries(
    stagedFiles: string[],
    cwd: string,
  ): TaskWorkspaceTreeDto['entries'] {
    const entriesByPath = new Map<
      string,
      { name: string; path: string; isDir: boolean }
    >();

    for (const filePath of stagedFiles) {
      const relativePath =
        cwd === '.' ? filePath : path.posix.relative(cwd, filePath);

      if (
        !relativePath ||
        relativePath === '.' ||
        relativePath.startsWith('../')
      ) {
        continue;
      }

      const [firstSegment, ...remainingSegments] = relativePath
        .split('/')
        .filter(Boolean);

      if (!firstSegment) {
        continue;
      }

      const entryPath = cwd === '.' ? firstSegment : `${cwd}/${firstSegment}`;

      entriesByPath.set(entryPath, {
        name: firstSegment,
        path: entryPath,
        isDir: remainingSegments.length > 0,
      });
    }

    return [...entriesByPath.values()].sort((left, right) => {
      if (left.isDir && !right.isDir) {
        return -1;
      }
      if (!left.isDir && right.isDir) {
        return 1;
      }

      return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  private async readStagedArtifactBuffer(
    worktreePath: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    const existsResult = await this.runGitCommand(worktreePath, [
      'cat-file',
      '-e',
      `:${relativePath}`,
    ]);

    if (!existsResult.success) {
      return null;
    }

    const contentResult = await this.runGitCommandBuffer(worktreePath, [
      'show',
      `:${relativePath}`,
    ]);

    if (!contentResult.success) {
      throw this.toGitException('Failed to read staged artifact content', {
        ...contentResult,
        stdout: contentResult.stdout.toString('utf-8'),
      });
    }

    return contentResult.stdout;
  }

  private async readArtifactBuffer(
    worktreePath: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    const workspaceBuffer = await this.readWorkspaceArtifactBuffer(
      worktreePath,
      relativePath,
    );

    if (workspaceBuffer) {
      return workspaceBuffer;
    }

    return this.readStagedArtifactBuffer(worktreePath, relativePath);
  }

  private async readWorkspaceArtifactBuffer(
    worktreePath: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    const workspaceRoot = path.resolve(worktreePath);
    const fullPath = path.resolve(workspaceRoot, relativePath);
    const relative = path.relative(workspaceRoot, fullPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('File path cannot escape workspace root');
    }

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return null;
    }

    return fs.readFile(fullPath);
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

  private isTextBuffer(value: Buffer): boolean {
    const inspectLength = Math.min(value.length, 8_192);

    for (let index = 0; index < inspectLength; index += 1) {
      if (value[index] === 0) {
        return false;
      }
    }

    return true;
  }

  private resolveMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypeMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.vue': 'text/plain',
      '.css': 'text/css',
      '.scss': 'text/x-scss',
      '.html': 'text/html',
      '.xml': 'application/xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };

    return mimeTypeMap[ext] ?? 'application/octet-stream';
  }

  private isTextLikeMime(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'text/yaml' ||
      mimeType === 'text/typescript' ||
      mimeType === 'text/javascript'
    );
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
