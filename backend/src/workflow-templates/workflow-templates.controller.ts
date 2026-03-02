import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './dto/update-workflow-template.dto';
import { WorkflowTemplate } from './domain/workflow-template';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllWorkflowTemplatesDto } from './dto/find-all-workflow-templates.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { WorkflowTemplateVersion } from './domain/workflow-template-version';
import { ReorderWorkflowTemplateNodesDto } from './dto/reorder-workflow-template-nodes.dto';

@ApiTags('WorkflowTemplates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'workflow-templates',
  version: '1',
})
export class WorkflowTemplatesController {
  constructor(
    private readonly workflowTemplatesService: WorkflowTemplatesService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: WorkflowTemplate })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request,
    @Body() createWorkflowTemplateDto: CreateWorkflowTemplateDto,
  ) {
    return this.workflowTemplatesService.create(
      createWorkflowTemplateDto,
      request.user,
    );
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(WorkflowTemplate) })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllWorkflowTemplatesDto,
  ): Promise<InfinityPaginationResponseDto<WorkflowTemplate>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.workflowTemplatesService.findAllWithPagination(
        {
          ...query,
          page,
          limit,
        },
        request.user,
      ),
      {
        page,
        limit,
      },
    );
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: WorkflowTemplate })
  @HttpCode(HttpStatus.OK)
  findById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.workflowTemplatesService.findById(id, request.user);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: WorkflowTemplate })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkflowTemplateDto: UpdateWorkflowTemplateDto,
  ) {
    return this.workflowTemplatesService.update(
      id,
      updateWorkflowTemplateDto,
      request.user,
    );
  }

  @Put(':id/nodes/reorder')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: WorkflowTemplate })
  @HttpCode(HttpStatus.OK)
  reorderNodes(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reorderDto: ReorderWorkflowTemplateNodesDto,
  ) {
    return this.workflowTemplatesService.reorderNodes(
      id,
      reorderDto,
      request.user,
    );
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workflowTemplatesService.remove(id, request.user);
  }

  @Post(':id/publish')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: WorkflowTemplateVersion })
  @HttpCode(HttpStatus.CREATED)
  publish(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowTemplateVersion> {
    return this.workflowTemplatesService.publishTemplateVersion(
      id,
      request.user,
    );
  }

  @Get(':id/versions')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: WorkflowTemplateVersion, isArray: true })
  @HttpCode(HttpStatus.OK)
  versions(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowTemplateVersion[]> {
    return this.workflowTemplatesService.findVersions(id, request.user);
  }
}
