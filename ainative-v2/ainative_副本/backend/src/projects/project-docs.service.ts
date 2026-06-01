import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import path from 'path';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  ProjectDocsPreviewQueryDto,
  ProjectDocsTreeQueryDto,
  SaveProjectDocDto,
} from './dto/project-doc.dto';
import { Project } from './domain/project';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';

@Injectable()
export class ProjectDocsService {
  private readonly maxTextPreviewBytes = 256 * 1024;
  private readonly maxImagePreviewBytes = 4 * 1024 * 1024;
  private readonly maxProjectDocFiles = 500;
  private readonly maxProjectDocDepth = 8;

  constructor(
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
  ) {}

  normalizeProjectDocPath(value: string): string {
    return this.projectRepositoryWorkspaceService.normalizeProjectDocPath(
      value,
    );
  }

  async docsTree(
    projectId: Project['id'],
    query: ProjectDocsTreeQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    cwd: string;
    entries: Array<{ name: string; path: string; isDir: boolean }>;
  }> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.resolve(path.join(repositoryRoot, 'docs'));
    await fs.mkdir(docsRoot, { recursive: true });

    const targetPath = this.resolveDocsBrowsePath(docsRoot, query.path);
    const stat = await fs.stat(targetPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new NotFoundException('Docs path not found or not a directory');
    }

    const dirEntries = await fs.readdir(targetPath, { withFileTypes: true });
    const entries = dirEntries
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map((entry) => {
        const absoluteEntryPath = path.join(targetPath, entry.name);
        return {
          name: entry.name,
          path: path
            .relative(docsRoot, absoluteEntryPath)
            .split(path.sep)
            .join('/'),
          isDir: entry.isDirectory(),
        };
      })
      .sort((left, right) => {
        if (left.isDir && !right.isDir) return -1;
        if (!left.isDir && right.isDir) return 1;
        return left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

    const cwd = path.relative(docsRoot, targetPath);
    return { cwd: cwd || '.', entries };
  }

  async docsFileStream(
    projectId: Project['id'],
    query: ProjectDocsPreviewQueryDto,
    currentUser: JwtPayloadType,
  ) {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.resolve(path.join(repositoryRoot, 'docs'));
    const relativePath = this.normalizeProjectDocPath(query.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Doc file not found');
    }

    return {
      stream: createReadStream(absolutePath),
      mimeType: this.resolveDocMimeType(absolutePath),
      size: stat.size,
    };
  }

  async docsPreview(
    projectId: Project['id'],
    query: ProjectDocsPreviewQueryDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    previewType: 'text' | 'image' | 'binary' | 'pdf' | 'video' | 'audio';
    tooLarge: boolean;
    size: number;
    mimeType?: string | null;
    text?: string | null;
    dataUrl?: string | null;
  }> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.resolve(path.join(repositoryRoot, 'docs'));
    const relativePath = this.normalizeProjectDocPath(query.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Docs file not found');
    }

    const mimeType = this.resolveDocMimeType(absolutePath);

    if (mimeType === 'application/pdf') {
      return {
        path: relativePath,
        previewType: 'pdf',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    if (mimeType.startsWith('video/')) {
      return {
        path: relativePath,
        previewType: 'video',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    if (mimeType.startsWith('audio/')) {
      return {
        path: relativePath,
        previewType: 'audio',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    if (mimeType.startsWith('image/')) {
      if (stat.size > this.maxImagePreviewBytes) {
        return {
          path: relativePath,
          previewType: 'image',
          tooLarge: true,
          size: stat.size,
          mimeType,
          dataUrl: null,
        };
      }

      const fileBuffer = await fs.readFile(absolutePath);
      return {
        path: relativePath,
        previewType: 'image',
        tooLarge: false,
        size: stat.size,
        mimeType,
        dataUrl: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
      };
    }

    if (stat.size > this.maxTextPreviewBytes) {
      return {
        path: relativePath,
        previewType: this.isDocTextLikeMime(mimeType) ? 'text' : 'binary',
        tooLarge: true,
        size: stat.size,
        mimeType,
      };
    }

    const fileBuffer = await fs.readFile(absolutePath);
    const isText =
      this.isDocTextLikeMime(mimeType) || this.isDocTextBuffer(fileBuffer);

    if (!isText) {
      return {
        path: relativePath,
        previewType: 'binary',
        tooLarge: false,
        size: stat.size,
        mimeType,
      };
    }

    return {
      path: relativePath,
      previewType: 'text',
      tooLarge: false,
      size: stat.size,
      mimeType,
      text: fileBuffer.toString('utf-8'),
    };
  }

  async listDocs(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<
    Array<{ path: string; name: string; size: number; updatedAt: Date }>
  > {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const docsRootExists = await this.pathExists(docsRoot);
    if (!docsRootExists) {
      return [];
    }

    const results: Array<{
      path: string;
      name: string;
      size: number;
      updatedAt: Date;
    }> = [];

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (
        depth > this.maxProjectDocDepth ||
        results.length >= this.maxProjectDocFiles
      ) {
        return;
      }

      let entries: Array<{
        name: string;
        isDirectory: () => boolean;
        isFile: () => boolean;
      }>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (results.length >= this.maxProjectDocFiles) {
          return;
        }

        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath, depth + 1);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const stat = await fs.stat(absolutePath).catch(() => null);
        if (!stat?.isFile()) {
          continue;
        }

        const relativePath = path
          .relative(docsRoot, absolutePath)
          .split(path.sep)
          .join('/');
        if (
          !relativePath ||
          relativePath.startsWith('..') ||
          path.isAbsolute(relativePath)
        ) {
          continue;
        }

        results.push({
          path: relativePath,
          name: path.basename(absolutePath),
          size: stat.size,
          updatedAt: stat.mtime,
        });
      }
    };

    await walk(docsRoot, 0);
    return results.sort((left, right) => left.path.localeCompare(right.path));
  }

  async readDoc(
    projectId: Project['id'],
    rawDocPath: string,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawDocPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);

    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    return {
      path: relativePath,
      name: path.basename(absolutePath),
      size: stat.size,
      updatedAt: stat.mtime,
      content: await fs.readFile(absolutePath, 'utf-8'),
    };
  }

  async uploadProjectDoc(
    projectId: Project['id'],
    rawPath: string,
    file: Buffer,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    const existing = await fs.stat(absolutePath).catch(() => null);
    if (existing?.isDirectory()) {
      throw new ConflictException('Project doc path is a directory');
    }

    const parentDir = path.dirname(absolutePath);
    const parentStat = await fs.stat(parentDir).catch(() => null);
    if (parentStat?.isFile()) {
      const parentRelative = path
        .relative(docsRoot, parentDir)
        .replace(/\\/g, '/');
      throw new ConflictException(
        `路径「${parentRelative}」已存在为文件，无法在其下创建子文件。请删除该文件或选择其他路径。`,
      );
    }

    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(absolutePath, file);

    return this.readDoc(projectId, relativePath, currentUser);
  }

  async createDoc(
    projectId: Project['id'],
    payload: SaveProjectDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(payload.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );

    if (await this.pathExists(absolutePath)) {
      throw new ConflictException('Project doc already exists');
    }

    const parentDir = path.dirname(absolutePath);
    const parentStat = await fs.stat(parentDir).catch(() => null);
    if (parentStat?.isFile()) {
      const parentRelative = path
        .relative(docsRoot, parentDir)
        .replace(/\\/g, '/');
      throw new ConflictException(
        `路径「${parentRelative}」已存在为文件，无法在其下创建子文件。请删除该文件或选择其他路径。`,
      );
    }

    await fs.mkdir(parentDir, { recursive: true });

    if (payload.contentBase64 != null && payload.contentBase64 !== '') {
      await fs.writeFile(
        absolutePath,
        Buffer.from(payload.contentBase64, 'base64'),
      );
    } else {
      await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');
    }

    return this.readDoc(projectId, relativePath, currentUser);
  }

  async updateDoc(
    projectId: Project['id'],
    payload: SaveProjectDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(payload.path);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    if (payload.contentBase64 != null && payload.contentBase64 !== '') {
      await fs.writeFile(
        absolutePath,
        Buffer.from(payload.contentBase64, 'base64'),
      );
    } else {
      await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');
    }

    return this.readDoc(projectId, relativePath, currentUser);
  }

  async removeDoc(
    projectId: Project['id'],
    rawDocPath: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(rawDocPath);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new NotFoundException('Project doc not found');
    }

    await fs.unlink(absolutePath);
  }

  async removeGoalDocsSubtree(
    projectId: Project['id'],
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    const trimmed = goalId?.trim();
    if (
      !trimmed ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        trimmed,
      )
    ) {
      throw new BadRequestException('Invalid goal id');
    }

    const { repositoryRoot } =
      await this.projectRepositoryWorkspaceService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const relativePath = this.normalizeProjectDocPath(`goals/${trimmed}`);
    const absolutePath = this.resolveProjectDocAbsolutePath(
      docsRoot,
      relativePath,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat) {
      return;
    }

    await fs.rm(absolutePath, { recursive: true, force: true });
  }

  resolveProjectDocAbsolutePath(
    docsRoot: string,
    relativePath: string,
  ): string {
    const resolvedDocsRoot = path.resolve(docsRoot);
    const absolutePath = path.resolve(resolvedDocsRoot, relativePath);
    const relative = path.relative(resolvedDocsRoot, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Project doc path cannot escape docs root');
    }

    return absolutePath;
  }

  private resolveDocsBrowsePath(
    docsRoot: string,
    relativePath?: string,
  ): string {
    const raw = relativePath?.trim();
    if (!raw || raw === '.') {
      return docsRoot;
    }

    if (path.isAbsolute(raw)) {
      throw new BadRequestException('Absolute path is not allowed');
    }

    const normalized = path
      .normalize(raw.replace(/\\/g, '/'))
      .replace(/[\\/]+$/, '');

    if (normalized.split(path.sep).some((segment) => segment === '..')) {
      throw new BadRequestException('Docs path cannot escape docs root');
    }

    const absolutePath = path.resolve(docsRoot, normalized);
    const relative = path.relative(docsRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Docs path cannot escape docs root');
    }

    return absolutePath;
  }

  private resolveDocMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.mdx': 'text/markdown',
      '.markdown': 'text/markdown',
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
    return mimeMap[ext] ?? 'application/octet-stream';
  }

  private isDocTextLikeMime(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml'
    );
  }

  private isDocTextBuffer(value: Buffer): boolean {
    const inspectLength = Math.min(value.length, 8_192);
    for (let index = 0; index < inspectLength; index += 1) {
      if (value[index] === 0) {
        return false;
      }
    }
    return true;
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
