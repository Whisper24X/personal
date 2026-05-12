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
        operation: (ctx: { repositoryRoot: string }) => Promise<unknown>,
      ) => operation({ repositoryRoot: '/repo' }),
    ),
  };
  const projectDocsService = {
    createDoc: jest.fn().mockResolvedValue(undefined),
    updateDoc: jest.fn().mockResolvedValue(undefined),
    readDoc: jest.fn(),
    writeDocInRepositoryRoot: jest.fn(
      (_repositoryRoot: string, payload: { path: string }) => ({
        relativePath: payload.path,
        absolutePath: `/repo/docs/${payload.path}`,
      }),
    ),
  };
  const projectKnowledgeService = {
    executeProjectAgentPrompt: jest.fn(),
  };
  const gitService = {
    checkoutBranchInRepository: jest.fn().mockResolvedValue(undefined),
    commitPathsInRepositoryRootIfDirty: jest.fn().mockResolvedValue(true),
    pushBranchInRepository: jest.fn().mockResolvedValue(undefined),
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
      projectDocsService,
      projectKnowledgeService,
      gitService,
      goalsMetrics,
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
    projectKnowledgeService.executeProjectAgentPrompt.mockResolvedValue({
      success: true,
      stdout: createCodexNdjsonOutput({
        markdown,
        uncertainPoints: ['缺少品牌色规范'],
      }),
      stderr: '',
      exitCode: 0,
      signal: null,
      errorMessage: null,
    });

    const result = await service.generatePrd(
      goal.id,
      { overwrite: true } as never,
      currentUser,
    );

    expect(projectDocsService.writeDocInRepositoryRoot).toHaveBeenCalledWith(
      '/repo',
      { path: 'goals/goal-1/PRD.md', content: markdown },
    );
    expect(gitService.checkoutBranchInRepository).toHaveBeenCalledWith(
      '/repo',
      goal.gitBranch,
    );
    expect(gitService.commitPathsInRepositoryRootIfDirty).toHaveBeenCalledWith(
      '/repo',
      ['/repo/docs/goals/goal-1/PRD.md'],
      'docs(goal): generate PRD for goal-1',
      { name: 'ainative-user', email: 'user-1@ainative.local' },
    );
    expect(gitService.pushBranchInRepository).toHaveBeenCalledWith(
      '/repo',
      goal.gitBranch,
    );
    expect(result.markdownLength).toBe(markdown.length);
    expect(goalsMetrics.incrementPrdGeneration).toHaveBeenCalledWith(true);
  });

  it('should parse plan JSON from codex item completed agent message output', async () => {
    const {
      service,
      goalRepository,
      projectDocsService,
      projectKnowledgeService,
      gitService,
      goalsMetrics,
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
    projectDocsService.readDoc.mockResolvedValue({
      path: goal.prdDocPath,
      content: '# PRD',
    });
    projectKnowledgeService.executeProjectAgentPrompt.mockResolvedValue({
      success: true,
      stdout: createCodexNdjsonOutput({
        markdown,
        items,
      }),
      stderr: '',
      exitCode: 0,
      signal: null,
      errorMessage: null,
    });

    const result = await service.generatePlan(
      goal.id,
      { overwrite: true, granularity: 'standard' } as never,
      currentUser,
    );

    expect(projectDocsService.writeDocInRepositoryRoot).toHaveBeenCalledWith(
      '/repo',
      { path: 'goals/goal-1/task-plan.md', content: markdown },
    );
    expect(gitService.checkoutBranchInRepository).toHaveBeenCalledWith(
      '/repo',
      goal.gitBranch,
    );
    expect(gitService.commitPathsInRepositoryRootIfDirty).toHaveBeenCalledWith(
      '/repo',
      ['/repo/docs/goals/goal-1/task-plan.md'],
      'docs(goal): generate task plan for goal-1',
      { name: 'ainative-user', email: 'user-1@ainative.local' },
    );
    expect(gitService.pushBranchInRepository).toHaveBeenCalledWith(
      '/repo',
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
