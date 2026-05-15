import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import extractZip from 'extract-zip';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Goal } from './domain/goal';
import { GoalSourceDocType } from './dto/goal-source-doc-type.enum';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalSourceDocsService } from './goal-source-docs.service';

jest.mock('extract-zip', () => jest.fn());

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

const createGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  projectId: 'project-1',
  title: '优化登录页',
  summary: '优化登录页体验',
  status: GoalStatus.draft,
  prdDocPath: null,
  planDocPath: null,
  defaultWorkflowTemplateId: null,
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  createdBy: 'user-1',
  gitBaseBranch: 'main',
  gitBranch: 'feature/goal-branch',
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createService = (worktreeRoot = '/repo-worktree') => {
  const goalRepository = {
    findById: jest.fn(),
    insertSourceDoc: jest.fn((payload) => ({
      id: `source-${payload.projectDocPath}`,
      createdAt: new Date('2026-04-08T00:00:00.000Z'),
      ...payload,
    })),
    listSourceDocs: jest.fn().mockResolvedValue([]),
    removeSourceDoc: jest.fn().mockResolvedValue(undefined),
  };
  const projectsService = {
    runWithProjectRepositoryLock: jest.fn(
      async (
        _projectId: string,
        _currentUser: JwtPayloadType,
        _options: unknown,
        operation: (ctx: { repositoryRoot: string }) => Promise<unknown>,
      ) => operation({ repositoryRoot: '/repo' }),
    ),
  };
  const projectDocsService = {
    normalizeProjectDocPath: jest.fn((value: string) => value.trim()),
    readDoc: jest.fn(),
    createDoc: jest.fn(),
    updateDoc: jest.fn(),
    removeDoc: jest.fn(),
    resolveProjectDocAbsolutePath: jest.fn(
      (docsRoot: string, relativePath: string) =>
        path.resolve(docsRoot, relativePath),
    ),
    writeDocInRepositoryRoot: jest.fn(
      async (
        repositoryRoot: string,
        payload: { path: string; content?: string; contentBase64?: string },
      ) => {
        const absolutePath = path.join(repositoryRoot, 'docs', payload.path);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        if (payload.contentBase64 != null) {
          await fs.writeFile(
            absolutePath,
            Buffer.from(payload.contentBase64, 'base64'),
          );
        } else {
          await fs.writeFile(absolutePath, payload.content ?? '', 'utf-8');
        }
        return { relativePath: payload.path, absolutePath };
      },
    ),
  };
  const gitService = {
    cleanupForeignUntrackedGoalDirs: jest.fn().mockResolvedValue(undefined),
    commitPathsInRepositoryRootIfDirty: jest.fn().mockResolvedValue(true),
    filterIgnoredPathsInRepositoryRoot: jest.fn(
      (_repositoryRoot: string, absolutePaths: string[]) =>
        Promise.resolve({
          keptAbsolutePaths: absolutePaths,
          ignoredRelativePaths: [] as string[],
        }),
    ),
    pushRepositoryHeadToBranch: jest.fn().mockResolvedValue(undefined),
    readStatusForPathsInRepositoryRoot: jest.fn().mockResolvedValue(''),
    runInTemporaryBranchWorktree: jest.fn(
      async (
        _repositoryRoot: string,
        _branch: string,
        operation: (root: string) => Promise<unknown>,
      ) => operation(worktreeRoot),
    ),
  };

  const service = new GoalSourceDocsService(
    goalRepository as never,
    projectsService as never,
    projectDocsService as never,
    gitService as never,
  );

  return {
    service,
    goalRepository,
    projectsService,
    projectDocsService,
    gitService,
  };
};

describe('GoalSourceDocsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should upload source docs through the goal branch worktree', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-source-upload-'),
    );
    try {
      const {
        service,
        goalRepository,
        projectDocsService,
        projectsService,
        gitService,
      } = createService(tempRoot);
      const goal = createGoal();
      const user = createJwt();

      const result = await service.uploadSourceDoc(
        goal,
        {
          projectDocPath: 'goals/goal-1/input/req.md',
          docType: GoalSourceDocType.requirement,
          sortOrder: 1,
        },
        Buffer.from('# Req'),
        user,
      );

      expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalledWith(
        goal.projectId,
        user,
        { syncRemote: true },
        expect.any(Function),
      );
      expect(gitService.runInTemporaryBranchWorktree).toHaveBeenCalledWith(
        '/repo',
        goal.gitBranch,
        expect.any(Function),
      );
      expect(projectDocsService.writeDocInRepositoryRoot).toHaveBeenCalledWith(
        tempRoot,
        {
          path: 'goals/goal-1/input/req.md',
          contentBase64: Buffer.from('# Req').toString('base64'),
        },
      );
      expect(
        gitService.commitPathsInRepositoryRootIfDirty,
      ).toHaveBeenCalledWith(
        tempRoot,
        [path.join(tempRoot, 'docs/goals/goal-1/input/req.md')],
        'docs(goal): upload source doc for goal-1',
        { name: 'ainative-user', email: 'user-1@ainative.local' },
      );
      expect(gitService.pushRepositoryHeadToBranch).toHaveBeenCalledWith(
        tempRoot,
        goal.gitBranch,
      );
      expect(goalRepository.insertSourceDoc).toHaveBeenCalledWith({
        goalId: goal.id,
        projectDocPath: 'goals/goal-1/input/req.md',
        docType: GoalSourceDocType.requirement,
        sortOrder: 1,
      });
      expect(result.projectDocPath).toBe('goals/goal-1/input/req.md');
      expect(projectDocsService.createDoc).not.toHaveBeenCalled();
      expect(projectDocsService.updateDoc).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('should reject ignored single source docs and clean the written file', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-source-ignored-upload-'),
    );
    try {
      const { service, goalRepository, gitService } = createService(tempRoot);
      const goal = createGoal();
      const ignoredPath = path.join(
        tempRoot,
        'docs/goals/goal-1/input/tsconfig.app.tsbuildinfo',
      );
      gitService.filterIgnoredPathsInRepositoryRoot.mockResolvedValueOnce({
        keptAbsolutePaths: [],
        ignoredRelativePaths: [
          'docs/goals/goal-1/input/tsconfig.app.tsbuildinfo',
        ],
      });

      await expect(
        service.uploadSourceDoc(
          goal,
          {
            projectDocPath: 'goals/goal-1/input/tsconfig.app.tsbuildinfo',
            docType: GoalSourceDocType.reference,
            sortOrder: 1,
          },
          Buffer.from('cache'),
          createJwt(),
        ),
      ).rejects.toThrow('该资料路径被 Git ignore 规则忽略');

      await expect(fs.stat(ignoredPath)).rejects.toThrow();
      expect(goalRepository.insertSourceDoc).not.toHaveBeenCalled();
      expect(
        gitService.commitPathsInRepositoryRootIfDirty,
      ).not.toHaveBeenCalled();
      expect(gitService.pushRepositoryHeadToBranch).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('should unpack zip files inside the goal branch worktree', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-source-'),
    );
    try {
      const zipPath = path.join(tempRoot, 'docs/goals/goal-1/input/source.zip');
      await fs.mkdir(path.dirname(zipPath), { recursive: true });
      await fs.writeFile(zipPath, Buffer.from('zip'));
      (extractZip as jest.Mock).mockImplementation(
        async (_zipPath: string, options: { dir: string }) => {
          const target = path.join(options.dir, 'req.md');
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, '# Req', 'utf-8');
        },
      );

      const { service, goalRepository, projectDocsService, gitService } =
        createService(tempRoot);
      const goal = createGoal();
      goalRepository.listSourceDocs.mockResolvedValue([
        {
          id: 'zip-row',
          goalId: goal.id,
          projectDocPath: 'goals/goal-1/input/source.zip',
          docType: GoalSourceDocType.prototype,
          sortOrder: 2,
          createdAt: new Date(),
        },
      ]);

      const result = await service.unpackInputZip(
        goal,
        { projectDocPath: 'goals/goal-1/input/source.zip' },
        createJwt(),
      );

      expect(result.extractedFileCount).toBe(1);
      expect(result.paths).toEqual([
        expect.stringMatching(/^goals\/goal-1\/input\/.+-unpacked\/req\.md$/),
      ]);
      expect(projectDocsService.createDoc).not.toHaveBeenCalled();
      expect(projectDocsService.updateDoc).not.toHaveBeenCalled();
      expect(projectDocsService.removeDoc).not.toHaveBeenCalled();
      expect(
        gitService.commitPathsInRepositoryRootIfDirty,
      ).toHaveBeenCalledWith(
        tempRoot,
        expect.arrayContaining([
          expect.stringMatching(
            /docs\/goals\/goal-1\/input\/.+-unpacked\/req\.md$/,
          ),
          zipPath,
        ]),
        'docs(goal): unpack source docs for goal-1',
        { name: 'ainative-user', email: 'user-1@ainative.local' },
      );
      expect(gitService.pushRepositoryHeadToBranch).toHaveBeenCalledWith(
        tempRoot,
        goal.gitBranch,
      );
      expect(goalRepository.insertSourceDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          goalId: goal.id,
          docType: GoalSourceDocType.requirement,
          sortOrder: 3,
        }),
      );
      expect(goalRepository.removeSourceDoc).toHaveBeenCalledWith(
        'zip-row',
        goal.id,
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('should upload and unpack zip without committing the zip itself', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-source-upload-zip-'),
    );
    try {
      (extractZip as jest.Mock).mockImplementation(
        async (_zipPath: string, options: { dir: string }) => {
          const target = path.join(options.dir, 'req.md');
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, '# Req', 'utf-8');
        },
      );

      const { service, goalRepository, gitService } = createService(tempRoot);
      const goal = createGoal();

      const result = await service.uploadAndUnpackInputZip(
        goal,
        {
          projectDocPath: 'goals/goal-1/input/source.zip',
          docType: GoalSourceDocType.prototype,
          sortOrder: 0,
        },
        Buffer.from('zip'),
        createJwt(),
      );

      expect(result.extractedFileCount).toBe(1);
      expect(result.paths).toEqual([
        expect.stringMatching(/^goals\/goal-1\/input\/.+-unpacked\/req\.md$/),
      ]);
      expect(
        gitService.commitPathsInRepositoryRootIfDirty,
      ).toHaveBeenCalledWith(
        tempRoot,
        [
          expect.stringMatching(
            /docs\/goals\/goal-1\/input\/.+-unpacked\/req\.md$/,
          ),
        ],
        'docs(goal): unpack source docs for goal-1',
        { name: 'ainative-user', email: 'user-1@ainative.local' },
      );
      expect(goalRepository.insertSourceDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          goalId: goal.id,
          docType: GoalSourceDocType.requirement,
          projectDocPath: expect.stringMatching(
            /^goals\/goal-1\/input\/.+-unpacked\/req\.md$/,
          ),
        }),
      );
      expect(goalRepository.removeSourceDoc).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('should skip ignored files when unpacking zip source docs', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-source-skip-ignored-'),
    );
    try {
      const zipPath = path.join(tempRoot, 'docs/goals/goal-1/input/source.zip');
      await fs.mkdir(path.dirname(zipPath), { recursive: true });
      await fs.writeFile(zipPath, Buffer.from('zip'));
      (extractZip as jest.Mock).mockImplementation(
        async (_zipPath: string, options: { dir: string }) => {
          await fs.writeFile(
            path.join(options.dir, 'req.md'),
            '# Req',
            'utf-8',
          );
          await fs.writeFile(
            path.join(options.dir, 'tsconfig.app.tsbuildinfo'),
            'cache',
            'utf-8',
          );
        },
      );

      const { service, goalRepository, gitService } = createService(tempRoot);
      const goal = createGoal();
      gitService.filterIgnoredPathsInRepositoryRoot.mockImplementationOnce(
        (_repositoryRoot: string, absolutePaths: string[]) =>
          Promise.resolve({
            keptAbsolutePaths: absolutePaths.filter((absolutePath) =>
              absolutePath.endsWith('/req.md'),
            ),
            ignoredRelativePaths: [
              'docs/goals/goal-1/input/unpacked/tsconfig.app.tsbuildinfo',
            ],
          }),
      );

      const result = await service.unpackInputZip(
        goal,
        { projectDocPath: 'goals/goal-1/input/source.zip' },
        createJwt(),
      );

      expect(result.paths).toEqual([
        expect.stringMatching(/^goals\/goal-1\/input\/.+-unpacked\/req\.md$/),
      ]);
      expect(goalRepository.insertSourceDoc).toHaveBeenCalledTimes(1);
      expect(goalRepository.insertSourceDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          projectDocPath: expect.stringMatching(
            /^goals\/goal-1\/input\/.+-unpacked\/req\.md$/,
          ),
        }),
      );
      expect(
        gitService.commitPathsInRepositoryRootIfDirty,
      ).toHaveBeenCalledWith(
        tempRoot,
        [
          expect.stringMatching(
            /docs\/goals\/goal-1\/input\/.+-unpacked\/req\.md$/,
          ),
          zipPath,
        ],
        'docs(goal): unpack source docs for goal-1',
        { name: 'ainative-user', email: 'user-1@ainative.local' },
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('should reject unpacked zip when all source docs are ignored', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-goal-source-all-ignored-'),
    );
    try {
      const zipPath = path.join(tempRoot, 'docs/goals/goal-1/input/source.zip');
      await fs.mkdir(path.dirname(zipPath), { recursive: true });
      await fs.writeFile(zipPath, Buffer.from('zip'));
      (extractZip as jest.Mock).mockImplementation(
        async (_zipPath: string, options: { dir: string }) => {
          await fs.writeFile(
            path.join(options.dir, 'tsconfig.app.tsbuildinfo'),
            'cache',
            'utf-8',
          );
        },
      );

      const { service, goalRepository, gitService } = createService(tempRoot);
      const goal = createGoal();
      gitService.filterIgnoredPathsInRepositoryRoot.mockResolvedValueOnce({
        keptAbsolutePaths: [],
        ignoredRelativePaths: [
          'docs/goals/goal-1/input/unpacked/tsconfig.app.tsbuildinfo',
        ],
      });

      await expect(
        service.unpackInputZip(
          goal,
          { projectDocPath: 'goals/goal-1/input/source.zip' },
          createJwt(),
        ),
      ).rejects.toThrow('可能全部是缓存/构建产物');

      await expect(fs.stat(zipPath)).resolves.toBeTruthy();
      expect(goalRepository.insertSourceDoc).not.toHaveBeenCalled();
      expect(
        gitService.commitPathsInRepositoryRootIfDirty,
      ).not.toHaveBeenCalled();
      expect(gitService.pushRepositoryHeadToBranch).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
