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
import { ProjectsService } from './projects.service';
import { Project } from './domain/project';
import { ProjectDto } from './dto/project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllProjectsDto } from './dto/find-all-projects.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { ProjectMember } from './domain/project-member';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import {
  InspectProjectRepositoryDto,
  ProjectRepositoryInspectionDto,
} from './dto/inspect-project-repository.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiCreatedResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto, request.user);
  }

  @Post('inspect-repository')
  @ApiOkResponse({ type: ProjectRepositoryInspectionDto })
  @HttpCode(HttpStatus.OK)
  inspectRepository(
    @Request() request,
    @Body() inspectProjectRepositoryDto: InspectProjectRepositoryDto,
  ): Promise<ProjectRepositoryInspectionDto> {
    return this.projectsService.inspectRepository(
      inspectProjectRepositoryDto,
      request.user,
    );
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(ProjectDto),
  })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllProjectsDto,
  ): Promise<InfinityPaginationResponseDto<Project>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.projectsService.findAllWithPagination({
        currentUser: request.user,
        query: {
          ...query,
          page,
          limit,
        },
      }),
      {
        page,
        limit,
      },
    );
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.OK)
  findById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findById(id, request.user);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto, request.user);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.projectsService.remove(id, request.user);
  }

  @Get(':projectId/members')
  @ApiParam({ name: 'projectId', type: String, required: true })
  @ApiOkResponse({ type: ProjectMember, isArray: true })
  @HttpCode(HttpStatus.OK)
  findMembers(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectsService.findMembers(projectId, request.user);
  }

  @Post(':projectId/members')
  @ApiParam({ name: 'projectId', type: String, required: true })
  @ApiCreatedResponse({ type: ProjectMember })
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() createProjectMemberDto: CreateProjectMemberDto,
  ) {
    return this.projectsService.addMember(
      projectId,
      createProjectMemberDto,
      request.user,
    );
  }

  @Patch(':projectId/members/:userId')
  @ApiParam({ name: 'projectId', type: String, required: true })
  @ApiParam({ name: 'userId', type: String, required: true })
  @ApiOkResponse({ type: ProjectMember })
  @HttpCode(HttpStatus.OK)
  updateMemberRole(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateProjectMemberDto: UpdateProjectMemberDto,
  ) {
    return this.projectsService.updateMemberRole(
      projectId,
      userId,
      updateProjectMemberDto,
      request.user,
    );
  }

  @Delete(':projectId/members/:userId')
  @ApiParam({ name: 'projectId', type: String, required: true })
  @ApiParam({ name: 'userId', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.projectsService.removeMember(projectId, userId, request.user);
  }
}
