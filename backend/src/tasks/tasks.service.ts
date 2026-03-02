import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskRepository } from './infrastructure/persistence/task.repository';
import { TaskNodeRepository } from './infrastructure/persistence/task-node.repository';
import { TaskLogRepository } from './infrastructure/persistence/task-log.repository';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import { WorkflowTemplatesService } from '../workflow-templates/workflow-templates.service';
import { Task } from './domain/task';
import { TaskStatus } from './dto/task-status.enum';
import { TaskMode } from './dto/task-mode.enum';
import { TaskNodeType } from './dto/task-node-type.enum';
import { TaskNode } from './domain/task-node';
import { TaskLogLevel } from './dto/task-log-level.enum';
import { TaskLog } from './domain/task-log';
import { TaskLogEventsService } from './task-log-events.service';
import { FindAllTasksDto } from './dto/find-all-tasks.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { RetryTaskDto } from './dto/retry-task.dto';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { TaskDetailDto } from './dto/task-detail.dto';
import { FindTaskLogsDto } from './dto/find-task-logs.dto';
import { TaskArtifactRepository } from './infrastructure/persistence/task-artifact.repository';
import { TaskArtifact } from './domain/task-artifact';
import { CreateTaskArtifactDto } from './dto/create-task-artifact.dto';
import { TaskArtifactType } from './dto/task-artifact-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { TaskRuntimeService } from './task-runtime.service';
import { Project } from '../projects/domain/project';
import { AgentRunnerService } from './agent-runner.service';
import { SkillRepository } from '../skills/infrastructure/persistence/skill.repository';
import { McpRepository } from '../mcps/infrastructure/persistence/mcp.repository';
import { Skill } from '../skills/domain/skill';
import { Mcp } from '../mcps/domain/mcp';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly runningNodeSet = new Set<string>();
  private readonly runtimeRole = this.resolveRuntimeRole();
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
  private readonly streamDbPollIntervalMs = this.readPositiveNumberFromEnv(
    'AINATIVE_STREAM_DB_POLL_INTERVAL_MS',
    1_000,
  );
  private readonly dispatchAdvisoryLockKey = 345123;
  private readonly schedulerBatchSize = 50;
  private readonly projectPageLimit = 200;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private staleRecoveryTimer: NodeJS.Timeout | null = null;
  private scheduling = false;
  private recoveringExpiredNodes = false;
  private destroyed = false;

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly taskLogRepository: TaskLogRepository,
    private readonly taskArtifactRepository: TaskArtifactRepository,
    private readonly projectsService: ProjectsService,
    private readonly workflowTemplatesService: WorkflowTemplatesService,
    private readonly taskLogEventsService: TaskLogEventsService,
    private readonly notificationsService: NotificationsService,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly agentRunnerService: AgentRunnerService,
    private readonly skillRepository: SkillRepository,
    private readonly mcpRepository: McpRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    if (this.runtimeRole !== 'worker') {
      return;
    }

    this.schedulerTimer = setInterval(() => {
      void this.scheduleQueuedNodes();
    }, this.schedulerIntervalMs);
    this.schedulerTimer.unref();
    this.staleRecoveryTimer = setInterval(() => {
      void this.recoverExpiredLeases();
    }, this.staleRecoveryIntervalMs);
    this.staleRecoveryTimer.unref();
    void this.scheduleQueuedNodes();
    void this.recoverExpiredLeases();
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
  }

  async create(
    createTaskDto: CreateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    const project = await this.projectsService.assertCanAccessProject(
      createTaskDto.projectId,
      currentUser,
    );

    let resolvedMode: TaskMode = createTaskDto.mode ?? TaskMode.conversation;
    let workflowTemplateId: string | null = null;
    let workflowTemplateVersion: number | null = null;
    let nodes: Array<{
      nodeOrder: number;
      name: string;
      nodeType: TaskNodeType;
      requiresApproval: boolean;
      input?: Record<string, unknown> | null;
    }> = [];

    if (createTaskDto.workflowTemplateId) {
      const templateVersion =
        await this.workflowTemplatesService.getVersionForTask({
          templateId: createTaskDto.workflowTemplateId,
          version: createTaskDto.workflowTemplateVersion,
          projectBusinessLineId: project.businessLineId,
        });

      resolvedMode =
        templateVersion.mode === 'workflow'
          ? TaskMode.workflow
          : TaskMode.conversation;
      workflowTemplateId = templateVersion.templateId;
      workflowTemplateVersion = templateVersion.version;

      nodes = templateVersion.nodesJson
        .map((node) => ({
          nodeOrder: node.nodeOrder,
          name: node.name,
          nodeType: this.normalizeNodeType(node.type),
          requiresApproval: !!node.requiresApproval,
          input: node.input ?? null,
        }))
        .sort((left, right) => left.nodeOrder - right.nodeOrder);
    } else {
      if (resolvedMode === TaskMode.workflow) {
        throw new ConflictException(
          'Workflow mode requires workflowTemplateId',
        );
      }

      nodes = [
        {
          nodeOrder: 1,
          name: 'conversation-node',
          nodeType: TaskNodeType.agent,
          requiresApproval: false,
          input: null,
        },
      ];
    }

    if (!nodes.length) {
      throw new ConflictException('Task must contain at least one node');
    }

    const task = await this.taskRepository.create({
      projectId: createTaskDto.projectId,
      workflowTemplateId,
      workflowTemplateVersion,
      mode: resolvedMode,
      title: createTaskDto.title,
      description: createTaskDto.description ?? null,
      acceptanceCriteria: createTaskDto.acceptanceCriteria ?? null,
      status: TaskStatus.todo,
      branch: createTaskDto.branch ?? null,
      environment: createTaskDto.environment ?? null,
      toolVersionsSnapshot: createTaskDto.toolVersionsSnapshot ?? null,
      createdBy: currentUser.sub,
      gitBaseBranch: null,
      gitWorktreePath: null,
      sandboxCleanupAt: null,
      startedAt: null,
      finishedAt: null,
    });

    await this.taskNodeRepository.createMany(
      nodes.map((node) => ({
        taskId: task.id,
        nodeOrder: node.nodeOrder,
        name: node.name,
        nodeType: node.nodeType,
        input: node.input ?? null,
        output: null,
        requiresApproval: node.requiresApproval,
        status: TaskStatus.todo,
        attempt: 0,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      })),
    );

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task created',
      payload: {
        mode: resolvedMode,
        nodeCount: nodes.length,
      },
    });

    return task;
  }

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
      await this.projectsService.assertCanAccessProject(
        query.projectId,
        currentUser,
      );
    } else if (!this.isAdmin(currentUser)) {
      throw new ForbiddenException('ProjectId is required for non-admin users');
    }

    return this.taskRepository.findAllWithPagination({
      paginationOptions,
      projectId: query.projectId,
      status: query.status,
    });
  }

  async findById(
    id: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<Task | null> {
    const task = await this.taskRepository.findById(id);

    if (!task) {
      return null;
    }

    await this.projectsService.assertCanAccessProject(
      task.projectId,
      currentUser,
    );

    return task;
  }

  async detailById(
    id: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.getTaskOrThrow(id, currentUser);
    const nodes = await this.taskNodeRepository.findByTaskId(task.id);

    return {
      task,
      nodes,
    };
  }

  async execute(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.getTaskOrThrow(taskId, currentUser);
    const prepared = await this.prepareTaskRuntime(task, currentUser);
    task = prepared.task;

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );

    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const nextTodoNode =
      await this.taskNodeRepository.findFirstByTaskIdAndStatus({
        taskId: task.id,
        status: TaskStatus.todo,
      });

    if (!nextTodoNode) {
      throw new ConflictException('No runnable node in todo status');
    }

    const queueRequestedAt = new Date();
    if (!task.startedAt) {
      const updatedTask = await this.taskRepository.update(task.id, {
        startedAt: queueRequestedAt,
      });
      task = updatedTask ?? task;
    }

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task queued for execution',
      payload: {
        requestedBy: currentUser.sub,
        requestedAt: queueRequestedAt.toISOString(),
        nodeOrder: nextTodoNode.nodeOrder,
      },
    });

    await this.recalculateTaskStatus(task.id);
    await this.triggerWorkerDispatch();

    return this.detailById(task.id, currentUser);
  }

  async retry(
    taskId: Task['id'],
    retryTaskDto: RetryTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.getTaskOrThrow(taskId, currentUser);
    const prepared = await this.prepareTaskRuntime(task, currentUser);
    task = prepared.task;

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );

    if (runningNode) {
      throw new ConflictException('Task already has an in-progress node');
    }

    const targetNode = retryTaskDto.nodeId
      ? await this.taskNodeRepository.findById(retryTaskDto.nodeId)
      : await this.taskNodeRepository.findFirstByTaskIdAndStatus({
          taskId: task.id,
          status: TaskStatus.inReview,
        });

    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    if (targetNode.status !== TaskStatus.inReview) {
      throw new ConflictException('Only in_review node can be retried');
    }

    await this.taskNodeRepository.update(targetNode.id, {
      status: TaskStatus.todo,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      output: null,
    });

    const queueRequestedAt = new Date();
    if (!task.startedAt) {
      const updatedTask = await this.taskRepository.update(task.id, {
        startedAt: queueRequestedAt,
      });
      task = updatedTask ?? task;
    }

    await this.appendLog({
      taskId: task.id,
      taskNodeId: targetNode.id,
      level: TaskLogLevel.info,
      message: 'Node retry queued',
      payload: {
        requestedBy: currentUser.sub,
        requestedAt: queueRequestedAt.toISOString(),
        nodeOrder: targetNode.nodeOrder,
      },
    });

    await this.recalculateTaskStatus(task.id);
    await this.triggerWorkerDispatch();

    return this.detailById(task.id, currentUser);
  }

  async cancel(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.getTaskOrThrow(taskId, currentUser);

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );

    if (!runningNode) {
      throw new ConflictException('Task has no in-progress node to cancel');
    }

    await this.taskNodeRepository.update(runningNode.id, {
      status: TaskStatus.inReview,
      finishedAt: new Date(),
      errorCode: 'CANCELLED',
      errorMessage: 'Execution cancelled by user',
      workerId: null,
      leaseUntil: null,
      heartbeatAt: null,
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: runningNode.id,
      level: TaskLogLevel.warn,
      message: 'Node execution cancelled',
      payload: {
        nodeOrder: runningNode.nodeOrder,
      },
    });

    await this.recalculateTaskStatus(task.id);
    await this.triggerWorkerDispatch();

    return this.detailById(task.id, currentUser);
  }

  async approve(
    taskId: Task['id'],
    approveTaskDto: ApproveTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.getTaskOrThrow(taskId, currentUser);

    const targetNode = await this.taskNodeRepository.findById(
      approveTaskDto.nodeId,
    );

    if (!targetNode || targetNode.taskId !== task.id) {
      throw new NotFoundException('Task node not found');
    }

    if (targetNode.status !== TaskStatus.inReview) {
      throw new ConflictException('Only in_review node can be approved');
    }

    await this.taskNodeRepository.update(targetNode.id, {
      status: TaskStatus.done,
      finishedAt: targetNode.finishedAt ?? new Date(),
      errorCode: null,
      errorMessage: null,
      workerId: null,
      leaseUntil: null,
      heartbeatAt: null,
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: targetNode.id,
      level: TaskLogLevel.info,
      message: 'Node approved and marked as done',
      payload: {
        nodeOrder: targetNode.nodeOrder,
      },
    });

    await this.recalculateTaskStatus(task.id);

    return this.detailById(task.id, currentUser);
  }

  async cleanupWorktree(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.getTaskOrThrow(taskId, currentUser);

    const cleanupResult = await this.taskRuntimeService.cleanupRuntime(task);

    await this.taskRepository.update(task.id, {
      sandboxCleanupAt: new Date(),
      ...(cleanupResult.cleaned ? { gitWorktreePath: null } : {}),
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: cleanupResult.cleaned ? TaskLogLevel.info : TaskLogLevel.warn,
      message: cleanupResult.cleaned
        ? 'Task worktree cleaned manually'
        : 'Task worktree cleanup skipped or failed',
      payload: {
        gitWorktreePath: task.gitWorktreePath,
        errorMessage: cleanupResult.errorMessage ?? null,
      },
    });

    return this.detailById(task.id, currentUser);
  }

  async listLogs(
    taskId: Task['id'],
    query: FindTaskLogsDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskLog[]> {
    await this.getTaskOrThrow(taskId, currentUser);

    return this.taskLogRepository.findByTaskIdSince({
      taskId,
      since: this.parseDate(query.since),
      afterId: query.afterId,
      limit: query.limit,
    });
  }

  async listArtifacts(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskArtifact[]> {
    await this.getTaskOrThrow(taskId, currentUser);

    return this.taskArtifactRepository.findByTaskId(taskId);
  }

  async createArtifact(
    taskId: Task['id'],
    createTaskArtifactDto: CreateTaskArtifactDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskArtifact> {
    const task = await this.getTaskOrThrow(taskId, currentUser);

    if (createTaskArtifactDto.taskNodeId) {
      const taskNode = await this.taskNodeRepository.findById(
        createTaskArtifactDto.taskNodeId,
      );

      if (!taskNode || taskNode.taskId !== task.id) {
        throw new NotFoundException('Task node not found');
      }
    }

    const artifact = await this.taskArtifactRepository.create({
      taskId: task.id,
      taskNodeId: createTaskArtifactDto.taskNodeId ?? null,
      artifactType: createTaskArtifactDto.artifactType,
      name: createTaskArtifactDto.name,
      downloadUrl: createTaskArtifactDto.downloadUrl ?? null,
      content: createTaskArtifactDto.content ?? null,
      metadata: createTaskArtifactDto.metadata ?? null,
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: createTaskArtifactDto.taskNodeId ?? null,
      level: TaskLogLevel.info,
      message: 'Task artifact uploaded',
      payload: {
        artifactId: artifact.id,
        artifactType: artifact.artifactType,
      },
    });

    return artifact;
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
    await this.getTaskOrThrow(taskId, currentUser);

    const since = this.parseDate(query.since);
    const streamLimit = query.limit ?? 200;
    const history = await this.taskLogRepository.findByTaskIdSince({
      taskId,
      since,
      afterId: query.afterId,
      limit: streamLimit,
    });

    const deliveredIds = new Set(history.map((log) => log.id));
    let cursorSince = since;
    let cursorAfterId = query.afterId;

    const updateCursor = (log: TaskLog): void => {
      if (!cursorSince || log.createdAt > cursorSince) {
        cursorSince = log.createdAt;
        cursorAfterId = log.id;
        return;
      }

      if (
        log.createdAt.getTime() === cursorSince.getTime() &&
        (!cursorAfterId || log.id > cursorAfterId)
      ) {
        cursorAfterId = log.id;
      }
    };

    for (const log of history) {
      updateCursor(log);
    }

    return {
      history,
      subscribe: (listener) => {
        let polling = false;

        const emitIfFresh = (log: TaskLog): void => {
          if (deliveredIds.has(log.id)) {
            return;
          }

          deliveredIds.add(log.id);
          if (deliveredIds.size > streamLimit * 20) {
            deliveredIds.clear();
            deliveredIds.add(log.id);
          }

          updateCursor(log);
          listener(log);
        };

        const pollIncrementalLogs = async (): Promise<void> => {
          if (polling) {
            return;
          }

          polling = true;

          try {
            const incrementalLogs = await this.taskLogRepository.findByTaskIdSince(
              {
                taskId,
                since: cursorSince,
                afterId: cursorAfterId,
                limit: streamLimit,
              },
            );

            for (const log of incrementalLogs) {
              emitIfFresh(log);
            }
          } finally {
            polling = false;
          }
        };

        const unsubscribeLocal = this.taskLogEventsService.subscribe(
          taskId,
          emitIfFresh,
        );
        const pollTimer = setInterval(() => {
          void pollIncrementalLogs();
        }, this.streamDbPollIntervalMs);
        pollTimer.unref();

        void pollIncrementalLogs();

        return () => {
          unsubscribeLocal();
          clearInterval(pollTimer);
        };
      },
    };
  }

  private async runNode(
    taskId: string,
    nodeId: string,
    project: Project,
    workerId?: string,
  ): Promise<void> {
    if (this.runningNodeSet.has(nodeId)) {
      return;
    }

    this.runningNodeSet.add(nodeId);
    let stopLeaseHeartbeat: (() => void) | undefined;

    try {
      await this.delay(150);

      const pendingNode = await this.taskNodeRepository.findById(nodeId);
      if (!pendingNode || pendingNode.status !== TaskStatus.inProgress) {
        return;
      }

      const runtimeTask = await this.taskRepository.findById(taskId);

      if (!runtimeTask) {
        throw new NotFoundException('Task not found');
      }

      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.info,
        message: 'Runner attached to node',
        payload: {
          nodeOrder: pendingNode.nodeOrder,
          branch: runtimeTask.branch ?? null,
          gitBaseBranch: runtimeTask.gitBaseBranch ?? null,
          gitWorktreePath: runtimeTask.gitWorktreePath ?? null,
        },
      });

      const runningNode = await this.taskNodeRepository.findById(nodeId);
      if (!runningNode || runningNode.status !== TaskStatus.inProgress) {
        return;
      }

      stopLeaseHeartbeat = this.startNodeLeaseHeartbeat({
        nodeId,
        workerId,
      });

      if (runningNode.nodeType === TaskNodeType.agent) {
        await this.executeAgentNode({
          taskId,
          nodeId,
          task: runtimeTask,
          node: runningNode,
          project,
        });
        return;
      }

      if (runningNode.nodeType === TaskNodeType.skill) {
        await this.executeSkillNode({
          taskId,
          nodeId,
          task: runtimeTask,
          node: runningNode,
          project,
        });
        return;
      }

      if (runningNode.nodeType === TaskNodeType.mcp) {
        await this.executeMcpNode({
          taskId,
          nodeId,
          task: runtimeTask,
          node: runningNode,
          project,
        });
        return;
      }

      if (runningNode.nodeType === TaskNodeType.manual) {
        await this.executeManualNode({
          taskId,
          nodeId,
          node: runningNode,
        });
        return;
      }

      await this.finalizeNodeAsFailure({
        nodeId,
        errorCode: 'UNSUPPORTED_NODE_TYPE',
        errorMessage: `Unsupported node type: ${runningNode.nodeType}`,
      });

      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.error,
        message: 'Node execution failed due to unsupported node type',
        payload: {
          nodeType: runningNode.nodeType,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected execution error';

      await this.finalizeNodeAsFailure({
        nodeId,
        errorCode: 'UNKNOWN',
        errorMessage,
      });

      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.error,
        message: 'Node execution failed',
        payload: {
          errorMessage,
        },
      });
    } finally {
      if (stopLeaseHeartbeat) {
        stopLeaseHeartbeat();
      }
      await this.recalculateTaskStatus(taskId);
      this.runningNodeSet.delete(nodeId);
      void this.triggerWorkerDispatch();
    }
  }

  private async prepareTaskRuntime(
    task: Task,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; project: Project }> {
    const project = await this.projectsService.assertCanAccessProject(
      task.projectId,
      currentUser,
    );

    const runtime = await this.taskRuntimeService.ensureRuntime(task, project);

    const hasRuntimeChanged =
      task.branch !== runtime.branch ||
      task.gitBaseBranch !== runtime.gitBaseBranch ||
      task.gitWorktreePath !== runtime.gitWorktreePath ||
      task.sandboxCleanupAt?.getTime() !== runtime.sandboxCleanupAt.getTime();

    if (!hasRuntimeChanged) {
      return { task, project };
    }

    const updatedTask = await this.taskRepository.update(task.id, {
      branch: runtime.branch,
      gitBaseBranch: runtime.gitBaseBranch,
      gitWorktreePath: runtime.gitWorktreePath,
      sandboxCleanupAt: runtime.sandboxCleanupAt,
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task sandbox initialized',
      payload: {
        branch: runtime.branch,
        gitBaseBranch: runtime.gitBaseBranch,
        gitWorktreePath: runtime.gitWorktreePath,
        sandboxCleanupAt: runtime.sandboxCleanupAt.toISOString(),
      },
    });

    return {
      task: updatedTask ?? task,
      project,
    };
  }

  private async executeAgentNode({
    taskId,
    nodeId,
    task,
    node,
    project,
  }: {
    taskId: string;
    nodeId: string;
    task: Task;
    node: TaskNode;
    project: Project;
  }): Promise<void> {
    const executionResult = await this.agentRunnerService.executeAgentNode({
      task,
      node,
      project,
    });

    if (executionResult.success) {
      const summary = executionResult.stdout
        ? executionResult.stdout.slice(0, 2_000)
        : 'Agent execution finished without stdout output';

      await this.finalizeNodeAsSuccess({
        node,
        output: {
          summary,
          stdout: executionResult.stdout,
          stderr: executionResult.stderr || null,
          exitCode: executionResult.exitCode,
          durationMs: executionResult.durationMs,
          finishedAt: new Date().toISOString(),
        },
      });

      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: node.requiresApproval ? TaskLogLevel.warn : TaskLogLevel.info,
        message: node.requiresApproval
          ? 'Agent node completed and waiting for approval'
          : 'Agent node completed successfully',
        payload: {
          status: node.requiresApproval ? TaskStatus.inReview : TaskStatus.done,
          durationMs: executionResult.durationMs,
          command: executionResult.command,
          args: executionResult.args,
        },
      });

      if (!node.requiresApproval) {
        await this.createNodeExecutionArtifact({
          taskId,
          task,
          node,
          summary,
          generatedBy: `agent-runner:${executionResult.command}`,
        });
      }

      return;
    }

    await this.finalizeNodeAsFailure({
      nodeId,
      errorCode: executionResult.timedOut ? 'TIMEOUT' : 'RUNNER_FAILED',
      errorMessage: executionResult.errorMessage ?? 'Agent execution failed',
      output: {
        stdout: executionResult.stdout || null,
        stderr: executionResult.stderr || null,
        exitCode: executionResult.exitCode,
        signal: executionResult.signal,
        durationMs: executionResult.durationMs,
        timedOut: executionResult.timedOut,
      },
    });

    await this.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: TaskLogLevel.error,
      message: 'Agent node execution failed',
      payload: {
        errorMessage: executionResult.errorMessage ?? null,
        exitCode: executionResult.exitCode,
        signal: executionResult.signal,
        durationMs: executionResult.durationMs,
        stderr: executionResult.stderr || null,
      },
    });
  }

  private async executeSkillNode({
    taskId,
    nodeId,
    task,
    node,
    project,
  }: {
    taskId: string;
    nodeId: string;
    task: Task;
    node: TaskNode;
    project: Project;
  }): Promise<void> {
    const skill = await this.resolveSkillForNode(node, project);

    await this.finalizeNodeAsSuccess({
      node,
      output: {
        summary: `Skill ${skill.name}@${skill.version} executed`,
        skill: {
          id: skill.id,
          name: skill.name,
          version: skill.version,
          scope: skill.scope ?? null,
        },
        finishedAt: new Date().toISOString(),
      },
    });

    await this.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: node.requiresApproval ? TaskLogLevel.warn : TaskLogLevel.info,
      message: node.requiresApproval
        ? 'Skill node completed and waiting for approval'
        : 'Skill node completed successfully',
      payload: {
        status: node.requiresApproval ? TaskStatus.inReview : TaskStatus.done,
        skillName: skill.name,
        skillVersion: skill.version,
      },
    });

    if (!node.requiresApproval) {
      await this.createNodeExecutionArtifact({
        taskId,
        task,
        node,
        summary: `Skill ${skill.name}@${skill.version} executed successfully.`,
        generatedBy: 'skill-runner',
      });
    }
  }

  private async executeMcpNode({
    taskId,
    nodeId,
    task,
    node,
    project,
  }: {
    taskId: string;
    nodeId: string;
    task: Task;
    node: TaskNode;
    project: Project;
  }): Promise<void> {
    const mcp = await this.resolveMcpForNode(node, project);

    await this.finalizeNodeAsSuccess({
      node,
      output: {
        summary: `MCP ${mcp.name}@${mcp.version} invoked`,
        mcp: {
          id: mcp.id,
          name: mcp.name,
          version: mcp.version,
          provider: mcp.provider ?? null,
          toolsCount: mcp.toolsCount,
        },
        finishedAt: new Date().toISOString(),
      },
    });

    await this.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: node.requiresApproval ? TaskLogLevel.warn : TaskLogLevel.info,
      message: node.requiresApproval
        ? 'MCP node completed and waiting for approval'
        : 'MCP node completed successfully',
      payload: {
        status: node.requiresApproval ? TaskStatus.inReview : TaskStatus.done,
        mcpName: mcp.name,
        mcpVersion: mcp.version,
        provider: mcp.provider ?? null,
      },
    });

    if (!node.requiresApproval) {
      await this.createNodeExecutionArtifact({
        taskId,
        task,
        node,
        summary: `MCP ${mcp.name}@${mcp.version} invoked successfully.`,
        generatedBy: 'mcp-runner',
      });
    }
  }

  private async executeManualNode({
    taskId,
    nodeId,
    node,
  }: {
    taskId: string;
    nodeId: string;
    node: TaskNode;
  }): Promise<void> {
    await this.taskNodeRepository.update(node.id, {
      status: TaskStatus.inReview,
      finishedAt: new Date(),
      output: {
        summary: 'Manual node requires human action',
        finishedAt: new Date().toISOString(),
      },
      errorCode: null,
      errorMessage: null,
    });

    await this.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: TaskLogLevel.warn,
      message: 'Manual node moved to in_review for human approval',
      payload: {
        status: TaskStatus.inReview,
      },
    });
  }

  private async resolveSkillForNode(
    node: TaskNode,
    project: Project,
  ): Promise<Skill> {
    const input = this.resolveNodeInput(node);
    const skillRefFromInput = this.resolveNamedRefFromInput(input, 'skill');
    const allowedSkillRefs = this.resolveAllowedRefsFromProjectConfig(project, [
      'allowedSkills',
    ]);

    const resolvedSkillRef = this.resolveTargetRef({
      inputRef: skillRefFromInput,
      allowedRefs: allowedSkillRefs,
      target: 'skill',
    });

    const skill = await this.findSkillByRef(resolvedSkillRef);

    if (!skill) {
      const versionText = resolvedSkillRef.version
        ? `@${resolvedSkillRef.version}`
        : '';
      throw new ConflictException(
        `Skill ${resolvedSkillRef.name}${versionText} not found`,
      );
    }

    if (!skill.enabled) {
      throw new ConflictException(
        `Skill ${skill.name}@${skill.version} disabled`,
      );
    }

    return skill;
  }

  private async resolveMcpForNode(
    node: TaskNode,
    project: Project,
  ): Promise<Mcp> {
    const input = this.resolveNodeInput(node);
    const mcpRefFromInput = this.resolveNamedRefFromInput(input, 'mcp');
    const allowedMcpRefs = this.resolveAllowedRefsFromProjectConfig(project, [
      'allowedMcp',
      'allowedMcps',
    ]);

    const resolvedMcpRef = this.resolveTargetRef({
      inputRef: mcpRefFromInput,
      allowedRefs: allowedMcpRefs,
      target: 'mcp',
    });

    const mcp = await this.findMcpByRef(resolvedMcpRef);

    if (!mcp) {
      const versionText = resolvedMcpRef.version
        ? `@${resolvedMcpRef.version}`
        : '';
      throw new ConflictException(
        `MCP ${resolvedMcpRef.name}${versionText} not found`,
      );
    }

    if (!mcp.enabled) {
      throw new ConflictException(`MCP ${mcp.name}@${mcp.version} disabled`);
    }

    return mcp;
  }

  private resolveNodeInput(node: TaskNode): Record<string, unknown> {
    if (!node.input || typeof node.input !== 'object') {
      return {};
    }

    return node.input as Record<string, unknown>;
  }

  private resolveNamedRefFromInput(
    input: Record<string, unknown>,
    target: 'skill' | 'mcp',
  ): { name: string; version?: string } | null {
    const targetNameKey = `${target}Name`;
    const targetVersionKey = `${target}Version`;

    const nameCandidate =
      (typeof input[targetNameKey] === 'string'
        ? input[targetNameKey]
        : null) ?? (typeof input.name === 'string' ? input.name : null);
    const versionCandidate =
      (typeof input[targetVersionKey] === 'string'
        ? input[targetVersionKey]
        : null) ?? (typeof input.version === 'string' ? input.version : null);

    if (!nameCandidate?.trim()) {
      return null;
    }

    const parsed = this.parseNameWithOptionalVersion(nameCandidate.trim());

    return {
      name: parsed.name,
      version: versionCandidate?.trim() || parsed.version,
    };
  }

  private resolveAllowedRefsFromProjectConfig(
    project: Project,
    keys: string[],
  ): Array<{ name: string; version?: string }> {
    const configJson =
      project.configJson && typeof project.configJson === 'object'
        ? (project.configJson as Record<string, unknown>)
        : {};

    for (const key of keys) {
      const rawValue = configJson[key];
      if (!Array.isArray(rawValue)) {
        continue;
      }

      const refs = rawValue
        .map((item) => this.parseAllowedItem(item))
        .filter(
          (item): item is { name: string; version?: string } => item !== null,
        );

      if (refs.length > 0) {
        return refs;
      }
    }

    return [];
  }

  private parseAllowedItem(
    rawItem: unknown,
  ): { name: string; version?: string } | null {
    if (typeof rawItem === 'string') {
      const parsed = this.parseNameWithOptionalVersion(rawItem.trim());
      return parsed.name ? parsed : null;
    }

    if (!rawItem || typeof rawItem !== 'object') {
      return null;
    }

    const rawObject = rawItem as Record<string, unknown>;
    const name =
      typeof rawObject.name === 'string' ? rawObject.name.trim() : null;
    const version =
      typeof rawObject.version === 'string' ? rawObject.version.trim() : null;

    if (!name) {
      return null;
    }

    return {
      name,
      ...(version ? { version } : {}),
    };
  }

  private parseNameWithOptionalVersion(value: string): {
    name: string;
    version?: string;
  } {
    const separatorIndex = value.lastIndexOf('@');

    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      return { name: value };
    }

    const name = value.slice(0, separatorIndex).trim();
    const version = value.slice(separatorIndex + 1).trim();

    if (!name || !version) {
      return { name: value };
    }

    return {
      name,
      version,
    };
  }

  private resolveTargetRef({
    inputRef,
    allowedRefs,
    target,
  }: {
    inputRef: { name: string; version?: string } | null;
    allowedRefs: Array<{ name: string; version?: string }>;
    target: 'skill' | 'mcp';
  }): { name: string; version?: string } {
    if (inputRef) {
      if (!allowedRefs.length) {
        return inputRef;
      }

      const matchedRef = allowedRefs.find((allowedRef) => {
        if (allowedRef.name !== inputRef.name) {
          return false;
        }

        if (!allowedRef.version) {
          return true;
        }

        return inputRef.version === allowedRef.version;
      });

      if (!matchedRef) {
        const versionText = inputRef.version ? `@${inputRef.version}` : '';
        throw new ForbiddenException(
          `${target} ${inputRef.name}${versionText} is not allowed by project config`,
        );
      }

      return {
        name: matchedRef.name,
        version: inputRef.version ?? matchedRef.version,
      };
    }

    if (!allowedRefs.length) {
      throw new ConflictException(
        `${target} node requires input ${target}Name/${target}Version or project allowed list`,
      );
    }

    return allowedRefs[0];
  }

  private async findSkillByRef(ref: {
    name: string;
    version?: string;
  }): Promise<Skill | null> {
    if (ref.version) {
      return this.skillRepository.findByNameAndVersion({
        name: ref.name,
        version: ref.version,
      });
    }

    const skills = await this.skillRepository.findAllWithPagination({
      paginationOptions: {
        page: 1,
        limit: 100,
      },
      keyword: ref.name,
    });

    const matchedSkills = skills
      .filter((skill) => skill.name === ref.name && skill.enabled)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );

    return matchedSkills[0] ?? null;
  }

  private async findMcpByRef(ref: {
    name: string;
    version?: string;
  }): Promise<Mcp | null> {
    if (ref.version) {
      return this.mcpRepository.findByNameAndVersion({
        name: ref.name,
        version: ref.version,
      });
    }

    const mcps = await this.mcpRepository.findAllWithPagination({
      paginationOptions: {
        page: 1,
        limit: 100,
      },
      keyword: ref.name,
    });

    const matchedMcps = mcps
      .filter((mcp) => mcp.name === ref.name && mcp.enabled)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );

    return matchedMcps[0] ?? null;
  }

  private async finalizeNodeAsSuccess({
    node,
    output,
  }: {
    node: TaskNode;
    output: Record<string, unknown>;
  }): Promise<void> {
    const nextStatus = node.requiresApproval
      ? TaskStatus.inReview
      : TaskStatus.done;

    await this.taskNodeRepository.update(node.id, {
      status: nextStatus,
      finishedAt: new Date(),
      output,
      errorCode: null,
      errorMessage: null,
      workerId: null,
      leaseUntil: null,
      heartbeatAt: null,
    });
  }

  private async finalizeNodeAsFailure({
    nodeId,
    errorCode,
    errorMessage,
    output,
  }: {
    nodeId: string;
    errorCode: string;
    errorMessage: string;
    output?: Record<string, unknown>;
  }): Promise<void> {
    const latestNode = await this.taskNodeRepository.findById(nodeId);

    if (!latestNode || latestNode.status !== TaskStatus.inProgress) {
      return;
    }

    await this.taskNodeRepository.update(nodeId, {
      status: TaskStatus.inReview,
      finishedAt: new Date(),
      errorCode,
      errorMessage,
      workerId: null,
      leaseUntil: null,
      heartbeatAt: null,
      ...(output ? { output } : {}),
    });
  }

  private async createNodeExecutionArtifact({
    taskId,
    task,
    node,
    summary,
    generatedBy,
  }: {
    taskId: string;
    task: Task;
    node: TaskNode;
    summary: string;
    generatedBy: string;
  }): Promise<void> {
    await this.taskArtifactRepository.create({
      taskId,
      taskNodeId: node.id,
      artifactType: TaskArtifactType.report,
      name: `node-${node.nodeOrder}-summary.md`,
      downloadUrl: null,
      content: `# Node ${node.nodeOrder}\n\n${summary}`,
      metadata: {
        generatedBy,
      },
    });

    await this.createGitDiffArtifact({
      task,
      taskNode: node,
    });
  }

  private async createGitDiffArtifact({
    task,
    taskNode,
  }: {
    task: Task;
    taskNode: TaskNode;
  }): Promise<void> {
    const diffArtifact =
      await this.taskRuntimeService.collectGitDiffArtifact(task);

    if (!diffArtifact) {
      return;
    }

    const existedArtifacts = await this.taskArtifactRepository.findByTaskId(
      task.id,
    );
    const artifactName = `node-${taskNode.nodeOrder}-${diffArtifact.name}`;
    const hasSameArtifact = existedArtifacts.some((artifact) => {
      return (
        artifact.taskNodeId === taskNode.id &&
        artifact.artifactType === TaskArtifactType.diff &&
        artifact.name === artifactName
      );
    });

    if (hasSameArtifact) {
      return;
    }

    await this.taskArtifactRepository.create({
      taskId: task.id,
      taskNodeId: taskNode.id,
      artifactType: TaskArtifactType.diff,
      name: artifactName,
      downloadUrl: null,
      content: diffArtifact.content,
      metadata: diffArtifact.metadata,
    });
  }

  private async scheduleQueuedNodes(): Promise<void> {
    if (this.runtimeRole !== 'worker' || this.destroyed || this.scheduling) {
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

          await this.appendLog({
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

          await this.recalculateTaskStatus(task.id);
          void this.runNode(task.id, claimedNode.id, project, this.workerId);

          globalRunning += 1;
          mutableProjectRunning[task.projectId] = projectRunning + 1;
        }
      });
    } finally {
      this.scheduling = false;
    }
  }

  private async recoverExpiredLeases(): Promise<void> {
    if (
      this.runtimeRole !== 'worker' ||
      this.destroyed ||
      this.recoveringExpiredNodes
    ) {
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
            !latestNode.leaseUntil ||
            latestNode.leaseUntil > now
          ) {
            continue;
          }

          await this.taskNodeRepository.update(node.id, {
            status: TaskStatus.inReview,
            finishedAt: new Date(),
            errorCode: 'WORKER_LOST',
            errorMessage: 'Node lease expired; worker heartbeat lost',
            workerId: null,
            leaseUntil: null,
            heartbeatAt: null,
          });

          await this.appendLog({
            taskId: latestNode.taskId,
            taskNodeId: latestNode.id,
            level: TaskLogLevel.error,
            message: 'Node execution interrupted due to worker heartbeat timeout',
            payload: {
              workerId: latestNode.workerId ?? null,
              leaseUntil: latestNode.leaseUntil.toISOString(),
            },
          });

          await this.recalculateTaskStatus(latestNode.taskId);
        }
      });
    } finally {
      this.recoveringExpiredNodes = false;
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

  private async triggerWorkerDispatch(): Promise<void> {
    if (this.runtimeRole !== 'worker') {
      return;
    }

    await this.scheduleQueuedNodes();
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

  private resolveRuntimeRole(): 'api' | 'worker' {
    return process.env.AINATIVE_RUNTIME_ROLE === 'worker' ? 'worker' : 'api';
  }

  private readPositiveNumberFromEnv(
    key: string,
    defaultValue: number,
  ): number {
    const rawValue = process.env[key];

    if (!rawValue) {
      return defaultValue;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return defaultValue;
    }

    return Math.floor(parsedValue);
  }

  private async applySandboxLifecycle(
    task: Task,
    status: TaskStatus,
  ): Promise<void> {
    if (status === TaskStatus.inReview && task.gitWorktreePath) {
      await this.appendLog({
        taskId: task.id,
        taskNodeId: null,
        level: TaskLogLevel.warn,
        message: 'Task kept sandbox for troubleshooting',
        payload: {
          gitWorktreePath: task.gitWorktreePath,
          sandboxCleanupAt: task.sandboxCleanupAt?.toISOString() ?? null,
        },
      });
      return;
    }

    if (status !== TaskStatus.done) {
      return;
    }

    const cleanupResult = await this.taskRuntimeService.cleanupRuntime(task);

    await this.taskRepository.update(task.id, {
      sandboxCleanupAt: new Date(),
      ...(cleanupResult.cleaned ? { gitWorktreePath: null } : {}),
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: cleanupResult.cleaned ? TaskLogLevel.info : TaskLogLevel.warn,
      message: cleanupResult.cleaned
        ? 'Task worktree cleaned after completion'
        : 'Task worktree cleanup failed after completion',
      payload: {
        gitWorktreePath: task.gitWorktreePath,
        errorMessage: cleanupResult.errorMessage ?? null,
      },
    });
  }

  private async recalculateTaskStatus(taskId: string): Promise<void> {
    const nodes = await this.taskNodeRepository.findByTaskId(taskId);

    const status = this.calculateTaskStatus(nodes);

    const currentTask = await this.taskRepository.findById(taskId);

    if (!currentTask) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = currentTask.status;

    await this.taskRepository.update(taskId, {
      status,
      finishedAt: status === TaskStatus.done ? new Date() : null,
    });

    if (previousStatus !== status) {
      await this.applySandboxLifecycle(currentTask, status);

      if (currentTask.createdBy) {
        await this.notificationsService.notifyTaskStatusChanged({
          userId: currentTask.createdBy,
          taskId,
          status,
        });
      }
    }
  }

  private calculateTaskStatus(nodes: TaskNode[]): TaskStatus {
    if (!nodes.length) {
      return TaskStatus.todo;
    }

    if (nodes.some((node) => node.status === TaskStatus.inProgress)) {
      return TaskStatus.inProgress;
    }

    if (nodes.some((node) => node.status === TaskStatus.inReview)) {
      return TaskStatus.inReview;
    }

    const hasTodo = nodes.some((node) => node.status === TaskStatus.todo);
    const hasDone = nodes.some((node) => node.status === TaskStatus.done);

    if (hasTodo && hasDone) {
      return TaskStatus.inProgress;
    }

    if (nodes.every((node) => node.status === TaskStatus.done)) {
      return TaskStatus.done;
    }

    if (nodes.every((node) => node.status === TaskStatus.todo)) {
      return TaskStatus.todo;
    }

    return TaskStatus.todo;
  }

  private async getTaskOrThrow(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.projectsService.assertCanAccessProject(
      task.projectId,
      currentUser,
    );

    return task;
  }

  private normalizeNodeType(nodeType: string): TaskNodeType {
    if (Object.values(TaskNodeType).includes(nodeType as TaskNodeType)) {
      return nodeType as TaskNodeType;
    }

    return TaskNodeType.agent;
  }

  private async appendLog({
    taskId,
    taskNodeId,
    level,
    message,
    payload,
  }: {
    taskId: string;
    taskNodeId?: string | null;
    level: TaskLogLevel;
    message: string;
    payload?: Record<string, unknown> | null;
  }): Promise<TaskLog> {
    const log = await this.taskLogRepository.create({
      taskId,
      taskNodeId: taskNodeId ?? null,
      level,
      message,
      payload: payload ?? null,
    });

    this.taskLogEventsService.emit(log);

    return log;
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private isAdmin(currentUser: JwtPayloadType): boolean {
    return currentUser.roles?.includes('admin') ?? false;
  }
}
