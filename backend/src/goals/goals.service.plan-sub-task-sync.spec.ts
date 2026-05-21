import { BadRequestException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { GoalPlanItemStatus } from './dto/goal-plan-item-status.enum';
import { GoalStatus } from './dto/goal-status.enum';
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
      {} as never,
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
  const createBranchMergedService = (
    goalStatus: GoalStatus,
    planItems: Array<{
      id: string;
      subTasks: Array<{
        id: string;
        status: GoalPlanItemStatus;
        dependsOnSubTaskIds?: string[];
      }>;
    }>,
  ) => {
    const goalRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'goal-1',
        projectId: 'project-1',
        status: goalStatus,
      }),
      findPlanSubTask: jest.fn().mockResolvedValue({
        id: 'st-1',
        goalPlanItemId: 'item-1',
        status: GoalPlanItemStatus.completed,
        taskId: 'task-1',
      }),
      listPlanItemsWithSubTasks: jest.fn().mockResolvedValue(planItems),
      update: jest.fn().mockResolvedValue({
        id: 'goal-1',
        projectId: 'project-1',
        status: GoalStatus.done,
      }),
      updatePlanSubTask: jest.fn().mockResolvedValue({
        id: 'st-1',
        goalPlanItemId: 'item-1',
        status: GoalPlanItemStatus.branchMerged,
        taskId: 'task-1',
      }),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        status: TaskStatus.done,
      }),
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
    );
    return { service, goalRepository };
  };

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
      {} as never,
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

  it('should allow manual branch_merged when subtask is completed and linked task is done', async () => {
    const goalRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'goal-1',
        projectId: 'project-1',
      }),
      findPlanSubTask: jest.fn().mockResolvedValue({
        id: 'st-1',
        goalPlanItemId: 'item-1',
        status: GoalPlanItemStatus.completed,
        taskId: 'task-1',
      }),
      listPlanItemsWithSubTasks: jest.fn().mockResolvedValue([]),
      updatePlanSubTask: jest.fn().mockResolvedValue({
        id: 'st-1',
        goalPlanItemId: 'item-1',
        status: GoalPlanItemStatus.branchMerged,
        taskId: 'task-1',
      }),
    };
    const projectsService = {
      assertProjectCapability: jest.fn().mockResolvedValue(undefined),
    };
    const taskRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        status: TaskStatus.done,
      }),
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
    );

    const next = await service.patchPlanSubTask(
      'goal-1',
      'st-1',
      { status: GoalPlanItemStatus.branchMerged },
      createJwt(),
    );

    expect(next.status).toBe(GoalPlanItemStatus.branchMerged);
    expect(goalRepository.updatePlanSubTask).toHaveBeenCalledWith(
      'goal-1',
      'st-1',
      expect.objectContaining({ status: GoalPlanItemStatus.branchMerged }),
    );
  });

  it('should mark goal done when all non-cancelled subtasks are branch_merged', async () => {
    const { service, goalRepository } = createBranchMergedService(
      GoalStatus.inProgress,
      [
        {
          id: 'item-1',
          subTasks: [
            {
              id: 'st-1',
              status: GoalPlanItemStatus.branchMerged,
              dependsOnSubTaskIds: [],
            },
            {
              id: 'st-2',
              status: GoalPlanItemStatus.branchMerged,
              dependsOnSubTaskIds: [],
            },
          ],
        },
      ],
    );

    await service.patchPlanSubTask(
      'goal-1',
      'st-1',
      { status: GoalPlanItemStatus.branchMerged },
      createJwt(),
    );

    expect(goalRepository.update).toHaveBeenCalledWith('goal-1', {
      status: GoalStatus.done,
    });
  });

  it('should not mark goal done while any non-cancelled subtask is not branch_merged', async () => {
    const { service, goalRepository } = createBranchMergedService(
      GoalStatus.inProgress,
      [
        {
          id: 'item-1',
          subTasks: [
            {
              id: 'st-1',
              status: GoalPlanItemStatus.branchMerged,
              dependsOnSubTaskIds: [],
            },
            {
              id: 'st-2',
              status: GoalPlanItemStatus.completed,
              dependsOnSubTaskIds: [],
            },
          ],
        },
      ],
    );

    await service.patchPlanSubTask(
      'goal-1',
      'st-1',
      { status: GoalPlanItemStatus.branchMerged },
      createJwt(),
    );

    expect(goalRepository.update).not.toHaveBeenCalled();
  });

  it('should ignore cancelled subtasks when marking goal done', async () => {
    const { service, goalRepository } = createBranchMergedService(
      GoalStatus.inProgress,
      [
        {
          id: 'item-1',
          subTasks: [
            {
              id: 'st-1',
              status: GoalPlanItemStatus.branchMerged,
              dependsOnSubTaskIds: [],
            },
            {
              id: 'st-2',
              status: GoalPlanItemStatus.cancelled,
              dependsOnSubTaskIds: [],
            },
          ],
        },
      ],
    );

    await service.patchPlanSubTask(
      'goal-1',
      'st-1',
      { status: GoalPlanItemStatus.branchMerged },
      createJwt(),
    );

    expect(goalRepository.update).toHaveBeenCalledWith('goal-1', {
      status: GoalStatus.done,
    });
  });

  it('should not overwrite archived goal status', async () => {
    const { service, goalRepository } = createBranchMergedService(
      GoalStatus.archived,
      [
        {
          id: 'item-1',
          subTasks: [
            {
              id: 'st-1',
              status: GoalPlanItemStatus.branchMerged,
              dependsOnSubTaskIds: [],
            },
          ],
        },
      ],
    );

    await service.patchPlanSubTask(
      'goal-1',
      'st-1',
      { status: GoalPlanItemStatus.branchMerged },
      createJwt(),
    );

    expect(goalRepository.update).not.toHaveBeenCalled();
  });
});
