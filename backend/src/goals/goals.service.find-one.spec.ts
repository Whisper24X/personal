import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { Goal } from './domain/goal';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalsService } from './goals.service';

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
  summary: '优化后端登录页的 UI 配色与信息层级',
  status: GoalStatus.prdGenerated,
  prdDocPath: 'goals/goal-1/PRD.md',
  planDocPath: null,
  defaultWorkflowTemplateId: null,
  agentCliId: null,
  agentCliConfigId: null,
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
    listPlanItemsWithSubTasks: jest.fn().mockResolvedValue([]),
    listTaskDependenciesForGoal: jest.fn().mockResolvedValue([]),
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
  const gitService = {
    checkoutBranchInRepository: jest.fn().mockResolvedValue(undefined),
    cleanupForeignUntrackedGoalDirs: jest.fn().mockResolvedValue(undefined),
  };
  const taskRepository = {
    findByGoalId: jest.fn().mockResolvedValue([]),
  };
  const goalsMetrics = {
    incrementGoalCreated: jest.fn(),
  };

  const service = new GoalsService(
    goalRepository as never,
    projectsService as never,
    {} as never,
    {} as never,
    gitService as never,
    taskRepository as never,
    {} as never,
    {} as never,
    goalsMetrics as never,
  );

  return {
    service,
    goalRepository,
    projectsService,
    gitService,
    taskRepository,
  };
};

describe('GoalsService.findOne', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not checkout goal branch before returning detail', async () => {
    const {
      service,
      goalRepository,
      projectsService,
      gitService,
      taskRepository,
    } = createService();
    const currentUser = createJwt();
    const goal = createGoal();
    taskRepository.findByGoalId.mockResolvedValue([
      {
        id: 'task-1',
        status: TaskStatus.done,
      },
    ]);
    goalRepository.findById.mockResolvedValue(goal);

    const result = await service.findOne(goal.id, currentUser);

    expect(projectsService.runWithProjectRepositoryLock).not.toHaveBeenCalled();
    expect(gitService.checkoutBranchInRepository).not.toHaveBeenCalled();
    expect(gitService.cleanupForeignUntrackedGoalDirs).not.toHaveBeenCalled();
    expect(goalRepository.listSourceDocs).toHaveBeenCalledWith(goal.id);
    expect(result.goal).toBe(goal);
    expect(result.progress.statusCounts[TaskStatus.done]).toBe(1);
  });

  it('should skip checkout when goal has no git branch', async () => {
    const { service, goalRepository, projectsService, gitService } =
      createService();
    const currentUser = createJwt();
    const goal = createGoal({ gitBranch: '' });
    goalRepository.findById.mockResolvedValue(goal);

    await service.findOne(goal.id, currentUser);

    expect(projectsService.runWithProjectRepositoryLock).not.toHaveBeenCalled();
    expect(gitService.checkoutBranchInRepository).not.toHaveBeenCalled();
    expect(gitService.cleanupForeignUntrackedGoalDirs).not.toHaveBeenCalled();
    expect(goalRepository.listSourceDocs).toHaveBeenCalledWith(goal.id);
  });
});
