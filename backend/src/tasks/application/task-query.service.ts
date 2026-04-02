import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../../projects/projects.service';
import { Task } from '../domain/task';
import { TaskLog } from '../domain/task-log';
import { FindAllTasksDto } from '../dto/find-all-tasks.dto';
import { FindTaskLogsDto } from '../dto/find-task-logs.dto';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskStatusCountsDto } from '../dto/task-status-counts.dto';
import { TaskDetailDto } from '../dto/task-detail.dto';
import { TaskMessageDto } from '../dto/task-message.dto';
import { TaskLogEventsService } from '../task-log-events.service';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskLogRepository } from '../infrastructure/persistence/task-log.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { IPaginationOptions } from '../../utils/types/pagination-options';
import { TaskAccessService } from './task-access.service';
import { TaskOutputService } from './task-output.service';
import { GoalsService } from '../../goals/goals.service';
import { GoalRepository } from '../../goals/infrastructure/persistence/goal.repository';

@Injectable()
export class TaskQueryService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskLogRepository: TaskLogRepository,
    private readonly projectsService: ProjectsService,
    private readonly taskLogEventsService: TaskLogEventsService,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly taskAccessService: TaskAccessService,
    private readonly taskOutputService: TaskOutputService,
    @Inject(forwardRef(() => GoalsService))
    private readonly goalsService: GoalsService,
    private readonly goalRepository: GoalRepository,
  ) {}

  async findAllWithPagination({
    query,
    currentUser,
  }: {
    query: FindAllTasksDto;
    currentUser: JwtPayloadType;
  }): Promise<Task[]> {
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };

    if (query.projectId) {
      await this.projectsService.assertProjectCapability(
        query.projectId,
        currentUser,
        'project.task.read',
      );
    } else if (!this.taskAccessService.isAdmin(currentUser)) {
      throw new ForbiddenException('ProjectId is required for non-admin users');
    }

    return this.taskRepository.findAllWithPagination({
      paginationOptions,
      projectId: query.projectId,
      status: query.status,
    });
  }

  async countByStatusForProject(
    projectId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskStatusCountsDto> {
    await this.projectsService.assertProjectCapability(
      projectId,
      currentUser,
      'project.task.read',
    );

    const counts = await this.taskRepository.countByStatusForProject(projectId);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return {
      projectId,
      todo: counts[TaskStatus.todo],
      in_progress: counts[TaskStatus.inProgress],
      in_review: counts[TaskStatus.inReview],
      done: counts[TaskStatus.done],
      total,
    };
  }

  async findById(
    id: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<Task | null> {
    const task = await this.taskRepository.findById(id);

    if (!task) {
      return null;
    }

    await this.projectsService.assertProjectCapability(
      task.projectId,
      currentUser,
      'project.task.read',
    );

    return task;
  }

  async detailById(
    id: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(id, currentUser);
    const nodes = await this.taskNodeRepository.findByTaskId(task.id);
    const goalSummary = task.goalId
      ? await this.goalsService.getGoalSummaryForTask(task.goalId, currentUser)
      : null;

    const planDeletionBlocked =
      await this.goalRepository.shouldBlockTaskDeletionForPlan(
        task.id,
        task.status,
      );

    return {
      task,
      nodes,
      goalSummary,
      planDeletionBlocked,
    };
  }

  async listMessages(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskMessageDto[]> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
    );
    const nodes = await this.taskNodeRepository.findByTaskId(taskId);
    const nodeMessages = await Promise.all(
      nodes.map((node) =>
        this.taskOutputService.readNodeOutputMessages(task, node),
      ),
    );

    return nodeMessages.flat();
  }

  async listLogs(
    taskId: Task['id'],
    query: FindTaskLogsDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskLog[]> {
    await this.taskAccessService.getTaskOrThrow(taskId, currentUser);

    return this.taskLogRepository.findByTaskIdSince({
      taskId,
      since: this.parseDate(query.since),
      afterId: query.afterId,
      limit: query.limit,
    });
  }

  async listWorktreeFiles(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
    options?: { prefix?: string },
  ): Promise<string[]> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
    );

    if (!task.gitWorktree?.trim()) {
      return [];
    }

    return this.taskRuntimeService.listWorktreeFiles(task, options);
  }

  async readWorktreeFile(
    taskId: Task['id'],
    relativePath: string,
    currentUser: JwtPayloadType,
  ): Promise<{ path: string; content: string }> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
    );

    const content = await this.taskRuntimeService.readFileFromWorktree(
      task,
      relativePath,
    );
    if (content === null) {
      throw new NotFoundException(`Worktree file not found: ${relativePath}`);
    }

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return { path: normalized, content };
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
    subscribe: (listener: (log: TaskLog) => void) => () => void;
  }> {
    await this.taskAccessService.getTaskOrThrow(taskId, currentUser);
    void query;

    return {
      subscribe: (listener) => {
        const unsubscribeLocal = this.taskLogEventsService.subscribe(
          taskId,
          listener,
        );
        return () => {
          unsubscribeLocal();
        };
      },
    };
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  }
}
