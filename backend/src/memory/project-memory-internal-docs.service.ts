import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { Project } from '../projects/domain/project';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectDocsService } from '../projects/project-docs.service';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';
import { CANONICAL_MEMORY_MARKDOWN_FILES } from './memory-path-canonical.util';

@Injectable()
export class ProjectMemoryInternalDocsService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectRepositoryWorkspaceService: ProjectRepositoryWorkspaceService,
    private readonly projectDocsService: ProjectDocsService,
  ) {}

  assertMemoryRelativePath(relativePath: string): string {
    const n = this.projectDocsService.normalizeProjectDocPath(relativePath);
    if (!n.startsWith('memory/')) {
      throw new BadRequestException('memory write only under docs/memory/');
    }
    const rest = n.slice('memory/'.length);
    if (!rest || rest.includes('..')) {
      throw new BadRequestException('invalid memory relative path');
    }
    if (rest.includes('/') || rest.includes(path.sep)) {
      throw new BadRequestException(
        'memory doc must be a single file directly under docs/memory/',
      );
    }
    if (rest === '_routing.yaml') {
      return n;
    }
    if (!rest.endsWith('.md')) {
      throw new BadRequestException(
        'memory doc must be *.md under memory/ or memory/_routing.yaml',
      );
    }
    if (!CANONICAL_MEMORY_MARKDOWN_FILES.has(rest)) {
      throw new BadRequestException(
        `memory markdown file not allowed: ${rest}`,
      );
    }
    return n;
  }

  async readDocRaw(
    project: Project,
    relativePath: string,
  ): Promise<string | null> {
    const n = this.assertMemoryRelativePath(relativePath);
    const root =
      await this.projectRepositoryWorkspaceService.ensureProjectRepository(
        project,
        { syncRemote: false },
      );
    const docsRoot = path.join(root, 'docs');
    const abs = this.projectDocsService.resolveProjectDocAbsolutePath(
      docsRoot,
      n,
    );
    try {
      return await fs.readFile(abs, 'utf-8');
    } catch {
      return null;
    }
  }

  async readDoc(
    projectId: Project['id'],
    relativePath: string,
  ): Promise<string | null> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return null;
    }
    return this.readDocRaw(project, relativePath);
  }

  async writeDoc(args: {
    projectId: string;
    relativePath: string;
    content: string;
    mode: 'create' | 'update';
  }): Promise<void> {
    const project = await this.projectRepository.findById(args.projectId);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const n = this.assertMemoryRelativePath(args.relativePath);
    const repositoryRoot =
      await this.projectRepositoryWorkspaceService.ensureProjectRepository(
        project,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const absolutePath = this.projectDocsService.resolveProjectDocAbsolutePath(
      docsRoot,
      n,
    );
    const parent = path.dirname(absolutePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (args.mode === 'create') {
      if (stat?.isFile()) {
        throw new BadRequestException('memory doc already exists');
      }
    } else {
      if (!stat?.isFile()) {
        await fs.mkdir(parent, { recursive: true });
        await fs.writeFile(absolutePath, args.content, 'utf-8');
        return;
      }
    }
    await fs.mkdir(parent, { recursive: true });
    await fs.writeFile(absolutePath, args.content, 'utf-8');
  }

  /**
   * Create if missing, else return path for read-then-update pattern.
   */
  async ensureFileExists(
    projectId: string,
    relativePath: string,
    initial: string,
  ): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    const n = this.assertMemoryRelativePath(relativePath);
    const repositoryRoot =
      await this.projectRepositoryWorkspaceService.ensureProjectRepository(
        project,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const absolutePath = this.projectDocsService.resolveProjectDocAbsolutePath(
      docsRoot,
      n,
    );
    const stat = await fs.stat(absolutePath).catch(() => null);
    const writeInitial = async () => {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, initial, 'utf-8');
    };
    if (!stat) {
      await writeInitial();
      return;
    }
    if (!stat.isFile()) {
      return;
    }
    if (stat.size === 0) {
      await writeInitial();
      return;
    }
    const existing = await fs.readFile(absolutePath, 'utf-8').catch(() => null);
    if (existing !== null && existing.trim() === '') {
      await writeInitial();
    }
  }
}
