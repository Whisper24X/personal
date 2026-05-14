import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Goal } from './domain/goal';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalsService } from './goals.service';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

const createCodexNdjsonOutput = (payload: Record<string, unknown>): string => {
  return [
    '{"type":"thread.started","thread_id":"thread-1"}',
    '{"type":"turn.started"}',
    `{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":${JSON.stringify(
      JSON.stringify(payload),
    )}}}`,
    '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}',
  ].join('\n');
};

const createGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  projectId: 'project-1',
  title: '优化登录页',
  summary: '优化后端登录页的 UI 配色与信息层级',
  status: GoalStatus.draft,
  prdDocPath: null,
  planDocPath: null,
  defaultWorkflowTemplateId: null,
  agentCliId: 'codex',
  agentCliConfigId: 'cfg-1',
  createdBy: 'user-1',
  gitBaseBranch: 'main',
  gitBranch: 'feature/goal-2604081145-abcd',
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createService = () => {
  let repositoryLockDepth = 0;
  const goalRepository = {
    findById: jest.fn(),
    listSourceDocs: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    replacePlanItems: jest.fn().mockResolvedValue(undefined),
  };
  const projectsService = {
    assertProjectCapability: jest.fn().mockResolvedValue(undefined),
    runWithProjectRepositoryLock: jest.fn(
      async (
        _projectId: string,
        _currentUser: JwtPayloadType,
        _options: unknown,
        operation: (ctx: {
          project: { id: string };
          repositoryRoot: string;
        }) => Promise<unknown>,
      ) => {
        repositoryLockDepth += 1;
        try {
          return await operation({
            project: { id: 'project-1' },
            repositoryRoot: '/repo',
          });
        } finally {
          repositoryLockDepth -= 1;
        }
      },
    ),
  };
  const projectDocsService = {
    createDoc: jest.fn().mockResolvedValue(undefined),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    readDoc: jest.fn(),
    readDocInRepositoryRoot: jest.fn(),
    writeDocInRepositoryRoot: jest.fn(
      (_repositoryRoot: string, payload: { path: string }) => ({
        relativePath: payload.path,
        absolutePath: `${_repositoryRoot}/docs/${payload.path}`,
      }),
    ),
  };
  const projectKnowledgeService = {
    executeProjectAgentPrompt: jest.fn(),
    executeProjectAgentPromptPrepared: jest.fn(),
  };
  const gitService = {
    checkoutBranchInRepository: jest.fn().mockResolvedValue(undefined),
    cleanupForeignUntrackedGoalDirs: jest.fn().mockResolvedValue(undefined),
    commitPathsInRepositoryRootIfDirty: jest.fn().mockResolvedValue(true),
    readStatusForPathsInRepositoryRoot: jest.fn().mockResolvedValue(''),
    pushBranchInRepository: jest.fn().mockResolvedValue(undefined),
    pushRepositoryHeadToBranch: jest.fn().mockResolvedValue(undefined),
    runInTemporaryBranchWorktree: jest.fn(
      async (
        _repositoryRoot: string,
        _branch: string,
        operation: (worktreeRoot: string) => Promise<unknown>,
      ) => operation('/repo-worktree'),
    ),
  };
  const taskRepository = {};
  const taskProvisioningService = {};
  const goalSourceDocsService = {
    goalInputDirHasAnyFile: jest.fn().mockResolvedValue(false),
  };
  const goalsMetrics = {
    incrementPrdGeneration: jest.fn(),
    incrementPlanGeneration: jest.fn(),
    incrementGoalCreated: jest.fn(),
  };

  const service = new GoalsService(
    goalRepository as never,
    projectsService as never,
    projectDocsService as never,
    projectKnowledgeService as never,
    gitService as never,
    taskRepository as never,
    taskProvisioningService as never,
    goalSourceDocsService as never,
    goalsMetrics as never,
  );

  return {
    service,
    goalRepository,
    projectsService,
    projectDocsService,
    projectKnowledgeService,
    gitService,
    goalSourceDocsService,
    goalsMetrics,
    getRepositoryLockDepth: () => repositoryLockDepth,
  };
};

describe('GoalsService generation parsing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should parse PRD JSON from codex item completed agent message output', async () => {
    const {
      service,
      goalRepository,
      projectsService,
      projectDocsService,
      projectKnowledgeService,
      gitService,
      goalsMetrics,
      getRepositoryLockDepth,
    } = createService();
    const currentUser = createJwt();
    const goal = createGoal();
    const markdown = '# PRD\n\n## 1. 背景\n- 优化登录页视觉层级';

    goalRepository.findById.mockResolvedValue(goal);
    goalRepository.update.mockResolvedValue({
      ...goal,
      prdDocPath: 'docs/goals/goal-1/PRD.md',
      status: GoalStatus.prdGenerated,
    });
    projectKnowledgeService.executeProjectAgentPromptPrepared.mockImplementation(
      () => {
        expect(getRepositoryLockDepth()).toBe(0);
        return {
          success: true,
          stdout: createCodexNdjsonOutput({
            markdown,
            uncertainPoints: ['缺少品牌色规范'],
          }),
          stderr: '',
          exitCode: 0,
          signal: null,
          errorMessage: null,
        };
      },
    );

    const result = await service.generatePrd(
      goal.id,
      { overwrite: true } as never,
      currentUser,
    );

    expect(projectDocsService.writeDocInRepositoryRoot).toHaveBeenCalledWith(
      '/repo-worktree',
      { path: 'goals/goal-1/PRD.md', content: markdown },
    );
    expect(gitService.checkoutBranchInRepository).not.toHaveBeenCalled();
    expect(gitService.runInTemporaryBranchWorktree).toHaveBeenCalledWith(
      '/repo',
      goal.gitBranch,
      expect.any(Function),
    );
    expect(gitService.cleanupForeignUntrackedGoalDirs).toHaveBeenCalledWith(
      '/repo-worktree',
      goal.id,
    );
    expect(gitService.cleanupForeignUntrackedGoalDirs).toHaveBeenCalledTimes(1);
    expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalledTimes(
      2,
    );
    expect(gitService.commitPathsInRepositoryRootIfDirty).toHaveBeenCalledWith(
      '/repo-worktree',
      ['/repo-worktree/docs/goals/goal-1/PRD.md'],
      'docs(goal): generate PRD for goal-1',
      { name: 'ainative-user', email: 'user-1@ainative.local' },
    );
    expect(gitService.pushRepositoryHeadToBranch).toHaveBeenCalledWith(
      '/repo-worktree',
      goal.gitBranch,
    );
    expect(result.markdownLength).toBe(markdown.length);
    expect(goalsMetrics.incrementPrdGeneration).toHaveBeenCalledWith(true);
  });

  it('should parse plan JSON from codex item completed agent message output', async () => {
    const {
      service,
      goalRepository,
      projectsService,
      projectDocsService,
      projectKnowledgeService,
      gitService,
      goalsMetrics,
      getRepositoryLockDepth,
    } = createService();
    const currentUser = createJwt();
    const goal = createGoal({
      status: GoalStatus.prdGenerated,
      prdDocPath: 'goals/goal-1/PRD.md',
    });
    const markdown = '# Task Plan\n\n## 1. 功能组';
    const items = [
      {
        localId: 'item-1',
        title: '登录页视觉改版',
        summary: '统一主色与强调色',
        acceptanceCriteria: '登录页主视觉与强调色统一且可读性达标',
        suggestedPrompt: '优化登录页视觉样式，保持交互逻辑不变',
        subTasks: [
          {
            subLocalId: 'sub-1',
            title: '调整登录卡片与按钮配色',
            summary: '优化卡片背景、边框与按钮状态色',
            acceptanceCriteria: '按钮与卡片在亮色背景下具备足够对比度',
            suggestedPrompt: '调整登录卡片与按钮的背景、边框、主次按钮颜色',
          },
        ],
      },
    ];

    goalRepository.findById.mockResolvedValue(goal);
    goalRepository.update.mockResolvedValue({
      ...goal,
      planDocPath: 'goals/goal-1/task-plan.md',
      status: GoalStatus.planned,
    });
    projectDocsService.readDocInRepositoryRoot.mockImplementation(() => {
      expect(getRepositoryLockDepth()).toBe(1);
      return {
        path: goal.prdDocPath,
        content: '# PRD',
      };
    });
    projectKnowledgeService.executeProjectAgentPromptPrepared.mockImplementation(
      () => {
        expect(getRepositoryLockDepth()).toBe(0);
        return {
          success: true,
          stdout: createCodexNdjsonOutput({
            markdown,
            items,
          }),
          stderr: '',
          exitCode: 0,
          signal: null,
          errorMessage: null,
        };
      },
    );

    const result = await service.generatePlan(
      goal.id,
      { overwrite: true, granularity: 'standard' } as never,
      currentUser,
    );

    expect(projectDocsService.writeDocInRepositoryRoot).toHaveBeenCalledWith(
      '/repo-worktree',
      { path: 'goals/goal-1/task-plan.md', content: markdown },
    );
    expect(gitService.checkoutBranchInRepository).not.toHaveBeenCalled();
    expect(gitService.runInTemporaryBranchWorktree).toHaveBeenCalledTimes(2);
    expect(gitService.cleanupForeignUntrackedGoalDirs).toHaveBeenCalledWith(
      '/repo-worktree',
      goal.id,
    );
    expect(gitService.cleanupForeignUntrackedGoalDirs).toHaveBeenCalledTimes(1);
    expect(projectsService.runWithProjectRepositoryLock).toHaveBeenCalledTimes(
      2,
    );
    expect(gitService.commitPathsInRepositoryRootIfDirty).toHaveBeenCalledWith(
      '/repo-worktree',
      ['/repo-worktree/docs/goals/goal-1/task-plan.md'],
      'docs(goal): generate task plan for goal-1',
      { name: 'ainative-user', email: 'user-1@ainative.local' },
    );
    expect(gitService.pushRepositoryHeadToBranch).toHaveBeenCalledWith(
      '/repo-worktree',
      goal.gitBranch,
    );
    expect(goalRepository.replacePlanItems).toHaveBeenCalledWith(
      goal.id,
      expect.arrayContaining([
        expect.objectContaining({
          title: '登录页视觉改版',
        }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          title: '调整登录卡片与按钮配色',
        }),
      ]),
    );
    expect(result.itemCount).toBe(1);
    expect(result.subTaskCount).toBe(1);
    expect(goalsMetrics.incrementPlanGeneration).toHaveBeenCalledWith(true);
  });
});
