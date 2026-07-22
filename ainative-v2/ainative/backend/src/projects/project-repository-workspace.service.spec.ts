import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
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
  slug: 'ainative-repo',
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
  const workspaceRepoService = {
    getWorkspaceGitUrl: jest
      .fn()
      .mockReturnValue('git@example.com:workspace.git'),
    getBaseBranch: jest.fn().mockReturnValue('master'),
  };

  return {
    service: new ProjectRepositoryWorkspaceService(
      projectAccessService as never,
      configService,
      projectWorkspacePathsService,
      workspaceRepoService as never,
    ),
    projectWorkspacePathsService,
  };
};

describe('ProjectRepositoryWorkspaceService branch resolution', () => {
  it('should use project defaultBranch for workspace-native projects', () => {
    const { service } = createService();
    const project = createProject(
      {
        gitUrl: '',
        defaultBranch: 'frontend-ainative',
      },
      { subtreeMode: 'workspace-native' },
    );

    expect(service.resolveEffectiveDefaultBranch(project)).toBe(
      'frontend-ainative',
    );
    expect(service.resolveCloneInitialBranch(project)).toBe('master');
  });

  it('should use master for workspace-managed hidden projects', () => {
    const { service } = createService();
    const project = createProject(
      {
        gitUrl: 'git@example.com:workspace.git',
        defaultBranch: 'master',
      },
      { subtreeMode: 'workspace-native', workspaceManaged: true },
    );

    expect(service.resolveEffectiveDefaultBranch(project)).toBe('master');
  });
});

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

  it('should checkout an existing local branch', async () => {
    const { service } = createService();
    const runCommandSpy = jest
      .spyOn(service as any, 'runCommand')
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

    await service.checkoutBranch('/tmp/project-repo', 'release');

    expect(runCommandSpy).toHaveBeenNthCalledWith(1, 'git', [
      '-C',
      '/tmp/project-repo',
      'rev-parse',
      '--verify',
      'refs/heads/release',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(2, 'git', [
      '-C',
      '/tmp/project-repo',
      'checkout',
      'release',
    ]);
  });

  it('should create local branch from origin when only remote branch exists', async () => {
    const { service } = createService();
    const runCommandSpy = jest
      .spyOn(service as any, 'runCommand')
      .mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

    await service.checkoutBranch('/tmp/project-repo', 'release');

    expect(runCommandSpy).toHaveBeenNthCalledWith(3, 'git', [
      '-C',
      '/tmp/project-repo',
      'checkout',
      '-B',
      'release',
      'origin/release',
    ]);
  });

  it('should reject checkout when neither local nor remote branch exists', async () => {
    const { service } = createService();

    jest.spyOn(service as any, 'runCommand').mockResolvedValue({
      success: false,
      stdout: '',
      stderr: '',
      timedOut: false,
    });

    await expect(
      service.checkoutBranch('/tmp/project-repo', 'release'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create a fixed branch worktree without checking out repository root', async () => {
    await createIsolatedDataRoot();
    const { service } = createService();
    const project = createProject();
    const runCommandSpy = jest
      .spyOn(service as any, 'runCommand')
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

    const worktreePath = await service.ensureBranchWorktree({
      project,
      repositoryRoot: '/tmp/project-repo',
      branchName: 'feature/goal-1',
      namespace: 'goal-branches',
    });

    expect(worktreePath).toContain(
      `${path.sep}.system${path.sep}goal-branches`,
    );
    expect(runCommandSpy.mock.calls).toEqual([
      ['git', ['-C', '/tmp/project-repo', 'worktree', 'prune']],
      [
        'git',
        [
          '-C',
          '/tmp/project-repo',
          'rev-parse',
          '--verify',
          'refs/heads/feature/goal-1',
        ],
      ],
      [
        'git',
        [
          '-C',
          '/tmp/project-repo',
          'worktree',
          'add',
          '--force',
          worktreePath,
          'feature/goal-1',
        ],
      ],
    ]);
  });

  it('should reuse an existing branch worktree when it already points to the branch', async () => {
    await createIsolatedDataRoot();
    const { service } = createService();
    const project = createProject();
    const worktreePath = (service as any).resolveBranchWorktreePath(
      project,
      'feature/goal-1',
      'goal-branches',
    );
    await fs.mkdir(path.join(worktreePath, '.git'), { recursive: true });
    const runCommandSpy = jest
      .spyOn(service as any, 'runCommand')
      .mockResolvedValueOnce({
        success: true,
        stdout: 'feature/goal-1',
        stderr: '',
        timedOut: false,
      });

    await expect(
      service.ensureBranchWorktree({
        project,
        repositoryRoot: '/tmp/project-repo',
        branchName: 'feature/goal-1',
        namespace: 'goal-branches',
      }),
    ).resolves.toBe(worktreePath);

    expect(runCommandSpy).toHaveBeenCalledTimes(1);
    expect(runCommandSpy).toHaveBeenCalledWith('git', [
      '-C',
      worktreePath,
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
  });
});
