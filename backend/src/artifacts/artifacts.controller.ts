import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { ArtifactsService } from './artifacts.service';
import { TaskArtifact } from '../tasks/domain/task-artifact';
import { ArtifactPreviewDto } from './dto/artifact-preview.dto';
import { ArtifactPreviewQueryDto } from './dto/artifact-preview-query.dto';

@ApiTags('Artifacts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'artifacts',
  version: '1',
})
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskArtifact })
  @HttpCode(HttpStatus.OK)
  findById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.artifactsService.findById(id, request.user);
  }

  @Get(':id/download')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string', format: 'uuid' },
        downloadUrl: { type: 'string', nullable: true },
        content: { type: 'string', nullable: true },
        suggestedFileName: { type: 'string', nullable: true },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  download(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ArtifactPreviewQueryDto,
  ) {
    return this.artifactsService.resolveDownload(
      id,
      request.user,
      query.worktreePath,
    );
  }

  @Get(':id/preview')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ArtifactPreviewDto })
  @HttpCode(HttpStatus.OK)
  preview(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ArtifactPreviewQueryDto,
  ) {
    return this.artifactsService.resolvePreview(
      id,
      request.user,
      query.worktreePath,
    );
  }
}
