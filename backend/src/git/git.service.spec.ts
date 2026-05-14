import { BadRequestException, ConflictException } from '@nestjs/common';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
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
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('abc1234')) // resolveFromRef: local main exists
      .mockResolvedValueOnce(createGitCommandResult('')); // git branch goal/foo main

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

  it('should checkout requirement branch and create plan branch from HEAD when prepareRequirementBranchWorkingTree and working tree clean', async () => {
    const { service, projectsService } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current')) // current branch before implicit checkout
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse local feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // checkout feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse origin/feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // local contains origin/feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // status porcelain empty
      .mockResolvedValueOnce(createGitCommandResult('')) // branch goal/plan-x
      .mockResolvedValueOnce(createGitCommandResult('')); // restore feature/current

    const result = await service.createBranch(
      'project-1',
      'goal/plan-x',
      'feature/base',
      createCurrentUser(),
      { prepareRequirementBranchWorkingTree: true },
    );

    expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalled();
    expect(result).toEqual({ success: true, branch: 'goal/plan-x' });
    expect(runCommandSpy).toHaveBeenNthCalledWith(1, [
      '-C',
      '/tmp/project-repo',
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(2, [
      '-C',
      '/tmp/project-repo',
      'rev-parse',
      '--verify',
      'refs/heads/feature/base',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(3, [
      '-C',
      '/tmp/project-repo',
      'checkout',
      'feature/base',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(4, [
      '-C',
      '/tmp/project-repo',
      'rev-parse',
      '--verify',
      'refs/remotes/origin/feature/base',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(5, [
      '-C',
      '/tmp/project-repo',
      'merge-base',
      '--is-ancestor',
      'refs/remotes/origin/feature/base',
      'refs/heads/feature/base',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(6, [
      '-C',
      '/tmp/project-repo',
      'status',
      '--porcelain',
      '--untracked-files=all',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(7, [
      '-C',
      '/tmp/project-repo',
      'branch',
      'goal/plan-x',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(8, [
      '-C',
      '/tmp/project-repo',
      'checkout',
      'feature/current',
    ]);
  });

  it('should not restore branch when already on requirement branch', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/base')) // current branch
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse local feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // checkout feature/base
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'missing' }),
      )
      .mockResolvedValueOnce(createGitCommandResult('')) // status porcelain empty
      .mockResolvedValueOnce(createGitCommandResult('')); // branch goal/plan-x

    const result = await service.createBranch(
      'project-1',
      'goal/plan-x',
      'feature/base',
      createCurrentUser(),
      { prepareRequirementBranchWorkingTree: true },
    );

    expect(result).toEqual({ success: true, branch: 'goal/plan-x' });
    expect(runCommandSpy).toHaveBeenCalledTimes(6);
    expect(runCommandSpy).not.toHaveBeenCalledWith([
      '-C',
      '/tmp/project-repo',
      'checkout',
      'feature/current',
    ]);
  });

  it('should report restore failure after creating plan branch', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current')) // current branch
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse local feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // checkout feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse origin/feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // local contains origin/feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // status porcelain empty
      .mockResolvedValueOnce(createGitCommandResult('')) // branch goal/plan-x
      .mockResolvedValueOnce(
        createGitCommandResult('', {
          success: false,
          stderr: 'checkout blocked',
        }),
      );

    await expect(
      service.createBranch(
        'project-1',
        'goal/plan-x',
        'feature/base',
        createCurrentUser(),
        { prepareRequirementBranchWorkingTree: true },
      ),
    ).rejects.toThrow(/恢复到原分支 feature\/current 失败.*checkout blocked/s);
  });

  it('should auto-commit dirty requirement branch before creating plan branch when prepareRequirementBranchWorkingTree', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current'))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(' M tracked.txt\n'))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(
        createGitCommandResult('[feature/base abc1234] chore(goal): msg\n'),
      )
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''));

    await service.createBranch(
      'project-1',
      'goal/plan-x',
      'feature/base',
      { sub: 'u1', username: 'alice', iat: 1, exp: 9 },
      { prepareRequirementBranchWorkingTree: true },
    );

    expect(runCommandSpy).toHaveBeenNthCalledWith(7, [
      '-C',
      '/tmp/project-repo',
      'add',
      '-A',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(8, [
      '-C',
      '/tmp/project-repo',
      '-c',
      'user.name=alice',
      '-c',
      'user.email=alice@ainative.local',
      'commit',
      '-m',
      'chore(goal): auto-commit before plan branch goal/plan-x',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(9, [
      '-C',
      '/tmp/project-repo',
      'branch',
      'goal/plan-x',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(10, [
      '-C',
      '/tmp/project-repo',
      'checkout',
      'feature/current',
    ]);
  });

  it('should fast-forward requirement branch before creating plan branch when local is behind remote', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current'))
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse local feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // checkout feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse origin/feature/base
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'not ancestor' }),
      )
      .mockResolvedValueOnce(createGitCommandResult('')) // remote contains local
      .mockResolvedValueOnce(createGitCommandResult('Fast-forward'))
      .mockResolvedValueOnce(createGitCommandResult('')) // status porcelain empty
      .mockResolvedValueOnce(createGitCommandResult('')) // branch goal/plan-x
      .mockResolvedValueOnce(createGitCommandResult('')); // restore feature/current

    await service.createBranch(
      'project-1',
      'goal/plan-x',
      'feature/base',
      createCurrentUser(),
      { prepareRequirementBranchWorkingTree: true },
    );

    expect(runCommandSpy).toHaveBeenNthCalledWith(7, [
      '-C',
      '/tmp/project-repo',
      'merge',
      '--ff-only',
      'refs/remotes/origin/feature/base',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(9, [
      '-C',
      '/tmp/project-repo',
      'branch',
      'goal/plan-x',
    ]);
    expect(runCommandSpy).toHaveBeenNthCalledWith(10, [
      '-C',
      '/tmp/project-repo',
      'checkout',
      'feature/current',
    ]);
  });

  it('should reject plan branch creation when requirement branch diverged from remote', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current'))
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse local feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // checkout feature/base
      .mockResolvedValueOnce(createGitCommandResult('')) // rev-parse origin/feature/base
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'not ancestor' }),
      )
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'not ancestor' }),
      )
      .mockResolvedValueOnce(createGitCommandResult(''));

    await expect(
      service.createBranch(
        'project-1',
        'goal/plan-x',
        'feature/base',
        createCurrentUser(),
        { prepareRequirementBranchWorkingTree: true },
      ),
    ).rejects.toThrow(/已分叉/);
    expect(runCommandSpy).not.toHaveBeenCalledWith([
      '-C',
      '/tmp/project-repo',
      'branch',
      'goal/plan-x',
    ]);
    expect(runCommandSpy).toHaveBeenLastCalledWith([
      '-C',
      '/tmp/project-repo',
      'checkout',
      'feature/current',
    ]);
  });

  it('should throw BadRequestException with stage hint when checkout requirement branch fails', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current'))
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'fatal: Needed' }),
      ) // rev-parse local
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'fatal: Needed' }),
      ) // rev-parse remote
      .mockResolvedValueOnce(createGitCommandResult(''));

    await expect(
      service.createBranch(
        'project-1',
        'goal/plan-x',
        'feature/missing',
        createCurrentUser(),
        { prepareRequirementBranchWorkingTree: true },
      ),
    ).rejects.toThrow(/无法切换到需求分支：/);
  });

  it('should throw BadRequestException with stage hint when auto-commit fails', async () => {
    const { service } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/current'))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(' M x\n'))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(
        createGitCommandResult('', {
          success: false,
          stderr: 'pre-commit hook failed',
        }),
      )
      .mockResolvedValueOnce(createGitCommandResult(''));

    await expect(
      service.createBranch(
        'project-1',
        'goal/plan-x',
        'feature/base',
        createCurrentUser(),
        { prepareRequirementBranchWorkingTree: true },
      ),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/自动提交失败.*pre-commit hook failed/s),
    });
  });

  it('should reject invalid new branch names', async () => {
    const { service } = createGitService();

    await expect(
      service.createBranch('project-1', '..bad', 'main', createCurrentUser()),
    ).rejects.toThrow(BadRequestException);
  });

  it('should not delete protected branch names (no lock)', async () => {
    const { service, projectsService } = createGitService();

    await service.deleteLocalBranch('project-1', 'main', createCurrentUser());

    expect(projectsService.runWithProjectRepositoryLock).not.toHaveBeenCalled();
  });

  it('should no-op deleteLocalBranch when branch does not exist locally', async () => {
    const { service, projectsService } = createGitService();

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('main'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/other'))
      .mockResolvedValueOnce(
        createGitCommandResult('origin/main\norigin/feature/other'),
      );

    await service.deleteLocalBranch(
      'project-1',
      'feature/missing',
      createCurrentUser(),
    );

    expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalled();
    expect(runCommandSpy).toHaveBeenCalledTimes(3);
  });

  it('should delete local branch when it exists and is not checked out', async () => {
    const { service, projectsService } = createGitService();

    projectsService.runWithProjectRepositoryLock.mockImplementation(
      async (
        _projectId: string,
        _user: unknown,
        _options: unknown,
        operation: (ctx: {
          project: { defaultBranch: string };
          repositoryRoot: string;
        }) => Promise<unknown>,
      ) =>
        operation({
          project: { defaultBranch: 'main' },
          repositoryRoot: '/tmp/project-repo',
        }),
    );

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('main'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/to-delete'))
      .mockResolvedValueOnce(createGitCommandResult('origin/main'))
      .mockResolvedValueOnce(createGitCommandResult(''));

    await service.deleteLocalBranch(
      'project-1',
      'feature/to-delete',
      createCurrentUser(),
    );

    expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalledWith(
      'project-1',
      createCurrentUser(),
      { syncRemote: false },
      expect.any(Function),
    );
    expect(runCommandSpy).toHaveBeenLastCalledWith([
      '-C',
      '/tmp/project-repo',
      'branch',
      '-D',
      'feature/to-delete',
    ]);
  });

  it('should switch to default branch before deleting when target is checked out', async () => {
    const { service, projectsService } = createGitService();

    projectsService.runWithProjectRepositoryLock.mockImplementation(
      async (
        _projectId: string,
        _user: unknown,
        _options: unknown,
        operation: (ctx: {
          project: { defaultBranch: string };
          repositoryRoot: string;
        }) => Promise<unknown>,
      ) =>
        operation({
          project: { defaultBranch: 'main' },
          repositoryRoot: '/tmp/project-repo',
        }),
    );

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('feature/on'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/on'))
      .mockResolvedValueOnce(createGitCommandResult('origin/main'))
      .mockResolvedValueOnce(createGitCommandResult(''))
      .mockResolvedValueOnce(createGitCommandResult(''));

    await service.deleteLocalBranch(
      'project-1',
      'feature/on',
      createCurrentUser(),
    );

    expect(runCommandSpy.mock.calls).toEqual([
      [['-C', '/tmp/project-repo', 'rev-parse', '--abbrev-ref', 'HEAD']],
      [
        [
          '-C',
          '/tmp/project-repo',
          'for-each-ref',
          '--format=%(refname:short)',
          'refs/heads',
        ],
      ],
      [
        [
          '-C',
          '/tmp/project-repo',
          'for-each-ref',
          '--format=%(refname:short)',
          'refs/remotes/origin',
        ],
      ],
      [['-C', '/tmp/project-repo', 'switch', 'main']],
      [['-C', '/tmp/project-repo', 'branch', '-D', 'feature/on']],
    ]);
  });

  it('should throw ConflictException when branch delete fails', async () => {
    const { service, projectsService } = createGitService();

    projectsService.runWithProjectRepositoryLock.mockImplementation(
      async (
        _projectId: string,
        _user: unknown,
        _options: unknown,
        operation: (ctx: {
          project: { defaultBranch: string };
          repositoryRoot: string;
        }) => Promise<unknown>,
      ) =>
        operation({
          project: { defaultBranch: 'main' },
          repositoryRoot: '/tmp/project-repo',
        }),
    );

    const runCommandSpy = jest.spyOn(service as any, 'runCommand') as jest.Mock;
    runCommandSpy
      .mockResolvedValueOnce(createGitCommandResult('main'))
      .mockResolvedValueOnce(createGitCommandResult('main\nfeature/bad'))
      .mockResolvedValueOnce(createGitCommandResult('origin/main'))
      .mockResolvedValueOnce(
        createGitCommandResult('', { success: false, stderr: 'cannot delete' }),
      );

    await expect(
      service.deleteLocalBranch(
        'project-1',
        'feature/bad',
        createCurrentUser(),
      ),
    ).rejects.toThrow(ConflictException);
  });

  describe('mergeBranchIntoBase', () => {
    it('should merge in a temporary worktree without checking out the main repository', async () => {
      const { service } = createGitService();
      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;
      runCommandSpy
        .mockResolvedValueOnce(createGitCommandResult('base-sha'))
        .mockResolvedValueOnce(createGitCommandResult('head-sha'))
        .mockResolvedValueOnce(createGitCommandResult(''))
        .mockResolvedValueOnce(
          createGitCommandResult('Merge made by recursive.'),
        )
        .mockResolvedValueOnce(createGitCommandResult('pushed'))
        .mockResolvedValueOnce(createGitCommandResult(''));

      const result = await service.mergeBranchIntoBase(
        'project-1',
        'feature/goal',
        'feature/group',
        createCurrentUser() as never,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        '已将「feature/group」合并入「feature/goal」',
      );

      const addCall = runCommandSpy.mock.calls[2][0] as string[];
      const tempWorktree = addCall[5];
      expect(addCall).toEqual([
        '-C',
        '/tmp/project-repo',
        'worktree',
        'add',
        '--detach',
        expect.stringContaining('worktree'),
        'refs/remotes/origin/feature/goal',
      ]);
      expect(runCommandSpy.mock.calls).toEqual([
        [
          [
            '-C',
            '/tmp/project-repo',
            'rev-parse',
            '--verify',
            'refs/remotes/origin/feature/goal',
          ],
        ],
        [
          [
            '-C',
            '/tmp/project-repo',
            'rev-parse',
            '--verify',
            'refs/heads/feature/group',
          ],
        ],
        [addCall],
        [['-C', tempWorktree, 'merge', '--no-ff', 'refs/heads/feature/group']],
        [
          [
            '-C',
            tempWorktree,
            'push',
            'origin',
            'HEAD:refs/heads/feature/goal',
          ],
        ],
        [
          [
            '-C',
            '/tmp/project-repo',
            'worktree',
            'remove',
            '--force',
            tempWorktree,
          ],
        ],
      ]);
      expect(
        runCommandSpy.mock.calls.flatMap((call) => call[0] as string[]),
      ).not.toContain('checkout');
    });

    it('should report conflicts from the temporary worktree and clean it up', async () => {
      const { service } = createGitService();
      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;
      runCommandSpy
        .mockResolvedValueOnce(createGitCommandResult('base-sha'))
        .mockResolvedValueOnce(createGitCommandResult('head-sha'))
        .mockResolvedValueOnce(createGitCommandResult(''))
        .mockResolvedValueOnce(
          createGitCommandResult('', {
            success: false,
            stderr: 'CONFLICT (content): Merge conflict',
          }),
        )
        .mockResolvedValueOnce(createGitCommandResult('src/a.ts\nsrc/b.ts'))
        .mockResolvedValueOnce(createGitCommandResult(''))
        .mockResolvedValueOnce(createGitCommandResult(''));

      const result = await service.mergeBranchIntoBase(
        'project-1',
        'feature/goal',
        'feature/group',
        createCurrentUser() as never,
      );

      const tempWorktree = (runCommandSpy.mock.calls[2][0] as string[])[5];
      expect(result).toEqual({
        success: false,
        message: expect.stringContaining('合并失败'),
        conflicts: ['src/a.ts', 'src/b.ts'],
      });
      expect(runCommandSpy.mock.calls[4][0]).toEqual([
        '-C',
        tempWorktree,
        'diff',
        '--name-only',
        '--diff-filter=U',
      ]);
      expect(runCommandSpy.mock.calls[5][0]).toEqual([
        '-C',
        tempWorktree,
        'merge',
        '--abort',
      ]);
      expect(runCommandSpy.mock.calls[6][0]).toEqual([
        '-C',
        '/tmp/project-repo',
        'worktree',
        'remove',
        '--force',
        tempWorktree,
      ]);
    });
  });

  describe('runInTemporaryBranchWorktree', () => {
    it('should run an operation in a detached temporary branch worktree and clean up', async () => {
      const { service } = createGitService();
      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;
      runCommandSpy
        .mockResolvedValueOnce(createGitCommandResult('branch-sha'))
        .mockResolvedValueOnce(createGitCommandResult(''))
        .mockResolvedValueOnce(createGitCommandResult(''));

      const result = await service.runInTemporaryBranchWorktree(
        '/tmp/project-repo',
        'feature/goal',
        (worktreeRoot) => Promise.resolve(`used:${worktreeRoot}`),
      );

      const addCall = runCommandSpy.mock.calls[1][0] as string[];
      const tempWorktree = addCall[5];
      expect(result).toBe(`used:${tempWorktree}`);
      expect(runCommandSpy.mock.calls).toEqual([
        [
          [
            '-C',
            '/tmp/project-repo',
            'rev-parse',
            '--verify',
            'refs/remotes/origin/feature/goal',
          ],
        ],
        [
          [
            '-C',
            '/tmp/project-repo',
            'worktree',
            'add',
            '--detach',
            tempWorktree,
            'refs/remotes/origin/feature/goal',
          ],
        ],
        [
          [
            '-C',
            '/tmp/project-repo',
            'worktree',
            'remove',
            '--force',
            tempWorktree,
          ],
        ],
      ]);
    });
  });

  describe('pushRepositoryHeadToBranch', () => {
    it('should push HEAD and refresh the remote-tracking ref', async () => {
      const { service } = createGitService();
      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;
      runCommandSpy
        .mockResolvedValueOnce(createGitCommandResult('pushed'))
        .mockResolvedValueOnce(createGitCommandResult(''));

      await service.pushRepositoryHeadToBranch(
        '/tmp/project-repo',
        'feature/goal',
      );

      expect(runCommandSpy.mock.calls).toEqual([
        [
          [
            '-C',
            '/tmp/project-repo',
            'push',
            'origin',
            'HEAD:refs/heads/feature/goal',
          ],
        ],
        [
          [
            '-C',
            '/tmp/project-repo',
            'update-ref',
            'refs/remotes/origin/feature/goal',
            'HEAD',
          ],
        ],
      ]);
    });
  });

  describe('cleanupForeignUntrackedGoalDirs', () => {
    it('should clean only untracked foreign goal directories', async () => {
      const { service } = createGitService();
      const repositoryRoot = await fs.mkdtemp(
        path.join(os.tmpdir(), 'ainative-git-clean-'),
      );
      const keepGoalId = '11111111-1111-4111-8111-111111111111';
      const foreignGoalId = '22222222-2222-4222-8222-222222222222';

      try {
        await fs.mkdir(path.join(repositoryRoot, 'docs', 'goals', keepGoalId), {
          recursive: true,
        });
        await fs.mkdir(
          path.join(repositoryRoot, 'docs', 'goals', foreignGoalId),
          {
            recursive: true,
          },
        );
        await fs.mkdir(path.join(repositoryRoot, 'docs', 'goals', 'draft'), {
          recursive: true,
        });

        const runCommandSpy = jest.spyOn(
          service as any,
          'runCommand',
        ) as jest.Mock;
        runCommandSpy
          .mockResolvedValueOnce(createGitCommandResult(''))
          .mockResolvedValueOnce(createGitCommandResult(''));

        await service.cleanupForeignUntrackedGoalDirs(
          repositoryRoot,
          keepGoalId,
        );

        expect(runCommandSpy.mock.calls).toEqual([
          [
            [
              '-C',
              repositoryRoot,
              'ls-files',
              '--',
              `docs/goals/${foreignGoalId}`,
            ],
          ],
          [
            [
              '-C',
              repositoryRoot,
              'clean',
              '-fd',
              '--',
              `docs/goals/${foreignGoalId}`,
            ],
          ],
        ]);
      } finally {
        await fs.rm(repositoryRoot, { recursive: true, force: true });
      }
    });

    it('should skip foreign goal directories with tracked files', async () => {
      const { service } = createGitService();
      const repositoryRoot = await fs.mkdtemp(
        path.join(os.tmpdir(), 'ainative-git-clean-'),
      );
      const keepGoalId = '11111111-1111-4111-8111-111111111111';
      const foreignGoalId = '22222222-2222-4222-8222-222222222222';

      try {
        await fs.mkdir(
          path.join(repositoryRoot, 'docs', 'goals', foreignGoalId),
          {
            recursive: true,
          },
        );

        const runCommandSpy = jest.spyOn(
          service as any,
          'runCommand',
        ) as jest.Mock;
        runCommandSpy.mockResolvedValueOnce(
          createGitCommandResult(`docs/goals/${foreignGoalId}/PRD.md\n`),
        );

        await service.cleanupForeignUntrackedGoalDirs(
          repositoryRoot,
          keepGoalId,
        );

        expect(runCommandSpy).toHaveBeenCalledTimes(1);
        expect(runCommandSpy).toHaveBeenCalledWith([
          '-C',
          repositoryRoot,
          'ls-files',
          '--',
          `docs/goals/${foreignGoalId}`,
        ]);
      } finally {
        await fs.rm(repositoryRoot, { recursive: true, force: true });
      }
    });
  });

  describe('commitRelativePathsInRepoRootIfDirty', () => {
    it('should no-op when relativePaths is empty', async () => {
      const { service } = createGitService();

      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;

      await service.commitRelativePathsInRepoRootIfDirty(
        '/tmp/repo',
        [],
        '对话知识沉淀',
      );

      expect(runCommandSpy).not.toHaveBeenCalled();
    });

    it('should no-op when staged index is empty after add', async () => {
      const { service } = createGitService();

      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;
      runCommandSpy
        .mockResolvedValueOnce(createGitCommandResult('')) // git add
        .mockResolvedValueOnce(createGitCommandResult('')); // diff --cached empty

      await service.commitRelativePathsInRepoRootIfDirty(
        '/tmp/repo',
        ['docs/memory'],
        '对话知识沉淀',
      );

      expect(runCommandSpy).toHaveBeenCalledTimes(2);
      expect(runCommandSpy).toHaveBeenNthCalledWith(1, [
        '-C',
        '/tmp/repo',
        'add',
        '--',
        'docs/memory',
      ]);
      expect(runCommandSpy).toHaveBeenNthCalledWith(2, [
        '-C',
        '/tmp/repo',
        'diff',
        '--cached',
        '--name-only',
      ]);
    });

    it('should commit with memory ingest author when there are staged changes', async () => {
      const { service } = createGitService();

      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;
      runCommandSpy
        .mockResolvedValueOnce(createGitCommandResult('')) // add
        .mockResolvedValueOnce(
          createGitCommandResult('docs/memory/conventions.md\n'),
        ) // diff cached
        .mockResolvedValueOnce(createGitCommandResult('abc1234')); // commit

      await service.commitRelativePathsInRepoRootIfDirty(
        '/tmp/repo',
        ['docs/memory'],
        '对话知识沉淀',
      );

      expect(runCommandSpy).toHaveBeenCalledTimes(3);
      expect(runCommandSpy).toHaveBeenNthCalledWith(3, [
        '-C',
        '/tmp/repo',
        '-c',
        'user.name=ainative-memory',
        '-c',
        'user.email=memory@ainative.local',
        'commit',
        '-m',
        '对话知识沉淀',
      ]);
    });

    it('should skip unsafe relative paths', async () => {
      const { service } = createGitService();

      const runCommandSpy = jest.spyOn(
        service as any,
        'runCommand',
      ) as jest.Mock;

      await service.commitRelativePathsInRepoRootIfDirty(
        '/tmp/repo',
        ['../etc/passwd'],
        '对话知识沉淀',
      );

      expect(runCommandSpy).not.toHaveBeenCalled();
    });
  });
});
