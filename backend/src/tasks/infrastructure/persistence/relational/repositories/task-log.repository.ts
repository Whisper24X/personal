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
      .createQueryBuilder('tl')
      .where('tl.taskId = :taskId', {
        taskId,
      });

    if (since && afterId) {
      query.andWhere(
        '(tl."createdAt" > :since OR (tl."createdAt" = :since AND tl.id > :afterId))',
        {
          since,
          afterId,
        },
      );
    } else if (since) {
      query.andWhere('tl."createdAt" > :since', {
        since,
      });
    }

    const entities = await query
      .orderBy('tl.createdAt', 'ASC')
      .addOrderBy('tl.id', 'ASC')
      .limit(limit ?? 200)
      .getMany();

    return entities.map((entity) => TaskLogMapper.toDomain(entity));
  }
}
