import { BadRequestException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsMetricsService } from './goals-metrics.service';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalPlanItemStatus } from './dto/goal-plan-item-status.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

const baseGoal = {
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
  gitBranch: 'feature/goal-goal1branch',
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('GoalsService group dependsOnItemIds', () => {
  const setupPatch = (predTaskStatus: TaskStatus) => {
    const goalRepository = {
      findById: jest.fn(),
      findPlanSubTask: jest.fn(),
      findPlanItem: jest.fn(),
      listPlanItemsWithSubTasks: jest.fn(),
      updatePlanSubTask: jest.fn(),
    };
    const projectsService = {
      assertProjectCapability: jest.fn(),
    };
    const taskRepository = {
      findById: jest.fn(),
    };
    const tasksService = {};
    const gitService = {};
    const goalsMetrics = {} as GoalsMetricsService;

    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      {} as never,
      {} as never,
      gitService as never,
      taskRepository as never,
      tasksService as never,
      {} as never,
      goalsMetrics,
      {} as never,
    );

    const stA = {
      id: 'st-a1',
      goalPlanItemId: 'group-a',
      title: 'a1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: 'task-a1',
      status: GoalPlanItemStatus.taskCreated,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stB = {
      id: 'st-b1',
      goalPlanItemId: 'group-b',
      title: 'b1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: null,
      status: GoalPlanItemStatus.draft,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const groups = [
      {
        id: 'group-a',
        goalId: 'goal-1',
        title: 'Group A',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: [] as string[],
        itemOrder: 0,
        gitBranch: 'gb-a',
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [stA],
      },
      {
        id: 'group-b',
        goalId: 'goal-1',
        title: 'Group B',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: ['group-a'],
        itemOrder: 1,
        gitBranch: 'gb-b',
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [stB],
      },
    ];

    goalRepository.findById.mockResolvedValue(baseGoal);
    goalRepository.findPlanSubTask.mockResolvedValue(stB);
    goalRepository.findPlanItem.mockResolvedValue({
      id: 'group-b',
      goalId: 'goal-1',
      title: 'Group B',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnItemIds: ['group-a'],
      itemOrder: 1,
      gitBranch: 'gb-b',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    goalRepository.listPlanItemsWithSubTasks.mockResolvedValue(groups);
    taskRepository.findById.mockImplementation((id: string) => {
      if (id === 'task-a1') {
        return Promise.resolve({
          id: 'task-a1',
          title: 'Ta',
          status: predTaskStatus,
        });
      }
      return Promise.resolve(null);
    });
    const approvedB = { ...stB, status: GoalPlanItemStatus.approved };
    goalRepository.updatePlanSubTask.mockResolvedValue(approvedB);

    return {
      service,
      goalRepository,
      taskRepository,
      approvedB,
    };
  };

  it('should reject approve when predecessor group subtasks are not branch_merged', async () => {
    const { service, goalRepository } = setupPatch(TaskStatus.done);
    const user = createJwt();

    await expect(
      service.patchPlanSubTask(
        'goal-1',
        'st-b1',
        { status: GoalPlanItemStatus.approved },
        user,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(goalRepository.updatePlanSubTask).not.toHaveBeenCalled();
  });

  it('should allow approve when predecessor group subtasks are branch_merged', async () => {
    const { service, goalRepository, taskRepository, approvedB } = setupPatch(
      TaskStatus.done,
    );
    const user = createJwt();
    goalRepository.listPlanItemsWithSubTasks.mockImplementation(() => {
      const stA = {
        id: 'st-a1',
        goalPlanItemId: 'group-a',
        title: 'a1',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnSubTaskIds: [] as string[],
        itemOrder: 0,
        taskId: 'task-a1',
        status: GoalPlanItemStatus.branchMerged,
        workflowTemplateId: 'wf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const stB = {
        id: 'st-b1',
        goalPlanItemId: 'group-b',
        title: 'b1',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnSubTaskIds: [] as string[],
        itemOrder: 0,
        taskId: null,
        status: GoalPlanItemStatus.draft,
        workflowTemplateId: 'wf-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return [
        {
          id: 'group-a',
          goalId: 'goal-1',
          title: 'Group A',
          summary: null,
          acceptanceCriteria: null,
          suggestedPrompt: null,
          dependsOnItemIds: [] as string[],
          itemOrder: 0,
          gitBranch: 'gb-a',
          createdAt: new Date(),
          updatedAt: new Date(),
          subTasks: [stA],
        },
        {
          id: 'group-b',
          goalId: 'goal-1',
          title: 'Group B',
          summary: null,
          acceptanceCriteria: null,
          suggestedPrompt: null,
          dependsOnItemIds: ['group-a'],
          itemOrder: 1,
          gitBranch: 'gb-b',
          createdAt: new Date(),
          updatedAt: new Date(),
          subTasks: [stB],
        },
      ];
    });

    const next = await service.patchPlanSubTask(
      'goal-1',
      'st-b1',
      { status: GoalPlanItemStatus.approved },
      user,
    );

    expect(next).toEqual(approvedB);
    expect(goalRepository.updatePlanSubTask).toHaveBeenCalled();
    expect(taskRepository.findById).not.toHaveBeenCalled();
  });

  it('should create plan item branch when parent gitBranch is still null', async () => {
    const goalRepository = {
      findById: jest.fn(),
      findPlanSubTask: jest.fn(),
      findPlanItem: jest.fn(),
      listPlanItemsWithSubTasks: jest.fn(),
      updatePlanSubTask: jest.fn(),
      updatePlanItem: jest.fn(),
    };
    const gitService = {
      createBranch: jest
        .fn()
        .mockResolvedValue({ success: true, branch: 'feature/goal-x-g2' }),
    };
    const projectsService = { assertProjectCapability: jest.fn() };
    const taskRepository = { findById: jest.fn() };
    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      {} as never,
      {} as never,
      gitService as never,
      taskRepository as never,
      {} as never,
      {} as never,
      {} as GoalsMetricsService,
      {} as never,
    );

    const st = {
      id: 'st-x',
      goalPlanItemId: 'group-x',
      title: 'x1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: null,
      status: GoalPlanItemStatus.draft,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const groups = [
      {
        id: 'group-x',
        goalId: 'goal-1',
        title: 'GX',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: [] as string[],
        itemOrder: 1,
        gitBranch: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [st],
      },
    ];

    goalRepository.findById.mockResolvedValue(baseGoal);
    goalRepository.findPlanSubTask.mockResolvedValue(st);
    goalRepository.findPlanItem.mockResolvedValue({
      id: 'group-x',
      goalId: 'goal-1',
      title: 'GX',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnItemIds: [],
      itemOrder: 1,
      gitBranch: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    goalRepository.listPlanItemsWithSubTasks.mockResolvedValue(groups);
    goalRepository.updatePlanSubTask.mockResolvedValue({
      ...st,
      status: GoalPlanItemStatus.approved,
    });
    goalRepository.updatePlanItem.mockResolvedValue({
      id: 'group-x',
      goalId: 'goal-1',
      title: 'GX',
      gitBranch: 'feature/goal-goal1branch-g2',
      itemOrder: 1,
      dependsOnItemIds: [],
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const user = createJwt();
    await service.patchPlanSubTask(
      'goal-1',
      'st-x',
      { status: GoalPlanItemStatus.approved },
      user,
    );

    expect(gitService.createBranch).toHaveBeenCalledWith(
      'project-1',
      'feature/goal-goal1branch-g2',
      'feature/goal-goal1branch',
      user,
      { prepareRequirementBranchWorkingTree: true },
    );
    expect(goalRepository.updatePlanItem).toHaveBeenCalledWith(
      'goal-1',
      'group-x',
      {
        gitBranch: 'feature/goal-goal1branch-g2',
      },
    );
  });

  const setupMaterialize = (
    predSubStatus: GoalPlanItemStatus,
    options: {
      predecessorGroupMerged?: boolean;
      existingTasks?: Array<{ id: string; title: string; status: TaskStatus }>;
      targetStatus?: GoalPlanItemStatus;
      targetTaskId?: string | null;
    } = {},
  ) => {
    const goalRepository = {
      findById: jest.fn(),
      listPlanItemsWithSubTasks: jest.fn(),
      updatePlanSubTask: jest.fn(),
      update: jest.fn(),
      insertTaskDependency: jest.fn(),
    };
    const projectsService = {
      assertProjectCapability: jest.fn(),
    };
    const taskRepository = {
      findById: jest.fn(),
      findByGoalId: jest.fn().mockResolvedValue(options.existingTasks ?? []),
    };
    const tasksService = {
      create: jest.fn(),
    };
    const goalsMetrics = {
      incrementMaterializedTasks: jest.fn(),
    } as unknown as GoalsMetricsService;
    const gitService = {};

    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      {} as never,
      {} as never,
      gitService as never,
      taskRepository as never,
      tasksService as never,
      {} as never,
      goalsMetrics,
      {} as never,
    );

    const stA = {
      id: 'st-a1',
      goalPlanItemId: 'group-a',
      title: 'a1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: 'task-a1',
      status: predSubStatus,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stB = {
      id: 'st-b1',
      goalPlanItemId: 'group-b',
      title: 'b1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: options.targetTaskId ?? null,
      status: options.targetStatus ?? GoalPlanItemStatus.approved,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const groupsInitial = [
      {
        id: 'group-a',
        goalId: 'goal-1',
        title: 'Group A',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: [] as string[],
        itemOrder: 0,
        gitBranch: 'gb-a',
        groupMergedIntoGoalAt: options.predecessorGroupMerged
          ? new Date('2026-05-01T00:00:00.000Z')
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [stA],
      },
      {
        id: 'group-b',
        goalId: 'goal-1',
        title: 'Group B',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: ['group-a'],
        itemOrder: 1,
        gitBranch: 'gb-b',
        groupMergedIntoGoalAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [stB],
      },
    ];

    const stBAfter = {
      ...stB,
      taskId: 'task-b-new',
      status: GoalPlanItemStatus.taskCreated,
    };
    const groupsAfter = [
      { ...groupsInitial[0] },
      {
        ...groupsInitial[1],
        subTasks: [stBAfter],
      },
    ];

    goalRepository.findById.mockResolvedValue(baseGoal);
    goalRepository.listPlanItemsWithSubTasks
      .mockResolvedValueOnce(groupsInitial)
      .mockResolvedValueOnce(groupsAfter);
    taskRepository.findById.mockResolvedValue(null);
    tasksService.create.mockResolvedValue({ id: 'task-b-new' });
    goalRepository.updatePlanSubTask.mockResolvedValue(stBAfter);

    return { service, goalRepository, taskRepository, tasksService };
  };

  it('should reject materialize when predecessor group subtasks are not branch_merged', async () => {
    const { service, tasksService } = setupMaterialize(
      GoalPlanItemStatus.taskCreated,
    );
    const user = createJwt();

    await expect(
      service.materializeTasks('goal-1', { planSubTaskIds: ['st-b1'] }, user),
    ).rejects.toThrow(BadRequestException);

    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('should create task when predecessor group subtasks are branch_merged', async () => {
    const { service, tasksService, goalRepository } = setupMaterialize(
      GoalPlanItemStatus.branchMerged,
      { predecessorGroupMerged: true },
    );
    const user = createJwt();

    const out = await service.materializeTasks(
      'goal-1',
      { planSubTaskIds: ['st-b1'] },
      user,
    );

    expect(out.tasks).toEqual([
      { planSubTaskId: 'st-b1', taskId: 'task-b-new' },
    ]);
    expect(tasksService.create).toHaveBeenCalledWith(
      expect.objectContaining({ gitBaseBranch: 'gb-b' }),
      user,
    );
    expect(goalRepository.update).toHaveBeenCalledWith('goal-1', {
      status: GoalStatus.inProgress,
    });
  });

  it('should reject materialize when an existing task is not done', async () => {
    const { service, tasksService } = setupMaterialize(
      GoalPlanItemStatus.branchMerged,
      {
        predecessorGroupMerged: true,
        existingTasks: [
          { id: 'task-a1', title: 'Task A', status: TaskStatus.inProgress },
        ],
      },
    );

    await expect(
      service.materializeTasks(
        'goal-1',
        { planSubTaskIds: ['st-b1'] },
        createJwt(),
      ),
    ).rejects.toThrow('任务「Task A」尚未完成');

    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('should reject materialize when a done task is not branch_merged', async () => {
    const { service, tasksService } = setupMaterialize(
      GoalPlanItemStatus.completed,
      {
        predecessorGroupMerged: true,
        existingTasks: [
          { id: 'task-a1', title: 'Task A', status: TaskStatus.done },
        ],
      },
    );

    await expect(
      service.materializeTasks(
        'goal-1',
        { planSubTaskIds: ['st-b1'] },
        createJwt(),
      ),
    ).rejects.toThrow('任务「Task A」已完成但尚未合并分支');

    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('should reject materialize when another plan group branch is not merged into goal', async () => {
    const { service, tasksService } = setupMaterialize(
      GoalPlanItemStatus.branchMerged,
    );

    await expect(
      service.materializeTasks(
        'goal-1',
        { planSubTaskIds: ['st-b1'] },
        createJwt(),
      ),
    ).rejects.toThrow('功能组「Group A」分支尚未并入需求分支');

    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('should return existing task id without enforcing new-task blockers', async () => {
    const { service, taskRepository, tasksService } = setupMaterialize(
      GoalPlanItemStatus.branchMerged,
      {
        existingTasks: [
          { id: 'task-a1', title: 'Task A', status: TaskStatus.inProgress },
        ],
        targetStatus: GoalPlanItemStatus.taskCreated,
        targetTaskId: 'task-b-existing',
      },
    );

    const out = await service.materializeTasks(
      'goal-1',
      { planSubTaskIds: ['st-b1'] },
      createJwt(),
    );

    expect(out.tasks).toEqual([
      { planSubTaskId: 'st-b1', taskId: 'task-b-existing' },
    ]);
    expect(taskRepository.findByGoalId).not.toHaveBeenCalled();
    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('should reject approve when predecessor group branch is not merged into goal (creating plan item branch)', async () => {
    const goalRepository = {
      findById: jest.fn(),
      findPlanSubTask: jest.fn(),
      findPlanItem: jest.fn(),
      listPlanItemsWithSubTasks: jest.fn(),
      updatePlanSubTask: jest.fn(),
    };
    const projectsService = { assertProjectCapability: jest.fn() };
    const taskRepository = { findById: jest.fn() };
    const gitService = { createBranch: jest.fn() };
    const goalsMetrics = {} as GoalsMetricsService;
    const service = new GoalsService(
      goalRepository as never,
      projectsService as never,
      {} as never,
      {} as never,
      gitService as never,
      taskRepository as never,
      {} as never,
      {} as never,
      goalsMetrics,
      {} as never,
    );

    const stA = {
      id: 'st-a1',
      goalPlanItemId: 'group-a',
      title: 'a1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: 'task-a1',
      status: GoalPlanItemStatus.branchMerged,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stB = {
      id: 'st-b1',
      goalPlanItemId: 'group-b',
      title: 'b1',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnSubTaskIds: [] as string[],
      itemOrder: 0,
      taskId: null,
      status: GoalPlanItemStatus.draft,
      workflowTemplateId: 'wf-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const groups = [
      {
        id: 'group-a',
        goalId: 'goal-1',
        title: 'Group A',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: [] as string[],
        itemOrder: 0,
        gitBranch: 'gb-a',
        groupMergedIntoGoalAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [stA],
      },
      {
        id: 'group-b',
        goalId: 'goal-1',
        title: 'Group B',
        summary: null,
        acceptanceCriteria: null,
        suggestedPrompt: null,
        dependsOnItemIds: ['group-a'],
        itemOrder: 1,
        gitBranch: null,
        groupMergedIntoGoalAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subTasks: [stB],
      },
    ];

    goalRepository.findById.mockResolvedValue(baseGoal);
    goalRepository.findPlanSubTask.mockResolvedValue(stB);
    goalRepository.findPlanItem.mockResolvedValue({
      id: 'group-b',
      goalId: 'goal-1',
      title: 'Group B',
      summary: null,
      acceptanceCriteria: null,
      suggestedPrompt: null,
      dependsOnItemIds: ['group-a'],
      itemOrder: 1,
      gitBranch: null,
      groupMergedIntoGoalAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    goalRepository.listPlanItemsWithSubTasks.mockResolvedValue(groups);

    const user = createJwt();

    await expect(
      service.patchPlanSubTask(
        'goal-1',
        'st-b1',
        { status: GoalPlanItemStatus.approved },
        user,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(gitService.createBranch).not.toHaveBeenCalled();
    expect(goalRepository.updatePlanSubTask).not.toHaveBeenCalled();
  });
});
