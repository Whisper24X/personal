import { TaskStatus } from '../tasks/dto/task-status.enum';
import { ObservabilityService } from './observability.service';

const createTask = (overrides?: Record<string, unknown>) => ({
  id: 'task-1',
  projectId: 'project-1',
  status: TaskStatus.done,
  startedAt: new Date('2026-02-16T00:00:00.000Z'),
  finishedAt: new Date('2026-02-16T00:10:00.000Z'),
  createdAt: new Date('2026-02-16T00:00:00.000Z'),
  ...overrides,
});

describe('ObservabilityService', () => {
  it('should include stale running and dispatch lag metrics', async () => {
    const taskRepository = {
      findAllWithPagination: jest
        .fn()
        .mockResolvedValueOnce([createTask()])
        .mockResolvedValueOnce([]),
    };
    const projectRepository = {
      findAllWithPagination: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'project-1' }])
        .mockResolvedValueOnce([]),
    };
    const queueService = {
      getStats: jest.fn().mockResolvedValue({
        generatedAt: new Date(),
        global: {
          maxConcurrency: 4,
          running: 1,
          queued: 2,
          inReview: 0,
          done: 1,
          availableSlots: 3,
          saturationRate: 25,
          staleRunning: 1,
          dispatchLagSeconds: 42,
          workerHeartbeatSkew: null,
        },
        projects: [],
      }),
    };

    const service = new ObservabilityService(
      taskRepository as never,
      projectRepository as never,
      queueService as never,
    );

    const metrics = await service.metrics({
      sub: 'admin-1',
      roles: ['admin'],
    } as never);

    expect(metrics.staleRunning).toBe(1);
    expect(metrics.dispatchLagSeconds).toBe(42);
    expect(metrics.alerts.some((alert) => alert.code === 'WORKER_STALE_RUNNING'))
      .toBeTruthy();
  });
});
