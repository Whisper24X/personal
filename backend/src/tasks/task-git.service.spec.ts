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

const createTaskGitServices = () => {
  const artifactService = new TaskWorkspaceArtifactService(
    {} as any,
    {} as any,
    {
      findByTaskId: jest.fn().mockResolvedValue([]),
    } as any,
  );
  const service = new TaskGitService({} as any, {} as any, artifactService);

  return {
    service,
    artifactService,
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
      worktreePath: '/tmp/worktree',
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
      worktreePath: '/tmp/worktree',
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
      worktreePath: repositoryPath,
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
      worktreePath: repositoryPath,
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
      worktreePath: repositoryPath,
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
});
