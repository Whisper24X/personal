import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { infinityPagination } from '../utils/infinity-pagination';
import { TaskDetailDto } from './dto/task-detail.dto';
import { RetryTaskDto } from './dto/retry-task.dto';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { TaskLog } from './domain/task-log';
import { FindTaskLogsDto } from './dto/find-task-logs.dto';
import { TaskArtifact } from './domain/task-artifact';
import { CreateTaskArtifactDto } from './dto/create-task-artifact.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'tasks',
  version: '1',
})
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: Task })
  @HttpCode(HttpStatus.OK)
  findById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findById(id, request.user);
  }

  @Get(':id/detail')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  detailById(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.detailById(id, request.user);
  }

  @Post(':id/execute')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  execute(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.execute(id, request.user);
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

  @Post(':id/cleanup-worktree')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskDetailDto })
  @HttpCode(HttpStatus.OK)
  cleanupWorktree(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.cleanupWorktree(id, request.user);
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

  @Get(':id/artifacts')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TaskArtifact, isArray: true })
  @HttpCode(HttpStatus.OK)
  artifacts(@Request() request, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.listArtifacts(id, request.user);
  }

  @Post(':id/artifacts')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: TaskArtifact })
  @HttpCode(HttpStatus.CREATED)
  createArtifact(
    @Request() request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createTaskArtifactDto: CreateTaskArtifactDto,
  ) {
    return this.tasksService.createArtifact(
      id,
      createTaskArtifactDto,
      request.user,
    );
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
      for (const historyLog of stream.history) {
        subscriber.next({
          id: historyLog.id,
          type: 'task-log',
          data: historyLog,
        });
      }

      const unsubscribe = stream.subscribe((log) => {
        subscriber.next({
          id: log.id,
          type: 'task-log',
          data: log,
        });
      });

      return () => {
        unsubscribe();
      };
    });
  }
}
