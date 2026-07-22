import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
  ProjectDocsPreviewDto,
  ProjectDocsPreviewQueryDto,
  ProjectDocsTreeDto,
  ProjectDocsTreeQueryDto,
  ReadProjectDocDto,
  SaveProjectDocDto,
  UploadProjectDocDto,
} from './dto/project-doc.dto';
import type { Response } from 'express';
import { ProjectDeployService } from './project-deploy.service';
import { ProjectDocsService } from './project-docs.service';
import { ProjectKnowledgeService } from './project-knowledge.service';
import { DatabaseIsolationService } from '../containers/database-isolation.service';
import { TableInfo } from '../containers/types/database-isolation.types';
import { ScanDatabaseTablesDto } from './dto/scan-database-tables.dto';
import { ProjectRepositoryWorkspaceService } from './project-repository-workspace.service';
import { WorkspaceNativeDeployService } from '../tasks/application/workspace-native-deploy.service';
import {
  isWorkspaceManaged,
  isWorkspaceNativeMode,
} from '../git/workspace-native.types';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectDocsService: ProjectDocsService,
    private readonly projectKnowledgeService: ProjectKnowledgeService,
    private readonly projectDeployService: ProjectDeployService,
    private readonly dbIsolationService: DatabaseIsolationService,
    private readonly projectRepoWorkspace: ProjectRepositoryWorkspaceService,
    private readonly workspaceNativeDeployService: WorkspaceNativeDeployService,
  ) {}

  private async guardNotWorkspaceManaged(
    projectId: string,
    currentUser: unknown,
  ): Promise<void> {
    const project = await this.projectsService.findByIdInternal(
      projectId,
      currentUser as any,
    );
    if (project && isWorkspaceManaged(project)) {
      throw new NotFoundException('Project not found');
    }
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

  @Post()
  @ApiCreatedResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto, request.user);
  }

  @Post(':id/repository-provisioning/retry')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDto })
  @HttpCode(HttpStatus.OK)
  async retryRepositoryProvisioning(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectsService.retryRepositoryProvisioning(id, request.user);
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

  @Post(':id/regenerate-runner')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.ACCEPTED)
  regenerateRunnerConfig(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.regenerateRunnerConfig(id, request.user);
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
  async listDocs(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDocsService.listDocs(id, request.user);
  }

  @Get(':id/docs/tree')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocsTreeDto })
  @HttpCode(HttpStatus.OK)
  async docsTree(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectDocsTreeQueryDto,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDocsService.docsTree(id, query, request.user);
  }

  @Get(':id/docs/file/raw')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async docsFileRaw(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectDocsPreviewQueryDto,
    @Res() res: Response,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    const { stream, mimeType, size } =
      await this.projectDocsService.docsFileStream(id, query, request.user);
    res.set({
      'Content-Type': mimeType,
      'Content-Length': size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(query.path.split('/').pop() || 'file')}"`,
    });
    stream.pipe(res);
  }

  @Get(':id/docs/preview')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocsPreviewDto })
  @HttpCode(HttpStatus.OK)
  async docsPreview(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProjectDocsPreviewQueryDto,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDocsService.docsPreview(id, query, request.user);
  }

  @Get(':id/docs/content')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.OK)
  async readDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReadProjectDocDto,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDocsService.readDoc(id, query.path, request.user);
  }

  @Post(':id/docs/upload')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['path', 'file'],
      properties: {
        path: {
          type: 'string',
          description: 'Relative path under project docs directory',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UploadProjectDocDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }
    return this.projectDocsService.uploadProjectDoc(
      id,
      body.path,
      file.buffer,
      request.user,
    );
  }

  @Post(':id/docs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.CREATED)
  async createDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: SaveProjectDocDto,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDocsService.createDoc(id, payload, request.user);
  }

  @Patch(':id/docs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ProjectDocContentDto })
  @HttpCode(HttpStatus.OK)
  async updateDoc(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: SaveProjectDocDto,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDocsService.updateDoc(id, payload, request.user);
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
    await this.guardNotWorkspaceManaged(id, request.user);
    await this.projectDocsService.removeDoc(id, query.path, request.user);
  }

  @Post(':id/docs/query')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: QueryProjectDocsResponseDto })
  @HttpCode(HttpStatus.OK)
  async queryDocs(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: QueryProjectDocsDto,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectKnowledgeService.queryDocs(id, payload, request.user);
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
    await this.guardNotWorkspaceManaged(id, request.user);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    await this.projectKnowledgeService.streamDocsQuery(
      id,
      query,
      request.user,
      (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
    );

    res.end();
  }

  @Post(':id/docs/query/stream')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiBody({ type: QueryProjectDocsDto })
  @HttpCode(HttpStatus.OK)
  async queryDocsStreamPost(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: QueryProjectDocsDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.guardNotWorkspaceManaged(id, request.user);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    await this.projectKnowledgeService.streamDocsQuery(
      id,
      body,
      request.user,
      (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      },
    );

    res.end();
  }

  @Get(':id/deploy-info')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { featureBranch: { type: 'string', nullable: true } },
    },
  })
  async getDeployInfo(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('taskId') taskId: string,
  ): Promise<{ featureBranch: string | null }> {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDeployService.getDeployInfo(id, taskId, request.user);
  }

  @Post(':id/deploy')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async deploy(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { taskId: string; command?: string },
    @Res() res: Response,
  ): Promise<void> {
    await this.guardNotWorkspaceManaged(id, request.user);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abortController = new AbortController();

    res.on('close', () => {
      abortController.abort();
    });

    const safeEmit = (event: string, data: Record<string, unknown>) => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch {
        /* connection already closed */
      }
    };

    await this.projectDeployService.deployToTest(
      id,
      body.taskId,
      request.user,
      safeEmit,
      body.command,
      abortController.signal,
    );

    if (!res.writableEnded) {
      res.end();
    }
  }

  @Get(':id/deploy-subtrees-info')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        gitPhase: { type: 'string' },
        canDeploy: { type: 'boolean' },
      },
    },
  })
  async getSubtreeDeployInfo(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('taskId') taskId: string,
  ) {
    await this.guardNotWorkspaceManaged(id, request.user);
    return this.projectDeployService.getSubtreeDeployInfo(
      id,
      taskId,
      request.user,
    );
  }

  @Post(':id/deploy-subtrees')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async deploySubtrees(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { taskId: string; forceOverwrite?: boolean },
    @Res() res: Response,
  ): Promise<void> {
    await this.guardNotWorkspaceManaged(id, request.user);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const safeEmit = (event: string, data: Record<string, unknown>) => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch {
        /* connection already closed */
      }
    };

    try {
      await this.projectDeployService.deploySubtrees(
        id,
        body.taskId,
        request.user,
        safeEmit,
        { forceOverwrite: body.forceOverwrite },
      );
    } catch (error) {
      safeEmit('deploy_error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  }

  @Post(':id/deploy-workspace-native')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async deployWorkspaceNative(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { taskId: string; targetBranches?: Record<string, string> },
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const safeEmit = (event: string, data: Record<string, unknown>) => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch {
        /* connection already closed */
      }
    };

    try {
      const project = await this.projectsService.findByIdInternal(
        id,
        request.user,
      );
      if (!project) {
        safeEmit('deploy_error', { message: 'Project not found' });
        res.end();
        return;
      }

      if (!isWorkspaceNativeMode(project)) {
        safeEmit('deploy_end', {
          success: false,
          error: 'Project is not configured for workspace-native deployment',
        });
        res.end();
        return;
      }

      const task = await this.projectDeployService.findTaskForProject(
        id,
        body.taskId,
      );
      if (!task) {
        safeEmit('deploy_error', { message: 'Task not found in this project' });
        res.end();
        return;
      }

      const targetBranches = body.targetBranches ?? {};

      const abortController = new AbortController();
      res.on('close', () => abortController.abort());

      safeEmit('deploy_start', {
        taskId: body.taskId,
        mode: 'workspace-native',
        targetBranches,
        subRepoCount:
          (
            (task.configJson as Record<string, unknown>)?.subReposSnapshot as
              | unknown[]
              | undefined
          )?.length ?? 0,
      });

      const result = await this.workspaceNativeDeployService.deploy(
        task,
        project,
        safeEmit,
        { targetBranches, signal: abortController.signal },
      );

      if (result.deployStatus.status === 'done') {
        safeEmit('deploy_end', {
          success: true,
          deployCommitSha: result.deployCommitSha,
          subRepoDeployBranches: result.subRepoDeployBranches,
          subRepoPushResults: result.deployStatus.subRepoPushResults,
        });
      } else if (result.deployStatus.status === 'cancelled') {
        safeEmit('deploy_end', {
          success: false,
          cancelled: true,
          error: '部署已取消',
          subRepoPushResults: result.deployStatus.subRepoPushResults,
        });
      } else {
        safeEmit('deploy_end', {
          success: false,
          error: '部署部分失败',
          subRepoPushResults: result.deployStatus.subRepoPushResults,
        });
      }
    } catch (error) {
      safeEmit('deploy_end', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  }

  @Get(':id/deploy-workspace-native-info')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async getWorkspaceNativeDeployInfo(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('taskId') taskId: string,
  ) {
    const project = await this.projectsService.findByIdInternal(
      id,
      request.user,
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!isWorkspaceNativeMode(project)) {
      return { enabled: false };
    }

    const task = await this.projectDeployService.findTaskForProject(id, taskId);
    if (!task) {
      throw new NotFoundException('Task not found in this project');
    }

    const taskConfig = (task.configJson ?? {}) as Record<string, unknown>;
    const workspaceSnapshot = taskConfig.workspaceSnapshot as
      | { taskBranch: string }
      | undefined;
    const subReposSnapshot = taskConfig.subReposSnapshot as
      | Array<{ url: string; prefix: string; branch: string }>
      | undefined;

    if (!workspaceSnapshot) {
      return {
        enabled: true,
        error: 'workspace-snapshot-missing',
        errorMessage:
          '该任务的 workspace 快照尚未就绪，请等待初始化完成后再部署。',
        featureBranch: null,
        subRepos: subReposSnapshot ?? [],
        deployStatus: taskConfig.deployStatus ?? null,
      };
    }

    return {
      enabled: true,
      featureBranch: workspaceSnapshot.taskBranch,
      subRepos: subReposSnapshot ?? [],
      deployStatus: taskConfig.deployStatus ?? null,
    };
  }

  @Post(':id/database-isolation/scan-tables')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          estimatedRows: { type: 'number' },
          sizeBytes: { type: 'number' },
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async scanDatabaseTables(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ScanDatabaseTablesDto,
  ): Promise<TableInfo[]> {
    const project = await this.projectsService.findById(id, request.user);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    try {
      return await this.dbIsolationService.scanTables(
        {
          host: body.host,
          port: body.port ?? 5432,
          adminUser: body.adminUser ?? 'postgres',
          sourceDatabase: body.sourceDatabase,
        },
        body.adminPassword,
      );
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      let message = error instanceof Error ? error.message : String(error);
      if (code === 'ECONNREFUSED')
        message = '数据库服务器连接被拒绝，请检查地址和端口';
      if (code === '28P01') message = '数据库认证失败，请检查用户名或密码';
      if (code === '3D000') message = '基准数据库不存在';
      throw new BadRequestException(`数据库连接失败: ${message}`);
    }
  }
}
