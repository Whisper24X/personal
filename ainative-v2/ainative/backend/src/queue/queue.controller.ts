import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { QueueService } from './queue.service';
import { QueueStatsDto } from './dto/queue-stats.dto';

@ApiTags('Queue')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'queue',
  version: '1',
})
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  @ApiOkResponse({ type: QueueStatsDto })
  @HttpCode(HttpStatus.OK)
  getStats(@Request() request): Promise<QueueStatsDto> {
    return this.queueService.getStats(request.user);
  }
}
