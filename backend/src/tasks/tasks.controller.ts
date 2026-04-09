import { Response } from 'express';
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
  Res,
  Sse,
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
import { Observable } from 'rxjs';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { Task } from './domain/task';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { FindAllTasksDto } from './dto/find-all-tasks.dto';
import { FindTaskStatsDto } from './dto/find-task-stats.dto';
import { TaskStatusCountsDto } from './dto/task-status-counts.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { TaskDetailDto } from './dto/task-detail.dto';
import { RetryTaskDto } from './dto/retry-task.dto';
import { RepeatNodeDto } from './dto/repeat-node.dto';
import { ResetNodeDto } from './dto/reset-node.dto';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { TaskLog } from './domain/task-log';
import { FindTaskLogsDto } from './dto/find-task-logs.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReplyTaskDto } from './dto/reply-task.dto';
import { TaskMessageDto } from './dto/task-message.dto';
import {
  TaskArtifactPreviewDto,
  TaskArtifactTreeDto,
  TaskWorkspaceFileDto,
  TaskWorkspaceFileQueryDto,
  TaskWorkspacePreviewDto,
  TaskWorkspaceTreeDto,
  TaskWorkspaceTreeQueryDto,
} from './dto/task-workspace.dto';
import {
  TaskGitActionResultDto,
  TaskGitBranchDiffFilesDto,
  TaskGitBranchDiffQueryDto,
  TaskGitCommitDto,
  TaskGitDiffDto,
  TaskGitDiffQueryDto,
  TaskGitFilesDto,
  TaskGitPrLinkDto,
  TaskGitStatusDto,
} from './dto/task-git.dto';
import {
  CreateTaskTerminalSessionDto,
  TaskTerminalInputDto,
  TaskTerminalSessionDto,
  TaskTerminalSessionListDto,
} from './dto/task-terminal.dto';
import { ReadWorktreeFileDto } from './dto/read-worktree-file.dto';
import { ListWorktreeFilesDto } from './dto/list-worktree-files.dto';
import { TaskWorkspaceService } from './task-workspace.service';
import { TaskGitService } from './task-git.service';
import { TaskTerminalService } from './task-terminal.service';
import { TaskWorkspaceWatchService } from './application/task-workspace-watch.service';
import { TaskEnvironmentDto } from './dto/task-environment.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'tasks',
  version: '1',
})
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskWorkspaceService: TaskWorkspaceService,
    private readonly taskGitService: TaskGitService,
    private readonly taskTerminalService: TaskTerminalService,
    private readonly taskWorkspaceWatchService: TaskWorkspaceWatchService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: Task })
  @HttpCode(HttpStatus.CREATED)
  create(@Request() request, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto, request.user);
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(Task) })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request,
    @Query() query: FindAllTasksDto,
  ): Promise<InfinityPaginationResponseDto<Task>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;

    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.tasksService.findAllWithPagination({
        query: {
          ...query,
          page,
          limit,
        },
        currentUser: request.user,
      }),
      {
        page,
        limit,
      },
    );
  }

  @Get('stats')
  @ApiOkResponse({ type: TaskStatusCountsDto })
  @HttpCode(HttpStatus.OK)
  async taskStats(
    @Request() request,
    @Query() query: FindTaskStatsDto,
  ): Promise<TaskStatusCountsDto> {
    return this.tasksService.countByStatusForProject(
      query.projectId,
      request.user,
    );
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Task })
  @HttpCode(HttpStatus.OK)
  findById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findById(id, request.user);
  }

  @Get(':id/environment')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskEnvironmentDto })
  @HttpCode(HttpStatus.OK)
  environment(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.environment(id, request.user);
  }

  @Post(':id/environment/start')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskEnvironmentDto })
  @HttpCode(HttpStatus.OK)
  startEnvironment(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.startEnvironment(id, request.user);
  }

  @Post(':id/environment/terminate')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskEnvironmentDto })
  @HttpCode(HttpStatus.OK)
  terminateEnvironment(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.terminateEnvironment(id, request.user);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  update(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateTaskDto, request.user);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tasksService.remove(id, request.user);
  }

  @Get(':id/detail')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  detailById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.detailById(id, request.user);
  }

  @Post(':id/reply')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  reply(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() replyTaskDto: ReplyTaskDto,
  ) {
    return this.tasksService.reply(id, replyTaskDto, request.user);
  }

  @Get(':id/messages')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskMessageDto, isArray: true })
  @HttpCode(HttpStatus.OK)
  messages(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.listMessages(id, request.user);
  }

  @Post(':id/execute')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  execute(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.execute(id, request.user);
  }

  @Post(':id/repeat-node')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  repeatNode(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() repeatNodeDto: RepeatNodeDto,
  ) {
    return this.tasksService.repeatNode(id, repeatNodeDto.nodeId, request.user);
  }

  @Post(':id/retry')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  retry(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() retryTaskDto: RetryTaskDto,
  ) {
    return this.tasksService.retry(id, retryTaskDto, request.user);
  }

  @Post(':id/reset-node')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  resetNode(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() resetNodeDto: ResetNodeDto,
  ) {
    return this.tasksService.resetNode(id, resetNodeDto.nodeId, request.user);
  }

  @Post(':id/cancel')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  cancel(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.cancel(id, request.user);
  }

  @Post(':id/approve')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  approve(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveTaskDto: ApproveTaskDto,
  ) {
    return this.tasksService.approve(id, approveTaskDto, request.user);
  }

  @Post(':id/complete')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  complete(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.complete(id, request.user);
  }

  @Post(':id/cleanup-worktree')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  cleanupWorktree(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.cleanupWorktree(id, request.user);
  }

  @Get(':id/workspace/tree')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskWorkspaceTreeDto })
  @HttpCode(HttpStatus.OK)
  workspaceTree(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceTreeQueryDto,
  ) {
    return this.taskWorkspaceService.getWorkspaceTree(id, query, request.user);
  }

  @Get(':id/workspace/file/raw')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async workspaceFileRaw(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceFileQueryDto,
    @Res() res: Response,
  ) {
    const { stream, mimeType, size } =
      await this.taskWorkspaceService.getWorkspaceFileStream(
        id,
        query,
        request.user,
      );
    res.set({
      'Content-Type': mimeType,
      'Content-Length': size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(query.path.split('/').pop() || 'file')}"`,
    });
    stream.pipe(res);
  }

  @Get(':id/workspace/file')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskWorkspaceFileDto })
  @HttpCode(HttpStatus.OK)
  workspaceFile(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceFileQueryDto,
  ) {
    return this.taskWorkspaceService.getWorkspaceFile(id, query, request.user);
  }

  @Get(':id/workspace/preview')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskWorkspacePreviewDto })
  @HttpCode(HttpStatus.OK)
  workspacePreview(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceFileQueryDto,
  ) {
    return this.taskWorkspaceService.getWorkspacePreview(
      id,
      query,
      request.user,
    );
  }

  @Get(':id/git/status')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitStatusDto })
  @HttpCode(HttpStatus.OK)
  gitStatus(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.taskGitService.getStatus(id, request.user);
  }

  @Get(':id/git/diff')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitDiffDto })
  @HttpCode(HttpStatus.OK)
  gitDiff(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskGitDiffQueryDto,
  ) {
    return this.taskGitService.getDiff(id, query, request.user);
  }

  @Get(':id/git/artifacts/tree')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskArtifactTreeDto })
  @HttpCode(HttpStatus.OK)
  gitArtifactsTree(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceTreeQueryDto,
  ) {
    return this.taskGitService.getArtifactTree(id, query, request.user);
  }

  @Get(':id/git/artifacts/raw')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async gitArtifactRaw(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceFileQueryDto,
    @Res() res: Response,
  ) {
    const { content, mimeType, size, name } =
      await this.taskGitService.getArtifactRawFile(id, query, request.user);
    res.set({
      'Content-Type': mimeType,
      'Content-Length': size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`,
    });
    res.send(content);
  }

  @Get(':id/git/artifacts/preview')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskArtifactPreviewDto })
  @HttpCode(HttpStatus.OK)
  gitArtifactPreview(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskWorkspaceFileQueryDto,
  ) {
    return this.taskGitService.getArtifactPreview(id, query, request.user);
  }

  @Get(':id/git/branch-diff-files')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitBranchDiffFilesDto })
  @HttpCode(HttpStatus.OK)
  gitBranchDiffFiles(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskGitBranchDiffQueryDto,
  ) {
    return this.taskGitService.getBranchDiffFiles(id, query, request.user);
  }

  @Get(':id/git/branch-diff')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitDiffDto })
  @HttpCode(HttpStatus.OK)
  gitBranchDiff(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TaskGitBranchDiffQueryDto,
  ) {
    return this.taskGitService.getBranchDiff(id, query, request.user);
  }

  @Post(':id/git/stage')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitStage(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TaskGitFilesDto,
  ) {
    return this.taskGitService.stageFiles(id, payload, request.user);
  }

  @Post(':id/git/unstage')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitUnstage(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TaskGitFilesDto,
  ) {
    return this.taskGitService.unstageFiles(id, payload, request.user);
  }

  @Post(':id/git/commit')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitCommit(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TaskGitCommitDto,
  ) {
    return this.taskGitService.commit(id, payload, request.user);
  }

  @Post(':id/git/merge')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitMerge(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TaskGitBranchDiffQueryDto,
  ) {
    return this.taskGitService.merge(id, payload, request.user);
  }

  @Post(':id/git/rebase')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitRebase(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TaskGitBranchDiffQueryDto,
  ) {
    return this.taskGitService.rebase(id, payload, request.user);
  }

  @Post(':id/git/push')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitPush(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.taskGitService.push(id, request.user);
  }

  @Get(':id/git/log')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitActionResultDto })
  @HttpCode(HttpStatus.OK)
  gitLog(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.taskGitService.getLog(id, request.user);
  }

  @Post(':id/git/pr-link')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskGitPrLinkDto })
  @HttpCode(HttpStatus.OK)
  gitPrLink(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: TaskGitBranchDiffQueryDto,
  ) {
    return this.taskGitService.getPrLink(id, payload, request.user);
  }

  @Post(':id/terminal/sessions')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: TaskTerminalSessionDto })
  @HttpCode(HttpStatus.CREATED)
  createTerminalSession(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: CreateTaskTerminalSessionDto,
  ) {
    return this.taskTerminalService.createSession(id, payload, request.user);
  }

  @Get(':id/terminal/sessions')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskTerminalSessionListDto })
  @HttpCode(HttpStatus.OK)
  async listTerminalSessions(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskTerminalSessionListDto> {
    const sessions = await this.taskTerminalService.listSessions(
      id,
      request.user,
    );

    return {
      sessions,
    };
  }

  @Post(':id/terminal/sessions/:sessionId/input')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'sessionId', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async inputTerminalSession(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId') sessionId: string,
    @Body() payload: TaskTerminalInputDto,
  ): Promise<void> {
    await this.taskTerminalService.input(id, sessionId, payload, request.user);
  }

  @Post(':id/terminal/sessions/:sessionId/stop')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'sessionId', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async stopTerminalSession(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.taskTerminalService.stopSession(id, sessionId, request.user);
  }

  @Delete(':id/terminal/sessions/:sessionId')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'sessionId', type: String, required: true })
  @HttpCode(HttpStatus.OK)
  async removeTerminalSession(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.taskTerminalService.removeSession(id, sessionId, request.user);
  }

  @Sse(':id/terminal/sessions/:sessionId/stream')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiParam({ name: 'sessionId', type: String, required: true })
  async streamTerminalSession(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId') sessionId: string,
  ): Promise<Observable<MessageEvent>> {
    const stream = await this.taskTerminalService.openSessionStream({
      taskId: id,
      sessionId,
      currentUser: request.user,
    });

    return new Observable<MessageEvent>((subscriber) => {
      for (const historyEvent of stream.history) {
        subscriber.next({
          type: 'task-terminal',
          data: historyEvent,
        });
      }

      const unsubscribe = stream.subscribe((event) => {
        subscriber.next({
          type: 'task-terminal',
          data: event,
        });
      });

      return () => {
        unsubscribe();
      };
    });
  }

  @Get(':id/logs')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskLog, isArray: true })
  @HttpCode(HttpStatus.OK)
  logs(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindTaskLogsDto,
  ) {
    return this.tasksService.listLogs(id, query, request.user);
  }

  @Get(':id/worktree-files')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: String, isArray: true })
  @HttpCode(HttpStatus.OK)
  listWorktreeFiles(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListWorktreeFilesDto,
  ) {
    return this.tasksService.listWorktreeFiles(id, request.user, {
      prefix: query.prefix,
    });
  }

  @Get(':id/worktree-files/content')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
    },
  })
  @HttpCode(HttpStatus.OK)
  readWorktreeFile(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReadWorktreeFileDto,
  ) {
    return this.tasksService.readWorktreeFile(id, query.path, request.user);
  }

  @Sse(':taskId/stream')
  @ApiParam({ name: 'taskId', type: String, required: true })
  async stream(
    @Request() request,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: FindTaskLogsDto,
  ): Promise<Observable<MessageEvent>> {
    const stream = await this.tasksService.openLogStream({
      taskId,
      query,
      currentUser: request.user,
    });

    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = stream.subscribe((log) => {
        subscriber.next({
          id: log.id,
          type: 'task-log',
          data: log,
        });
      });
      const unsubscribeWorkspace = this.taskWorkspaceWatchService.subscribe(
        taskId,
        (event) => {
          subscriber.next({
            id: event.id,
            type: 'task-workspace-change',
            data: event,
          });
        },
      );

      const heartbeatInterval = setInterval(() => {
        subscriber.next({
          type: 'heartbeat',
          data: '',
        } as MessageEvent);
      }, 30_000);

      return () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        unsubscribeWorkspace();
      };
    });
  }
}
