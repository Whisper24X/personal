import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';
import { GoalStatus } from './dto/goal-status.enum';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

describe('GoalsService.remove', () => {
  const createService = () => {
    const goalRepository = {
      findById: jest.fn(),
      softRemove: jest.fn(),
      deleteSourceDocsAndPlanItemsByGoalId: jest.fn(),
    };
    const projectsService = {
      assertProjectCapability: jest.fn(),
    };
    const projectDocsService = {
      removeGoalDocsSubtree: jest.fn(),
    };
    const taskRepository = {
      findByGoalId: jest.fn(),
    };
    const tasksService = {
      remove: jest.fn(),
    };
    const goalsMetrics = {} as GoalsMetricsService;
    const gitService = {
      deleteLocalBranch: jest.fn().mockResolvedValue(undefined),
    };

    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      projectDocsService as never,
      {} as never,
      gitService as never,
      taskRepository as never,
      tasksService as never,
      {} as never,
      goalsMetrics,
    );

    return {
      service,
      goalRepository,
      projectsService,
      projectDocsService,
      taskRepository,
      tasksService,
      gitService,
    };
  };

  it('should delete tasks, goal docs subtree, child rows, then soft-remove goal', async () => {
    const {
      service,
      goalRepository,
      projectDocsService,
      taskRepository,
      tasksService,
      gitService,
    } = createService();

    goalRepository.findById.mockResolvedValue({
      id: 'goal-1',
      projectId: 'project-1',
      title: 'G',
      summary: null,
      status: GoalStatus.planned,
      prdDocPath: null,
      planDocPath: null,
      defaultWorkflowTemplateId: null,
      agentCliId: null,
      agentCliConfigId: null,
      gitBaseBranch: 'main',
      gitBranch: 'feature/goal-x',
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    taskRepository.findByGoalId.mockResolvedValue([
      { id: 'task-a' },
      { id: 'task-b' },
    ] as never);

    const user = createJwt();
    await service.remove('goal-1', user);

    expect(tasksService.remove).toHaveBeenCalledTimes(2);
    expect(tasksService.remove).toHaveBeenNthCalledWith(1, 'task-a', user);
    expect(tasksService.remove).toHaveBeenNthCalledWith(2, 'task-b', user);
    expect(gitService.deleteLocalBranch).toHaveBeenCalledWith(
      'project-1',
      'feature/goal-x',
      user,
    );
    expect(projectDocsService.removeGoalDocsSubtree).toHaveBeenCalledWith(
      'project-1',
      'goal-1',
      user,
    );
    expect(
      goalRepository.deleteSourceDocsAndPlanItemsByGoalId,
    ).toHaveBeenCalledWith('goal-1');
    expect(goalRepository.softRemove).toHaveBeenCalledWith('goal-1');
  });

  it('should still remove docs and goal when there are no tasks', async () => {
    const {
      service,
      goalRepository,
      projectDocsService,
      taskRepository,
      tasksService,
      gitService,
    } = createService();

    goalRepository.findById.mockResolvedValue({
      id: 'goal-2',
      projectId: 'project-2',
      title: 'G',
      summary: null,
      status: GoalStatus.draft,
      prdDocPath: null,
      planDocPath: null,
      defaultWorkflowTemplateId: null,
      agentCliId: null,
      agentCliConfigId: null,
      gitBaseBranch: 'main',
      gitBranch: 'feature/goal-y',
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    taskRepository.findByGoalId.mockResolvedValue([]);

    const user = createJwt();
    await service.remove('goal-2', user);

    expect(tasksService.remove).not.toHaveBeenCalled();
    expect(gitService.deleteLocalBranch).toHaveBeenCalledWith(
      'project-2',
      'feature/goal-y',
      user,
    );
    expect(projectDocsService.removeGoalDocsSubtree).toHaveBeenCalledWith(
      'project-2',
      'goal-2',
      user,
    );
    expect(goalRepository.softRemove).toHaveBeenCalledWith('goal-2');
  });
});
