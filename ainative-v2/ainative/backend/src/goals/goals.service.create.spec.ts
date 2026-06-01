import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalsService } from './goals.service';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

describe('GoalsService.create', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should generate short goal branches and persist the created branch name', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 31, 11, 52, 20, 454));

    const goalRepository = {
      create: jest.fn().mockImplementation((payload: any) => ({
        ...payload,
        summary: payload.summary ?? null,
        status: payload.status ?? GoalStatus.draft,
        prdDocPath: payload.prdDocPath ?? null,
        planDocPath: payload.planDocPath ?? null,
        defaultWorkflowTemplateId: payload.defaultWorkflowTemplateId ?? null,
        agentCliId: payload.agentCliId ?? null,
        agentCliConfigId: payload.agentCliConfigId ?? null,
        createdBy: payload.createdBy ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue(undefined),
    };
    const gitService = {
      createBranch: jest.fn().mockResolvedValue(undefined),
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
      {} as never,
      {} as never,
      {} as never,
      goalsMetrics as never,
    );

    const user = createJwt();
    const created = await service.create(
      {
        projectId: 'project-1',
        title: 'Goal title',
        gitBaseBranch: 'main',
        summary: 'Goal summary',
      } as never,
      user,
    );

    const createdBranch = gitService.createBranch.mock.calls[0]?.[1];

    expect(createdBranch).toMatch(/^feature\/goal-2603311152-[a-z0-9]{4}$/);
    expect(gitService.createBranch).toHaveBeenCalledWith(
      'project-1',
      createdBranch,
      'main',
      user,
    );
    expect(goalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        title: 'Goal title',
        gitBaseBranch: 'main',
        gitBranch: createdBranch,
        status: GoalStatus.draft,
        createdBy: user.sub,
      }),
    );
    expect(created.gitBranch).toBe(createdBranch);
    expect(goalsMetrics.incrementGoalCreated).toHaveBeenCalled();
  });
});
