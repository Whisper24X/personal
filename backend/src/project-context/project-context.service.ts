import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { ProjectContextDto } from '../projects/dto/project-context.dto';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class ProjectContextService {
  private readonly maxDocuments = 20;
  private readonly maxPreviewLength = 1600;
  private readonly maxFileSizeBytes = 256 * 1024;

  constructor(private readonly projectsService: ProjectsService) {}

  async readContext(
    projectId: Project['id'],
    currentUser: JwtPayloadType,
  ): Promise<ProjectContextDto> {
    const project = await this.projectsService.assertCanAccessProject(
      projectId,
      currentUser,
    );

    const warnings: string[] = [];
    const documents: ProjectContextDto['documents'] = [];
    let source: ProjectContextDto['source'] = 'empty';

    const configJson = (project.configJson ?? {}) as Record<string, unknown>;

    const localContextBaseDir = this.resolveLocalContextBaseDir(configJson);

    if (localContextBaseDir) {
      const localContextResult =
        await this.loadDocumentsFromLocalPath(localContextBaseDir);
      documents.push(...localContextResult.documents);
      warnings.push(...localContextResult.warnings);

      if (localContextResult.documents.length > 0) {
        source = 'local_repository';
      }
    }

    if (!documents.length) {
      const configDocuments = this.loadDocumentsFromProjectConfig(configJson);
      documents.push(...configDocuments);

      if (configDocuments.length > 0) {
        source = 'project_config';
      }
    }

    if (!documents.length) {
      warnings.push(
        'No readable project context found. Configure `contextBaseDir` or `contextDocuments` in project config.',
      );
    }

    return {
      projectId: project.id,
      gitUrl: project.gitUrl,
      defaultBranch: project.defaultBranch,
      source,
      generatedAt: new Date(),
      documents: documents.slice(0, this.maxDocuments),
      warnings,
    };
  }

  private resolveLocalContextBaseDir(
    configJson: Record<string, unknown>,
  ): string | null {
    const candidates = ['contextBaseDir', 'repoLocalPath', 'workspacePath'];

    for (const key of candidates) {
      const candidate = configJson[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private async loadDocumentsFromLocalPath(contextBaseDir: string): Promise<{
    documents: ProjectContextDto['documents'];
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const documents: ProjectContextDto['documents'] = [];

    const normalizedBaseDir = path.resolve(contextBaseDir);

    try {
      await fs.access(normalizedBaseDir);
    } catch {
      warnings.push(
        `Configured context directory not found: ${normalizedBaseDir}`,
      );

      return {
        documents,
        warnings,
      };
    }

    const candidateFiles = await this.collectCandidateFiles(normalizedBaseDir);

    for (const candidateFile of candidateFiles) {
      if (documents.length >= this.maxDocuments) {
        break;
      }

      const fileStat = await this.safeStat(candidateFile);
      if (!fileStat || !fileStat.isFile()) {
        continue;
      }

      if (fileStat.size > this.maxFileSizeBytes) {
        continue;
      }

      const content = await this.safeReadFile(candidateFile);
      if (!content || !content.trim()) {
        continue;
      }

      const normalizedRelativePath = path
        .relative(normalizedBaseDir, candidateFile)
        .replace(/\\/g, '/');

      documents.push({
        path: normalizedRelativePath,
        title: path.basename(candidateFile),
        preview: content.slice(0, this.maxPreviewLength),
        length: content.length,
      });
    }

    return {
      documents,
      warnings,
    };
  }

  private async collectCandidateFiles(baseDir: string): Promise<string[]> {
    const result = new Set<string>();

    const rootCandidates = ['README.md', 'README.MD', 'README.txt'];

    for (const filename of rootCandidates) {
      const fullPath = path.join(baseDir, filename);
      const stat = await this.safeStat(fullPath);
      if (stat?.isFile()) {
        result.add(fullPath);
      }
    }

    const nestedDirs = ['docs', 'spec', 'specs'];
    for (const dirname of nestedDirs) {
      const fullDir = path.join(baseDir, dirname);
      const stat = await this.safeStat(fullDir);

      if (!stat?.isDirectory()) {
        continue;
      }

      const nestedFiles = await this.walkContextFiles(fullDir);
      for (const nestedFile of nestedFiles) {
        result.add(nestedFile);
      }
    }

    return Array.from(result).slice(0, this.maxDocuments * 3);
  }

  private async walkContextFiles(startDir: string): Promise<string[]> {
    const result: string[] = [];
    const queue = [startDir];

    const allowedExtensions = new Set([
      '.md',
      '.txt',
      '.adoc',
      '.rst',
      '.json',
      '.yaml',
      '.yml',
    ]);

    const ignoredDirs = new Set([
      '.git',
      'node_modules',
      'dist',
      'build',
      '.next',
      '.nuxt',
      'coverage',
    ]);

    while (queue.length > 0 && result.length < this.maxDocuments * 3) {
      const currentDir = queue.shift()!;
      const entries = await this.safeReadDir(currentDir);

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) {
            queue.push(path.join(currentDir, entry.name));
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();

        if (!allowedExtensions.has(extension)) {
          continue;
        }

        result.push(path.join(currentDir, entry.name));

        if (result.length >= this.maxDocuments * 3) {
          break;
        }
      }
    }

    return result;
  }

  private loadDocumentsFromProjectConfig(
    configJson: Record<string, unknown>,
  ): ProjectContextDto['documents'] {
    const rawDocuments = configJson.contextDocuments;
    if (!Array.isArray(rawDocuments)) {
      return [];
    }

    const documents: ProjectContextDto['documents'] = [];

    for (const rawDocument of rawDocuments) {
      if (!rawDocument || typeof rawDocument !== 'object') {
        continue;
      }

      const pathValue =
        'path' in rawDocument && typeof rawDocument.path === 'string'
          ? rawDocument.path
          : null;

      const titleValue =
        'title' in rawDocument && typeof rawDocument.title === 'string'
          ? rawDocument.title
          : null;

      const contentValue =
        'content' in rawDocument && typeof rawDocument.content === 'string'
          ? rawDocument.content
          : null;

      if (!pathValue || !contentValue) {
        continue;
      }

      documents.push({
        path: pathValue,
        title: titleValue ?? path.basename(pathValue),
        preview: contentValue.slice(0, this.maxPreviewLength),
        length: contentValue.length,
      });

      if (documents.length >= this.maxDocuments) {
        break;
      }
    }

    return documents;
  }

  private async safeReadDir(dirPath: string) {
    try {
      return await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }
  }

  private async safeReadFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async safeStat(filePath: string) {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }
}
