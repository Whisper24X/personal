import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  buildPoolSnapshotDetails,
  RepositoryDiagnosticsOptions,
  readTypeOrmPoolSnapshot,
} from '../../../../../observability/repository-diagnostics';
import { Task } from '../../../../domain/task';
import { TaskStatus } from '../../../../dto/task-status.enum';
import { TaskRepository } from '../../task.repository';
import { TaskEntity } from '../entities/task.entity';
import { TaskMapper } from '../mappers/task.mapper';

@Injectable()
export class TaskRelationalRepository implements TaskRepository {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Task> {
    const entity = await this.taskRepository.save(
      this.taskRepository.create(
        TaskMapper.toPersistence({
          ...new Task(),
          ...data,
        }),
      ),
    );

    return TaskMapper.toDomain(entity);
  }

  async findById(
    id: Task['id'],
    options?: RepositoryDiagnosticsOptions,
  ): Promise<NullableType<Task>> {
    if (!options?.diagnostics) {
      const entity = await this.taskRepository.findOne({
        where: {
          id,
          deletedAt: IsNull(),
        },
      });

      return entity ? TaskMapper.toDomain(entity) : null;
    }

    const metricPrefix = options.metricPrefix ?? 'taskLookup';
    const diagnostics = options.diagnostics;
    diagnostics.add(
      buildPoolSnapshotDetails(
        metricPrefix,
        'BeforeAcquire',
        readTypeOrmPoolSnapshot(this.dataSource),
      ),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    let connectionAcquired = false;

    try {
      await diagnostics.measure(
        `${metricPrefix}AcquireConnection`,
        async () => {
          await queryRunner.connect();
          connectionAcquired = true;
        },
        () =>
          buildPoolSnapshotDetails(
            metricPrefix,
            'AfterAcquire',
            readTypeOrmPoolSnapshot(this.dataSource),
          ),
      );

      const entity = await diagnostics.measure(
        `${metricPrefix}FindOne`,
        () =>
          queryRunner.manager.getRepository(TaskEntity).findOne({
            where: {
              id,
              deletedAt: IsNull(),
            },
          }),
        (result) => ({
          [`${metricPrefix}EntityFound`]: Boolean(result),
          ...buildPoolSnapshotDetails(
            metricPrefix,
            'AfterQuery',
            readTypeOrmPoolSnapshot(this.dataSource),
          ),
        }),
      );

      if (!entity) {
        return null;
      }

      return diagnostics.measure(`${metricPrefix}Map`, () =>
        TaskMapper.toDomain(entity),
      );
    } finally {
      if (connectionAcquired && !queryRunner.isReleased) {
        await diagnostics.measure(
          `${metricPrefix}ReleaseConnection`,
          () => queryRunner.release(),
          () =>
            buildPoolSnapshotDetails(
              metricPrefix,
              'AfterRelease',
              readTypeOrmPoolSnapshot(this.dataSource),
            ),
        );
      }
    }
  }

  async findByGoalId(goalId: string): Promise<Task[]> {
    const entities = await this.taskRepository.find({
      where: {
        goalId,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) => TaskMapper.toDomain(entity));
  }

  async findByGitWorktree(gitWorktree: string): Promise<NullableType<Task>> {
    const entity = await this.taskRepository.findOne({
      where: {
        gitWorktree,
        deletedAt: IsNull(),
      },
    });

    return entity ? TaskMapper.toDomain(entity) : null;
  }

  async findMaxGitWorktreeSequence(prefix: string): Promise<number> {
    const rows = await this.taskRepository
      .createQueryBuilder('task')
      .select('task."gitWorktree"', 'gitWorktree')
      .where('task."deletedAt" IS NULL')
      .andWhere('task."gitWorktree" LIKE :pattern', {
        pattern: `${prefix}%`,
      })
      .getRawMany<{ gitWorktree?: string | null }>();

    return rows.reduce((maxSequence, row) => {
      const gitWorktree = row.gitWorktree?.trim();

      if (!gitWorktree) {
        return maxSequence;
      }

      const suffix = gitWorktree.slice(prefix.length);

      if (!/^\d+$/.test(suffix)) {
        return maxSequence;
      }

      return Math.max(maxSequence, Number(suffix));
    }, 0);
  }

  async bulkUpdateBusinessLineIdByProjectId({
    projectId,
    businessLineId,
  }: {
    projectId: string;
    businessLineId: string;
  }): Promise<void> {
    await this.taskRepository
      .createQueryBuilder()
      .update(TaskEntity)
      .set({
        businessLineId,
      })
      .where('"projectId" = :projectId', {
        projectId,
      })
      .andWhere('"deletedAt" IS NULL')
      .execute();
  }

  async findAllWithPagination({
    paginationOptions,
    projectId,
    status,
  }: {
    paginationOptions: IPaginationOptions;
    projectId?: string;
    status?: TaskStatus;
  }): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .where('task.deletedAt IS NULL');

    if (projectId) {
      query.andWhere('task.projectId = :projectId', {
        projectId,
      });
    }

    if (status) {
      query.andWhere('task.status = :status', {
        status,
      });
    }

    const entities = await query
      .orderBy('task.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => TaskMapper.toDomain(entity));
  }

  async countByStatusForProject(
    projectId: string,
  ): Promise<Record<TaskStatus, number>> {
    const rows = await this.taskRepository
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(task.id)', 'count')
      .where('task.deletedAt IS NULL')
      .andWhere('task.projectId = :projectId', { projectId })
      .groupBy('task.status')
      .getRawMany<{ status: TaskStatus; count: string }>();

    const empty: Record<TaskStatus, number> = {
      [TaskStatus.todo]: 0,
      [TaskStatus.inProgress]: 0,
      [TaskStatus.inReview]: 0,
      [TaskStatus.done]: 0,
    };

    for (const row of rows) {
      empty[row.status] = Number(row.count ?? 0);
    }

    return empty;
  }

  async countRunningTasks(at: Date = new Date()): Promise<number> {
    const result = await this.taskRepository
      .createQueryBuilder('task')
      .select('COUNT(DISTINCT task.id)', 'count')
      .innerJoin(
        'task_nodes',
        'node',
        `node."taskId" = task.id AND node.status = :status AND ((node."runtimeJson"->>'leaseUntil')::timestamptz) > :at`,
        {
          status: TaskStatus.inProgress,
          at,
        },
      )
      .where('task."deletedAt" IS NULL')
      .getRawOne<{ count?: string }>();

    return Number(result?.count ?? 0);
  }

  async countRunningTasksByProjectIds(
    projectIds: string[],
    at: Date = new Date(),
  ): Promise<Record<string, number>> {
    if (projectIds.length === 0) {
      return {};
    }

    const rows = await this.taskRepository
      .createQueryBuilder('task')
      .select('task."projectId"', 'projectId')
      .addSelect('COUNT(DISTINCT task.id)', 'count')
      .innerJoin(
        'task_nodes',
        'node',
        `node."taskId" = task.id AND node.status = :status AND ((node."runtimeJson"->>'leaseUntil')::timestamptz) > :at`,
        {
          status: TaskStatus.inProgress,
          at,
        },
      )
      .where('task."deletedAt" IS NULL')
      .andWhere('task."projectId" IN (:...projectIds)', {
        projectIds,
      })
      .groupBy('task."projectId"')
      .getRawMany<{ projectId: string; count: string }>();

    return rows.reduce<Record<string, number>>((result, row) => {
      result[row.projectId] = Number(row.count ?? 0);
      return result;
    }, {});
  }

  async hasRunningTaskInProject(
    projectId: string,
    options?: {
      excludeTaskId?: Task['id'];
      at?: Date;
    },
  ): Promise<boolean> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .select('1')
      .innerJoin(
        'task_nodes',
        'node',
        `node."taskId" = task.id AND node.status = :status`,
        {
          status: TaskStatus.inProgress,
        },
      )
      .where('task."deletedAt" IS NULL')
      .andWhere('task."projectId" = :projectId', { projectId })
      .limit(1);

    if (options?.excludeTaskId) {
      query.andWhere('task.id <> :excludeTaskId', {
        excludeTaskId: options.excludeTaskId,
      });
    }

    const row = await query.getRawOne();
    return Boolean(row);
  }

  async countQueuedTasksByProjectIds(
    projectIds: string[],
    at: Date = new Date(),
  ): Promise<Record<string, number>> {
    if (projectIds.length === 0) {
      return {};
    }

    const rows = await this.taskRepository
      .createQueryBuilder('task')
      .select('task."projectId"', 'projectId')
      .addSelect('COUNT(task.id)', 'count')
      .where('task."deletedAt" IS NULL')
      .andWhere('task."projectId" IN (:...projectIds)', {
        projectIds,
      })
      .andWhere(this.buildDispatchableTodoExistsCondition('task'), {
        todoStatus: TaskStatus.todo,
        doneStatus: TaskStatus.done,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_nodes running
          WHERE running."taskId" = task.id
            AND running.status = :runningStatus
            AND ((running."runtimeJson"->>'leaseUntil')::timestamptz) > :at
        )`,
        {
          runningStatus: TaskStatus.inProgress,
          at,
        },
      )
      .andWhere(this.buildNoInReviewNodesCondition('task'), {
        reviewStatus: TaskStatus.inReview,
      })
      .groupBy('task."projectId"')
      .getRawMany<{ projectId: string; count: string }>();

    return rows.reduce<Record<string, number>>((result, row) => {
      result[row.projectId] = Number(row.count ?? 0);
      return result;
    }, {});
  }

  async countStaleRunningTasks(at: Date = new Date()): Promise<number> {
    const result = await this.taskRepository
      .createQueryBuilder('task')
      .select('COUNT(DISTINCT task.id)', 'count')
      .innerJoin(
        'task_nodes',
        'node',
        `node."taskId" = task.id AND node.status = :status AND (node."runtimeJson"->>'leaseUntil') IS NOT NULL AND ((node."runtimeJson"->>'leaseUntil')::timestamptz) <= :at`,
        {
          status: TaskStatus.inProgress,
          at,
        },
      )
      .where('task."deletedAt" IS NULL')
      .getRawOne<{ count?: string }>();

    return Number(result?.count ?? 0);
  }

  async findOldestQueuedTaskCreatedAt(
    at: Date = new Date(),
  ): Promise<Date | null> {
    const row = await this.taskRepository
      .createQueryBuilder('task')
      .select('task."createdAt"', 'createdAt')
      .where('task."deletedAt" IS NULL')
      .andWhere(this.buildDispatchableTodoExistsCondition('task'), {
        todoStatus: TaskStatus.todo,
        doneStatus: TaskStatus.done,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_nodes running
          WHERE running."taskId" = task.id
            AND running.status = :runningStatus
            AND ((running."runtimeJson"->>'leaseUntil')::timestamptz) > :at
        )`,
        {
          runningStatus: TaskStatus.inProgress,
          at,
        },
      )
      .andWhere(this.buildNoInReviewNodesCondition('task'), {
        reviewStatus: TaskStatus.inReview,
      })
      .orderBy('task."createdAt"', 'ASC')
      .limit(1)
      .getRawOne<{ createdAt?: string | Date }>();

    if (!row?.createdAt) {
      return null;
    }

    return row.createdAt instanceof Date
      ? row.createdAt
      : new Date(row.createdAt);
  }

  async findTasksReadyForDispatch(limit: number, _at?: Date): Promise<Task[]> {
    void _at;

    if (limit <= 0) {
      return [];
    }

    const entities = await this.taskRepository
      .createQueryBuilder('task')
      .where('task."deletedAt" IS NULL')
      .andWhere('task."startedAt" IS NOT NULL')
      .andWhere('task.status IN (:...statuses)', {
        statuses: [TaskStatus.todo, TaskStatus.inProgress],
      })
      .andWhere(this.buildDispatchableTodoExistsCondition('task'), {
        todoStatus: TaskStatus.todo,
        doneStatus: TaskStatus.done,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_nodes running
          WHERE running."taskId" = task.id
            AND running.status = :runningStatus
        )`,
        {
          runningStatus: TaskStatus.inProgress,
        },
      )
      .andWhere(this.buildNoInReviewNodesCondition('task'), {
        reviewStatus: TaskStatus.inReview,
      })
      .orderBy('task."createdAt"', 'ASC')
      .limit(limit)
      .getMany();

    return entities.map((entity) => TaskMapper.toDomain(entity));
  }

  findTasksWithExpiredWorktrees(
    limit: number,
    at: Date = new Date(),
  ): Promise<Task[]> {
    void limit;
    void at;

    // Schema uses gitWorktree; retention (sandboxCleanupAt) not in current schema.
    // Return empty until retention columns are added.
    return Promise.resolve([]);
  }

  async update(
    id: Task['id'],
    payload: Partial<Task>,
  ): Promise<NullableType<Task>> {
    const entity = await this.taskRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!entity) {
      throw new NotFoundException('Task not found');
    }

    const updatedEntity = await this.taskRepository.save(
      this.taskRepository.create(
        TaskMapper.toPersistence({
          ...TaskMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return TaskMapper.toDomain(updatedEntity);
  }

  async remove(id: Task['id']): Promise<void> {
    await this.taskRepository.softDelete(id);
  }

  private buildDispatchableTodoExistsCondition(taskAlias: string): string {
    return `EXISTS (
      SELECT 1
      FROM task_nodes todo
      WHERE todo."taskId" = ${taskAlias}.id
        AND todo.status = :todoStatus
        AND NOT EXISTS (
          SELECT 1
          FROM task_nodes prior
          WHERE prior."taskId" = ${taskAlias}.id
            AND prior."nodeOrder" < todo."nodeOrder"
            AND prior.status <> :doneStatus
        )
    )`;
  }

  private buildNoInReviewNodesCondition(taskAlias: string): string {
    return `NOT EXISTS (
      SELECT 1
      FROM task_nodes review
      WHERE review."taskId" = ${taskAlias}.id
        AND review.status = :reviewStatus
    )`;
  }
}
