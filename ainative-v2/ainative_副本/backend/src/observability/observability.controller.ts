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
import { ObservabilityService } from './observability.service';
import { ObservabilityMetricsDto } from './dto/observability-metrics.dto';

@ApiTags('Observability')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'observability',
  version: '1',
})
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  @ApiOkResponse({ type: ObservabilityMetricsDto })
  @HttpCode(HttpStatus.OK)
  metrics(@Request() request): Promise<ObservabilityMetricsDto> {
    return this.observabilityService.metrics(request.user);
  }
}
