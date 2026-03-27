import { NotificationSetting } from '../../../../domain/notification-setting';
import { NotificationSettingEntity } from '../entities/notification-setting.entity';

export class NotificationSettingMapper {
  static toDomain(raw: NotificationSettingEntity): NotificationSetting {
    const domainEntity = new NotificationSetting();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    domainEntity.webhookEnabled = raw.webhookEnabled;
    domainEntity.webhookUrl = raw.webhookUrl;
    domainEntity.webhookSecret = raw.webhookSecret;
    domainEntity.browserEnabled = raw.browserEnabled;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(
    domainEntity: NotificationSetting,
  ): NotificationSettingEntity {
    const persistenceEntity = new NotificationSettingEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.webhookEnabled = domainEntity.webhookEnabled;
    persistenceEntity.webhookUrl = domainEntity.webhookUrl;
    persistenceEntity.webhookSecret = domainEntity.webhookSecret;
    persistenceEntity.browserEnabled = domainEntity.browserEnabled;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
