import { ForbiddenException } from '@nestjs/common';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { QueueService } from './queue.service';

const createTask = (overrides?: Record<string, unknown>) => ({
  id: 'task-1',
  projectId: 'project-1',
  status: TaskStatus.todo,
  createdAt: new Date('2026-02-16T00:00:00.000Z'),
  ...overrides,
});

const createProject = (overrides?: Record<string, unknown>) => ({
  id: 'project-1',
  name: 'Project A',
  configJson: null,
  ...overrides,
});

describe('QueueService', () => {
  it('should expose stale running and dispatch lag metrics', async () => {
    const now = new Date('2026-02-16T01:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const taskRepository = {
      findAllWithPagination: jest.fn().mockResolvedValue([createTask()]),
      countRunningTasksByProjectIds: jest.fn().mockResolvedValue({
        'project-1': 1,
      }),
      countQueuedTasksByProjectIds: jest.fn().mockResolvedValue({
        'project-1': 2,
      }),
      countRunningTasks: jest.fn().mockResolvedValue(1),
      countStaleRunningTasks: jest.fn().mockResolvedValue(1),
      findOldestQueuedTaskCreatedAt: jest
        .fn()
        .mockResolvedValue(new Date('2026-02-16T00:59:30.000Z')),
    };
    const projectRepository = {
      findAllWithPagination: jest.fn().mockResolvedValue([createProject()]),
    };

    const service = new QueueService(
      taskRepository as never,
      projectRepository as never,
    );

    const result = await service.getStats({
      sub: 'admin-1',
      roles: ['admin'],
    } as never);

    expect(result.global.staleRunning).toBe(1);
    expect(result.global.dispatchLagSeconds).toBe(30);
    expect(taskRepository.countRunningTasks).toHaveBeenCalledWith(
      expect.any(Date),
    );

    jest.useRealTimers();
  });

  it('should reject non-admin queue stats view', async () => {
    const service = new QueueService({} as never, {} as never);

    await expect(
      service.getStats({
        sub: 'user-1',
        roles: ['user'],
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });
});
