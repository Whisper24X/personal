import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskLog } from '../../../../domain/task-log';
import { TaskLogRepository } from '../../task-log.repository';
import { TaskLogEntity } from '../entities/task-log.entity';
import { TaskLogMapper } from '../mappers/task-log.mapper';

@Injectable()
export class TaskLogRelationalRepository implements TaskLogRepository {
  constructor(
    @InjectRepository(TaskLogEntity)
    private readonly taskLogRepository: Repository<TaskLogEntity>,
  ) {}

  async create(data: Omit<TaskLog, 'id' | 'createdAt'>): Promise<TaskLog> {
    const entity = await this.taskLogRepository.save(
      this.taskLogRepository.create({
        taskId: data.taskId,
        taskNodeId: data.taskNodeId,
        level: data.level,
        message: data.message,
        payload: data.payload,
      }),
    );

    return TaskLogMapper.toDomain(entity);
  }

  async findByTaskIdSince({
    taskId,
    since,
    afterId,
    limit,
  }: {
    taskId: TaskLog['taskId'];
    since?: Date;
    afterId?: string;
    limit?: number;
  }): Promise<TaskLog[]> {
    const query = this.taskLogRepository
      .createQueryBuilder('taskLog')
      .where('taskLog.taskId = :taskId', {
        taskId,
      });

    if (since && afterId) {
      query.andWhere(
        '("taskLog"."createdAt" > :since OR ("taskLog"."createdAt" = :since AND "taskLog"."id" > :afterId))',
        {
          since,
          afterId,
        },
      );
    } else if (since) {
      query.andWhere('"taskLog"."createdAt" > :since', {
        since,
      });
    }

    const entities = await query
      .orderBy('taskLog.createdAt', 'ASC')
      .addOrderBy('taskLog.id', 'ASC')
      .limit(limit ?? 200)
      .getMany();

    return entities.map((entity) => TaskLogMapper.toDomain(entity));
  }
}
