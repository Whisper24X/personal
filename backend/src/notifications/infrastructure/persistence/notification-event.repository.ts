import { NullableType } from '../../../utils/types/nullable.type';
import { NotificationEvent } from '../../domain/notification-event';

export abstract class NotificationEventRepository {
  abstract create(
    data: Omit<NotificationEvent, 'id' | 'createdAt' | 'readAt'>,
  ): Promise<NotificationEvent>;

  abstract findByUserId({
    userId,
    limit,
    unreadOnly,
  }: {
    userId: NotificationEvent['userId'];
    limit: number;
    unreadOnly?: boolean;
  }): Promise<NotificationEvent[]>;

  abstract findById(
    id: NotificationEvent['id'],
  ): Promise<NullableType<NotificationEvent>>;

  abstract markRead(
    id: NotificationEvent['id'],
    readAt: Date,
  ): Promise<NullableType<NotificationEvent>>;

  abstract markAllReadByUserId(
    userId: NotificationEvent['userId'],
    readAt: Date,
  ): Promise<number>;

  abstract deleteReadByUserId(
    userId: NotificationEvent['userId'],
  ): Promise<number>;

  abstract countUnreadByUserId(
    userId: NotificationEvent['userId'],
  ): Promise<number>;
}
