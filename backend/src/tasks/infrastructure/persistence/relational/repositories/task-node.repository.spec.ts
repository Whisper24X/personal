import { TaskStatus } from '../../../../dto/task-status.enum';
import { TaskNodeRelationalRepository } from './task-node.repository';

const createQueryBuilder = () => {
  const builder = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getQuery: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    setParameters: jest.fn(),
    returning: jest.fn(),
    execute: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.set.mockReturnValue(builder);
  builder.setParameters.mockReturnValue(builder);
  builder.returning.mockReturnValue(builder);

  return builder;
};

describe('TaskNodeRelationalRepository', () => {
  it('should only claim the first unblocked todo node', async () => {
    const candidateBuilder = createQueryBuilder();
    const updateBuilder = createQueryBuilder();
    candidateBuilder.getQuery.mockReturnValue(
      'SELECT candidate.id FROM task_nodes candidate',
    );
    updateBuilder.execute.mockResolvedValue({
      raw: [{ id: 'node-2' }],
    });

    const claimedEntity = {
      id: 'node-2',
      taskId: 'task-1',
      nodeOrder: 2,
      name: 'Node 2',
      input: null,
      agentCliId: 'codex',
      agentCliConfigId: 'cfg-1',
      agentClioutput: null,
      agentCliSessionId: null,
      configJson: null,
      loopJson: null,
      runtimeJson: null,
      status: TaskStatus.inProgress,
      startedAt: new Date('2026-03-25T10:00:00.000Z'),
      finishedAt: null,
      createdAt: new Date('2026-03-25T09:00:00.000Z'),
      updatedAt: new Date('2026-03-25T10:00:00.000Z'),
    };

    const typeormRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(candidateBuilder)
        .mockReturnValueOnce(updateBuilder),
      findOne: jest.fn().mockResolvedValue(claimedEntity),
    };

    const repository = new TaskNodeRelationalRepository(
      typeormRepository as never,
    );

    await repository.claimFirstTodoNode(
      'task-1',
      'worker-1',
      new Date('2026-03-25T10:10:00.000Z'),
    );

    const candidateConditions = candidateBuilder.andWhere.mock.calls.map(
      ([sql]) => sql as string,
    );
    const inReviewCondition = candidateConditions.find((sql) =>
      sql.includes('FROM task_nodes review'),
    );
    const priorCondition = candidateConditions.find((sql) =>
      sql.includes('FROM task_nodes prior'),
    );

    expect(inReviewCondition).toContain('review.status = :reviewStatus');
    expect(priorCondition).toContain(
      'prior."nodeOrder" < candidate."nodeOrder"',
    );
    expect(priorCondition).toContain('prior.status <> :doneStatus');
    expect(updateBuilder.setParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        todoStatus: TaskStatus.todo,
        runningStatus: TaskStatus.inProgress,
        reviewStatus: TaskStatus.inReview,
        doneStatus: TaskStatus.done,
        workerId: 'worker-1',
      }),
    );
  });
});
