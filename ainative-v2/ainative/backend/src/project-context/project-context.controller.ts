import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { ProjectContextDto } from '../projects/dto/project-context.dto';
import { ProjectContextService } from './project-context.service';

@ApiTags('ProjectContext')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectContextController {
  constructor(private readonly projectContextService: ProjectContextService) {}

  @Get(':projectId/context')
  @ApiParam({ name: 'projectId', type: String, required: true })
  @ApiOkResponse({ type: ProjectContextDto })
  @HttpCode(HttpStatus.OK)
  readContext(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectContextDto> {
    return this.projectContextService.readContext(projectId, request.user);
  }
}
