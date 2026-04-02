import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { Task } from './domain/task';
import { TaskMode } from './dto/task-mode.enum';
import { TaskStatus } from './dto/task-status.enum';
import { TaskWorkspaceContextCacheService } from './application/task-workspace-context-cache.service';
import { TaskRuntimeService } from './task-runtime.service';
import { TasksService } from './tasks.service';
import { TaskWorkspaceService } from './task-workspace.service';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  goalId: null,
  businessLineId: 'business-line-1',
  mode: TaskMode.workflow,
  title: 'Task workspace test',
  prompt: null,
  status: TaskStatus.inProgress,
  gitBranch: 'feature/task-workspace-test',
  gitBaseBranch: 'main',
  gitWorktree: 'wk-task-workspace-test',
  configJson: null,
  createdBy: 'user-1',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-04-02T00:00:00.000Z'),
  updatedAt: new Date('2026-04-02T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  businessLineId: 'business-line-1',
  name: 'AINative Task Workspace',
  description: null,
  gitUrl: 'git@example.com:group/ainative.git',
  defaultBranch: 'main',
  configJson: null,
  createdAt: new Date('2026-04-02T00:00:00.000Z'),
  updatedAt: new Date('2026-04-02T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const currentUser: JwtPayloadType = {
  sub: 'user-1',
  roles: ['user'],
  iat: 1,
  exp: 2,
};

describe('TaskWorkspaceService', () => {
  let workspaceRoot: string;
  let tasksService: Pick<TasksService, 'assertCanAccessTaskProject'>;
  let taskRuntimeService: Pick<TaskRuntimeService, 'resolveTaskWorktreePath'>;
  let service: TaskWorkspaceService;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ainative-task-workspace-'),
    );
    await fs.mkdir(path.join(workspaceRoot, 'dir'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'README.md'), '# test\n');

    tasksService = {
      assertCanAccessTaskProject: jest.fn().mockResolvedValue({
        task: createTask(),
        project: createProject(),
      }),
    };
    taskRuntimeService = {
      resolveTaskWorktreePath: jest.fn().mockReturnValue(workspaceRoot),
    };
    service = new TaskWorkspaceService(
      tasksService as TasksService,
      taskRuntimeService as TaskRuntimeService,
      new TaskWorkspaceContextCacheService(),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it('should reuse the canonical workspace root for root tree requests', async () => {
    const realpathSpy = jest.spyOn(fs, 'realpath');
    const statSpy = jest.spyOn(fs, 'stat');

    const result = await service.getWorkspaceTree(
      'task-1',
      { path: '.' },
      currentUser,
    );

    expect(result).toEqual({
      cwd: '.',
      entries: [
        {
          name: 'dir',
          path: 'dir',
          isDir: true,
        },
        {
          name: 'README.md',
          path: 'README.md',
          isDir: false,
        },
      ],
    });
    expect(realpathSpy).toHaveBeenCalledTimes(1);
    expect(realpathSpy).toHaveBeenCalledWith(workspaceRoot);
    expect(statSpy).not.toHaveBeenCalled();
  });

  it('should reuse cached workspace context across consecutive tree requests', async () => {
    const realpathSpy = jest.spyOn(fs, 'realpath');

    await service.getWorkspaceTree('task-1', { path: '.' }, currentUser);
    await service.getWorkspaceTree('task-1', { path: '.' }, currentUser);

    expect(tasksService.assertCanAccessTaskProject).toHaveBeenCalledTimes(1);
    expect(taskRuntimeService.resolveTaskWorktreePath).toHaveBeenCalledTimes(1);
    expect(realpathSpy).toHaveBeenCalledTimes(1);
  });

  it('should reject file paths when listing a workspace tree', async () => {
    await expect(
      service.getWorkspaceTree('task-1', { path: 'README.md' }, currentUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('should raise not found when the workspace path does not exist', async () => {
    await expect(
      service.getWorkspaceTree('task-1', { path: 'missing' }, currentUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should not cache failed workspace context resolutions', async () => {
    (tasksService.assertCanAccessTaskProject as jest.Mock)
      .mockRejectedValueOnce(
        new ConflictException('Task workspace is not initialized'),
      )
      .mockResolvedValue({
        task: createTask(),
        project: createProject(),
      });

    await expect(
      service.getWorkspaceTree('task-1', { path: '.' }, currentUser),
    ).rejects.toThrow(ConflictException);

    await service.getWorkspaceTree('task-1', { path: '.' }, currentUser);

    expect(tasksService.assertCanAccessTaskProject).toHaveBeenCalledTimes(2);
  });
});
