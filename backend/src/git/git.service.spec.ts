import { BadRequestException } from '@nestjs/common';
import { GitService } from './git.service';

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createGitService = () => {
  const projectsService = {
    ensureProjectRepositoryReady: jest.fn(),
    runWithProjectRepositoryLock: jest
      .fn()
      .mockImplementation(
        async (
          _projectId: string,
          _user: unknown,
          _options: unknown,
          operation: (ctx: {
            project: unknown;
            repositoryRoot: string;
          }) => Promise<unknown>,
        ) =>
          operation({
            project: {},
            repositoryRoot: '/tmp/project-repo',
          }),
      ),
  };

  const service = new GitService(projectsService as never);

  return {
    service,
    projectsService,
  };
};

const createGitCommandResult = (
  stdout: string,
  overrides?: Partial<{ success: boolean; stderr: string }>,
) => ({
  success: overrides?.success ?? true,
  stdout,
  stderr: overrides?.stderr ?? '',
});

describe('GitService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should build detailed branch data with ahead and behind counts', async () => {
    const { service, projectsService } = createGitService();

    projectsService.ensureProjectRepositoryReady.mockResolvedValue({
      project: {
        defaultBranch: 'main',
      },
      repositoryRoot: '/tmp/project-repo',
    });

    const runCommandMock = jest.spyOn(
      service as any,
      'runCommand',
    ) as jest.Mock;
    runCommandMock
      .mockResolvedValueOnce(createGitCommandResult('main'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/demo'))
      .mockResolvedValueOnce(
        createGitCommandResult(
          'origin/main\norigin/feature/demo\norigin/release/1.0\norigin/HEAD',
        ),
      )
      .mockResolvedValueOnce(
        createGitCommandResult(
          [
            'main\x1f1111111\x1f1111111\x1fAlice\x1f2026-03-19T08:00:00.000Z\x1fmain commit',
            'feature/demo\x1f2222222\x1f2222222\x1fBob\x1f2026-03-19T09:00:00.000Z\x1ffeature commit',
            'origin/main\x1f3333333\x1f3333333\x1fAlice\x1f2026-03-19T10:00:00.000Z\x1fremote main commit',
            'origin/feature/demo\x1f4444444\x1f4444444\x1fBob\x1f2026-03-19T11:00:00.000Z\x1fremote feature commit',
            'origin/release/1.0\x1f5555555\x1f5555555\x1fCarol\x1f2026-03-19T12:00:00.000Z\x1frelease commit',
          ].join('\n'),
        ),
      )
      .mockResolvedValueOnce(createGitCommandResult('0\t2'))
      .mockResolvedValueOnce(createGitCommandResult('3\t1'));

    const result = await service.listBranchesDetail(
      'project-1',
      createCurrentUser(),
    );

    expect(result.branches).toEqual([
      {
        name: 'main',
        type: 'both',
        isCurrent: true,
        tracking: 'origin/main',
        ahead: 0,
        behind: 2,
        lastCommit: {
          sha: '1111111',
          shortSha: '1111111',
          author: 'Alice',
          committedAt: '2026-03-19T08:00:00.000Z',
          message: 'main commit',
        },
      },
      {
        name: 'feature/demo',
        type: 'both',
        isCurrent: false,
        tracking: 'origin/feature/demo',
        ahead: 3,
        behind: 1,
        lastCommit: {
          sha: '2222222',
          shortSha: '2222222',
          author: 'Bob',
          committedAt: '2026-03-19T09:00:00.000Z',
          message: 'feature commit',
        },
      },
      {
        name: 'release/1.0',
        type: 'remote',
        isCurrent: false,
        tracking: undefined,
        ahead: 0,
        behind: 0,
        lastCommit: {
          sha: '5555555',
          shortSha: '5555555',
          author: 'Carol',
          committedAt: '2026-03-19T12:00:00.000Z',
          message: 'release commit',
        },
      },
    ]);
  });

  it('should reject pull when target branch is not current branch', async () => {
    const { service, projectsService } = createGitService();

    projectsService.ensureProjectRepositoryReady.mockResolvedValue({
      project: {
        defaultBranch: 'main',
      },
      repositoryRoot: '/tmp/project-repo',
    });

    const runCommandMock = jest.spyOn(
      service as any,
      'runCommand',
    ) as jest.Mock;
    runCommandMock
      .mockResolvedValueOnce(createGitCommandResult('feature/demo'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/demo'))
      .mockResolvedValueOnce(
        createGitCommandResult('origin/main\norigin/feature/demo'),
      );

    await expect(
      service.pullBranch('project-1', 'main', createCurrentUser()),
    ).rejects.toThrow(BadRequestException);
  });

  it('should pull the current local branch from origin', async () => {
    const { service, projectsService } = createGitService();

    projectsService.ensureProjectRepositoryReady.mockResolvedValue({
      project: {
        defaultBranch: 'main',
      },
      repositoryRoot: '/tmp/project-repo',
    });

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('main'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/demo'))
      .mockResolvedValueOnce(
        createGitCommandResult('origin/main\norigin/feature/demo'),
      )
      .mockResolvedValueOnce(
        createGitCommandResult('Updating 1111111..2222222'),
      );

    const result = await service.pullBranch(
      'project-1',
      'main',
      createCurrentUser(),
    );

    expect(result).toEqual({
      success: true,
      branch: 'main',
      output: 'Updating 1111111..2222222',
    });
    expect(runCommandSpy).toHaveBeenLastCalledWith([
      '-C',
      '/tmp/project-repo',
      'pull',
      '--ff-only',
      'origin',
      'main',
    ]);
  });

  it('should create a branch with git branch name from', async () => {
    const { service, projectsService } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy.mockResolvedValueOnce(createGitCommandResult(''));

    const result = await service.createBranch(
      'project-1',
      ' goal/foo ',
      ' main ',
      createCurrentUser(),
    );

    expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalled();
    expect(result).toEqual({ success: true, branch: 'goal/foo' });
    expect(runCommandSpy).toHaveBeenCalledWith([
      '-C',
      '/tmp/project-repo',
      'branch',
      'goal/foo',
      'main',
    ]);
  });

  it('should reject invalid new branch names', async () => {
    const { service } = createGitService();

    await expect(
      service.createBranch('project-1', '..bad', 'main', createCurrentUser()),
    ).rejects.toThrow(BadRequestException);
  });
});
