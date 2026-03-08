import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  TaskWorkspaceEntryDto,
  TaskWorkspaceFileDto,
  TaskWorkspaceFileQueryDto,
  TaskWorkspacePreviewDto,
  TaskWorkspaceTreeDto,
  TaskWorkspaceTreeQueryDto,
} from './dto/task-workspace.dto';
import { Task } from './domain/task';
import { TaskRuntimeService } from './task-runtime.service';
import { TasksService } from './tasks.service';

@Injectable()
export class TaskWorkspaceService {
  private readonly maxFileReadBytes = 1024 * 1024;
  private readonly maxTextPreviewBytes = 256 * 1024;
  private readonly maxImagePreviewBytes = 4 * 1024 * 1024;

  constructor(
    private readonly tasksService: TasksService,
    private readonly taskRuntimeService: TaskRuntimeService,
  ) {}

  async getWorkspaceTree(
    taskId: string,
    query: TaskWorkspaceTreeQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspaceTreeDto> {
    const { workspaceRoot } = await this.resolveWorkspaceContext(
      taskId,
      currentUser,
    );
    const resolved = await this.resolveTargetPath({
      workspaceRoot,
      relativePath: query.path,
    });

    const stat = await fs.stat(resolved.targetPath).catch(() => null);
    if (!stat) {
      throw new NotFoundException('Workspace path not found');
    }
    if (!stat.isDirectory()) {
      throw new BadRequestException('Workspace path must be a directory');
    }

    const dirEntries = await fs.readdir(resolved.targetPath, {
      withFileTypes: true,
    });

    const entries = dirEntries
      .map<TaskWorkspaceEntryDto>((entry) => {
        const absoluteEntryPath = path.join(resolved.targetPath, entry.name);

        return {
          name: entry.name,
          path: this.toRelativePath(workspaceRoot, absoluteEntryPath),
          isDir: entry.isDirectory(),
        };
      })
      .sort((left, right) => {
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

    return {
      cwd: resolved.cwd,
      entries,
    };
  }

  async getWorkspaceFile(
    taskId: string,
    query: TaskWorkspaceFileQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspaceFileDto> {
    const { workspaceRoot } = await this.resolveWorkspaceContext(
      taskId,
      currentUser,
    );
    const resolved = await this.resolveTargetPath({
      workspaceRoot,
      relativePath: query.path,
    });

    const stat = await fs.stat(resolved.targetPath).catch(() => null);
    if (!stat) {
      throw new NotFoundException('Workspace file not found');
    }
    if (!stat.isFile()) {
      throw new BadRequestException('Workspace path must be a file');
    }

    const mimeType = this.resolveMimeType(resolved.targetPath);
    const tooLarge = stat.size > this.maxFileReadBytes;

    if (tooLarge) {
      return {
        path: resolved.cwd,
        name: path.basename(resolved.targetPath),
        size: stat.size,
        tooLarge: true,
        encoding: null,
        mimeType,
        content: null,
      };
    }

    const fileBuffer = await fs.readFile(resolved.targetPath);
    const isText = this.isTextBuffer(fileBuffer);

    return {
      path: resolved.cwd,
      name: path.basename(resolved.targetPath),
      size: stat.size,
      tooLarge: false,
      encoding: isText ? 'utf8' : 'base64',
      mimeType,
      content: isText
        ? fileBuffer.toString('utf-8')
        : fileBuffer.toString('base64'),
    };
  }

  async getWorkspacePreview(
    taskId: string,
    query: TaskWorkspaceFileQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskWorkspacePreviewDto> {
    const { workspaceRoot } = await this.resolveWorkspaceContext(
      taskId,
      currentUser,
    );
    const resolved = await this.resolveTargetPath({
      workspaceRoot,
      relativePath: query.path,
    });

    const stat = await fs.stat(resolved.targetPath).catch(() => null);
    if (!stat) {
      throw new NotFoundException('Workspace file not found');
    }
    if (!stat.isFile()) {
      throw new BadRequestException('Workspace path must be a file');
    }

    const mimeType = this.resolveMimeType(resolved.targetPath);

    if (mimeType.startsWith('image/')) {
      if (stat.size > this.maxImagePreviewBytes) {
        return {
          path: resolved.cwd,
          previewType: 'image',
          tooLarge: true,
          size: stat.size,
          mimeType,
          dataUrl: null,
        };
      }

      const fileBuffer = await fs.readFile(resolved.targetPath);

      return {
        path: resolved.cwd,
        previewType: 'image',
        tooLarge: false,
        size: stat.size,
        mimeType,
        dataUrl: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
      };
    }

    if (stat.size > this.maxTextPreviewBytes) {
      return {
        path: resolved.cwd,
        previewType: this.isTextLikeMime(mimeType) ? 'text' : 'binary',
        tooLarge: true,
        size: stat.size,
        mimeType,
      };
    }

    const fileBuffer = await fs.readFile(resolved.targetPath);
    const isText =
      this.isTextLikeMime(mimeType) || this.isTextBuffer(fileBuffer);

    if (!isText) {
      return {
        path: resolved.cwd,
        previewType: 'binary',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    return {
      path: resolved.cwd,
      previewType: 'text',
      tooLarge: false,
      size: stat.size,
      mimeType,
      text: fileBuffer.toString('utf-8'),
    };
  }

  private async resolveWorkspaceContext(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; workspaceRoot: string }> {
    const { task, project } =
      await this.tasksService.assertCanAccessTaskProject(taskId, currentUser);

    if (!task.gitWorktree?.trim()) {
      throw new ConflictException('Task workspace is not initialized');
    }

    const runtimeWorkspaceRoot =
      this.taskRuntimeService.resolveTaskWorktreePath(task, project);

    const workspaceRoot = await fs.realpath(runtimeWorkspaceRoot).catch(() => {
      throw new NotFoundException('Task workspace path does not exist');
    });

    return {
      task,
      workspaceRoot,
    };
  }

  private async resolveTargetPath({
    workspaceRoot,
    relativePath,
  }: {
    workspaceRoot: string;
    relativePath?: string;
  }): Promise<{ targetPath: string; cwd: string }> {
    const normalizedRelativePath = this.normalizeRelativePath(relativePath);
    const rawTargetPath =
      normalizedRelativePath === '.'
        ? workspaceRoot
        : path.resolve(workspaceRoot, normalizedRelativePath);

    const targetPath = await fs.realpath(rawTargetPath).catch(() => {
      throw new NotFoundException('Workspace path does not exist');
    });

    this.ensurePathInsideWorkspace(workspaceRoot, targetPath);

    return {
      targetPath,
      cwd: this.toRelativePath(workspaceRoot, targetPath),
    };
  }

  private normalizeRelativePath(value?: string): string {
    if (!value?.trim()) {
      return '.';
    }

    if (path.isAbsolute(value)) {
      throw new BadRequestException('Absolute path is not allowed');
    }

    const normalized = path
      .normalize(value.trim())
      .replace(/^\.(?:[\\/]|$)/, '')
      .replace(/[\\/]+$/, '');

    if (!normalized) {
      return '.';
    }

    const pathSegments = normalized.split(path.sep);
    if (pathSegments.some((segment) => segment === '..')) {
      throw new BadRequestException('Workspace path cannot escape root');
    }

    return normalized;
  }

  private ensurePathInsideWorkspace(
    workspaceRoot: string,
    targetPath: string,
  ): void {
    const relativePath = path.relative(workspaceRoot, targetPath);

    if (
      relativePath === '' ||
      (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
    ) {
      return;
    }

    throw new BadRequestException('Workspace path cannot escape root');
  }

  private toRelativePath(workspaceRoot: string, targetPath: string): string {
    const relativePath = path.relative(workspaceRoot, targetPath);

    if (!relativePath) {
      return '.';
    }

    return relativePath.split(path.sep).join('/');
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
}
