import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { Task } from '../tasks/domain/task';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { QueueService } from '../queue/queue.service';
import { ObservabilityMetricsDto } from './dto/observability-metrics.dto';

@Injectable()
export class ObservabilityService {
  private readonly pageLimit = 200;

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly queueService: QueueService,
  ) {}

  async metrics(currentUser: JwtPayloadType): Promise<ObservabilityMetricsDto> {
    this.ensureAdmin(currentUser);

    const [tasks, projects, queueStats] = await Promise.all([
      this.fetchAllTasks(),
      this.fetchAllProjects(),
      this.queueService.getStats(currentUser),
    ]);

    const statusCounts = {
      todo: tasks.filter((task) => task.status === TaskStatus.todo).length,
      inProgress: tasks.filter((task) => task.status === TaskStatus.inProgress)
        .length,
      inReview: tasks.filter((task) => task.status === TaskStatus.inReview)
        .length,
      done: tasks.filter((task) => task.status === TaskStatus.done).length,
    };

    const completedTasks = statusCounts.done + statusCounts.inReview;
    const successRate =
      completedTasks > 0
        ? Number(((statusCounts.done / completedTasks) * 100).toFixed(2))
        : 0;

    const finishedDurations = tasks
      .filter(
        (task) =>
          task.status === TaskStatus.done && task.startedAt && task.finishedAt,
      )
      .map((task) => {
        return (
          (task.finishedAt!.getTime() - task.startedAt!.getTime()) / (1000 * 60)
        );
      })
      .filter((duration) => duration >= 0);

    const averageDurationMinutes =
      finishedDurations.length > 0
        ? Number(
            (
              finishedDurations.reduce((sum, duration) => sum + duration, 0) /
              finishedDurations.length
            ).toFixed(2),
          )
        : null;

    const alerts: ObservabilityMetricsDto['alerts'] = [];

    if (statusCounts.inReview > 0) {
      alerts.push({
        level: 'warn',
        code: 'TASK_NEEDS_REVIEW',
        message: `当前有 ${statusCounts.inReview} 个任务处于 in_review。`,
      });
    }

    if (
      queueStats.global.availableSlots === 0 &&
      queueStats.global.queued > 0
    ) {
      alerts.push({
        level: 'warn',
        code: 'QUEUE_SATURATED',
        message: `队列已满载，仍有 ${queueStats.global.queued} 个任务等待执行。`,
      });
    }

    if (queueStats.global.staleRunning > 0) {
      alerts.push({
        level: 'error',
        code: 'WORKER_STALE_RUNNING',
        message: `检测到 ${queueStats.global.staleRunning} 个运行节点租约已过期。`,
      });
    }

    if (completedTasks >= 5 && successRate < 80) {
      alerts.push({
        level: 'error',
        code: 'LOW_SUCCESS_RATE',
        message: `成功率仅 ${successRate}%（近期待完成任务样本）。`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        level: 'info',
        code: 'SYSTEM_HEALTHY',
        message: '暂无异常告警。',
      });
    }

    return {
      generatedAt: new Date(),
      totalProjects: projects.length,
      totalTasks: tasks.length,
      statusCounts,
      successRate,
      averageDurationMinutes,
      queueLength: queueStats.global.queued,
      runningTasks: queueStats.global.running,
      maxConcurrency: queueStats.global.maxConcurrency,
      concurrencyUsage: queueStats.global.saturationRate,
      staleRunning: queueStats.global.staleRunning,
      dispatchLagSeconds: queueStats.global.dispatchLagSeconds ?? null,
      workerHeartbeatSkew: queueStats.global.workerHeartbeatSkew ?? null,
      alerts,
    };
  }

  private async fetchAllTasks(): Promise<Task[]> {
    const tasks: Task[] = [];
    let page = 1;

    while (true) {
      const pageData = await this.taskRepository.findAllWithPagination({
        paginationOptions: {
          page,
          limit: this.pageLimit,
        },
      });

      tasks.push(...pageData);

      if (pageData.length < this.pageLimit) {
        break;
      }

      page += 1;
    }

    return tasks;
  }

  private async fetchAllProjects(): Promise<Project[]> {
    const projects: Project[] = [];
    let page = 1;

    while (true) {
      const pageData = await this.projectRepository.findAllWithPagination({
        paginationOptions: {
          page,
          limit: this.pageLimit,
        },
      });

      projects.push(...pageData);

      if (pageData.length < this.pageLimit) {
        break;
      }

      page += 1;
    }

    return projects;
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenObservabilityView');
    }
  }
}
