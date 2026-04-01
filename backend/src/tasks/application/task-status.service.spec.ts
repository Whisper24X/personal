import { TaskStatusService } from './task-status.service';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskMode } from '../dto/task-mode.enum';

const createService = () => {
  const taskRepository = {
    findById: jest.fn(),
    update: jest.fn(),
  };
  const taskNodeRepository = {
    findByTaskId: jest.fn(),
  };
  const notificationsService = {
    notifyTaskStatusChanged: jest.fn().mockResolvedValue(undefined),
  };
  const taskLogService = {
    appendLog: jest.fn().mockResolvedValue(undefined),
  };
  const goalsService = {
    syncPlanSubTaskStatusFromLinkedTask: jest.fn().mockResolvedValue(undefined),
  };

  const service = new TaskStatusService(
    taskRepository as never,
    taskNodeRepository as never,
    notificationsService as never,
    taskLogService as never,
    goalsService as never,
  );

  return {
    service,
    taskRepository,
    taskNodeRepository,
    notificationsService,
    taskLogService,
    goalsService,
  };
};

const createDoneNode = (id: string) => ({
  id,
  taskId: 'task-1',
  nodeOrder: 1,
  name: `Node ${id}`,
  status: TaskStatus.done,
  loopJson: null,
});

const createNode = (
  status: TaskStatus,
  overrides: Record<string, unknown> = {},
) => ({
  id: `node-${status}`,
  taskId: 'task-1',
  nodeOrder: 1,
  name: `Node ${status}`,
  status,
  loopJson: null,
  ...overrides,
});

describe('TaskStatusService', () => {
  it('should return todo when all nodes are todo and task has not started progressing', () => {
    const { service } = createService();

    expect(
      service.calculateTaskStatus(
        [createNode(TaskStatus.todo)] as never,
        TaskStatus.todo,
      ),
    ).toBe(TaskStatus.todo);
  });

  it('should return in_progress when all nodes are todo but task was already in progress', () => {
    const { service } = createService();

    expect(
      service.calculateTaskStatus(
        [createNode(TaskStatus.todo)] as never,
        TaskStatus.inProgress,
      ),
    ).toBe(TaskStatus.inProgress);
  });

  it('should return in_progress when a node is pending review but not all nodes are done', () => {
    const { service } = createService();

    expect(
      service.calculateTaskStatus(
        [
          createNode(TaskStatus.done, { id: 'node-1', nodeOrder: 1 }),
          createNode(TaskStatus.inReview, { id: 'node-2', nodeOrder: 2 }),
        ] as never,
        TaskStatus.inProgress,
      ),
    ).toBe(TaskStatus.inProgress);
  });

  it('should return in_review when all nodes are done but task is not manually completed', () => {
    const { service } = createService();

    expect(
      service.calculateTaskStatus(
        [createDoneNode('node-1')] as never,
        TaskStatus.inProgress,
      ),
    ).toBe(TaskStatus.inReview);
  });

  it('should return done when all nodes are done and task is already completed manually', () => {
    const { service } = createService();

    expect(
      service.calculateTaskStatus(
        [createDoneNode('node-1')] as never,
        TaskStatus.done,
      ),
    ).toBe(TaskStatus.done);
  });

  it('should persist manual task completion through setTaskStatus', async () => {
    const {
      service,
      taskRepository,
      taskLogService,
      goalsService,
      notificationsService,
    } = createService();

    taskRepository.findById.mockResolvedValue({
      id: 'task-1',
      title: 'Task 1',
      createdBy: 'user-1',
      mode: TaskMode.workflow,
      gitWorktree: 'wk-1',
      status: TaskStatus.inReview,
    });

    await service.setTaskStatus('task-1', TaskStatus.done);

    expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
      status: TaskStatus.done,
      finishedAt: expect.any(Date),
    });
    expect(
      goalsService.syncPlanSubTaskStatusFromLinkedTask,
    ).toHaveBeenCalledWith('task-1', TaskStatus.done);
    expect(taskLogService.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        message: 'Task completed; worktree preserved',
      }),
    );
    expect(notificationsService.notifyTaskStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        status: TaskStatus.done,
      }),
    );
  });
});
