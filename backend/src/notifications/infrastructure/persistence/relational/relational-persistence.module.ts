import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationSettingRepository } from '../notification-setting.repository';
import { NotificationEventRepository } from '../notification-event.repository';
import { NotificationSettingEntity } from './entities/notification-setting.entity';
import { NotificationEventEntity } from './entities/notification-event.entity';
import { NotificationSettingRelationalRepository } from './repositories/notification-setting.repository';
import { NotificationEventRelationalRepository } from './repositories/notification-event.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationSettingEntity,
      NotificationEventEntity,
    ]),
  ],
  providers: [
    {
      provide: NotificationSettingRepository,
      useClass: NotificationSettingRelationalRepository,
    },
    {
      provide: NotificationEventRepository,
      useClass: NotificationEventRelationalRepository,
    },
  ],
  exports: [NotificationSettingRepository, NotificationEventRepository],
})
export class RelationalNotificationPersistenceModule {}
