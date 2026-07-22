import { BadRequestException } from '@nestjs/common';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { GoalPlanItemStatus } from './dto/goal-plan-item-status.enum';
import { GoalsService } from './goals.service';

const createJwt = (): JwtPayloadType =>
  ({
    sub: 'user-1',
    iat: 1,
    exp: 9999999999,
  }) as JwtPayloadType;

const createGoal = () => ({
  id: 'goal-1',
  projectId: 'project-1',
  title: '需求',
  gitBranch: 'feature/goal-1',
  gitBaseBranch: 'main',
});

const createMergedGroup = () => ({
  id: 'group-1',
  title: '功能组 A',
  groupMergedIntoGoalAt: new Date('2026-05-11T10:00:00.000Z'),
  subTasks: [
    {
      id: 'sub-1',
      title: '子任务 A',
      status: GoalPlanItemStatus.branchMerged,
      taskId: 'task-1',
    },
  ],
});

const createWorkspaceProject = () => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  configJson: {
    subtreeMode: 'workspace-native',
    subRepos: [
      {
        prefix: 'app',
        url: 'git@gitlab.example.com:g/app.git',
        branch: 'main',
      },
    ],
  },
});

function createService(overrides?: {
  goalRepository?: Record<string, unknown>;
  projectsService?: Record<string, unknown>;
  taskRepository?: Record<string, unknown>;
  projectRepositoryWorkspaceService?: Record<string, unknown>;
  workspaceNativeDeployService?: Record<string, unknown>;
}) {
  const goalRepository = {
    findById: jest.fn().mockResolvedValue(createGoal()),
    listPlanItemsWithSubTasks: jest
      .fn()
      .mockResolvedValue([createMergedGroup()]),
    ...overrides?.goalRepository,
  };
  const projectsService = {
    assertProjectCapability: jest.fn().mockResolvedValue(undefined),
    findByIdInternal: jest.fn().mockResolvedValue(createWorkspaceProject()),
    ...overrides?.projectsService,
  };
  const taskRepository = {
    findByGoalId: jest.fn().mockResolvedValue([
      {
        id: 'task-1',
        title: '任务 A',
        status: TaskStatus.done,
      },
    ]),
    ...overrides?.taskRepository,
  };
  const projectRepositoryWorkspaceService = {
    checkoutBranch: jest.fn().mockResolvedValue(undefined),
    runWithProjectRepositoryLock: jest
      .fn()
      .mockImplementation(
        async (
          _projectId: string,
          _user: JwtPayloadType,
          _options: unknown,
          operation: (ctx: {
            project: ReturnType<typeof createWorkspaceProject>;
            repositoryRoot: string;
          }) => Promise<unknown>,
        ) =>
          operation({
            project: createWorkspaceProject(),
            repositoryRoot: '/tmp/project-repo',
          }),
      ),
    ensureBranchWorktree: jest
      .fn()
      .mockResolvedValue('/tmp/goal-branch-worktree'),
    ...overrides?.projectRepositoryWorkspaceService,
  };
  const workspaceNativeDeployService = {
    pushBranchToSubReposFromRoot: jest.fn().mockResolvedValue({
      success: true,
      message: '推送完成: 1 个子仓',
      subRepoPushResults: [
        { prefix: 'app', status: 'success', remoteBranch: 'feature/goal-1' },
      ],
    }),
    ...overrides?.workspaceNativeDeployService,
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
    {} as never,
    {} as never,
    {} as never,
    { findById: jest.fn() } as never,
    projectRepositoryWorkspaceService as never,
    workspaceNativeDeployService as never,
  );

  return {
    service,
    goalRepository,
    projectsService,
    taskRepository,
    projectRepositoryWorkspaceService,
    workspaceNativeDeployService,
  };
}

describe('GoalsService.pushDemandBranchToSubRepos', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject when any countable plan group is not merged into goal branch', async () => {
    const { service } = createService({
      goalRepository: {
        listPlanItemsWithSubTasks: jest.fn().mockResolvedValue([
          {
            ...createMergedGroup(),
            groupMergedIntoGoalAt: null,
          },
        ]),
      },
    });

    await expect(
      service.pushDemandBranchToSubRepos('goal-1', createJwt()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject when any materialized task is not done', async () => {
    const { service } = createService({
      taskRepository: {
        findByGoalId: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            title: '任务 A',
            status: TaskStatus.inProgress,
          },
        ]),
      },
    });

    await expect(
      service.pushDemandBranchToSubRepos('goal-1', createJwt()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject non workspace-native projects', async () => {
    const { service } = createService({
      projectsService: {
        findByIdInternal: jest.fn().mockResolvedValue({
          ...createWorkspaceProject(),
          configJson: {},
        }),
      },
    });

    await expect(
      service.pushDemandBranchToSubRepos('goal-1', createJwt()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject workspace-native projects without sub repositories', async () => {
    const { service } = createService({
      projectsService: {
        findByIdInternal: jest.fn().mockResolvedValue({
          ...createWorkspaceProject(),
          configJson: {
            subtreeMode: 'workspace-native',
            subRepos: [],
          },
        }),
      },
    });

    await expect(
      service.pushDemandBranchToSubRepos('goal-1', createJwt()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should push configured sub repositories from the demand branch worktree', async () => {
    const user = createJwt();
    const {
      service,
      projectRepositoryWorkspaceService,
      workspaceNativeDeployService,
    } = createService();

    const result = await service.pushDemandBranchToSubRepos('goal-1', user);

    expect(result.success).toBe(true);
    expect(
      projectRepositoryWorkspaceService.runWithProjectRepositoryLock,
    ).toHaveBeenCalledWith(
      'project-1',
      user,
      { syncRemote: true },
      expect.any(Function),
    );
    expect(
      projectRepositoryWorkspaceService.checkoutBranch,
    ).not.toHaveBeenCalled();
    expect(
      projectRepositoryWorkspaceService.ensureBranchWorktree,
    ).toHaveBeenCalledWith({
      project: createWorkspaceProject(),
      repositoryRoot: '/tmp/project-repo',
      branchName: 'feature/goal-1',
      namespace: 'goal-branches',
    });
    expect(
      workspaceNativeDeployService.pushBranchToSubReposFromRoot,
    ).toHaveBeenCalledWith({
      repositoryRoot: '/tmp/goal-branch-worktree',
      branch: 'feature/goal-1',
      subRepos: [
        {
          prefix: 'app',
          url: 'git@gitlab.example.com:g/app.git',
          branch: 'main',
        },
      ],
      requireCleanWorktree: true,
    });
  });
});
