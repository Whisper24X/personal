import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';

const user = {
  sub: 'user-1',
  iat: 1,
  exp: 9999999999,
} as JwtPayloadType;

describe('GoalsService.getPlanItemPrLink', () => {
  it('should return GitHub compare URL for project gitUrl and branches', async () => {
    const goalRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'goal-1',
        projectId: 'proj-1',
        gitBranch: 'feature/goal-1',
      }),
      findPlanItem: jest.fn().mockResolvedValue({
        id: 'item-1',
        gitBranch: 'feature/group-a',
      }),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({
        id: 'proj-1',
        gitUrl: 'https://github.com/org/repo.git',
      }),
    };
    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as GoalsMetricsService,
    );

    const out = await service.getPlanItemPrLink('goal-1', 'item-1', user);

    expect(out.url).toContain('github.com/org/repo/compare');
    expect(out.url).toContain('feature%2Fgoal-1');
    expect(out.url).toContain('feature%2Fgroup-a');
  });
});
