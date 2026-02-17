import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Project } from '../projects/domain/project';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { Task } from '../tasks/domain/task';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import {
  ProjectQueueStatsDto,
  QueueGlobalStatsDto,
  QueueStatsDto,
} from './dto/queue-stats.dto';

@Injectable()
export class QueueService {
  private readonly pageLimit = 200;

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async getStats(currentUser: JwtPayloadType): Promise<QueueStatsDto> {
    this.ensureAdmin(currentUser);
    const now = new Date();

    const [tasks, projects] = await Promise.all([
      this.fetchAllTasks(),
      this.fetchAllProjects(),
    ]);

    const projectIds = projects.map((project) => project.id);
    const [
      runningByProject,
      queuedByProject,
      globalRunning,
      staleRunning,
      oldestQueuedTaskCreatedAt,
    ] =
      await Promise.all([
        this.taskRepository.countRunningTasksByProjectIds(projectIds, now),
        this.taskRepository.countQueuedTasksByProjectIds(projectIds, now),
        this.taskRepository.countRunningTasks(now),
        this.taskRepository.countStaleRunningTasks(now),
        this.taskRepository.findOldestQueuedTaskCreatedAt(now),
      ]);

    const projectMap = new Map(
      projects.map((project) => [project.id, project]),
    );

    const projectStatsMap = new Map<string, ProjectQueueStatsDto>();

    for (const task of tasks) {
      const project = projectMap.get(task.projectId);
      const existedStats = projectStatsMap.get(task.projectId);

      const projectStats = existedStats ?? {
        projectId: task.projectId,
        projectName: project?.name ?? task.projectId,
        maxConcurrency: this.resolveProjectConcurrency(project),
        running: runningByProject[task.projectId] ?? 0,
        queued: queuedByProject[task.projectId] ?? 0,
        inReview: 0,
        done: 0,
      };

      if (task.status === TaskStatus.inReview) {
        projectStats.inReview += 1;
      } else if (task.status === TaskStatus.done) {
        projectStats.done += 1;
      }

      projectStatsMap.set(task.projectId, projectStats);
    }

    const projectStats = Array.from(projectStatsMap.values()).sort(
      (left, right) => {
        const leftQueued = left.queued + left.running + left.inReview;
        const rightQueued = right.queued + right.running + right.inReview;

        if (leftQueued !== rightQueued) {
          return rightQueued - leftQueued;
        }

        return left.projectName.localeCompare(right.projectName);
      },
    );

    const globalMaxConcurrency = this.resolveGlobalConcurrency(projects);
    const globalQueued = Object.values(queuedByProject).reduce(
      (sum, count) => sum + count,
      0,
    );
    const globalInReview = tasks.filter(
      (task) => task.status === TaskStatus.inReview,
    ).length;
    const globalDone = tasks.filter(
      (task) => task.status === TaskStatus.done,
    ).length;

    const global: QueueGlobalStatsDto = {
      maxConcurrency: globalMaxConcurrency,
      running: globalRunning,
      queued: globalQueued,
      inReview: globalInReview,
      done: globalDone,
      availableSlots: Math.max(globalMaxConcurrency - globalRunning, 0),
      saturationRate:
        globalMaxConcurrency > 0
          ? Number(((globalRunning / globalMaxConcurrency) * 100).toFixed(2))
          : 0,
      staleRunning,
      dispatchLagSeconds: oldestQueuedTaskCreatedAt
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - oldestQueuedTaskCreatedAt.getTime()) / 1_000,
            ),
          )
        : null,
      workerHeartbeatSkew: null,
    };

    return {
      generatedAt: new Date(),
      global,
      projects: projectStats,
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

  private resolveProjectConcurrency(project?: Project): number {
    if (!project?.configJson) {
      return 2;
    }

    const config = project.configJson as Record<string, unknown>;
    const maxConcurrency = config.maxConcurrency;

    if (typeof maxConcurrency === 'number' && maxConcurrency > 0) {
      return Math.floor(maxConcurrency);
    }

    return 2;
  }

  private resolveGlobalConcurrency(projects: Project[]): number {
    if (!projects.length) {
      return 10;
    }

    const total = projects.reduce((sum, project) => {
      return sum + this.resolveProjectConcurrency(project);
    }, 0);

    return Math.max(total, 1);
  }

  private ensureAdmin(currentUser: JwtPayloadType): void {
    if (!currentUser.roles?.includes('admin')) {
      throw new ForbiddenException('forbiddenQueueView');
    }
  }
}
