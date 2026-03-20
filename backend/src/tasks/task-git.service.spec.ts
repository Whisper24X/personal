import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
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

const initializeRepository = async (): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ainative-git-'));

  runGit(['init'], directory);
  runGit(['config', 'user.name', 'AINative Test'], directory);
  runGit(['config', 'user.email', 'ainative@example.com'], directory);

  await fs.writeFile(path.join(directory, 'README.md'), '# test\n');
  runGit(['add', 'README.md'], directory);
  runGit(['commit', '-m', 'init'], directory);

  return directory;
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
    const service = new TaskGitService({} as any, {} as any);

    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      worktreePath: '/tmp/worktree',
    });

    const runGitCommand = jest
      .spyOn(service as any, 'runGitCommand')
      .mockImplementation((_cwd: string, args: string[]) => {
        if (args[0] === 'status') {
          expect(args).toEqual([
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

    const service = new TaskGitService({} as any, {} as any);
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      worktreePath: repositoryPath,
    });

    const rootTree = await service.getArtifactTree(
      'task-1',
      { path: '.' } as never,
      {} as never,
    );
    const nestedTree = await service.getArtifactTree(
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
    });
    expect(nestedTree).toEqual({
      cwd: 'src',
      entries: [{ name: 'nested', path: 'src/nested', isDir: true }],
    });
  });

  it('should preview artifact content from worktree when unstaged changes exist', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const readmePath = path.join(repositoryPath, 'README.md');
    await fs.writeFile(readmePath, '# staged version\n');
    runGit(['add', 'README.md'], repositoryPath);
    await fs.writeFile(readmePath, '# unstaged version\n');

    const service = new TaskGitService({} as any, {} as any);
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      worktreePath: repositoryPath,
    });

    const preview = await service.getArtifactPreview(
      'task-1',
      { path: 'README.md' } as never,
      {} as never,
    );

    expect(preview.previewType).toBe('text');
    expect(preview.text).toBe('# unstaged version\n');
  });

  it('should fall back to staged index content when the worktree file is missing', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const readmePath = path.join(repositoryPath, 'README.md');
    await fs.writeFile(readmePath, '# staged version\n');
    runGit(['add', 'README.md'], repositoryPath);
    await fs.unlink(readmePath);

    const service = new TaskGitService({} as any, {} as any);
    jest.spyOn(service as any, 'resolveTaskGitContext').mockResolvedValue({
      task: {
        gitBaseBranch: 'main',
      },
      worktreePath: repositoryPath,
    });

    const preview = await service.getArtifactPreview(
      'task-1',
      { path: 'README.md' } as never,
      {} as never,
    );

    expect(preview.previewType).toBe('text');
    expect(preview.text).toBe('# staged version\n');
  });

  it('should skip commitIfChanged when there are no workspace changes', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const service = new TaskGitService({} as any, {} as any);
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

    const service = new TaskGitService({} as any, {} as any);
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
});
