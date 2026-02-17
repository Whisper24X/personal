import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
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
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
