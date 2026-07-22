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
      listPlanItems: jest.fn().mockResolvedValue([]),
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
    const taskProvisioningService = {
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
      taskProvisioningService as never,
      {} as never,
      goalsMetrics,
      {
        branchIncludesTopLevelPrefixes: jest.fn(),
        embedSubReposOntoBranch: jest.fn(),
      } as never,
      {} as never,
      {} as never,
    );

    return {
      service,
      goalRepository,
      projectsService,
      projectDocsService,
      taskRepository,
      taskProvisioningService,
      gitService,
    };
  };

  it('should delete plan rows before tasks, then docs subtree, then soft-remove goal', async () => {
    const {
      service,
      goalRepository,
      projectDocsService,
      taskRepository,
      taskProvisioningService,
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
    goalRepository.listPlanItems.mockResolvedValue([
      {
        id: 'item-1',
        goalId: 'goal-1',
        title: 'Group',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: [],
        itemOrder: 0,
        gitBranch: 'feature/plan-group-a',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const user = createJwt();
    await service.remove('goal-1', user);

    expect(
      goalRepository.listPlanItems.mock.invocationCallOrder[0],
    ).toBeLessThan(
      goalRepository.deleteSourceDocsAndPlanItemsByGoalId.mock
        .invocationCallOrder[0],
    );
    expect(
      goalRepository.deleteSourceDocsAndPlanItemsByGoalId.mock
        .invocationCallOrder[0],
    ).toBeLessThan(taskProvisioningService.remove.mock.invocationCallOrder[0]);
    expect(
      goalRepository.deleteSourceDocsAndPlanItemsByGoalId,
    ).toHaveBeenCalledWith('goal-1');
    expect(taskProvisioningService.remove).toHaveBeenCalledTimes(2);
    expect(taskProvisioningService.remove).toHaveBeenNthCalledWith(
      1,
      'task-a',
      user,
      { skipPlanConsistencyCheck: true },
    );
    expect(taskProvisioningService.remove).toHaveBeenNthCalledWith(
      2,
      'task-b',
      user,
      { skipPlanConsistencyCheck: true },
    );
    expect(gitService.deleteLocalBranch).toHaveBeenCalledTimes(2);
    expect(gitService.deleteLocalBranch).toHaveBeenCalledWith(
      'project-1',
      'feature/goal-x',
      user,
    );
    expect(gitService.deleteLocalBranch).toHaveBeenCalledWith(
      'project-1',
      'feature/plan-group-a',
      user,
    );
    expect(projectDocsService.removeGoalDocsSubtree).toHaveBeenCalledWith(
      'project-1',
      'goal-1',
      user,
    );
    expect(goalRepository.softRemove).toHaveBeenCalledWith('goal-1');
  });

  it('should still remove docs and goal when there are no tasks', async () => {
    const {
      service,
      goalRepository,
      projectDocsService,
      taskRepository,
      taskProvisioningService,
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

    expect(
      goalRepository.deleteSourceDocsAndPlanItemsByGoalId,
    ).toHaveBeenCalledWith('goal-2');
    expect(taskProvisioningService.remove).not.toHaveBeenCalled();
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
