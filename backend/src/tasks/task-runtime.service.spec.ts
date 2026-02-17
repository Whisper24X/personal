import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Task } from './domain/task';
import { TaskMode } from './dto/task-mode.enum';
import { TaskStatus } from './dto/task-status.enum';
import { TaskRuntimeService } from './task-runtime.service';

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

const createTask = (worktreePath: string): Task => ({
  id: 'task-test-id',
  projectId: 'project-test-id',
  mode: TaskMode.workflow,
  title: 'runtime test',
  status: TaskStatus.todo,
  branch: 'feature/runtime-test',
  gitBaseBranch: 'main',
  gitWorktreePath: worktreePath,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const initializeRepository = async (): Promise<string> => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'ainative-runtime-spec-'),
  );

  runGit(['init'], directory);
  runGit(['config', 'user.name', 'AINative Test'], directory);
  runGit(['config', 'user.email', 'ainative@example.com'], directory);

  await fs.writeFile(path.join(directory, 'README.md'), '# runtime test\n');
  runGit(['add', 'README.md'], directory);
  runGit(['commit', '-m', 'init commit'], directory);

  return directory;
};

describe('TaskRuntimeService', () => {
  const service = new TaskRuntimeService();
  const createdDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirectories
        .splice(0)
        .map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
  });

  it('should return null when git worktree is clean', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    const artifact = await service.collectGitDiffArtifact(
      createTask(repositoryPath),
    );

    expect(artifact).toBeNull();
  });

  it('should collect git diff artifact with commit metadata', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    await fs.appendFile(path.join(repositoryPath, 'README.md'), '\nnew line\n');

    const artifact = await service.collectGitDiffArtifact(
      createTask(repositoryPath),
    );

    expect(artifact).not.toBeNull();
    expect(artifact?.content).toContain('## commit');
    expect(artifact?.content).toContain('```diff');
    expect(artifact?.metadata.branch).toBeTruthy();
    expect(artifact?.metadata.headCommit).toBeTruthy();
    expect(Array.isArray(artifact?.metadata.changedFiles)).toBeTruthy();
    expect(artifact?.metadata.changedFiles).toContain('README.md');
  });

  it('should fall back to directory cleanup when git worktree cleanup fails', async () => {
    const worktreePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-runtime-cleanup-spec-'),
    );
    createdDirectories.push(worktreePath);

    const runtimeMetaPath = path.join(worktreePath, '.ainative-runtime.json');
    await fs.writeFile(
      runtimeMetaPath,
      JSON.stringify(
        {
          taskId: 'task-test-id',
          projectId: 'project-test-id',
          branch: 'feature/runtime-test',
          gitBaseBranch: 'main',
          worktreePath,
          allowedRoot: path.dirname(worktreePath),
          repositoryRoot: '/tmp/not-exists-repository-root',
          generatedAt: new Date().toISOString(),
          sandbox: {
            type: 'git-worktree',
            note: 'test meta',
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const cleanupResult = await service.cleanupRuntime(
      createTask(worktreePath),
    );

    expect(cleanupResult.cleaned).toBeTruthy();

    await expect(fs.access(worktreePath)).rejects.toThrow();
  });
});
