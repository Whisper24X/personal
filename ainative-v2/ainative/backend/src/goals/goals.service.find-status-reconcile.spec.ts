import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { Goal } from './domain/goal';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalsMetricsService } from './goals-metrics.service';
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
  status: GoalStatus.inProgress,
  prdDocPath: 'goals/goal-1/PRD.md',
  planDocPath: 'goals/goal-1/task-plan.md',
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
    findMany: jest.fn(),
    completeGoalsWithAllPlanSubTasksMerged: jest
      .fn()
      .mockResolvedValue(undefined),
    listSourceDocs: jest.fn().mockResolvedValue([]),
    listPlanItemsWithSubTasks: jest.fn().mockResolvedValue([]),
    listTaskDependenciesForGoal: jest.fn().mockResolvedValue([]),
  };
  const projectsService = {
    assertProjectCapability: jest.fn().mockResolvedValue(undefined),
  };
  const taskRepository = {
    findByGoalId: jest.fn().mockResolvedValue([]),
  };
  const service = new GoalsService(
    goalRepository as never,
    projectsService as never,
    {} as never,
    {} as never,
    {} as never,
    taskRepository as never,
    {} as never,
    {} as never,
    {} as GoalsMetricsService,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, goalRepository, projectsService, taskRepository };
};

describe('GoalsService completed status reconciliation', () => {
  it('should reconcile completed goal status before returning detail', async () => {
    const { service, goalRepository, taskRepository } = createService();
    const goal = createGoal({ status: GoalStatus.inProgress });
    const completedGoal = { ...goal, status: GoalStatus.done };
    goalRepository.findById
      .mockResolvedValueOnce(goal)
      .mockResolvedValueOnce(completedGoal);
    taskRepository.findByGoalId.mockResolvedValue([
      {
        id: 'task-1',
        status: TaskStatus.done,
      },
    ]);

    const result = await service.findOne(goal.id, createJwt());

    expect(
      goalRepository.completeGoalsWithAllPlanSubTasksMerged,
    ).toHaveBeenCalledWith({ goalId: goal.id });
    expect(result.goal.status).toBe(GoalStatus.done);
    expect(result.progress.statusCounts[TaskStatus.done]).toBe(1);
  });

  it('should reconcile completed goal statuses before querying list', async () => {
    const { service, goalRepository } = createService();
    const goal = createGoal({ status: GoalStatus.done });
    goalRepository.findMany.mockResolvedValue([goal]);

    const result = await service.findAll(
      { projectId: 'project-1', status: GoalStatus.done } as never,
      createJwt(),
    );

    expect(
      goalRepository.completeGoalsWithAllPlanSubTasksMerged,
    ).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(goalRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        status: GoalStatus.done,
      }),
    );
    expect(result.data).toEqual([goal]);
  });
});
