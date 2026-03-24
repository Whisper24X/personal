import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { NotificationEventsEmitterService } from './notification-events-emitter.service';
import { NotificationSetting } from './domain/notification-setting';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import { NotificationEvent } from './domain/notification-event';
import { FindNotificationEventsDto } from './dto/find-notification-events.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationEventsEmitter: NotificationEventsEmitterService,
  ) {}

  @Get('settings')
  @ApiOkResponse({ type: NotificationSetting })
  @HttpCode(HttpStatus.OK)
  getSetting(@Request() request): Promise<NotificationSetting> {
    return this.notificationsService.getMySetting(request.user.sub);
  }

  @Patch('settings')
  @ApiOkResponse({ type: NotificationSetting })
  @HttpCode(HttpStatus.OK)
  updateSetting(
    @Request() request,
    @Body() updateNotificationSettingDto: UpdateNotificationSettingDto,
  ): Promise<NotificationSetting> {
    return this.notificationsService.updateMySetting(
      request.user.sub,
      updateNotificationSettingDto,
    );
  }

  @Get('events')
  @ApiOkResponse({ type: NotificationEvent, isArray: true })
  @HttpCode(HttpStatus.OK)
  listEvents(
    @Request() request,
    @Query() query: FindNotificationEventsDto,
  ): Promise<NotificationEvent[]> {
    return this.notificationsService.listMyEvents(request.user.sub, query);
  }

  @Get('events/unread-count')
  @ApiOkResponse({
    schema: { type: 'object', properties: { count: { type: 'number' } } },
  })
  @HttpCode(HttpStatus.OK)
  countUnreadEvents(@Request() request): Promise<{ count: number }> {
    return this.notificationsService.countUnreadEvents(request.user.sub);
  }

  @Post('events/read-all')
  @ApiOkResponse({
    schema: { type: 'object', properties: { affected: { type: 'number' } } },
  })
  @HttpCode(HttpStatus.OK)
  markAllEventsRead(@Request() request): Promise<{ affected: number }> {
    return this.notificationsService.markAllEventsRead(request.user.sub);
  }

  @Delete('events/read')
  @ApiOkResponse({
    schema: { type: 'object', properties: { affected: { type: 'number' } } },
  })
  @HttpCode(HttpStatus.OK)
  deleteReadEvents(@Request() request): Promise<{ affected: number }> {
    return this.notificationsService.deleteReadEvents(request.user.sub);
  }

  @Post('events/:id/read')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: NotificationEvent })
  @HttpCode(HttpStatus.OK)
  markEventRead(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationEvent> {
    return this.notificationsService.markEventRead(request.user.sub, id);
  }

  @Sse('events/stream')
  async streamEvents(@Request() request): Promise<Observable<MessageEvent>> {
    const userId: string = request.user.sub;
    const { count } = await this.notificationsService.countUnreadEvents(userId);

    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        type: 'unread_count',
        data: { count },
      });

      const unsubscribe = this.notificationEventsEmitter.subscribe(
        userId,
        (event) => {
          subscriber.next({
            id: event.id,
            type: 'new_event',
            data: event,
          });
        },
      );

      return () => {
        unsubscribe();
      };
    });
  }
}
