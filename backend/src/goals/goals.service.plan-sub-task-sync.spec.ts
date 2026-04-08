import { BadRequestException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { GoalPlanItemStatus } from './dto/goal-plan-item-status.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

describe('GoalsService.syncPlanSubTaskStatusFromLinkedTask', () => {
  const createService = () => {
    const goalRepository = {
      syncPlanSubTaskStatusByLinkedTaskId: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    const service = new GoalsService(
      goalRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as GoalsMetricsService,
    );
    return { service, goalRepository };
  };

  it('should delegate isDone=true when task status is done', async () => {
    const { service, goalRepository } = createService();
    await service.syncPlanSubTaskStatusFromLinkedTask(
      'task-1',
      TaskStatus.done,
    );
    expect(
      goalRepository.syncPlanSubTaskStatusByLinkedTaskId,
    ).toHaveBeenCalledWith('task-1', true);
  });

  it('should delegate isDone=false when task status is not done', async () => {
    const { service, goalRepository } = createService();
    await service.syncPlanSubTaskStatusFromLinkedTask(
      'task-1',
      TaskStatus.inProgress,
    );
    expect(
      goalRepository.syncPlanSubTaskStatusByLinkedTaskId,
    ).toHaveBeenCalledWith('task-1', false);
  });
});

describe('GoalsService.patchPlanSubTask', () => {
  it('should reject manual completed status', async () => {
    const goalRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'goal-1',
        projectId: 'project-1',
      }),
      findPlanSubTask: jest.fn().mockResolvedValue({
        id: 'st-1',
        goalPlanItemId: 'item-1',
        status: GoalPlanItemStatus.taskCreated,
      }),
      updatePlanSubTask: jest.fn(),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue(undefined),
    };
    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as GoalsMetricsService,
    );

    await expect(
      service.patchPlanSubTask(
        'goal-1',
        'st-1',
        { status: GoalPlanItemStatus.completed },
        createJwt(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(goalRepository.updatePlanSubTask).not.toHaveBeenCalled();
  });
});
