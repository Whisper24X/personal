import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { Project } from './domain/project';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';

process.env.AINATIVE_DATA_ROOT_DIR ??= path.resolve(process.cwd(), 'tmp');

const createProject = (
  overrides: Partial<Project> = {},
  configJson?: Record<string, unknown> | null,
): Project => ({
  id: 'project-test-id',
  businessLineId: 'business-line-test-id',
  name: 'AINative Repository Project',
  description: null,
  gitUrl: 'git@gitlab.yc345.tv:frontend/ainative.git',
  defaultBranch: 'main',
  configJson: configJson ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const createService = () => {
  const configService = new ConfigService();
  const projectWorkspacePathsService = new ProjectWorkspacePathsService(
    configService,
  );
  const projectAccessService = {
    assertCanAccessProject: jest.fn(),
  };

  return {
    service: new ProjectRepositoryWorkspaceService(
      projectAccessService as never,
      configService,
      projectWorkspacePathsService,
    ),
    projectWorkspacePathsService,
  };
};

describe('ProjectRepositoryWorkspaceService', () => {
  const createdDirectories: string[] = [];
  const originalDataRootDir = process.env.AINATIVE_DATA_ROOT_DIR;
  const originalMaxRetries = process.env.AINATIVE_GIT_NETWORK_MAX_RETRIES;

  const createIsolatedDataRoot = async (): Promise<void> => {
    const dataRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-project-repo-spec-'),
    );
    createdDirectories.push(dataRoot);
    process.env.AINATIVE_DATA_ROOT_DIR = dataRoot;
  };

  afterEach(async () => {
    jest.restoreAllMocks();

    if (originalDataRootDir === undefined) {
      delete process.env.AINATIVE_DATA_ROOT_DIR;
    } else {
      process.env.AINATIVE_DATA_ROOT_DIR = originalDataRootDir;
    }

    if (originalMaxRetries === undefined) {
      delete process.env.AINATIVE_GIT_NETWORK_MAX_RETRIES;
    } else {
      process.env.AINATIVE_GIT_NETWORK_MAX_RETRIES = originalMaxRetries;
    }

    await Promise.all(
      createdDirectories
        .splice(0)
        .map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
  });

  it('should refuse to delete a non-git custom repoLocalPath directory', async () => {
    await createIsolatedDataRoot();
    const { service } = createService();
    const repositoryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-custom-repo-root-'),
    );
    createdDirectories.push(repositoryRoot);
    const markerFile = path.join(repositoryRoot, 'keep.txt');
    await fs.writeFile(markerFile, 'keep');

    const project = createProject({}, { repoLocalPath: repositoryRoot });
    const runCommandSpy = jest.spyOn(service as any, 'runCommand');

    await expect(
      (service as any).syncProjectRepositoryContent(project, repositoryRoot, {
        syncRemote: false,
      }),
    ).rejects.toThrow('manual cleanup required');
    expect(runCommandSpy).not.toHaveBeenCalled();
    await expect(fs.access(markerFile)).resolves.toBeUndefined();
  });

  it('should clean a managed leftover clone directory before retrying clone', async () => {
    await createIsolatedDataRoot();
    const { service, projectWorkspacePathsService } = createService();
    const project = createProject();
    const repositoryRoot =
      projectWorkspacePathsService.resolveRepositoryRoot(project);
    const staleFile = path.join(repositoryRoot, 'partial.txt');

    await fs.mkdir(repositoryRoot, { recursive: true });
    await fs.writeFile(staleFile, 'partial');

    const runCommandSpy = jest
      .spyOn(service as any, 'runCommand')
      .mockImplementation(async (_command: string, args: string[]) => {
        expect(args).toContain('clone');
        await expect(fs.access(staleFile)).rejects.toThrow();
        await fs.mkdir(path.join(repositoryRoot, '.git'), { recursive: true });

        return {
          success: true,
          stdout: '',
          stderr: '',
          timedOut: false,
        };
      });

    await (service as any).syncProjectRepositoryContent(
      project,
      repositoryRoot,
      {
        syncRemote: false,
      },
    );

    expect(runCommandSpy).toHaveBeenCalledTimes(1);
    await expect(
      fs.access(path.join(repositoryRoot, '.git')),
    ).resolves.toBeUndefined();
    await expect(fs.access(staleFile)).rejects.toThrow();
  });

  it('should retry clone when the previous attempt timed out', async () => {
    await createIsolatedDataRoot();
    const { service, projectWorkspacePathsService } = createService();
    const project = createProject();
    const repositoryRoot =
      projectWorkspacePathsService.resolveRepositoryRoot(project);
    const partialFile = path.join(repositoryRoot, 'partial.txt');

    await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    let attempt = 0;
    const runCommandSpy = jest
      .spyOn(service as any, 'runCommand')
      .mockImplementation(async () => {
        attempt += 1;

        if (attempt === 1) {
          await fs.mkdir(repositoryRoot, { recursive: true });
          await fs.writeFile(partialFile, 'partial');

          return {
            success: false,
            stdout: '',
            stderr: '',
            timedOut: true,
          };
        }

        await expect(fs.access(partialFile)).rejects.toThrow();
        await fs.mkdir(path.join(repositoryRoot, '.git'), { recursive: true });

        return {
          success: true,
          stdout: '',
          stderr: '',
          timedOut: false,
        };
      });

    await (service as any).cloneProjectRepositoryWithRetries({
      project,
      repositoryRoot,
      defaultBranch: project.defaultBranch,
      resolvedGitUrl: project.gitUrl,
    });

    expect(runCommandSpy).toHaveBeenCalledTimes(2);
  });

  it('should clean managed leftovers after the final clone failure', async () => {
    await createIsolatedDataRoot();
    process.env.AINATIVE_GIT_NETWORK_MAX_RETRIES = '2';
    const { service, projectWorkspacePathsService } = createService();
    const project = createProject();
    const repositoryRoot =
      projectWorkspacePathsService.resolveRepositoryRoot(project);
    const partialFile = path.join(repositoryRoot, 'partial.txt');

    await fs.mkdir(path.dirname(repositoryRoot), { recursive: true });
    jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'runCommand').mockImplementation(async () => {
      await fs.mkdir(repositoryRoot, { recursive: true });
      await fs.writeFile(partialFile, 'partial');

      return {
        success: false,
        stdout: '',
        stderr: 'fatal: early EOF',
        timedOut: false,
      };
    });

    await expect(
      (service as any).cloneProjectRepositoryWithRetries({
        project,
        repositoryRoot,
        defaultBranch: project.defaultBranch,
        resolvedGitUrl: project.gitUrl,
      }),
    ).rejects.toThrow('fatal: early EOF');

    await expect(fs.access(repositoryRoot)).rejects.toThrow();
  });
});
