import { NullableType } from '../../../utils/types/nullable.type';
import { NotificationSetting } from '../../domain/notification-setting';

export abstract class NotificationSettingRepository {
  abstract findByUserId(
    userId: NotificationSetting['userId'],
  ): Promise<NullableType<NotificationSetting>>;

  abstract create(
    data: Omit<NotificationSetting, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationSetting>;

  abstract update(
    id: NotificationSetting['id'],
    payload: Partial<NotificationSetting>,
  ): Promise<NullableType<NotificationSetting>>;
}
