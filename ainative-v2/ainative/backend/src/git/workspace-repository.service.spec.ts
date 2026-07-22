import { ConfigService } from '@nestjs/config';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { WorkspaceRepositoryService } from './workspace-repository.service';

describe('WorkspaceRepositoryService', () => {
  const createService = (env: Record<string, unknown> = {}) =>
    new WorkspaceRepositoryService(
      {
        withLock: jest.fn(async (_key: string, fn: () => Promise<unknown>) =>
          fn(),
        ),
      } as never,
      {
        get: jest.fn((key: string) => env[key]),
      } as unknown as ConfigService,
    );

  it('should default workspace ssh remotes to gitlab.yc345.tv http auth host', () => {
    const service = createService({
      GITLAB_TOKEN: 'token-123',
    });

    const resolved = (service as any).resolveRemoteUrl(
      'git@gitlab.yc345.tv:frontend/ainative-workspace.git',
    );

    expect(resolved).toBe(
      'https://oauth2:token-123@gitlab.yc345.tv/frontend/ainative-workspace.git',
    );
  });

  it('should prefer configured http auth host when provided', () => {
    const service = createService({
      GITLAB_HTTP_AUTH_HOST: 'gitlab.example.com',
      GITLAB_TOKEN: 'token-123',
    });

    const resolved = (service as any).resolveRemoteUrl(
      'git@gitlab.example.com:frontend/ainative-workspace.git',
    );

    expect(resolved).toBe(
      'https://oauth2:token-123@gitlab.example.com/frontend/ainative-workspace.git',
    );
  });

  describe('tryResolveEmbeddedSubRepoHeads', () => {
    const subRepos = [{ prefix: 'app', url: 'git@x/y.git', branch: 'main' }];

    it('should return {} when subRepos is empty', async () => {
      const service = createService();
      const result = await (service as any).tryResolveEmbeddedSubRepoHeads(
        '/wt',
        [],
      );
      expect(result).toEqual({});
    });

    it('should return null when a prefix is missing from HEAD tree', async () => {
      const service = createService();
      const headSpy = jest
        .spyOn(service as any, 'headTreeHasPrefix')
        .mockResolvedValue(false);

      const result = await (service as any).tryResolveEmbeddedSubRepoHeads(
        '/wt',
        subRepos,
      );

      expect(result).toBeNull();
      expect(headSpy).toHaveBeenCalledWith('/wt', 'app');
    });

    it('should return tree SHAs when all prefixes exist', async () => {
      const service = createService();
      jest.spyOn(service as any, 'headTreeHasPrefix').mockResolvedValue(true);
      const mustGitSpy = jest
        .spyOn(service as any, 'mustGit')
        .mockResolvedValue({ stdout: 'deadbeef9\n' });

      const result = await (service as any).tryResolveEmbeddedSubRepoHeads(
        '/wt',
        subRepos,
      );

      expect(result).toEqual({ app: 'deadbeef9' });
      expect(mustGitSpy).toHaveBeenCalledWith('/wt', ['rev-parse', 'HEAD:app']);
    });

    it('should return tree SHAs for nested prefix when embedded tree exists at HEAD', async () => {
      const service = createService();
      const runGitSpy = jest.spyOn(service as any, 'runGit');
      runGitSpy.mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'rev-parse' && args.includes('--verify')) {
          return Promise.resolve({ success: true, stdout: '', stderr: '' });
        }
        if (args[0] === 'cat-file' && args[1] === '-t') {
          return Promise.resolve({
            success: true,
            stdout: 'tree\n',
            stderr: '',
          });
        }
        return Promise.resolve({ success: false, stdout: '', stderr: '' });
      });
      const mustGitSpy = jest
        .spyOn(service as any, 'mustGit')
        .mockResolvedValue({ stdout: 'nestedtreesha\n' });

      const result = await (service as any).tryResolveEmbeddedSubRepoHeads(
        '/wt',
        [{ prefix: 'packages/app', url: 'git@x/y.git', branch: 'main' }],
      );

      expect(result).toEqual({ 'packages/app': 'nestedtreesha' });
      expect(mustGitSpy).toHaveBeenCalledWith('/wt', [
        'rev-parse',
        'HEAD:packages/app',
      ]);
    });
  });

  describe('createTaskWorktree', () => {
    let tmpWorktreeBase: string;

    beforeAll(() => {
      tmpWorktreeBase = mkdtempSync(path.join(tmpdir(), 'wt-test-'));
    });

    it('should skip fetchSubRepo when reuseEmbeddedSubtrees and tryResolve succeeds', async () => {
      const service = createService();
      jest.spyOn(service, 'ensureClone').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'tryResolveEmbeddedSubRepoHeads')
        .mockResolvedValue({ app: 'treesha1' });
      const fetchSpy = jest.spyOn(service as any, 'fetchSubRepo');
      jest
        .spyOn(service as any, 'resolveBranchRefForRevParse')
        .mockResolvedValue('refs/heads/group');
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);

      const mustGitSpy = jest.spyOn(service as any, 'mustGit');
      mustGitSpy.mockImplementation((_cwd: string, args: string[]) => {
        const joined = args.join(' ');
        if (joined.includes('rev-parse') && args.includes('refs/heads/group')) {
          return Promise.resolve({ stdout: 'abc111\n' });
        }
        if (joined === 'rev-parse HEAD') {
          return Promise.resolve({ stdout: 'snapcommit\n' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const result = await service.createTaskWorktree(
        '/repo',
        tmpWorktreeBase,
        'feature/task-slug',
        [{ prefix: 'app', url: 'git@u/r.git', branch: 'main' }],
        { baseBranch: 'group/feat', reuseEmbeddedSubtrees: true },
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.subRepoHeads).toEqual({ app: 'treesha1' });
      expect(result.taskBranch).toBe('feature/task-slug');
      expect(result.snapshotCommitSha).toBe('snapcommit');
    });

    it('should skip fetchSubRepo when reuseEmbeddedSubtrees succeeds for nested subRepo prefix', async () => {
      const service = createService();
      jest.spyOn(service, 'ensureClone').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'tryResolveEmbeddedSubRepoHeads')
        .mockResolvedValue({ 'packages/app': 'treesha-nested' });
      const fetchSpy = jest.spyOn(service as any, 'fetchSubRepo');
      jest
        .spyOn(service as any, 'resolveBranchRefForRevParse')
        .mockResolvedValue('refs/heads/group');
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);

      const mustGitSpy = jest.spyOn(service as any, 'mustGit');
      mustGitSpy.mockImplementation((_cwd: string, args: string[]) => {
        const joined = args.join(' ');
        if (joined.includes('rev-parse') && args.includes('refs/heads/group')) {
          return Promise.resolve({ stdout: 'abc111\n' });
        }
        if (joined === 'rev-parse HEAD') {
          return Promise.resolve({ stdout: 'snapcommit\n' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const result = await service.createTaskWorktree(
        '/repo',
        tmpWorktreeBase,
        'feature/task-slug',
        [
          {
            prefix: 'packages/app',
            url: 'git@u/r.git',
            branch: 'main',
          },
        ],
        { baseBranch: 'group/feat', reuseEmbeddedSubtrees: true },
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.subRepoHeads).toEqual({ 'packages/app': 'treesha-nested' });
    });

    it('should call fetchSubRepo when reuseEmbeddedSubtrees but tryResolve returns null', async () => {
      const service = createService();
      jest.spyOn(service, 'ensureClone').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'tryResolveEmbeddedSubRepoHeads')
        .mockResolvedValue(null);
      const fetchSpy = jest
        .spyOn(service as any, 'fetchSubRepo')
        .mockResolvedValue('remoteheadsha');
      const embedSpy = jest
        .spyOn(service as any, 'ensureSubRepoEmbedded')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'resolveBranchRefForRevParse')
        .mockResolvedValue('refs/heads/group');
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);

      const mustGitSpy = jest.spyOn(service as any, 'mustGit');
      mustGitSpy.mockImplementation((_cwd: string, args: string[]) => {
        const joined = args.join(' ');
        if (joined.includes('rev-parse') && args.includes('refs/heads/group')) {
          return Promise.resolve({ stdout: 'abc111\n' });
        }
        if (joined === 'rev-parse HEAD') {
          return Promise.resolve({ stdout: 'afterembed\n' });
        }
        if (joined === 'status --porcelain') {
          return Promise.resolve({ stdout: '' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const result = await service.createTaskWorktree(
        '/repo',
        tmpWorktreeBase,
        'feature/task-slug',
        [{ prefix: 'app', url: 'git@u/r.git', branch: 'main' }],
        { baseBranch: 'group/feat', reuseEmbeddedSubtrees: true },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(embedSpy).toHaveBeenCalledTimes(1);
      expect(result.subRepoHeads).toEqual({ app: 'remoteheadsha' });
    });

    it('should skip ensureClone fetch, base fetch, and push when localMaterializeTaskWorktree and use local ref only', async () => {
      const service = createService();
      const ensureSpy = jest
        .spyOn(service, 'ensureClone')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'tryResolveEmbeddedSubRepoHeads')
        .mockResolvedValue({ app: 'treesha1' });
      const resolveLocalSpy = jest
        .spyOn(service as any, 'resolveLocalBranchRefOnly')
        .mockResolvedValue('refs/heads/group-branch');
      const resolveRemoteSpy = jest.spyOn(
        service as any,
        'resolveBranchRefForRevParse',
      );
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);

      const mustGitSpy = jest.spyOn(service as any, 'mustGit');
      mustGitSpy.mockImplementation((_cwd: string, args: string[]) => {
        const joined = args.join(' ');
        if (
          joined.includes('rev-parse') &&
          args.includes('refs/heads/group-branch')
        ) {
          return Promise.resolve({ stdout: 'basecommit\n' });
        }
        if (joined === 'rev-parse HEAD') {
          return Promise.resolve({ stdout: 'snapcommit\n' });
        }
        return Promise.resolve({ stdout: '' });
      });

      const result = await service.createTaskWorktree(
        '/repo',
        tmpWorktreeBase,
        'feature/task-slug',
        [{ prefix: 'app', url: 'git@u/r.git', branch: 'main' }],
        {
          baseBranch: 'group-branch',
          reuseEmbeddedSubtrees: true,
          localMaterializeTaskWorktree: true,
        },
      );

      expect(ensureSpy).toHaveBeenCalledWith('/repo', {
        skipFetchIfPresent: true,
      });
      expect(resolveLocalSpy).toHaveBeenCalledWith('/repo', 'group-branch');
      expect(resolveRemoteSpy).not.toHaveBeenCalled();

      const fetchCalls = mustGitSpy.mock.calls.filter(
        (c) => Array.isArray(c[1]) && c[1].includes('fetch'),
      );
      const pushCalls = mustGitSpy.mock.calls.filter(
        (c) => Array.isArray(c[1]) && c[1].includes('push'),
      );
      expect(fetchCalls).toHaveLength(0);
      expect(pushCalls).toHaveLength(0);

      expect(result.subRepoHeads).toEqual({ app: 'treesha1' });
      expect(result.taskBranch).toBe('feature/task-slug');
      expect(result.snapshotCommitSha).toBe('snapcommit');
    });

    it('should not push task branch when worktree push is deferred', async () => {
      const service = createService();
      const progress: string[] = [];
      jest.spyOn(service, 'ensureClone').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'resolveBranchRefForRevParse')
        .mockResolvedValue('refs/remotes/origin/main');
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);
      jest.spyOn(service as any, 'fetchSubRepo').mockResolvedValue('sub-sha');
      jest
        .spyOn(service as any, 'ensureSubRepoEmbedded')
        .mockResolvedValue(undefined);
      const mustGit = jest
        .spyOn(service as any, 'mustGit')
        .mockImplementation((_cwd: string, args: string[]) => {
          if (args[0] === 'status') {
            return Promise.resolve({ stdout: '', stderr: '' });
          }
          if (args[0] === 'rev-parse') {
            return Promise.resolve({ stdout: 'base-sha\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

      const result = await service.createTaskWorktree(
        '/tmp/repo',
        tmpWorktreeBase,
        'feature/task-1',
        [{ prefix: 'app', url: 'git@example.com:app.git', branch: 'main' }],
        {
          deferPush: true,
          onProgress: ({ stage }) => {
            progress.push(stage);
          },
        },
      );

      expect(result.pushDeferred).toBe(true);
      expect(progress).toEqual(
        expect.arrayContaining([
          'syncing_base',
          'creating_worktree',
          'fetching_sub_repos',
          'embedding_sub_repos',
        ]),
      );
      expect(
        mustGit.mock.calls.some(([, args]) => {
          return Array.isArray(args) && args[0] === 'push';
        }),
      ).toBe(false);
    });
  });

  describe('ensureProjectWorkspaceBranch', () => {
    it('should fetch base branch only and create project branch when missing on origin', async () => {
      const service = createService();
      const mustGitSpy = jest.spyOn(service as any, 'mustGit');
      mustGitSpy.mockImplementation((_cwd: string, args: string[]) => {
        const joined = args.join(' ');
        if (
          joined.includes('rev-parse') &&
          joined.includes('refs/remotes/origin/')
        ) {
          return Promise.reject(new Error('remote ref missing'));
        }
        return Promise.resolve({ stdout: '' });
      });
      jest.spyOn(service as any, 'originBranchExists').mockResolvedValue(false);
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);

      await service.ensureProjectWorkspaceBranch(
        '/repo',
        'bl-75bb4550-psychology2',
      );

      const fetchCalls = mustGitSpy.mock.calls
        .map((c) => c[1] as string[])
        .filter((args) => args[0] === 'fetch');
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]).toEqual([
        'fetch',
        'origin',
        '+refs/heads/master:refs/remotes/origin/master',
      ]);
      expect(
        mustGitSpy.mock.calls.some(
          (c) =>
            Array.isArray(c[1]) &&
            c[1][0] === 'branch' &&
            c[1][1] === 'bl-75bb4550-psychology2',
        ),
      ).toBe(true);
      expect(
        mustGitSpy.mock.calls.some(
          (c) =>
            Array.isArray(c[1]) &&
            c[1][0] === 'push' &&
            c[1].includes('bl-75bb4550-psychology2'),
        ),
      ).toBe(true);
    });

    it('should fetch project branch from origin when it already exists', async () => {
      const service = createService();
      const mustGitSpy = jest.spyOn(service as any, 'mustGit');
      mustGitSpy.mockResolvedValue({ stdout: 'abc123\n' });
      jest.spyOn(service as any, 'originBranchExists').mockResolvedValue(true);
      jest
        .spyOn(service as any, 'branchExistsLocally')
        .mockResolvedValue(false);

      await service.ensureProjectWorkspaceBranch(
        '/repo',
        'bl-75bb4550/psychology2',
      );

      const fetchCalls = mustGitSpy.mock.calls
        .map((c) => c[1] as string[])
        .filter((args) => args[0] === 'fetch');
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[1]).toEqual([
        'fetch',
        'origin',
        '+refs/heads/bl-75bb4550/psychology2:refs/remotes/origin/bl-75bb4550/psychology2',
      ]);
    });
  });
});
