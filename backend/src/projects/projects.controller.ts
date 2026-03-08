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
  Res,
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
import { ProjectCustomRole } from './domain/project-custom-role';
import { CreateProjectCustomRoleDto } from './dto/create-project-custom-role.dto';
import { UpdateProjectCustomRoleDto } from './dto/update-project-custom-role.dto';
import {
  InspectProjectRepositoryDto,
  ProjectRepositoryInspectionDto,
} from './dto/inspect-project-repository.dto';
import {
  QueryProjectDocsDto,
  QueryProjectDocsResponseDto,
  ProjectDocContentDto,
  ProjectDocItemDto,
  ReadProjectDocDto,
  SaveProjectDocDto,
} from './dto/project-doc.dto';
import type { Response } from 'express';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

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

  @Post()
  @ApiCreatedResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto, request.user);
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

  @Get(':projectId/custom-roles')
  @ApiParam({
    name: 'projectId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: ProjectCustomRole,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  findCustomRoles(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectsService.findCustomRoles(projectId, request.user);
  }

  @Get(':projectId/custom-role-library')
  @ApiParam({
    name: 'projectId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: ProjectCustomRole,
    isArray: true,
  })
  @HttpCode(HttpStatus.OK)
  findCustomRoleLibrary(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectsService.findCustomRoleLibrary(projectId, request.user);
  }

  @Post(':projectId/custom-roles')
  @ApiParam({
    name: 'projectId',
    type: String,
    required: true,
  })
  @ApiCreatedResponse({
    type: ProjectCustomRole,
  })
  @HttpCode(HttpStatus.CREATED)
  createCustomRole(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() createProjectCustomRoleDto: CreateProjectCustomRoleDto,
  ) {
    return this.projectsService.createCustomRole(
      projectId,
      createProjectCustomRoleDto,
      request.user,
    );
  }

  @Patch(':projectId/custom-roles/:roleId')
  @ApiParam({
    name: 'projectId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'roleId',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: ProjectCustomRole,
  })
  @HttpCode(HttpStatus.OK)
  updateCustomRole(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() updateProjectCustomRoleDto: UpdateProjectCustomRoleDto,
  ) {
    return this.projectsService.updateCustomRole(
      projectId,
      roleId,
      updateProjectCustomRoleDto,
      request.user,
    );
  }

  @Delete(':projectId/custom-roles/:roleId')
  @ApiParam({
    name: 'projectId',
    type: String,
    required: true,
  })
  @ApiParam({
    name: 'roleId',
    type: String,
    required: true,
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCustomRole(
    @Request() request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.projectsService.removeCustomRole(
      projectId,
      roleId,
      request.user,
    );
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

  @Get(':id/docs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocItemDto, isArray: true })
  @HttpCode(HttpStatus.OK)
  listDocs(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.listDocs(id, request.user);
  }

  @Get(':id/docs/content')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.OK)
  readDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReadProjectDocDto,
  ) {
    return this.projectsService.readDoc(id, query.path, request.user);
  }

  @Post(':id/docs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.CREATED)
  createDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: SaveProjectDocDto,
  ) {
    return this.projectsService.createDoc(id, payload, request.user);
  }

  @Patch(':id/docs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.OK)
  updateDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: SaveProjectDocDto,
  ) {
    return this.projectsService.updateDoc(id, payload, request.user);
  }

  @Delete(':id/docs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReadProjectDocDto,
  ): Promise<void> {
    await this.projectsService.removeDoc(id, query.path, request.user);
  }

  @Post(':id/docs/query')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: QueryProjectDocsResponseDto })
  @HttpCode(HttpStatus.OK)
  queryDocs(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: QueryProjectDocsDto,
  ) {
    return this.projectsService.queryDocs(id, payload, request.user);
  }

  @Get(':id/docs/query/stream')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async queryDocsStream(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryProjectDocsDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    await this.projectsService.streamDocsQuery(id, query, request.user, (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    });

    res.end();
  }
}
