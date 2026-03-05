import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Project } from '../projects/domain/project';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';
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

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-test-id',
  projectId: 'project-test-id',
  businessLineId: 'business-line-test-id',
  mode: TaskMode.workflow,
  title: 'runtime test',
  status: TaskStatus.todo,
  gitBranch: 'feature/runtime-test',
  gitBaseBranch: 'main',
  gitWorktree: null,
  prompt: null,
  cliToolId: null,
  agentToolConfigId: null,
  clientInputSnapshot: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const createProject = (
  overrides: Partial<Project> = {},
  configJson?: Record<string, unknown> | null,
): Project => ({
  id: 'project-test-id',
  businessLineId: 'business-line-test-id',
  name: 'AINative Runtime Project',
  description: null,
  gitUrl: 'git@example.com:group/ainative-workspace.git',
  defaultBranch: 'main',
  configJson: configJson ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
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
      createTask({ gitWorktree: repositoryPath }),
    );

    expect(artifact).toBeNull();
  });

  it('should collect git diff artifact with commit metadata', async () => {
    const repositoryPath = await initializeRepository();
    createdDirectories.push(repositoryPath);

    await fs.appendFile(path.join(repositoryPath, 'README.md'), '\nnew line\n');

    const artifact = await service.collectGitDiffArtifact(
      createTask({ gitWorktree: repositoryPath }),
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
      createTask({ gitWorktree: worktreePath }),
    );

    expect(cleanupResult.cleaned).toBeTruthy();

    await expect(fs.access(worktreePath)).rejects.toThrow();
  });

  it('should resolve default repository and worktree paths under .ainative data tree', () => {
    const project = createProject();
    const task = createTask();

    const expectedProjectBase = path.resolve(
      resolveAinativeDataRootDir(),
      project.businessLineId,
      'projects',
      project.id,
    );
    const expectedWorktreeBase = path.resolve(
      resolveAinativeDataRootDir(),
      project.businessLineId,
      'worktrees',
      project.id,
    );

    expect((service as any).resolveRepositoryRoot(project)).toBe(
      path.join(expectedProjectBase, 'ainative-workspace'),
    );
    expect((service as any).resolveWorktreeBaseDir(project)).toBe(
      expectedWorktreeBase,
    );
    expect((service as any).resolveGitWorktreePath(task, project)).toBe(
      path.join(expectedWorktreeBase, `wk-${task.id}`),
    );
  });

  it('should keep explicit repo/worktree path overrides', () => {
    const project = createProject(
      {},
      {
        repoCacheBaseDir: '/tmp/ainative-repo-cache',
        worktreeBaseDir: '/tmp/ainative-worktrees',
      },
    );
    const task = createTask();

    expect((service as any).resolveRepositoryRoot(project)).toBe(
      path.resolve(
        '/tmp/ainative-repo-cache',
        'ainative-workspace-project-test-id',
      ),
    );
    expect((service as any).resolveWorktreeBaseDir(project)).toBe(
      path.resolve('/tmp/ainative-worktrees'),
    );
    expect((service as any).resolveGitWorktreePath(task, project)).toBe(
      path.resolve('/tmp/ainative-worktrees', `wk-${task.id}`),
    );
  });

  it('should prefer repoLocalPath over repo cache base dir', () => {
    const project = createProject(
      {},
      {
        repoLocalPath: '/tmp/ainative-fixed-repo',
        repoCacheBaseDir: '/tmp/ainative-repo-cache',
      },
    );

    expect((service as any).resolveRepositoryRoot(project)).toBe(
      path.resolve('/tmp/ainative-fixed-repo'),
    );
  });

  it('should normalize task branch to wk- prefix for worktree branch naming', () => {
    const project = createProject();

    expect(
      (service as any).resolveBranch(
        createTask({ gitBranch: 'feature/runtime-test' }),
        project,
      ),
    ).toBe('wk-feature/runtime-test');
    expect(
      (service as any).resolveBranch(
        createTask({ gitBranch: 'wk-existing' }),
        project,
      ),
    ).toBe('wk-existing');
  });

  it('should generate wk- prefixed fallback branch when task branch is empty', () => {
    const project = createProject({
      name: 'AINative Runtime Project',
    });
    const task = createTask({ gitBranch: null });

    expect((service as any).resolveBranch(task, project)).toBe(
      'wk-ainative-runtime-project-task-tes',
    );
  });

  it('should normalize and validate requested create worktree path under allowed root', async () => {
    const allowedRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-runtime-allowed-root-'),
    );
    createdDirectories.push(allowedRoot);
    const canonicalAllowedRoot = await fs.realpath(allowedRoot);
    const project = createProject(
      {},
      {
        worktreeAllowedRoot: allowedRoot,
      },
    );
    const requestedPath = path.join(canonicalAllowedRoot, 'task-create-1');

    const resolvedPath = await service.resolveAndValidateCreateWorktreePath(
      project,
      requestedPath,
    );

    expect(resolvedPath).toBe(path.resolve(requestedPath));
  });

  it('should reject requested create worktree path outside allowed root', async () => {
    const allowedRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-runtime-allowed-root-'),
    );
    createdDirectories.push(allowedRoot);
    const outsideRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-runtime-outside-root-'),
    );
    createdDirectories.push(outsideRoot);
    const project = createProject(
      {},
      {
        worktreeAllowedRoot: allowedRoot,
      },
    );

    await expect(
      service.resolveAndValidateCreateWorktreePath(
        project,
        path.join(outsideRoot, 'task-create-2'),
      ),
    ).rejects.toThrow('outside allowed root');
  });
});
