import { Test } from '@nestjs/testing';
import { promises as fs } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { Project } from '../projects/domain/project';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { ProjectDocsService } from '../projects/project-docs.service';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';
import { ProjectMemoryInternalDocsService } from './project-memory-internal-docs.service';

describe('ProjectMemoryInternalDocsService', () => {
  let service: ProjectMemoryInternalDocsService;
  let tmpDir: string;
  let projectRepository: { findById: jest.Mock };
  let workspaceService: { ensureProjectRepository: jest.Mock };
  let projectDocsService: {
    normalizeProjectDocPath: jest.Mock;
    resolveProjectDocAbsolutePath: jest.Mock;
  };

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mem-int-docs-'));
    projectRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'proj-1' } as Project),
    };
    workspaceService = {
      ensureProjectRepository: jest.fn().mockResolvedValue(tmpDir),
    };
    projectDocsService = {
      normalizeProjectDocPath: jest.fn((v: string) =>
        v.trim().replace(/^\/+/, ''),
      ),
      resolveProjectDocAbsolutePath: jest.fn(
        (docsRoot: string, relativePath: string) =>
          path.join(path.resolve(docsRoot), relativePath),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectMemoryInternalDocsService,
        { provide: ProjectRepository, useValue: projectRepository },
        {
          provide: ProjectRepositoryWorkspaceService,
          useValue: workspaceService,
        },
        { provide: ProjectDocsService, useValue: projectDocsService },
      ],
    }).compile();

    service = moduleRef.get(ProjectMemoryInternalDocsService);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('ensureFileExists', () => {
    it('should write initial content when file exists with zero bytes', async () => {
      const docsRoot = path.join(tmpDir, 'docs');
      await fs.mkdir(path.join(docsRoot, 'memory'), { recursive: true });
      const abs = path.join(docsRoot, 'memory', 'conventions.md');
      await fs.writeFile(abs, '', 'utf-8');
      const seed = '# seed\n\n## 团队沉淀\n\n';
      await service.ensureFileExists('proj-1', 'memory/conventions.md', seed);
      await expect(fs.readFile(abs, 'utf-8')).resolves.toBe(seed);
    });

    it('should write initial content when file is whitespace-only', async () => {
      const docsRoot = path.join(tmpDir, 'docs');
      await fs.mkdir(path.join(docsRoot, 'memory'), { recursive: true });
      const abs = path.join(docsRoot, 'memory', 'conventions.md');
      await fs.writeFile(abs, '   \n\t  ', 'utf-8');
      const seed = '# seed\n\n## 团队沉淀\n\n';
      await service.ensureFileExists('proj-1', 'memory/conventions.md', seed);
      await expect(fs.readFile(abs, 'utf-8')).resolves.toBe(seed);
    });

    it('should not overwrite file with substantive content', async () => {
      const docsRoot = path.join(tmpDir, 'docs');
      await fs.mkdir(path.join(docsRoot, 'memory'), { recursive: true });
      const abs = path.join(docsRoot, 'memory', 'conventions.md');
      const existing = '# keep\n\n## 团队沉淀\n\nbody';
      await fs.writeFile(abs, existing, 'utf-8');
      await service.ensureFileExists(
        'proj-1',
        'memory/conventions.md',
        '# other',
      );
      await expect(fs.readFile(abs, 'utf-8')).resolves.toBe(existing);
    });
  });
});
