import { TaskStatus } from './dto/task-status.enum';
import { TaskMode } from './dto/task-mode.enum';
import { TasksService } from './tasks.service';

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
  gitWorktree: 'wk-20260319-1',
  configJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const createCurrentUser = () => ({
  sub: 'user-1',
  roles: ['admin'],
  iat: 1,
  exp: 9999999999,
});

const createTasksService = () => {
  const task = createTask();
  const commandService = {
    create: jest.fn().mockResolvedValue(task),
    update: jest.fn().mockResolvedValue({ task, nodes: [] }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const interactionService = {
    reply: jest.fn().mockResolvedValue({ task, nodes: [] }),
    execute: jest.fn().mockResolvedValue({ task, nodes: [] }),
    repeatNode: jest.fn().mockResolvedValue({ task, nodes: [] }),
    retry: jest.fn().mockResolvedValue({ task, nodes: [] }),
    cancel: jest.fn().mockResolvedValue({ task, nodes: [] }),
    approve: jest.fn().mockResolvedValue({ task, nodes: [] }),
    cleanupWorktree: jest.fn().mockResolvedValue({ task, nodes: [] }),
  };
  const queryService = {
    findAllWithPagination: jest.fn().mockResolvedValue([task]),
    findById: jest.fn().mockResolvedValue(task),
    detailById: jest.fn().mockResolvedValue({ task, nodes: [] }),
    listMessages: jest.fn().mockResolvedValue([]),
    listLogs: jest.fn().mockResolvedValue([]),
    listWorktreeFiles: jest.fn().mockResolvedValue(['README.md']),
    readWorktreeFile: jest
      .fn()
      .mockResolvedValue({ path: 'README.md', content: 'hello' }),
    openLogStream: jest.fn().mockResolvedValue({
      history: [],
      subscribe: jest.fn().mockReturnValue(() => undefined),
    }),
  };
  const schedulerService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };
  const accessService = {
    assertCanAccessTask: jest.fn().mockResolvedValue(task),
    assertCanAccessTaskProject: jest
      .fn()
      .mockResolvedValue({ task, project: { id: 'project-1' } }),
  };
  const statusService = {
    calculateTaskStatus: jest.fn().mockReturnValue(TaskStatus.done),
  };
  const outputService = {
    readNodeOutputSummary: jest.fn().mockResolvedValue('summary'),
  };

  const service = new TasksService(
    commandService as never,
    interactionService as never,
    queryService as never,
    schedulerService as never,
    accessService as never,
    statusService as never,
    outputService as never,
  );

  return {
    service,
    task,
    commandService,
    interactionService,
    queryService,
    schedulerService,
    accessService,
    statusService,
    outputService,
  };
};

describe('TasksService', () => {
  it('should delegate create to task command service', async () => {
    const { service, commandService } = createTasksService();
    const currentUser = createCurrentUser();
    const dto = {
      projectId: 'project-1',
      title: 'title',
      prompt: 'prompt',
    };

    await service.create(dto as never, currentUser as never);

    expect(commandService.create).toHaveBeenCalledWith(dto, currentUser);
  });

  it('should delegate query methods to task query service', async () => {
    const { service, queryService } = createTasksService();
    const currentUser = createCurrentUser();

    await service.findAllWithPagination({
      query: { page: 1, limit: 10 } as never,
      currentUser: currentUser as never,
    });
    await service.findById('task-1', currentUser as never);
    await service.detailById('task-1', currentUser as never);
    await service.listMessages('task-1', currentUser as never);
    await service.listLogs(
      'task-1',
      { limit: 10 } as never,
      currentUser as never,
    );
    await service.listWorktreeFiles('task-1', currentUser as never, {
      prefix: 'src',
    });
    await service.readWorktreeFile('task-1', 'README.md', currentUser as never);
    await service.openLogStream({
      taskId: 'task-1',
      query: { limit: 10 } as never,
      currentUser: currentUser as never,
    });

    expect(queryService.findAllWithPagination).toHaveBeenCalled();
    expect(queryService.findById).toHaveBeenCalledWith('task-1', currentUser);
    expect(queryService.detailById).toHaveBeenCalledWith('task-1', currentUser);
    expect(queryService.listMessages).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );
    expect(queryService.listLogs).toHaveBeenCalled();
    expect(queryService.listWorktreeFiles).toHaveBeenCalled();
    expect(queryService.readWorktreeFile).toHaveBeenCalledWith(
      'task-1',
      'README.md',
      currentUser,
    );
    expect(queryService.openLogStream).toHaveBeenCalled();
  });

  it('should delegate command and interaction mutations to application services', async () => {
    const { service, commandService, interactionService } =
      createTasksService();
    const currentUser = createCurrentUser();

    await service.update(
      'task-1',
      { title: 'new' } as never,
      currentUser as never,
    );
    await service.remove('task-1', currentUser as never);
    await service.reply(
      'task-1',
      { message: 'reply' } as never,
      currentUser as never,
    );
    await service.execute('task-1', currentUser as never);
    await service.repeatNode('task-1', 'node-1', currentUser as never);
    await service.retry(
      'task-1',
      { nodeId: 'node-1' } as never,
      currentUser as never,
    );
    await service.cancel('task-1', currentUser as never);
    await service.approve(
      'task-1',
      { nodeId: 'node-1' } as never,
      currentUser as never,
    );
    await service.cleanupWorktree('task-1', currentUser as never);

    expect(commandService.update).toHaveBeenCalledWith(
      'task-1',
      { title: 'new' },
      currentUser,
    );
    expect(commandService.remove).toHaveBeenCalledWith('task-1', currentUser);
    expect(interactionService.reply).toHaveBeenCalled();
    expect(interactionService.execute).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );
    expect(interactionService.repeatNode).toHaveBeenCalledWith(
      'task-1',
      'node-1',
      currentUser,
    );
    expect(interactionService.retry).toHaveBeenCalled();
    expect(interactionService.cancel).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );
    expect(interactionService.approve).toHaveBeenCalled();
    expect(interactionService.cleanupWorktree).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );
  });

  it('should delegate lifecycle hooks to task scheduler service', () => {
    const { service, schedulerService } = createTasksService();

    service.onModuleInit();
    service.onModuleDestroy();

    expect(schedulerService.onModuleInit).toHaveBeenCalled();
    expect(schedulerService.onModuleDestroy).toHaveBeenCalled();
  });

  it('should delegate access assertions and retain compatibility wrappers', async () => {
    const { service, accessService, statusService, outputService } =
      createTasksService();
    const currentUser = createCurrentUser();
    const serviceAny = service as any;

    await service.assertCanAccessTask('task-1', currentUser as never);
    await service.assertCanAccessTaskProject('task-1', currentUser as never);

    expect(accessService.assertCanAccessTask).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );
    expect(accessService.assertCanAccessTaskProject).toHaveBeenCalledWith(
      'task-1',
      currentUser,
    );

    expect(serviceAny.calculateTaskStatus([])).toBe(TaskStatus.done);
    await expect(
      serviceAny.readNodeOutputSummary({ id: 'node-1' }),
    ).resolves.toBe('summary');
    expect(statusService.calculateTaskStatus).toHaveBeenCalledWith([]);
    expect(outputService.readNodeOutputSummary).toHaveBeenCalledWith({
      id: 'node-1',
    });
  });
});
