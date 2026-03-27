import { TaskStatus } from '../../../../dto/task-status.enum';
import { TaskRelationalRepository } from './task.repository';

const createQueryBuilder = () => {
  const builder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    groupBy: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.addSelect.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.groupBy.mockReturnValue(builder);

  return builder;
};

describe('TaskRelationalRepository', () => {
  it('should treat any in-progress task in the project as running', async () => {
    const queryBuilder = createQueryBuilder();
    queryBuilder.getRawOne.mockResolvedValue({ '?column?': 1 });

    const typeormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const repository = new TaskRelationalRepository(typeormRepository as never);

    const result = await repository.hasRunningTaskInProject('project-1', {
      excludeTaskId: 'task-1',
    });

    expect(result).toBe(true);
    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'task_nodes',
      'node',
      'node."taskId" = task.id AND node.status = :status',
      {
        status: TaskStatus.inProgress,
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'task.id <> :excludeTaskId',
      {
        excludeTaskId: 'task-1',
      },
    );
  });

  it('should only mark tasks ready for dispatch when the next todo node is unblocked', async () => {
    const queryBuilder = createQueryBuilder();
    queryBuilder.getMany.mockResolvedValue([]);

    const typeormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const repository = new TaskRelationalRepository(typeormRepository as never);

    await repository.findTasksReadyForDispatch(10);

    const andWhereSql = queryBuilder.andWhere.mock.calls.map(
      ([sql]) => sql as string,
    );
    const dispatchableTodoCondition = andWhereSql.find((sql) =>
      sql.includes('FROM task_nodes todo'),
    );
    const inReviewCondition = andWhereSql.find((sql) =>
      sql.includes('FROM task_nodes review'),
    );

    expect(dispatchableTodoCondition).toContain(
      'prior."nodeOrder" < todo."nodeOrder"',
    );
    expect(dispatchableTodoCondition).toContain('prior.status <> :doneStatus');
    expect(inReviewCondition).toContain('review.status = :reviewStatus');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM task_nodes todo'),
      expect.objectContaining({
        todoStatus: TaskStatus.todo,
        doneStatus: TaskStatus.done,
      }),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM task_nodes review'),
      expect.objectContaining({
        reviewStatus: TaskStatus.inReview,
      }),
    );
  });

  it('should exclude in-review workflows from queued task counts', async () => {
    const queryBuilder = createQueryBuilder();
    queryBuilder.getRawMany.mockResolvedValue([]);

    const typeormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const repository = new TaskRelationalRepository(typeormRepository as never);

    await repository.countQueuedTasksByProjectIds(['project-1']);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM task_nodes review'),
      expect.objectContaining({
        reviewStatus: TaskStatus.inReview,
      }),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('prior."nodeOrder" < todo."nodeOrder"'),
      expect.objectContaining({
        todoStatus: TaskStatus.todo,
        doneStatus: TaskStatus.done,
      }),
    );
  });
});
