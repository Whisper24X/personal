import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { NotificationEvent } from '../../../../domain/notification-event';
import { NotificationEventRepository } from '../../notification-event.repository';
import { NotificationEventEntity } from '../entities/notification-event.entity';
import { NotificationEventMapper } from '../mappers/notification-event.mapper';

@Injectable()
export class NotificationEventRelationalRepository
  implements NotificationEventRepository
{
  constructor(
    @InjectRepository(NotificationEventEntity)
    private readonly notificationEventRepository: Repository<NotificationEventEntity>,
  ) {}

  async create(
    data: Omit<NotificationEvent, 'id' | 'createdAt' | 'readAt'>,
  ): Promise<NotificationEvent> {
    const entity = await this.notificationEventRepository.save(
      this.notificationEventRepository.create({
        userId: data.userId,
        taskId: data.taskId,
        eventType: data.eventType,
        title: data.title,
        content: data.content,
        payload: data.payload,
      }),
    );

    return NotificationEventMapper.toDomain(entity);
  }

  async findByUserId({
    userId,
    limit,
    unreadOnly,
  }: {
    userId: NotificationEvent['userId'];
    limit: number;
    unreadOnly?: boolean;
  }): Promise<NotificationEvent[]> {
    const entities = await this.notificationEventRepository.find({
      where: {
        userId,
        ...(unreadOnly ? { readAt: IsNull() } : {}),
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });

    return entities.map((entity) => NotificationEventMapper.toDomain(entity));
  }

  async findById(
    id: NotificationEvent['id'],
  ): Promise<NullableType<NotificationEvent>> {
    const entity = await this.notificationEventRepository.findOne({
      where: {
        id,
      },
    });

    return entity ? NotificationEventMapper.toDomain(entity) : null;
  }

  async markRead(
    id: NotificationEvent['id'],
    readAt: Date,
  ): Promise<NullableType<NotificationEvent>> {
    const entity = await this.notificationEventRepository.findOne({
      where: {
        id,
      },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.notificationEventRepository.save(
      this.notificationEventRepository.create({
        ...entity,
        readAt,
      }),
    );

    return NotificationEventMapper.toDomain(updatedEntity);
  }

  async markAllReadByUserId(userId: string, readAt: Date): Promise<number> {
    const result = await this.notificationEventRepository.update(
      { userId, readAt: IsNull() },
      { readAt },
    );

    return result.affected ?? 0;
  }

  async deleteReadByUserId(userId: string): Promise<number> {
    const result = await this.notificationEventRepository.delete({
      userId,
      readAt: Not(IsNull()),
    });

    return result.affected ?? 0;
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return this.notificationEventRepository.count({
      where: { userId, readAt: IsNull() },
    });
  }
}
