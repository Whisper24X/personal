import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
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

  async findById(id: Task['id']): Promise<NullableType<Task>> {
    const entity = await this.taskRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    return entity ? TaskMapper.toDomain(entity) : null;
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

  async countRunningTasks(at: Date = new Date()): Promise<number> {
    const result = await this.taskRepository
      .createQueryBuilder('task')
      .select('COUNT(DISTINCT task.id)', 'count')
      .innerJoin(
        'task_nodes',
        'node',
        'node."taskId" = task.id AND node.status = :status AND node."leaseUntil" > :at',
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
        'node."taskId" = task.id AND node.status = :status AND node."leaseUntil" > :at',
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
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM task_nodes todo
          WHERE todo."taskId" = task.id
            AND todo.status = :todoStatus
        )`,
        {
          todoStatus: TaskStatus.todo,
        },
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_nodes running
          WHERE running."taskId" = task.id
            AND running.status = :runningStatus
            AND running."leaseUntil" > :at
        )`,
        {
          runningStatus: TaskStatus.inProgress,
          at,
        },
      )
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
        'node."taskId" = task.id AND node.status = :status AND node."leaseUntil" IS NOT NULL AND node."leaseUntil" <= :at',
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
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM task_nodes todo
          WHERE todo."taskId" = task.id
            AND todo.status = :todoStatus
        )`,
        {
          todoStatus: TaskStatus.todo,
        },
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_nodes running
          WHERE running."taskId" = task.id
            AND running.status = :runningStatus
            AND running."leaseUntil" > :at
        )`,
        {
          runningStatus: TaskStatus.inProgress,
          at,
        },
      )
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
      .andWhere(
        `EXISTS (
          SELECT 1
          FROM task_nodes todo
          WHERE todo."taskId" = task.id
            AND todo.status = :todoStatus
        )`,
        {
          todoStatus: TaskStatus.todo,
        },
      )
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
      .orderBy('task."createdAt"', 'ASC')
      .limit(limit)
      .getMany();

    return entities.map((entity) => TaskMapper.toDomain(entity));
  }

  async findTasksWithExpiredWorktrees(
    _limit: number,
    _at: Date = new Date(),
  ): Promise<Task[]> {
    // Schema uses gitWorktree; retention (sandboxCleanupAt) not in current schema.
    // Return empty until retention columns are added.
    return [];
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
}
