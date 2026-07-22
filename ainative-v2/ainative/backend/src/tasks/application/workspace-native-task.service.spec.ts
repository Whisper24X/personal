import { mkdtemp, readFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { WorkspaceNativeTaskService } from './workspace-native-task.service';
import { computeSubRepoFingerprint } from '../../git/sub-repo.types';

describe('WorkspaceNativeTaskService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'ainative-ws-task-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createProject = (configJson: Record<string, unknown> = {}) => ({
    id: 'project-1',
    businessLineId: 'business-line-1',
    name: 'Yanxue Test',
    description: null,
    gitUrl: 'git@example.com:workspace/ainative-workspace.git',
    defaultBranch: 'main',
    configJson,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: null,
  });

  it('should use business line runner cache when project runner config is missing', async () => {
    const cachedOrchestration = {
      services: [
        {
          name: 'yanxue',
          workdir: 'yanxue',
          command: 'go run ./cmd/server',
          port: 8000,
        },
      ],
      routes: [
        {
          path: '/api/',
          service: 'yanxue',
          upstreamPath: '/',
        },
      ],
      preview: {
        service: 'yanxue',
        path: '/api/',
      },
    };
    const subRepos = [
      {
        prefix: 'yanxue',
        url: 'git@example.com:backend/yanxue.git',
        branch: 'main',
      },
    ];
    const subRepoFingerprint = computeSubRepoFingerprint(subRepos);
    const workspaceRepoService = {
      getBaseBranch: jest.fn().mockReturnValue('main'),
      createTaskWorktree: jest.fn().mockImplementation(
        async (
          _repositoryRoot,
          _worktreeBaseDir,
          taskBranch,
          _subRepos,
          options,
        ) => {
          await options.beforeCommit(tempDir, {
            yanxue: 'abc123',
          });
          return {
            taskBranch,
            worktreePath: tempDir,
            snapshotCommitSha: 'snapshot-sha',
            subRepoHeads: {
              yanxue: 'abc123',
            },
            pushDeferred: false,
          };
        },
      ),
      pushTaskBranch: jest.fn(),
      removeTaskWorktree: jest.fn(),
    };
    const projectWorkspacePaths = {
      resolveRepositoryRoot: jest.fn().mockReturnValue('/tmp/repo'),
      resolveWorktreeBaseDir: jest.fn().mockReturnValue('/tmp/worktrees'),
    };
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-line-1',
        configJson: {
          subRepos,
          runnerConfigStatus: 'ready',
          runnerConfigCache: cachedOrchestration,
          runnerConfigCacheMeta: {
            source: 'ai-full-scan',
            generatedAt: '2026-06-01T00:00:00.000Z',
            coverageStatus: 'valid',
            verificationStatus: 'passed',
            subRepoFingerprint,
          },
        },
      }),
    };
    const service = new WorkspaceNativeTaskService(
      workspaceRepoService as never,
      projectWorkspacePaths as never,
      businessLineRepository as never,
    );

    const result = await service.initializeWorkspaceNativeTask(
      createProject({
        subtreeMode: 'workspace-native',
      }) as never,
      'task-1',
    );

    expect(result.configJsonPatch.runner).toEqual(
      expect.objectContaining({
        status: 'ready',
        source: 'businessLineCache',
        configSnapshot: expect.objectContaining({
          services: cachedOrchestration.services,
          generatedMeta: expect.objectContaining({
            source: 'ai-full-scan',
          }),
        }),
      }),
    );
    await expect(
      readFile(path.join(tempDir, 'ainative.runner.json'), 'utf-8'),
    ).resolves.toContain('"yanxue"');
    await expect(
      readFile(
        path.join(tempDir, '.ainative', 'runner', 'ainative.runner.json'),
        'utf-8',
      ),
    ).resolves.toContain('"yanxue"');
  });

  it('should use project runner config when generated meta is incomplete but structure is compatible', async () => {
    const subRepos = [
      {
        prefix: 'yanxue',
        url: 'git@example.com:backend/yanxue.git',
        branch: 'main',
      },
    ];
    const workspaceRepoService = {
      getBaseBranch: jest.fn().mockReturnValue('main'),
      createTaskWorktree: jest.fn().mockImplementation(
        async (
          _repositoryRoot,
          _worktreeBaseDir,
          taskBranch,
          _subRepos,
          options,
        ) => {
          await options.beforeCommit(tempDir, {
            yanxue: 'abc123',
          });
          return {
            taskBranch,
            worktreePath: tempDir,
            snapshotCommitSha: 'snapshot-sha',
            subRepoHeads: {
              yanxue: 'abc123',
            },
            pushDeferred: false,
          };
        },
      ),
      pushTaskBranch: jest.fn(),
      removeTaskWorktree: jest.fn(),
    };
    const projectWorkspacePaths = {
      resolveRepositoryRoot: jest.fn().mockReturnValue('/tmp/repo'),
      resolveWorktreeBaseDir: jest.fn().mockReturnValue('/tmp/worktrees'),
    };
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-line-1',
        configJson: {
          subRepos,
        },
      }),
    };
    const service = new WorkspaceNativeTaskService(
      workspaceRepoService as never,
      projectWorkspacePaths as never,
      businessLineRepository as never,
    );

    const result = await service.initializeWorkspaceNativeTask(
      createProject({
        subtreeMode: 'workspace-native',
        containerRuntime: {
          runnerOrchestration: {
            services: [
              {
                name: 'yanxue',
                workdir: 'yanxue',
                command: 'go run ./cmd/server',
                port: 8000,
              },
            ],
          },
        },
      }) as never,
      'task-1',
    );

    expect(result.configJsonPatch.runner).toEqual(
      expect.objectContaining({
        status: 'ready',
        source: 'projectConfig',
      }),
    );
    await expect(
      readFile(path.join(tempDir, 'ainative.runner.json'), 'utf-8'),
    ).resolves.toContain('"yanxue"');
  });

  it('should use project runner config when runner fingerprint mismatches current task code but subrepo structure matches', async () => {
    const subRepos = [
      {
        prefix: 'yanxue',
        url: 'git@example.com:backend/yanxue.git',
        branch: 'main',
      },
    ];
    const subRepoFingerprint = computeSubRepoFingerprint(subRepos);
    const workspaceRepoService = {
      getBaseBranch: jest.fn().mockReturnValue('main'),
      createTaskWorktree: jest.fn().mockImplementation(
        async (
          _repositoryRoot,
          _worktreeBaseDir,
          taskBranch,
          _subRepos,
          options,
        ) => {
          await options.beforeCommit(tempDir, {
            yanxue: 'abc123',
          });
          return {
            taskBranch,
            worktreePath: tempDir,
            snapshotCommitSha: 'snapshot-sha',
            subRepoHeads: {
              yanxue: 'abc123',
            },
            pushDeferred: false,
          };
        },
      ),
      pushTaskBranch: jest.fn(),
      removeTaskWorktree: jest.fn(),
    };
    const projectWorkspacePaths = {
      resolveRepositoryRoot: jest.fn().mockReturnValue('/tmp/repo'),
      resolveWorktreeBaseDir: jest.fn().mockReturnValue('/tmp/worktrees'),
    };
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-line-1',
        configJson: {
          subRepos,
        },
      }),
    };
    const service = new WorkspaceNativeTaskService(
      workspaceRepoService as never,
      projectWorkspacePaths as never,
      businessLineRepository as never,
    );

    const result = await service.initializeWorkspaceNativeTask(
      createProject({
        subtreeMode: 'workspace-native',
        containerRuntime: {
          runnerOrchestration: {
            services: [
              {
                name: 'yanxue',
                workdir: 'yanxue',
                command: 'go run ./cmd/server',
                port: 8000,
              },
            ],
            routes: [
              {
                path: '/api/',
                action: 'proxy',
                match: 'prefix',
                service: 'yanxue',
              },
            ],
            preview: {
              service: 'yanxue',
              path: '/api/',
            },
            generatedMeta: {
              source: 'runner-generation-project',
              generatedAt: '2026-06-28T00:00:00.000Z',
              subRepoFingerprint,
              coverageStatus: 'valid',
              verificationStatus: 'passed',
              runnerFingerprint: 'runner-fp-other',
            },
          },
        },
      }) as never,
      'task-1',
    );

    expect(result.configJsonPatch.runner).toEqual(
      expect.objectContaining({
        status: 'ready',
        source: 'projectConfig',
      }),
    );
  });

  it.each(['generated', 'partial', 'needsManualReview', 'verifying'])(
    'should not use business line runner cache when status is %s',
    async (status) => {
      const cachedOrchestration = {
        services: [
          {
            name: 'yanxue',
            workdir: 'yanxue',
            command: 'go run ./cmd/server',
            port: 8000,
          },
        ],
      };
      const subRepos = [
        {
          prefix: 'yanxue',
          url: 'git@example.com:backend/yanxue.git',
          branch: 'main',
        },
      ];
      const subRepoFingerprint = computeSubRepoFingerprint(subRepos);
      const workspaceRepoService = {
        getBaseBranch: jest.fn().mockReturnValue('main'),
        createTaskWorktree: jest.fn().mockImplementation(
          async (
            _repositoryRoot,
            _worktreeBaseDir,
            taskBranch,
            _subRepos,
            options,
          ) => {
            await options.beforeCommit(tempDir, {
              yanxue: 'abc123',
            });
            return {
              taskBranch,
              worktreePath: tempDir,
              snapshotCommitSha: 'snapshot-sha',
              subRepoHeads: {
                yanxue: 'abc123',
              },
              pushDeferred: false,
            };
          },
        ),
        pushTaskBranch: jest.fn(),
        removeTaskWorktree: jest.fn(),
      };
      const projectWorkspacePaths = {
        resolveRepositoryRoot: jest.fn().mockReturnValue('/tmp/repo'),
        resolveWorktreeBaseDir: jest.fn().mockReturnValue('/tmp/worktrees'),
      };
      const businessLineRepository = {
        findById: jest.fn().mockResolvedValue({
          id: 'business-line-1',
          configJson: {
            subRepos,
            runnerConfigStatus: status,
            runnerConfigCache: cachedOrchestration,
            runnerConfigCacheMeta: {
              source: 'ai-full-scan',
              generatedAt: '2026-06-01T00:00:00.000Z',
              coverageStatus: 'valid',
              verificationStatus: 'passed',
              subRepoFingerprint,
            },
          },
        }),
      };
      const service = new WorkspaceNativeTaskService(
        workspaceRepoService as never,
        projectWorkspacePaths as never,
        businessLineRepository as never,
      );

      const result = await service.initializeWorkspaceNativeTask(
        createProject({
          subtreeMode: 'workspace-native',
        }) as never,
        'task-1',
      );

      expect(result.configJsonPatch.runner).toEqual(
        expect.objectContaining({
          status: 'unavailable',
          source: 'unavailableStaleCache',
        }),
      );
    },
  );

  it('should not use project runner config when subrepo fingerprint mismatches current structure', async () => {
    const subRepos = [
      {
        prefix: 'yanxue',
        url: 'git@example.com:backend/yanxue.git',
        branch: 'main',
      },
    ];
    const workspaceRepoService = {
      getBaseBranch: jest.fn().mockReturnValue('main'),
      createTaskWorktree: jest.fn().mockImplementation(
        async (
          _repositoryRoot,
          _worktreeBaseDir,
          taskBranch,
          _subRepos,
          options,
        ) => {
          await options.beforeCommit(tempDir, {
            yanxue: 'abc123',
          });
          return {
            taskBranch,
            worktreePath: tempDir,
            snapshotCommitSha: 'snapshot-sha',
            subRepoHeads: {
              yanxue: 'abc123',
            },
            pushDeferred: false,
          };
        },
      ),
      pushTaskBranch: jest.fn(),
      removeTaskWorktree: jest.fn(),
    };
    const projectWorkspacePaths = {
      resolveRepositoryRoot: jest.fn().mockReturnValue('/tmp/repo'),
      resolveWorktreeBaseDir: jest.fn().mockReturnValue('/tmp/worktrees'),
    };
    const businessLineRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'business-line-1',
        configJson: {
          subRepos,
        },
      }),
    };
    const service = new WorkspaceNativeTaskService(
      workspaceRepoService as never,
      projectWorkspacePaths as never,
      businessLineRepository as never,
    );

    const result = await service.initializeWorkspaceNativeTask(
      createProject({
        subtreeMode: 'workspace-native',
        containerRuntime: {
          runnerOrchestration: {
            services: [
              {
                name: 'yanxue',
                workdir: 'yanxue',
                command: 'go run ./cmd/server',
                port: 8000,
              },
            ],
            generatedMeta: {
              source: 'runner-generation-project',
              generatedAt: '2026-06-28T00:00:00.000Z',
              subRepoFingerprint: 'different-structure',
              coverageStatus: 'valid',
              verificationStatus: 'passed',
            },
          },
        },
      }) as never,
      'task-1',
    );

    expect(result.configJsonPatch.runner).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        source: 'unavailableGenerationFailed',
        error: expect.stringContaining('子仓结构不匹配'),
      }),
    );
  });
});
