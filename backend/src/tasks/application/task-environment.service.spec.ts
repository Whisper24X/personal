import { ConflictException } from '@nestjs/common';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskStatus } from '../dto/task-status.enum';
import {
  TaskEnvironmentStage,
  TaskEnvironmentStatus,
} from '../dto/task-environment.dto';
import { TaskEnvironmentService } from './task-environment.service';

const createTask = () => ({
  id: 'task-1',
  projectId: 'project-1',
  businessLineId: 'business-line-1',
  mode: TaskMode.conversation,
  title: 'task title',
  prompt: 'task prompt',
  status: TaskStatus.todo,
  gitBranch: 'feature/task-1',
  gitBaseBranch: 'main',
  gitWorktree: 'wk-task-1',
  configJson: null,
  createdBy: 'user-1',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  deletedAt: null,
});

const createProject = () => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative Project',
  description: null,
  gitUrl: 'git@example.com:group/repo.git',
  defaultBranch: 'main',
  configJson: null,
  createdAt: new Date('2026-04-08T00:00:00.000Z'),
  updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  deletedAt: null,
});

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createService = () => {
  const task = createTask();
  const project = createProject();
  const taskAccessService = {
    assertCanAccessTaskProject: jest.fn().mockResolvedValue({ task, project }),
    getProjectByIdOrThrow: jest.fn().mockResolvedValue(project),
  };
  const taskRuntimeOrchestrator = {
    prepareTaskRuntime: jest.fn().mockResolvedValue({ task, project }),
  };
  const taskLogService = {
    appendLog: jest.fn().mockResolvedValue(undefined),
  };
  const taskLogRepository = {
    findLatestByTaskId: jest.fn().mockResolvedValue([]),
  };
  const taskRepository = {
    findById: jest.fn().mockResolvedValue(task),
  };
  const projectExecutionSlotRepository = {
    claimSlotWithinLimit: jest.fn(),
  };
  const containerExecutionConfig = {
    getSlotTtlMs: jest.fn().mockReturnValue(5_000),
    getMaxContainersPerProject: jest.fn().mockReturnValue(2),
  };
  const containerOrchestration = {
    inspectTaskContainer: jest.fn().mockResolvedValue(null),
    ensureContainer: jest.fn().mockResolvedValue({
      containerId: 'container-1',
    }),
  };

  const service = new TaskEnvironmentService(
    taskAccessService as never,
    taskRuntimeOrchestrator as never,
    taskLogService as never,
    taskLogRepository as never,
    taskRepository as never,
    projectExecutionSlotRepository as never,
    containerExecutionConfig as never,
    containerOrchestration as never,
  );

  return {
    service,
    task,
    project,
    taskAccessService,
    taskRuntimeOrchestrator,
    taskLogService,
    taskLogRepository,
    taskRepository,
    projectExecutionSlotRepository,
    containerExecutionConfig,
    containerOrchestration,
  };
};

describe('TaskEnvironmentService', () => {
  it('should fail direct environment start when the project container limit is reached', async () => {
    const {
      service,
      task,
      projectExecutionSlotRepository,
      containerOrchestration,
    } = createService();
    const currentUser = createCurrentUser();

    projectExecutionSlotRepository.claimSlotWithinLimit.mockResolvedValue(
      'limit_reached',
    );

    try {
      await service.startEnvironment(task.id, currentUser as never);
      throw new Error('expected startEnvironment to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe('当前项目已达到容器启动上限（2）');
    }

    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).toHaveBeenCalledWith('project-1', 'task-1', 5_000, 2);
    expect(containerOrchestration.ensureContainer).not.toHaveBeenCalled();
  });

  it('should treat an existing task slot as idempotent and continue startup', async () => {
    const {
      service,
      task,
      project,
      projectExecutionSlotRepository,
      containerOrchestration,
    } = createService();
    const currentUser = createCurrentUser();

    containerOrchestration.inspectTaskContainer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        containerId: 'container-1',
        running: true,
        accessMetadata: null,
      });
    projectExecutionSlotRepository.claimSlotWithinLimit.mockResolvedValue(
      'existing',
    );

    const result = await service.startEnvironment(
      task.id,
      currentUser as never,
    );

    expect(
      projectExecutionSlotRepository.claimSlotWithinLimit,
    ).toHaveBeenCalledWith(project.id, task.id, 5_000, 2);
    expect(containerOrchestration.ensureContainer).toHaveBeenCalledWith({
      task,
      project,
      worktreePath: 'wk-task-1',
      trackProjectSlot: true,
    });
    expect(result.status).toBe(TaskEnvironmentStatus.ready);
    expect(result.stage).toBe(TaskEnvironmentStage.ready);
  });
});
