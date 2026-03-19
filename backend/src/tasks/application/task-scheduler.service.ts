import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Project } from '../../projects/domain/project';
import { ProjectRepository } from '../../projects/infrastructure/persistence/project.repository';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskAccessService } from './task-access.service';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import { TaskNodeExecutionService } from './task-node-execution.service';
import { TaskOutputService } from './task-output.service';
import { TaskStatusService } from './task-status.service';

@Injectable()
export class TaskSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = `${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
  private readonly schedulerIntervalMs = this.readPositiveNumberFromEnv(
    'AINATIVE_DISPATCH_INTERVAL_MS',
    1_000,
  );
  private readonly nodeLeaseTtlMs = this.readPositiveNumberFromEnv(
    'AINATIVE_NODE_LEASE_TTL_MS',
    45_000,
  );
  private readonly nodeHeartbeatIntervalMs = this.readPositiveNumberFromEnv(
    'AINATIVE_NODE_HEARTBEAT_INTERVAL_MS',
    10_000,
  );
  private readonly staleRecoveryIntervalMs = this.readPositiveNumberFromEnv(
    'AINATIVE_STALE_RECOVERY_INTERVAL_MS',
    15_000,
  );
  private readonly retentionCleanupIntervalMs = this.readPositiveNumberFromEnv(
    'AINATIVE_RETENTION_CLEANUP_INTERVAL_MS',
    3600_000,
  );
  private readonly dispatchAdvisoryLockKey = 345123;
  private readonly schedulerBatchSize = 50;
  private readonly projectPageLimit = 200;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private staleRecoveryTimer: NodeJS.Timeout | null = null;
  private retentionCleanupTimer: NodeJS.Timeout | null = null;
  private scheduling = false;
  private recoveringExpiredNodes = false;
  private destroyed = false;

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly dataSource: DataSource,
    private readonly taskNodeExecutionService: TaskNodeExecutionService,
    private readonly taskAccessService: TaskAccessService,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly taskOutputService: TaskOutputService,
    private readonly taskLogService: TaskLogService,
    private readonly taskStatusService: TaskStatusService,
    private readonly taskConfigResolver: TaskConfigResolverService,
    private readonly configService: ConfigService = new ConfigService(),
  ) {}

  onModuleInit(): void {
    this.schedulerTimer = setInterval(() => {
      void this.scheduleQueuedNodes();
    }, this.schedulerIntervalMs);
    this.schedulerTimer.unref();
    this.staleRecoveryTimer = setInterval(() => {
      void this.recoverExpiredLeases();
    }, this.staleRecoveryIntervalMs);
    this.staleRecoveryTimer.unref();
    this.retentionCleanupTimer = setInterval(() => {
      void this.scheduleRetentionCleanup();
    }, this.retentionCleanupIntervalMs);
    this.retentionCleanupTimer.unref();
    void this.scheduleQueuedNodes();
    void this.recoverExpiredLeases();
    void this.scheduleRetentionCleanup();
  }

  onModuleDestroy(): void {
    this.destroyed = true;

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.staleRecoveryTimer) {
      clearInterval(this.staleRecoveryTimer);
      this.staleRecoveryTimer = null;
    }

    if (this.retentionCleanupTimer) {
      clearInterval(this.retentionCleanupTimer);
      this.retentionCleanupTimer = null;
    }
  }

  async triggerDispatch(): Promise<void> {
    await this.scheduleQueuedNodes();
  }

  private async scheduleQueuedNodes(): Promise<void> {
    if (this.destroyed || this.scheduling) {
      return;
    }

    this.scheduling = true;

    try {
      await this.withDispatchAdvisoryLock(async () => {
        const now = new Date();
        const candidateTasks =
          await this.taskRepository.findTasksReadyForDispatch(
            this.schedulerBatchSize,
            now,
          );

        if (!candidateTasks.length) {
          return;
        }

        const projectIds = Array.from(
          new Set(candidateTasks.map((task) => task.projectId)),
        );
        const [allProjects, runningByProject, globalRunningBase] =
          await Promise.all([
            this.fetchAllProjectsForConcurrency(),
            this.taskRepository.countRunningTasksByProjectIds(projectIds, now),
            this.taskRepository.countRunningTasks(now),
          ]);

        const projectMap = new Map(
          allProjects.map((project) => [project.id, project] as const),
        );
        const globalMaxConcurrency = this.resolveGlobalConcurrency(allProjects);
        const mutableProjectRunning = {
          ...runningByProject,
        } as Record<string, number>;

        let globalRunning = globalRunningBase;

        for (const task of candidateTasks) {
          if (globalRunning >= globalMaxConcurrency) {
            break;
          }

          const project = projectMap.get(task.projectId);
          if (!project) {
            continue;
          }

          const projectMaxConcurrency = this.resolveProjectConcurrency(project);
          const projectRunning = mutableProjectRunning[task.projectId] ?? 0;

          if (projectRunning >= projectMaxConcurrency) {
            continue;
          }

          const claimedNode = await this.taskNodeRepository.claimFirstTodoNode(
            task.id,
            this.workerId,
            new Date(Date.now() + this.nodeLeaseTtlMs),
          );
          if (!claimedNode) {
            continue;
          }

          await this.taskLogService.appendLog({
            taskId: task.id,
            taskNodeId: claimedNode.id,
            level: TaskLogLevel.info,
            message: 'Node execution started',
            payload: {
              nodeOrder: claimedNode.nodeOrder,
              dispatcher: 'db-worker-scheduler',
              workerId: this.workerId,
            },
          });

          await this.taskStatusService.recalculateTaskStatus(task.id);
          void this.taskNodeExecutionService.runNode({
            taskId: task.id,
            nodeId: claimedNode.id,
            project,
            workerId: this.workerId,
            startLeaseHeartbeat: ({ nodeId, workerId }) =>
              this.startNodeLeaseHeartbeat({
                nodeId,
                workerId,
              }),
            onSettled: async () => {
              await this.triggerDispatch();
            },
          });

          globalRunning += 1;
          mutableProjectRunning[task.projectId] = projectRunning + 1;
        }
      });
    } finally {
      this.scheduling = false;
    }
  }

  private async recoverExpiredLeases(): Promise<void> {
    if (this.destroyed || this.recoveringExpiredNodes) {
      return;
    }

    this.recoveringExpiredNodes = true;

    try {
      await this.withDispatchAdvisoryLock(async () => {
        const now = new Date();
        const expiredNodes =
          await this.taskNodeRepository.findExpiredInProgressNodes({
            now,
            limit: this.schedulerBatchSize,
          });

        for (const node of expiredNodes) {
          const latestNode = await this.taskNodeRepository.findById(node.id);

          if (
            !latestNode ||
            latestNode.status !== TaskStatus.inProgress ||
            !this.taskConfigResolver.readNodeLeaseUntil(latestNode) ||
            this.taskConfigResolver.readNodeLeaseUntil(latestNode)! > now
          ) {
            continue;
          }

          const leaseUntil =
            this.taskConfigResolver.readNodeLeaseUntil(latestNode);
          const workerId =
            this.taskConfigResolver.readRuntimeWorkerId(latestNode);
          const agentClioutput =
            await this.taskOutputService.writeNodeOutputJsonl({
              task: await this.taskAccessService.getTaskByIdOrThrow(
                latestNode.taskId,
              ),
              node: latestNode,
              output: {
                summary: 'Node lease expired; worker heartbeat lost',
                finishedAt: new Date().toISOString(),
                error: {
                  code: 'WORKER_LOST',
                  message: 'Node lease expired; worker heartbeat lost',
                },
              },
            });

          await this.taskNodeRepository.update(node.id, {
            status: TaskStatus.inReview,
            finishedAt: new Date(),
            agentClioutput,
            runtimeJson: null,
          });

          await this.taskLogService.appendLog({
            taskId: latestNode.taskId,
            taskNodeId: latestNode.id,
            level: TaskLogLevel.error,
            message:
              'Node execution interrupted due to worker heartbeat timeout',
            payload: {
              workerId,
              leaseUntil: leaseUntil?.toISOString() ?? null,
            },
          });

          await this.taskStatusService.recalculateTaskStatus(latestNode.taskId);
        }
      });
    } finally {
      this.recoveringExpiredNodes = false;
    }
  }

  private async scheduleRetentionCleanup(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const now = new Date();
    const expiredTasks =
      await this.taskRepository.findTasksWithExpiredWorktrees(20, now);

    for (const task of expiredTasks) {
      try {
        const project = await this.taskAccessService.getProjectByIdOrThrow(
          task.projectId,
        );
        const cleanupResult = await this.taskRuntimeService.cleanupRuntime(
          task,
          project,
        );

        await this.taskRepository.update(task.id, {
          ...(cleanupResult.cleaned ? { gitWorktree: null } : {}),
        });

        await this.taskLogService.appendLog({
          taskId: task.id,
          taskNodeId: null,
          level: cleanupResult.cleaned ? TaskLogLevel.info : TaskLogLevel.warn,
          message: cleanupResult.cleaned
            ? 'Task worktree cleaned after retention period'
            : 'Task worktree cleanup failed after retention period',
          payload: {
            gitWorktree: task.gitWorktree,
            errorMessage: cleanupResult.errorMessage ?? null,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Retention cleanup error';
        await this.taskLogService.appendLog({
          taskId: task.id,
          taskNodeId: null,
          level: TaskLogLevel.warn,
          message: 'Retention cleanup failed',
          payload: { errorMessage },
        });
      }
    }
  }

  private startNodeLeaseHeartbeat({
    nodeId,
    workerId,
  }: {
    nodeId: string;
    workerId?: string;
  }): () => void {
    if (!workerId) {
      return () => undefined;
    }

    let stopped = false;
    let renewing = false;

    const renewLease = async (): Promise<void> => {
      if (stopped || renewing || this.destroyed) {
        return;
      }

      renewing = true;

      try {
        const updated = await this.taskNodeRepository.renewNodeLease({
          nodeId,
          workerId,
          leaseUntil: new Date(Date.now() + this.nodeLeaseTtlMs),
          heartbeatAt: new Date(),
        });

        if (!updated) {
          stopped = true;
          clearInterval(heartbeatTimer);
        }
      } finally {
        renewing = false;
      }
    };

    const heartbeatTimer = setInterval(() => {
      void renewLease();
    }, this.nodeHeartbeatIntervalMs);
    heartbeatTimer.unref();
    void renewLease();

    return () => {
      stopped = true;
      clearInterval(heartbeatTimer);
    };
  }

  private async withDispatchAdvisoryLock<T>(
    operation: () => Promise<T>,
  ): Promise<T | undefined> {
    const lockResult = await this.dataSource.query(
      'SELECT pg_try_advisory_lock($1::bigint) AS "locked"',
      [this.dispatchAdvisoryLockKey],
    );
    const locked = lockResult?.[0]?.locked;
    const acquired = locked === true || locked === 't' || locked === 1;

    if (!acquired) {
      return undefined;
    }

    try {
      return await operation();
    } finally {
      await this.dataSource.query(
        'SELECT pg_advisory_unlock($1::bigint) AS "unlocked"',
        [this.dispatchAdvisoryLockKey],
      );
    }
  }

  private resolveProjectConcurrency(project?: Project): number {
    if (!project?.configJson || typeof project.configJson !== 'object') {
      return 2;
    }

    const configJson = project.configJson as Record<string, unknown>;
    const maxConcurrency = configJson.maxConcurrency;

    if (typeof maxConcurrency === 'number' && maxConcurrency > 0) {
      return Math.floor(maxConcurrency);
    }

    return 2;
  }

  private resolveGlobalConcurrency(projects: Project[]): number {
    if (!projects.length) {
      return 10;
    }

    const totalConcurrency = projects.reduce((sum, project) => {
      return sum + this.resolveProjectConcurrency(project);
    }, 0);

    return Math.max(totalConcurrency, 1);
  }

  private async fetchAllProjectsForConcurrency(): Promise<Project[]> {
    const projects: Project[] = [];
    let page = 1;

    while (true) {
      const pageData = await this.projectRepository.findAllWithPagination({
        paginationOptions: {
          page,
          limit: this.projectPageLimit,
        },
      });

      projects.push(...pageData);

      if (pageData.length < this.projectPageLimit) {
        break;
      }

      page += 1;
    }

    return projects;
  }

  private readPositiveNumberFromEnv(key: string, defaultValue: number): number {
    const rawValue = this.configService.get<string>(key, { infer: true });

    if (!rawValue) {
      return defaultValue;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return defaultValue;
    }

    return Math.floor(parsedValue);
  }
}
