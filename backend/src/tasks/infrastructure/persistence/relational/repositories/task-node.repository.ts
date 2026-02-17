import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { TaskNode } from '../../../../domain/task-node';
import { TaskStatus } from '../../../../dto/task-status.enum';
import { TaskNodeRepository } from '../../task-node.repository';
import { TaskNodeEntity } from '../entities/task-node.entity';
import { TaskNodeMapper } from '../mappers/task-node.mapper';

@Injectable()
export class TaskNodeRelationalRepository implements TaskNodeRepository {
  constructor(
    @InjectRepository(TaskNodeEntity)
    private readonly taskNodeRepository: Repository<TaskNodeEntity>,
  ) {}

  async createMany(
    data: Array<Omit<TaskNode, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<TaskNode[]> {
    const entities = await this.taskNodeRepository.save(
      data.map((item) => this.taskNodeRepository.create(item)),
    );

    return entities.map((entity) => TaskNodeMapper.toDomain(entity));
  }

  async findByTaskId(taskId: TaskNode['taskId']): Promise<TaskNode[]> {
    const entities = await this.taskNodeRepository.find({
      where: { taskId },
      order: {
        nodeOrder: 'ASC',
      },
    });

    return entities.map((entity) => TaskNodeMapper.toDomain(entity));
  }

  async findById(id: TaskNode['id']): Promise<NullableType<TaskNode>> {
    const entity = await this.taskNodeRepository.findOne({
      where: { id },
    });

    return entity ? TaskNodeMapper.toDomain(entity) : null;
  }

  async findInProgressByTaskId(
    taskId: TaskNode['taskId'],
  ): Promise<NullableType<TaskNode>> {
    const entity = await this.taskNodeRepository.findOne({
      where: {
        taskId,
        status: TaskStatus.inProgress,
      },
      order: {
        nodeOrder: 'ASC',
      },
    });

    return entity ? TaskNodeMapper.toDomain(entity) : null;
  }

  async findFirstByTaskIdAndStatus({
    taskId,
    status,
  }: {
    taskId: TaskNode['taskId'];
    status: TaskStatus;
  }): Promise<NullableType<TaskNode>> {
    const entity = await this.taskNodeRepository.findOne({
      where: {
        taskId,
        status,
      },
      order: {
        nodeOrder: 'ASC',
      },
    });

    return entity ? TaskNodeMapper.toDomain(entity) : null;
  }

  async findByTaskIdAndStatus({
    taskId,
    status,
  }: {
    taskId: TaskNode['taskId'];
    status: TaskStatus;
  }): Promise<TaskNode[]> {
    const entities = await this.taskNodeRepository.find({
      where: {
        taskId,
        status,
      },
      order: {
        nodeOrder: 'ASC',
      },
    });

    return entities.map((entity) => TaskNodeMapper.toDomain(entity));
  }

  async claimFirstTodoNode(
    taskId: TaskNode['taskId'],
    workerId: string,
    leaseUntil: Date,
  ): Promise<NullableType<TaskNode>> {
    const todoStatus = TaskStatus.todo;
    const now = new Date();

    const candidateSubQuery = this.taskNodeRepository
      .createQueryBuilder('candidate')
      .select('candidate.id')
      .where('candidate."taskId" = :taskId', {
        taskId,
      })
      .andWhere('candidate.status = :todoStatus', {
        todoStatus,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM task_nodes running
          WHERE running."taskId" = :taskId
            AND running.status = :runningStatus
        )`,
        {
          taskId,
          runningStatus: TaskStatus.inProgress,
        },
      )
      .orderBy('candidate."nodeOrder"', 'ASC')
      .limit(1)
      .getQuery();

    const updateResult = await this.taskNodeRepository
      .createQueryBuilder()
      .update(TaskNodeEntity)
      .set({
        status: TaskStatus.inProgress,
        attempt: () => '"attempt" + 1',
        startedAt: now,
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
        workerId,
        leaseUntil,
        heartbeatAt: now,
      })
      .where(`id = (${candidateSubQuery})`)
      .andWhere('status = :todoStatus', {
        todoStatus,
      })
      .setParameters({
        taskId,
        todoStatus,
        runningStatus: TaskStatus.inProgress,
      })
      .returning('id')
      .execute();

    const claimedNodeId = (updateResult.raw?.[0] as { id?: string } | undefined)
      ?.id;

    if (!claimedNodeId) {
      return null;
    }

    return this.findById(claimedNodeId);
  }

  async renewNodeLease({
    nodeId,
    workerId,
    leaseUntil,
    heartbeatAt,
  }: {
    nodeId: TaskNode['id'];
    workerId: string;
    leaseUntil: Date;
    heartbeatAt: Date;
  }): Promise<boolean> {
    const result = await this.taskNodeRepository
      .createQueryBuilder()
      .update(TaskNodeEntity)
      .set({
        leaseUntil,
        heartbeatAt,
      })
      .where('id = :nodeId', {
        nodeId,
      })
      .andWhere('status = :status', {
        status: TaskStatus.inProgress,
      })
      .andWhere('workerId = :workerId', {
        workerId,
      })
      .execute();

    return Number(result.affected ?? 0) > 0;
  }

  async releaseNodeLease(nodeId: TaskNode['id']): Promise<void> {
    await this.taskNodeRepository
      .createQueryBuilder()
      .update(TaskNodeEntity)
      .set({
        workerId: null,
        leaseUntil: null,
        heartbeatAt: null,
      })
      .where('id = :nodeId', {
        nodeId,
      })
      .execute();
  }

  async findExpiredInProgressNodes({
    now,
    limit,
  }: {
    now: Date;
    limit: number;
  }): Promise<TaskNode[]> {
    if (limit <= 0) {
      return [];
    }

    const entities = await this.taskNodeRepository
      .createQueryBuilder('node')
      .where('node.status = :status', {
        status: TaskStatus.inProgress,
      })
      .andWhere('node."leaseUntil" IS NOT NULL')
      .andWhere('node."leaseUntil" <= :now', {
        now,
      })
      .orderBy('node."leaseUntil"', 'ASC')
      .addOrderBy('node."createdAt"', 'ASC')
      .limit(limit)
      .getMany();

    return entities.map((entity) => TaskNodeMapper.toDomain(entity));
  }

  async update(
    id: TaskNode['id'],
    payload: Partial<TaskNode>,
  ): Promise<NullableType<TaskNode>> {
    const entity = await this.taskNodeRepository.findOne({
      where: {
        id,
      },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.taskNodeRepository.save(
      this.taskNodeRepository.create(
        TaskNodeMapper.toPersistence({
          ...TaskNodeMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return TaskNodeMapper.toDomain(updatedEntity);
  }
}
