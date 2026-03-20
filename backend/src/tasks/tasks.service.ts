import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { Task } from './domain/task';
import { TaskLog } from './domain/task-log';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { FindAllTasksDto } from './dto/find-all-tasks.dto';
import { FindTaskLogsDto } from './dto/find-task-logs.dto';
import { ReplyTaskDto } from './dto/reply-task.dto';
import { RetryTaskDto } from './dto/retry-task.dto';
import { TaskDetailDto } from './dto/task-detail.dto';
import { TaskMessageDto } from './dto/task-message.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskAccessService } from './application/task-access.service';
import { TaskCommandService } from './application/task-command.service';
import { TaskInteractionService } from './application/task-interaction.service';
import { TaskQueryService } from './application/task-query.service';
import { TaskSchedulerService } from './application/task-scheduler.service';
import { TaskStatusService } from './application/task-status.service';
import { TaskOutputService } from './application/task-output.service';
import { TaskNode } from './domain/task-node';

@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly taskCommandService: TaskCommandService,
    private readonly taskInteractionService: TaskInteractionService,
    private readonly taskQueryService: TaskQueryService,
    private readonly taskSchedulerService: TaskSchedulerService,
    private readonly taskAccessService: TaskAccessService,
    private readonly taskStatusService: TaskStatusService,
    private readonly taskOutputService: TaskOutputService,
  ) {}

  onModuleInit(): void {
    this.taskSchedulerService.onModuleInit();
  }

  onModuleDestroy(): void {
    this.taskSchedulerService.onModuleDestroy();
  }

  async create(
    createTaskDto: CreateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    return this.taskCommandService.create(createTaskDto, currentUser);
  }

  async findAllWithPagination({
    query,
    currentUser,
  }: {
    query: FindAllTasksDto;
    currentUser: JwtPayloadType;
  }): Promise<Task[]> {
    return this.taskQueryService.findAllWithPagination({
      query,
      currentUser,
    });
  }

  async findById(
    id: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<Task | null> {
    return this.taskQueryService.findById(id, currentUser);
  }

  async detailById(
    id: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskQueryService.detailById(id, currentUser);
  }

  async update(
    taskId: Task['id'],
    updateTaskDto: UpdateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskCommandService.update(taskId, updateTaskDto, currentUser);
  }

  async remove(taskId: Task['id'], currentUser: JwtPayloadType): Promise<void> {
    await this.taskCommandService.remove(taskId, currentUser);
  }

  async reply(
    taskId: Task['id'],
    replyTaskDto: ReplyTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.reply(taskId, replyTaskDto, currentUser);
  }

  async listMessages(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskMessageDto[]> {
    return this.taskQueryService.listMessages(taskId, currentUser);
  }

  async execute(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.execute(taskId, currentUser);
  }

  async repeat(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.repeat(taskId, currentUser);
  }

  async repeatNode(
    taskId: Task['id'],
    nodeId: TaskNode['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.repeatNode(taskId, nodeId, currentUser);
  }

  async retry(
    taskId: Task['id'],
    retryTaskDto: RetryTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.retry(taskId, retryTaskDto, currentUser);
  }

  async cancel(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.cancel(taskId, currentUser);
  }

  async approve(
    taskId: Task['id'],
    approveTaskDto: ApproveTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.approve(
      taskId,
      approveTaskDto,
      currentUser,
    );
  }

  async cleanupWorktree(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    return this.taskInteractionService.cleanupWorktree(taskId, currentUser);
  }

  async listLogs(
    taskId: Task['id'],
    query: FindTaskLogsDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskLog[]> {
    return this.taskQueryService.listLogs(taskId, query, currentUser);
  }

  async listWorktreeFiles(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
    options?: { prefix?: string },
  ): Promise<string[]> {
    return this.taskQueryService.listWorktreeFiles(
      taskId,
      currentUser,
      options,
    );
  }

  async readWorktreeFile(
    taskId: Task['id'],
    relativePath: string,
    currentUser: JwtPayloadType,
  ): Promise<{ path: string; content: string }> {
    return this.taskQueryService.readWorktreeFile(
      taskId,
      relativePath,
      currentUser,
    );
  }

  async openLogStream({
    taskId,
    query,
    currentUser,
  }: {
    taskId: Task['id'];
    query: FindTaskLogsDto;
    currentUser: JwtPayloadType;
  }): Promise<{
    history: TaskLog[];
    subscribe: (listener: (log: TaskLog) => void) => () => void;
  }> {
    return this.taskQueryService.openLogStream({
      taskId,
      query,
      currentUser,
    });
  }

  async assertCanAccessTask(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    return this.taskAccessService.assertCanAccessTask(taskId, currentUser);
  }

  async assertCanAccessTaskProject(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; project: Project }> {
    return this.taskAccessService.assertCanAccessTaskProject(
      taskId,
      currentUser,
    );
  }

  private calculateTaskStatus(nodes: TaskNode[]): Task['status'] {
    return this.taskStatusService.calculateTaskStatus(nodes);
  }

  private async readNodeOutputSummary(node: TaskNode): Promise<string | null> {
    return this.taskOutputService.readNodeOutputSummary(node);
  }
}
