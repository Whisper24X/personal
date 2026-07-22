import {
  WORKSPACE_NATIVE_PUSH_DIRTY_MESSAGE,
  WorkspaceNativeDeployService,
} from './workspace-native-deploy.service';

const createTask = () => ({
  id: 'task-1',
  gitBranch: 'feature/task-1',
  configJson: {
    workspaceSnapshot: {
      taskBranch: 'feature/task-1',
      snapshotCommitSha: 'snap-1',
    },
    subReposSnapshot: [
      {
        prefix: 'frontend',
        url: 'git@github.com:org/frontend.git',
        branch: 'main',
      },
      {
        prefix: 'backend',
        url: 'git@github.com:org/backend.git',
        branch: 'develop',
      },
    ],
  },
});

const createProject = () => ({
  id: 'project-1',
  configJson: {
    subtreeMode: 'workspace-native',
  },
});

const createService = () => {
  const workspaceRepoService = {
    deployToSubRepo: jest.fn(),
  };
  const projectWorkspacePaths = {
    resolveTaskWorktreePath: jest.fn().mockReturnValue('/tmp/worktree'),
  };
  const taskRepository = {
    update: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue({
      id: 'task-1',
      configJson: {},
    }),
  };

  const service = new WorkspaceNativeDeployService(
    workspaceRepoService as any,
    projectWorkspacePaths as any,
    taskRepository as any,
  );

  return {
    service,
    workspaceRepoService,
    projectWorkspacePaths,
    taskRepository,
  };
};

describe('WorkspaceNativeDeployService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should push config repo only once in push mode before fan-out to sub-repos', async () => {
    const { service, workspaceRepoService } = createService();
    const task = createTask();
    const project = createProject();

    const mustGitSpy = jest
      .spyOn(service as any, 'mustGit')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'status') {
          return { stdout: '', stderr: '' };
        }
        if (args[0] === 'push' && args[1] === 'origin') {
          return { stdout: '', stderr: '' };
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'deploy-sha', stderr: '' };
        }
        throw new Error(`unexpected mustGit args: ${args.join(' ')}`);
      });

    workspaceRepoService.deployToSubRepo.mockResolvedValue({
      success: true,
      remoteBranch: 'feature/task-1',
      pushedCommitSha: 'subtree-sha',
      skipped: false,
    });

    const events: Array<{ event: string; data: Record<string, unknown> }> = [];
    const result = await service.deploy(
      task as any,
      project as any,
      (event, data) => events.push({ event, data }),
      { mode: 'push', skipLock: true },
    );

    expect(
      mustGitSpy.mock.calls.filter(
        ([, args]) =>
          Array.isArray(args) && args[0] === 'push' && args[1] === 'origin',
      ),
    ).toHaveLength(1);
    expect(workspaceRepoService.deployToSubRepo).toHaveBeenCalledTimes(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'deploy_step',
          data: expect.objectContaining({
            step: 'push_config_repo',
            message: '推送配置仓 → feature/task-1...',
          }),
        }),
        expect.objectContaining({
          event: 'deploy_step',
          data: expect.objectContaining({
            step: 'push_config_repo_done',
            message: '配置仓已推送到 origin/feature/task-1',
          }),
        }),
      ]),
    );
    expect(result.deployStatus.status).toBe('done');
  });

  it('should stop before sub-repo fan-out when config repo push fails in push mode', async () => {
    const { service, workspaceRepoService } = createService();
    const task = createTask();
    const project = createProject();

    jest
      .spyOn(service as any, 'mustGit')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'status') {
          return { stdout: '', stderr: '' };
        }
        if (args[0] === 'push' && args[1] === 'origin') {
          throw new Error('git push failed (cwd=/tmp/worktree): network error');
        }
        if (args[0] === 'rev-parse') {
          return { stdout: 'deploy-sha', stderr: '' };
        }
        throw new Error(`unexpected mustGit args: ${args.join(' ')}`);
      });

    await expect(
      service.deploy(task as any, project as any, undefined, {
        mode: 'push',
        skipLock: true,
      }),
    ).rejects.toThrow('git push failed (cwd=/tmp/worktree): network error');

    expect(workspaceRepoService.deployToSubRepo).not.toHaveBeenCalled();
  });

  it('should reject push mode when the worktree still has uncommitted changes', async () => {
    const { service, workspaceRepoService } = createService();
    const task = createTask();
    const project = createProject();

    const mustGitSpy = jest
      .spyOn(service as any, 'mustGit')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'status') {
          return { stdout: ' M README.md', stderr: '' };
        }
        throw new Error(`unexpected mustGit args: ${args.join(' ')}`);
      });

    await expect(
      service.deploy(task as any, project as any, undefined, {
        mode: 'push',
        skipLock: true,
      }),
    ).rejects.toThrow(WORKSPACE_NATIVE_PUSH_DIRTY_MESSAGE);

    expect(workspaceRepoService.deployToSubRepo).not.toHaveBeenCalled();
    expect(
      mustGitSpy.mock.calls.some(
        ([, args]) => Array.isArray(args) && args[0] === 'commit',
      ),
    ).toBe(false);
  });
});
