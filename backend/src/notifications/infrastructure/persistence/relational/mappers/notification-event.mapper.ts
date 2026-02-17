import { NotificationEvent } from '../../../../domain/notification-event';
import { NotificationEventEntity } from '../entities/notification-event.entity';

export class NotificationEventMapper {
  static toDomain(raw: NotificationEventEntity): NotificationEvent {
    const domainEntity = new NotificationEvent();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    domainEntity.taskId = raw.taskId;
    domainEntity.eventType = raw.eventType;
    domainEntity.title = raw.title;
    domainEntity.content = raw.content;
    domainEntity.payload = raw.payload;
    domainEntity.readAt = raw.readAt;
    domainEntity.createdAt = raw.createdAt;

    return domainEntity;
  }
}
