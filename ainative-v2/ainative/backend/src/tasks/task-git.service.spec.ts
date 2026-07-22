import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { TaskWorkspaceArtifactService } from './application/task-workspace-artifact.service';
import { TaskStatus } from './dto/task-status.enum';
import { TaskGitService } from './task-git.service';

const runGit = (args: string[], cwd: string): string => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }

  return result.stdout.trim();
};

const initializeRepository = async (
  options: { removeIdentityAfterInit?: boolean } = {},
): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ainative-git-'));

  runGit(['init'], directory);
  runGit(['config', 'user.name', 'AINative'], directory);
  runGit(['config', 'user.email', 'ainative@example.com'], directory);

  await fs.writeFile(path.join(directory, 'README.md'), '# test\n');
  runGit(['add', 'README.md'], directory);
  runGit(['commit', '-m', 'init'], directory);

  if (options.removeIdentityAfterInit) {
    runGit(['config', '--unset', 'user.name'], directory);
    runGit(['config', '--unset', 'user.email'], directory);
  }

  return directory;
};

const createTaskGitServices = (workspaceNativeDeployService?: any) => {
  const taskRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 'task-1',
      configJson: {},
    }),
    update: jest.fn().mockResolvedValue(undefined),
    acquireGitOperationLock: jest.fn().mockResolvedValue(true),
  };
  const artifactService = new TaskWorkspaceArtifactService(
    {} as any,
    {} as any,
    {
      findByTaskId: jest.fn().mockResolvedValue([]),
    } as any,
  );
  const service = new TaskGitService(
    {} as any,
    {} as any,
    artifactService,
    taskRepository as any,
    workspaceNativeDeployService,
  );

  return {
    service,
    artifactService,
    taskRepository,
  };
};

describe('TaskGitService', () => {
  const createdDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirectories
        .splice(0)
        .map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
  });

  it('should expand untracked directories into file paths when reading git status', async () => {
    const { service } = createTaskGitServices();

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });

    const runGitCommand = jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args.includes('status')) {
          expect(args).toEqual([
            '-c',
            'core.quotePath=false',
            'status',
            '--porcelain',
            '--untracked-files=all',
          ]);

          return {
            success: true,
            stdout: '?? docs/feature/20260319-111330/brainstorm.md',
            stderr: '',
            exitCode: 0,
          };
        }

        if (args[0] === 'rev-parse') {
          return {
            success: true,
            stdout: 'feature/test-branch',
            stderr: '',
            exitCode: 0,
          };
        }

        throw new Error(`Unexpected git args: ${args.join(' ')}`);
      });

    const result = await service.getStatus('task-1', {} as any);

    expect(runGitCommand).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      branchName: 'feature/test-branch',
      baseBranch: 'main',
      files: [
        {
          path: 'docs/feature/20260319-111330/brainstorm.md',
          status: '??',
          staged: false,
        },
      ],
    });
  });

  it('should decode git C-style octal escapes in porcelain paths to UTF-8', async () => {
    const { service } = createTaskGitServices();

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });

    jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args.includes('status')) {
          return {
            success: true,
            stdout: '?? "\\345\\244\\247\\347\\272\\262.md"',
            stderr: '',
            exitCode: 0,
          };
        }

        if (args[0] === 'rev-parse') {
          return {
            success: true,
            stdout: 'feature/test-branch',
            stderr: '',
            exitCode: 0,
          };
        }

        throw new Error(`Unexpected git args: ${args.join(' ')}`);
      });

    const result = await service.getStatus('task-1', {} as any);

    expect(result.files[0]?.path).toBe('大纲.md');
  });

  it('should push workspace-native tasks through multi-repo deploy service', async () => {
    const deployService = {
      deploy: jest.fn().mockResolvedValue({
        deployCommitSha: 'abc123',
        deployStatus: {
          status: 'done',
          subRepoPushResults: [
            {
              prefix: 'frontend',
              status: 'success',
              remoteBranch: 'feature/task-1',
            },
            {
              prefix: 'backend',
              status: 'skipped',
              remoteBranch: 'feature/task-1',
            },
          ],
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
        subRepoDeployBranches: [],
      }),
    };
    const { service } = createTaskGitServices(deployService);
    const task = {
      id: 'task-1',
      configJson: {
        workspaceSnapshot: { taskBranch: 'feature/task-1' },
        subReposSnapshot: [
          {
            prefix: 'frontend',
            url: 'git@github.com:org/frontend.git',
            branch: 'main',
          },
        ],
      },
    };
    const project = {
      configJson: {
        subtreeMode: 'workspace-native',
      },
    };

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task,
      project,
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });
    jest.spyOn(service as any, 'listAllArtifactFiles').mockResolvedValue([]);

    const result = await service.push('task-1', {} as never);

    expect(result.success).toBe(true);
    expect(result.operationId).toEqual(expect.stringMatching(/^push-/));
    await new Promise((resolve) => setImmediate(resolve));
    expect(deployService.deploy).toHaveBeenCalledWith(
      task,
      project,
      expect.any(Function),
      expect.objectContaining({ skipLock: true, mode: 'push' }),
    );
  });

  it('should not push config repo directly before delegating workspace-native push', async () => {
    const deployService = {
      resolveWorktreePath: jest.fn().mockReturnValue('/tmp/worktree'),
      deploy: jest.fn().mockResolvedValue({
        deployCommitSha: 'abc123',
        deployStatus: {
          status: 'done',
          subRepoPushResults: [],
          updatedAt: '2026-05-07T00:00:00.000Z',
        },
        subRepoDeployBranches: [],
      }),
    };
    const { service } = createTaskGitServices(deployService);

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        id: 'task-1',
        configJson: {
          workspaceSnapshot: { taskBranch: 'feature/task-1' },
          subReposSnapshot: [{ prefix: 'frontend' }],
        },
      },
      project: {
        configJson: {
          subtreeMode: 'workspace-native',
        },
      },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });
    jest.spyOn(service as any, 'listAllArtifactFiles').mockResolvedValue([]);

    const runGitSpy = jest.spyOn(service as any, 'runGitCommand');

    await service.push('task-1', {} as never);
    await new Promise((resolve) => setImmediate(resolve));

    expect(
      runGitSpy.mock.calls.some(
        ([cwd, args]) =>
          cwd === '/tmp/worktree' &&
          Array.isArray(args) &&
          args[0] === 'push' &&
          args[1] === 'origin',
      ),
    ).toBe(false);
  });

  it('should return failed result when workspace-native deploy service throws during push', async () => {
    const deployService = {
      deploy: jest.fn().mockRejectedValue(new Error('配置仓 push 失败')),
    };
    const { service } = createTaskGitServices(deployService);

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        id: 'task-1',
        configJson: {
          workspaceSnapshot: { taskBranch: 'feature/task-1' },
          subReposSnapshot: [{ prefix: 'frontend' }],
        },
      },
      project: {
        configJson: {
          subtreeMode: 'workspace-native',
        },
      },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });
    jest.spyOn(service as any, 'listAllArtifactFiles').mockResolvedValue([]);

    const result = await service.push('task-1', {} as never);
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.success).toBe(true);
    expect(result.operationId).toEqual(expect.stringMatching(/^push-/));
  });

  it('should reject workspace-native push when the task worktree has uncommitted changes', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    await fs.writeFile(
      path.join(repositoryPath, 'README.md'),
      '# dirty before push\n',
    );

    const deployService = {
      deploy: jest.fn(),
    };
    const { service } = createTaskGitServices(deployService);

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        id: 'task-1',
        configJson: {
          workspaceSnapshot: { taskBranch: 'feature/task-1' },
          subReposSnapshot: [{ prefix: 'frontend' }],
        },
      },
      project: {
        configJson: {
          subtreeMode: 'workspace-native',
        },
      },
      worktreePath: repositoryPath,
      subRepos: [],
    });

    const result = await service.push('task-1', {} as never);

    expect(result).toEqual({
      success: false,
      message:
        '任务工作区存在未提交改动，请先填写提交信息并点击“提交”后再推送。',
    });
    expect(deployService.deploy).not.toHaveBeenCalled();
  });

  it('should generate PR links from workspace-native sub-repo snapshot', async () => {
    const { service } = createTaskGitServices();
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBranch: 'feature/fallback',
        configJson: {
          workspaceSnapshot: { taskBranch: 'feature/task-1' },
          subReposSnapshot: [
            {
              prefix: 'frontend',
              url: 'https://github.com/org/frontend.git',
              branch: 'develop',
            },
            {
              prefix: 'backend',
              url: 'git@github.com:org/backend.git',
              branch: 'main',
            },
          ],
          subRepoDeployBranches: [
            {
              prefix: 'backend',
              remoteBranch: 'feature/task-1-backend',
            },
          ],
        },
      },
      project: {
        configJson: {
          subtreeMode: 'workspace-native',
        },
      },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });

    const result = await service.getPrLink(
      'task-1',
      { baseBranch: 'ignored' },
      {} as never,
    );

    expect(result.url).toContain('/compare/main...feature%2Ftask-1-backend');
    expect(result.urls).toEqual([
      {
        prefix: 'frontend',
        url: null,
        hint: '请先推送到子仓再创建 PR',
      },
      {
        prefix: 'backend',
        url: 'https://github.com/org/backend/compare/main...feature%2Ftask-1-backend?expand=1',
      },
    ]);
  });

  it('should build an artifact tree from all changed files', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    await fs.mkdir(path.join(repositoryPath, 'src', 'nested'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(repositoryPath, 'src', 'nested', 'demo.ts'),
      'export const demo = 1;\n',
    );
    await fs.writeFile(path.join(repositoryPath, 'docs.md'), '# docs\n');
    runGit(['add', 'src/nested/demo.ts'], repositoryPath);

    const { artifactService } = createTaskGitServices();
    jest
      .spyOn(artifactService as any, 'resolveArtifactContext')
      .mockResolvedValue({
        task: {
          mode: 'workflow',
        },
        worktreePath: repositoryPath,
        source: {
          sourceType: 'workspace_unstaged_fallback',
          nodeId: 'node-1',
          beforeCommitSha: null,
          afterCommitSha: null,
        },
      });

    const rootTree = await artifactService.getArtifactTree(
      'task-1',
      { path: '.' } as never,
      {} as never,
    );
    const nestedTree = await artifactService.getArtifactTree(
      'task-1',
      { path: 'src' } as never,
      {} as never,
    );

    expect(rootTree).toEqual({
      cwd: '.',
      entries: [
        { name: 'src', path: 'src', isDir: true },
        { name: 'docs.md', path: 'docs.md', isDir: false },
      ],
      files: [
        {
          path: 'docs.md',
          status: '??',
          deleted: false,
        },
        {
          path: 'src/nested/demo.ts',
          status: 'A ',
          deleted: false,
        },
      ],
      artifactSource: {
        sourceType: 'workspace_unstaged_fallback',
        nodeId: 'node-1',
        beforeCommitSha: null,
        afterCommitSha: null,
      },
    });
    expect(nestedTree).toEqual({
      cwd: 'src',
      entries: [{ name: 'nested', path: 'src/nested', isDir: true }],
      files: [
        {
          path: 'src/nested/demo.ts',
          status: 'A ',
          deleted: false,
        },
      ],
      artifactSource: {
        sourceType: 'workspace_unstaged_fallback',
        nodeId: 'node-1',
        beforeCommitSha: null,
        afterCommitSha: null,
      },
    });
  });

  it('should preview artifact content from worktree when unstaged changes exist', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const readmePath = path.join(repositoryPath, 'README.md');
    await fs.writeFile(readmePath, '# staged version\n');
    runGit(['add', 'README.md'], repositoryPath);
    await fs.writeFile(readmePath, '# unstaged version\n');

    const { artifactService } = createTaskGitServices();
    jest
      .spyOn(artifactService as any, 'resolveArtifactContext')
      .mockResolvedValue({
        task: {
          mode: 'workflow',
        },
        worktreePath: repositoryPath,
        source: {
          sourceType: 'workspace_unstaged_fallback',
          nodeId: 'node-1',
          beforeCommitSha: null,
          afterCommitSha: null,
        },
      });

    const preview = await artifactService.getArtifactPreview(
      'task-1',
      { path: 'README.md' } as never,
      {} as never,
    );

    expect(preview.previewType).toBe('text');
    expect(preview.text).toBe('# unstaged version\n');
    expect(preview.artifactSource.sourceType).toBe(
      'workspace_unstaged_fallback',
    );
  });

  it('should fall back to staged index content when the worktree file is missing', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const readmePath = path.join(repositoryPath, 'README.md');
    await fs.writeFile(readmePath, '# staged version\n');
    runGit(['add', 'README.md'], repositoryPath);
    await fs.unlink(readmePath);

    const { artifactService } = createTaskGitServices();
    jest
      .spyOn(artifactService as any, 'resolveArtifactContext')
      .mockResolvedValue({
        task: {
          mode: 'workflow',
        },
        worktreePath: repositoryPath,
        source: {
          sourceType: 'workspace_unstaged_fallback',
          nodeId: 'node-1',
          beforeCommitSha: null,
          afterCommitSha: null,
        },
      });

    const preview = await artifactService.getArtifactPreview(
      'task-1',
      { path: 'README.md' } as never,
      {} as never,
    );

    expect(preview.previewType).toBe('text');
    expect(preview.text).toBe('# staged version\n');
  });

  it('should list commit-range artifacts and preview the node snapshot content', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const readmePath = path.join(repositoryPath, 'README.md');
    await fs.writeFile(readmePath, '# node one\n');
    runGit(['add', 'README.md'], repositoryPath);
    runGit(['commit', '-m', 'node one'], repositoryPath);
    const beforeCommitSha = runGit(['rev-parse', 'HEAD~1'], repositoryPath);
    const afterCommitSha = runGit(['rev-parse', 'HEAD'], repositoryPath);

    await fs.writeFile(readmePath, '# node two\n');

    const { artifactService } = createTaskGitServices();
    jest
      .spyOn(artifactService as any, 'resolveArtifactContext')
      .mockResolvedValue({
        task: {
          mode: 'workflow',
        },
        worktreePath: repositoryPath,
        source: {
          sourceType: 'commit_range',
          nodeId: 'node-1',
          beforeCommitSha,
          afterCommitSha,
        },
      });

    const tree = await artifactService.getArtifactTree(
      'task-1',
      { path: '.' } as never,
      {} as never,
    );
    const preview = await artifactService.getArtifactPreview(
      'task-1',
      { path: 'README.md' } as never,
      {} as never,
    );

    expect(tree.files).toEqual([
      {
        path: 'README.md',
        status: 'M',
        deleted: false,
      },
    ]);
    expect(tree.artifactSource).toEqual({
      sourceType: 'commit_range',
      nodeId: 'node-1',
      beforeCommitSha,
      afterCommitSha,
    });
    expect(preview.previewType).toBe('text');
    expect(preview.text).toBe('# node one\n');
    expect(preview.artifactSource.sourceType).toBe('commit_range');
  });

  it('should use workspace fallback for the current in-review node when commit range is unavailable', () => {
    const { artifactService } = createTaskGitServices();

    const source = (artifactService as any).resolveArtifactSource({
      task: {
        mode: 'workflow',
      },
      nodes: [
        {
          id: 'node-1',
          taskId: 'task-1',
          nodeOrder: 1,
          status: TaskStatus.done,
        },
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          status: TaskStatus.inReview,
          beforeRunCommitSha: 'before-only',
          afterRunCommitSha: null,
        },
      ],
      targetNode: {
        id: 'node-2',
        taskId: 'task-1',
        nodeOrder: 2,
        status: TaskStatus.inReview,
        beforeRunCommitSha: 'before-only',
        afterRunCommitSha: null,
      },
    });

    expect(source).toEqual({
      sourceType: 'workspace_unstaged_fallback',
      nodeId: 'node-2',
      beforeCommitSha: 'before-only',
      afterCommitSha: null,
    });
  });

  it('should prefer workspace fallback for in-review nodes even when commit snapshots exist', () => {
    const { artifactService } = createTaskGitServices();

    const source = (artifactService as any).resolveArtifactSource({
      task: {
        mode: 'workflow',
      },
      nodes: [
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          status: TaskStatus.inReview,
          beforeRunCommitSha: 'before-sha',
          afterRunCommitSha: 'after-sha',
        },
      ],
      targetNode: {
        id: 'node-2',
        taskId: 'task-1',
        nodeOrder: 2,
        status: TaskStatus.inReview,
        beforeRunCommitSha: 'before-sha',
        afterRunCommitSha: 'after-sha',
      },
    });

    expect(source).toEqual({
      sourceType: 'workspace_unstaged_fallback',
      nodeId: 'node-2',
      beforeCommitSha: 'before-sha',
      afterCommitSha: 'after-sha',
    });
  });

  it('should prefer workspace fallback for in-progress nodes even when commit snapshots exist', () => {
    const { artifactService } = createTaskGitServices();

    const source = (artifactService as any).resolveArtifactSource({
      task: {
        mode: 'workflow',
      },
      nodes: [
        {
          id: 'node-2',
          taskId: 'task-1',
          nodeOrder: 2,
          status: TaskStatus.inProgress,
          beforeRunCommitSha: 'before-sha',
          afterRunCommitSha: 'after-sha',
        },
      ],
      targetNode: {
        id: 'node-2',
        taskId: 'task-1',
        nodeOrder: 2,
        status: TaskStatus.inProgress,
        beforeRunCommitSha: 'before-sha',
        afterRunCommitSha: 'after-sha',
      },
    });

    expect(source).toEqual({
      sourceType: 'workspace_unstaged_fallback',
      nodeId: 'node-2',
      beforeCommitSha: 'before-sha',
      afterCommitSha: 'after-sha',
    });
  });

  it('should use workspace fallback for todo nodes', () => {
    const { artifactService } = createTaskGitServices();

    const source = (artifactService as any).resolveArtifactSource({
      task: {
        mode: 'workflow',
      },
      nodes: [
        {
          id: 'node-3',
          taskId: 'task-1',
          nodeOrder: 3,
          status: TaskStatus.todo,
          beforeRunCommitSha: null,
          afterRunCommitSha: null,
        },
      ],
      targetNode: {
        id: 'node-3',
        taskId: 'task-1',
        nodeOrder: 3,
        status: TaskStatus.todo,
        beforeRunCommitSha: null,
        afterRunCommitSha: null,
      },
    });

    expect(source).toEqual({
      sourceType: 'workspace_unstaged_fallback',
      nodeId: 'node-3',
      beforeCommitSha: null,
      afterCommitSha: null,
    });
  });

  it('should skip commitIfChanged when there are no workspace changes', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const { service } = createTaskGitServices();
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: repositoryPath,
      subRepos: [],
    });

    const result = await service.commitIfChanged(
      'task-1',
      'chore(task): approve node #1 Node 1',
      {} as never,
    );

    expect(result).toEqual({
      committed: false,
      skippedReason: 'no_changes',
    });
  });

  it('should stage workspace changes before committing', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    await fs.writeFile(
      path.join(repositoryPath, 'README.md'),
      '# updated in workspace\n',
    );

    const { service } = createTaskGitServices();
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: repositoryPath,
      subRepos: [],
    });

    const result = await service.commitIfChanged(
      'task-1',
      'chore(task): approve node #1 Node 1',
      {} as never,
    );

    expect(result).toEqual({
      committed: true,
      commitSha: expect.any(String),
      subject: 'chore(task): approve node #1 Node 1',
    });

    expect(runGit(['status', '--short'], repositoryPath)).toBe('');
    expect(runGit(['log', '-1', '--pretty=%s'], repositoryPath)).toBe(
      'chore(task): approve node #1 Node 1',
    );
  });

  it('should commit changed files for a resolved runtime task worktree', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    await fs.writeFile(
      path.join(repositoryPath, 'README.md'),
      '# updated from runtime task\n',
    );

    const { service } = createTaskGitServices();
    jest
      .spyOn(service as any, 'resolveTaskGitWorktreePath')
      .mockResolvedValue(repositoryPath);

    const result = await service.commitIfChangedForTask(
      {} as never,
      {} as never,
      'chore(task): complete node #1 Node 1',
    );

    expect(result).toEqual({
      committed: true,
      commitSha: expect.any(String),
      subject: 'chore(task): complete node #1 Node 1',
    });
    expect(runGit(['status', '--short'], repositoryPath)).toBe('');
    expect(runGit(['log', '-1', '--pretty=%s'], repositoryPath)).toBe(
      'chore(task): complete node #1 Node 1',
    );
  });

  it('should configure fallback git identity before committing when missing', async () => {
    const repositoryPath = await initializeRepository({
      removeIdentityAfterInit: true,
    });
    createdDirectories.push(repositoryPath);
    const isolatedHome = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-git-home-'),
    );
    const isolatedConfigHome = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-git-xdg-'),
    );
    createdDirectories.push(isolatedHome, isolatedConfigHome);

    await fs.writeFile(
      path.join(repositoryPath, 'README.md'),
      '# updated without identity\n',
    );

    const { service } = createTaskGitServices();
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: repositoryPath,
      subRepos: [],
    });
    const previousHome = process.env.HOME;
    const previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    const previousNoSystem = process.env.GIT_CONFIG_NOSYSTEM;

    process.env.HOME = isolatedHome;
    process.env.XDG_CONFIG_HOME = isolatedConfigHome;
    process.env.GIT_CONFIG_NOSYSTEM = '1';

    try {
      const result = await service.commitIfChanged(
        'task-1',
        'chore(task): approve node #1 Node 1',
        {} as never,
      );

      expect(result).toEqual({
        committed: true,
        commitSha: expect.any(String),
        subject: 'chore(task): approve node #1 Node 1',
      });
      expect(runGit(['config', '--get', 'user.name'], repositoryPath)).toBe(
        'AINative Bot',
      );
      expect(runGit(['config', '--get', 'user.email'], repositoryPath)).toBe(
        'ainative@example.com',
      );
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }

      if (previousXdgConfigHome === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
      }

      if (previousNoSystem === undefined) {
        delete process.env.GIT_CONFIG_NOSYSTEM;
      } else {
        process.env.GIT_CONFIG_NOSYSTEM = previousNoSystem;
      }
    }
  });

  it('should merge current branch into base then switch back to feature', async () => {
    const { service } = createTaskGitServices();

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });

    const calls: string[][] = [];
    jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation((_cwd: string, args: string[]) => {
        calls.push(args);

        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          if (args[2] === 'origin/main') {
            return Promise.resolve({
              success: false,
              stdout: '',
              stderr: 'unknown revision',
              exitCode: 1,
            });
          }
          if (args[2] === 'refs/heads/main') {
            return Promise.resolve({
              success: true,
              stdout: 'deadbeef',
              stderr: '',
              exitCode: 0,
            });
          }
        }

        if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
          return Promise.resolve({
            success: true,
            stdout: 'feature/x',
            stderr: '',
            exitCode: 0,
          });
        }

        if (args.includes('status') && args.includes('--porcelain')) {
          return Promise.resolve({
            success: true,
            stdout: '',
            stderr: '',
            exitCode: 0,
          });
        }

        if (args[0] === 'checkout') {
          return Promise.resolve({
            success: true,
            stdout: '',
            stderr: '',
            exitCode: 0,
          });
        }

        if (args[0] === 'merge') {
          return Promise.resolve({
            success: true,
            stdout: '',
            stderr: 'Merge made by recursive strategy.',
            exitCode: 0,
          });
        }

        return Promise.resolve({
          success: false,
          stdout: '',
          stderr: `unexpected: ${args.join(' ')}`,
          exitCode: 1,
        });
      });

    const result = await service.merge(
      'task-1',
      { baseBranch: 'main' },
      {} as never,
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('feature/x');
    expect(result.message).toContain('local base');
    expect(calls).toContainEqual(['merge', '--no-ff', 'feature/x']);
    const checkoutCalls = calls.filter((args) => args[0] === 'checkout');
    expect(checkoutCalls[0]).toEqual(['checkout', 'main']);
    expect(checkoutCalls[1]).toEqual(['checkout', 'feature/x']);
  });

  it('should reject merge when already on base branch', async () => {
    const { service } = createTaskGitServices();

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });

    jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          if (args[2] === 'origin/main') {
            return Promise.resolve({
              success: false,
              stdout: '',
              stderr: '',
              exitCode: 1,
            });
          }
        }

        if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
          return Promise.resolve({
            success: true,
            stdout: 'main',
            stderr: '',
            exitCode: 0,
          });
        }

        return Promise.resolve({
          success: false,
          stdout: '',
          stderr: `unexpected: ${args.join(' ')}`,
          exitCode: 1,
        });
      });

    const result = await service.merge(
      'task-1',
      { baseBranch: 'main' },
      {} as never,
    );
    expect(result.message).toMatch(/Already on the base branch/);
  });

  it('should reject merge when working tree is dirty', async () => {
    const { service } = createTaskGitServices();

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      project: { configJson: {} },
      worktreePath: '/tmp/worktree',
      subRepos: [],
    });

    jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          if (args[2] === 'origin/main') {
            return Promise.resolve({
              success: false,
              stdout: '',
              stderr: '',
              exitCode: 1,
            });
          }
        }

        if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') {
          return Promise.resolve({
            success: true,
            stdout: 'feature/x',
            stderr: '',
            exitCode: 0,
          });
        }

        if (args.includes('status') && args.includes('--porcelain')) {
          return Promise.resolve({
            success: true,
            stdout: ' M README.md\n',
            stderr: '',
            exitCode: 0,
          });
        }

        return Promise.resolve({
          success: false,
          stdout: '',
          stderr: `unexpected: ${args.join(' ')}`,
          exitCode: 1,
        });
      });

    const result = await service.merge(
      'task-1',
      { baseBranch: 'main' },
      {} as never,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Working tree is not clean/);
  });
});
