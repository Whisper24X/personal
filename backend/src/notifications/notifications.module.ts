import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventsEmitterService } from './notification-events-emitter.service';
import { RelationalNotificationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalNotificationPersistenceModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventsEmitterService],
  exports: [
    NotificationsService,
    NotificationEventsEmitterService,
    RelationalNotificationPersistenceModule,
  ],
})
export class NotificationsModule {}
