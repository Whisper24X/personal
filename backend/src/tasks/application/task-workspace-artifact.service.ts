import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { Project } from '../../projects/domain/project';
import { Task } from '../domain/task';
import {
  TaskWorkspaceFileQueryDto,
  TaskWorkspacePreviewDto,
  TaskWorkspaceTreeDto,
  TaskWorkspaceTreeQueryDto,
} from '../dto/task-workspace.dto';
import { TaskAccessService } from './task-access.service';
import { TaskRuntimeService } from '../task-runtime.service';

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

@Injectable()
export class TaskWorkspaceArtifactService {
  private readonly defaultGitTimeoutMs = 90_000;
  private readonly maxTextPreviewBytes = 256 * 1024;
  private readonly maxImagePreviewBytes = 4 * 1024 * 1024;

  constructor(
    private readonly taskAccessService: TaskAccessService,
    private readonly taskRuntimeService: TaskRuntimeService,
  ) {}

  async getArtifactTree(
    taskId: string,
    query: TaskWorkspaceTreeQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspaceTreeDto> {
    const { worktreePath } = await this.resolveTaskWorkspaceContext(
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
    const { worktreePath } = await this.resolveTaskWorkspaceContext(
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
    const { worktreePath } = await this.resolveTaskWorkspaceContext(
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

  async listArtifactFiles(worktreePath: string): Promise<string[]> {
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

  private async resolveTaskWorkspaceContext(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; worktreePath: string }> {
    const { task, project } =
      await this.taskAccessService.assertCanAccessTaskProject(
        taskId,
        currentUser,
      );

    return {
      task,
      worktreePath: await this.resolveTaskWorkspacePath(task, project),
    };
  }

  private async resolveTaskWorkspacePath(
    task: Task,
    project: Project,
  ): Promise<string> {
    if (!task.gitWorktree?.trim()) {
      throw new BadRequestException('Task workspace is not initialized');
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

    return worktreePath;
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

  private parseChangedFiles(statusText: string): Array<{ path: string }> {
    return statusText
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const rawPath = line.slice(3).trim();
        const normalizedPath = rawPath.includes(' -> ')
          ? (rawPath.split(' -> ').pop() ?? rawPath)
          : rawPath;

        return {
          path: this.decodeGitQuotedPath(normalizedPath),
        };
      });
  }

  private decodeGitQuotedPath(input: string): string {
    const trimmed = input.trim();
    if (!trimmed.includes('\\')) {
      return trimmed;
    }

    let value = trimmed;
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    const bytes: number[] = [];
    for (let index = 0; index < value.length; ) {
      if (
        value[index] === '\\' &&
        index + 1 < value.length &&
        /[0-7]/.test(value[index + 1])
      ) {
        let oct = '';
        let nextIndex = index + 1;
        while (
          nextIndex < value.length &&
          oct.length < 3 &&
          /[0-7]/.test(value[nextIndex])
        ) {
          oct += value[nextIndex];
          nextIndex += 1;
        }
        bytes.push(parseInt(oct, 8));
        index = nextIndex;
      } else if (value[index] === '\\') {
        bytes.push(0x5c);
        index += 1;
      } else {
        bytes.push(value.charCodeAt(index) & 0xff);
        index += 1;
      }
    }

    return Buffer.from(bytes).toString('utf-8');
  }

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

  private toGitException(
    summary: string,
    result: Pick<GitExecutionResult, 'stdout' | 'stderr' | 'exitCode'>,
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
