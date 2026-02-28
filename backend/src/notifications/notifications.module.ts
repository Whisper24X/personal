import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RelationalNotificationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { NotificationEmailService } from './notification-email.service';

@Module({
  imports: [RelationalNotificationPersistenceModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEmailService],
  exports: [NotificationsService, RelationalNotificationPersistenceModule],
})
export class NotificationsModule {}
