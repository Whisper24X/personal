import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
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
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import { DataSource } from 'typeorm';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReplyTaskDto } from './dto/reply-task.dto';
import { TaskMessageDto, TaskMessageRole } from './dto/task-message.dto';

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
  private readonly retentionCleanupIntervalMs = this.readPositiveNumberFromEnv(
    'AINATIVE_RETENTION_CLEANUP_INTERVAL_MS',
    3600_000,
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
  private retentionCleanupTimer: NodeJS.Timeout | null = null;
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
    private readonly projectRepository: ProjectRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService = new ConfigService(),
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

  async create(
    createTaskDto: CreateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    const project = await this.projectsService.assertProjectCapability(
      createTaskDto.projectId,
      currentUser,
      'project.task.create',
    );

    let resolvedMode: TaskMode = createTaskDto.mode ?? TaskMode.conversation;
    let workflowTemplateId: string | null = null;
    let nodes: Array<{
      nodeOrder: number;
      name: string;
      nodeType: TaskNodeType;
      requiresApproval: boolean;
      input?: Record<string, unknown> | null;
    }> = [];

    if (createTaskDto.workflowTemplateId) {
      const template = await this.workflowTemplatesService.getTemplateForTask({
        templateId: createTaskDto.workflowTemplateId,
        projectId: project.id,
        projectBusinessLineId: project.businessLineId,
      });

      resolvedMode = TaskMode.workflow;
      workflowTemplateId = template.id;

      nodes = template.nodesJson
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

    const normalizedGitBaseBranch = this.normalizeOptionalString(
      createTaskDto.gitBaseBranch,
    );
    const requestedGitWorktree = this.normalizeOptionalString(
      createTaskDto.gitWorktree,
    );
    const taskNameId = await this.resolveCreateTaskNameId({
      gitBranch: createTaskDto.gitBranch,
      gitBaseBranch: normalizedGitBaseBranch,
      gitWorktree: requestedGitWorktree,
      projectDefaultBranch: project.defaultBranch,
    });
    const normalizedGitBranch = this.resolveCreateGitBranch({
      gitBranch: createTaskDto.gitBranch,
      gitBaseBranch: normalizedGitBaseBranch,
      projectDefaultBranch: project.defaultBranch,
      taskNameId,
    });
    let normalizedGitWorktree = this.buildDefaultGitWorktree(taskNameId);

    if (requestedGitWorktree) {
      try {
        normalizedGitWorktree = await this.normalizeGitWorktree(
          requestedGitWorktree,
          project,
        );
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid git worktree name',
        );
      }
    }

    const existedTask = await this.taskRepository.findByGitWorktree(
      normalizedGitWorktree,
    );

    if (existedTask) {
      throw new ConflictException('Task worktree name already in use');
    }

    const task = await this.taskRepository.create({
      projectId: createTaskDto.projectId,
      businessLineId: project.businessLineId,
      workflowTemplateId,
      mode: resolvedMode,
      title: createTaskDto.title,
      prompt: createTaskDto.prompt ?? null,
      status: TaskStatus.todo,
      gitBranch: normalizedGitBranch,
      cliToolId: this.normalizeOptionalString(createTaskDto.cliToolId),
      agentToolConfigId: this.normalizeOptionalString(
        createTaskDto.agentToolConfigId,
      ),
      clientInputSnapshot: createTaskDto.clientInputSnapshot ?? null,
      createdBy: currentUser.sub,
      gitBaseBranch: normalizedGitBaseBranch,
      gitWorktree: normalizedGitWorktree,
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
      await this.projectsService.assertProjectCapability(
        query.projectId,
        currentUser,
        'project.task.read',
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
    const task = await this.getTaskOrThrow(id, currentUser);
    const nodes = await this.taskNodeRepository.findByTaskId(task.id);

    return {
      task,
      nodes,
    };
  }

  async update(
    taskId: Task['id'],
    updateTaskDto: UpdateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.create',
    );
    const updatePayload: Partial<Task> = {};

    if (updateTaskDto.title !== undefined) {
      updatePayload.title = updateTaskDto.title;
    }
    if (updateTaskDto.prompt !== undefined) {
      updatePayload.prompt = updateTaskDto.prompt;
    }
    if (updateTaskDto.gitBranch !== undefined) {
      updatePayload.gitBranch = this.normalizeGitBranch(updateTaskDto.gitBranch);
    }
    if (updateTaskDto.gitBaseBranch !== undefined) {
      updatePayload.gitBaseBranch = this.normalizeOptionalString(
        updateTaskDto.gitBaseBranch,
      );
    }
    if (updateTaskDto.gitWorktree !== undefined) {
      const requestedGitWorktree = this.normalizeOptionalString(
        updateTaskDto.gitWorktree,
      );
      if (requestedGitWorktree) {
        let normalizedGitWorktree: string;
        try {
          normalizedGitWorktree = await this.normalizeGitWorktree(
            requestedGitWorktree,
            await this.getProjectByIdOrThrow(task.projectId),
          );
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error
              ? error.message
              : 'Invalid git worktree name',
          );
        }

        if (normalizedGitWorktree !== task.gitWorktree) {
          const existedTask = await this.taskRepository.findByGitWorktree(
            normalizedGitWorktree,
          );
          if (existedTask && existedTask.id !== task.id) {
            throw new ConflictException('Task worktree name already in use');
          }
        }

        updatePayload.gitWorktree = normalizedGitWorktree;
      } else {
        updatePayload.gitWorktree = null;
      }
    }
    if (updateTaskDto.cliToolId !== undefined) {
      updatePayload.cliToolId = this.normalizeOptionalString(
        updateTaskDto.cliToolId,
      );
    }
    if (updateTaskDto.agentToolConfigId !== undefined) {
      updatePayload.agentToolConfigId = this.normalizeOptionalString(
        updateTaskDto.agentToolConfigId,
      );
    }
    if (updateTaskDto.clientInputSnapshot !== undefined) {
      updatePayload.clientInputSnapshot = updateTaskDto.clientInputSnapshot;
    }

    if (Object.keys(updatePayload).length === 0) {
      return this.detailById(task.id, currentUser);
    }

    await this.taskRepository.update(task.id, updatePayload);

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task info updated',
      payload: {
        updatedBy: currentUser.sub,
        fields: Object.keys(updatePayload),
      },
    });

    return this.detailById(task.id, currentUser);
  }

  async remove(taskId: Task['id'], currentUser: JwtPayloadType): Promise<void> {
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.create',
    );
    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );

    if (runningNode) {
      throw new ConflictException(
        'Cannot delete task while execution is in progress',
      );
    }

    await this.taskRepository.remove(task.id);
  }

  async reply(
    taskId: Task['id'],
    replyTaskDto: ReplyTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.create',
    );
    const prepared = await this.prepareTaskRuntime(task, currentUser);
    task = prepared.task;

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    if (runningNode) {
      throw new ConflictException(
        'Task already has an in-progress node and cannot accept reply',
      );
    }

    const normalizedMessage = replyTaskDto.message.trim();
    if (!normalizedMessage) {
      throw new ConflictException('Reply message cannot be empty');
    }

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: normalizedMessage,
      payload: {
        messageRole: TaskMessageRole.user,
        kind: 'reply',
        repliedBy: currentUser.sub,
      },
    });

    const inReviewNode =
      await this.taskNodeRepository.findFirstByTaskIdAndStatus({
        taskId: task.id,
        status: TaskStatus.inReview,
      });
    if (inReviewNode) {
      await this.taskNodeRepository.update(inReviewNode.id, {
        status: TaskStatus.todo,
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
        output: null,
      });

      await this.appendLog({
        taskId: task.id,
        taskNodeId: inReviewNode.id,
        level: TaskLogLevel.info,
        message: 'In-review node moved back to todo by reply',
        payload: {
          nodeOrder: inReviewNode.nodeOrder,
          repliedBy: currentUser.sub,
        },
      });
    } else {
      const todoNode = await this.taskNodeRepository.findFirstByTaskIdAndStatus(
        {
          taskId: task.id,
          status: TaskStatus.todo,
        },
      );

      if (!todoNode) {
        const fallbackNode =
          await this.taskNodeRepository.findFirstByTaskIdAndStatus({
            taskId: task.id,
            status: TaskStatus.done,
          });

        if (!fallbackNode) {
          throw new ConflictException('No node available for reply execution');
        }

        await this.taskNodeRepository.update(fallbackNode.id, {
          status: TaskStatus.todo,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
          output: null,
        });
      }
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
      message: 'Task queued after reply',
      payload: {
        repliedBy: currentUser.sub,
        requestedAt: queueRequestedAt.toISOString(),
      },
    });

    await this.recalculateTaskStatus(task.id);
    await this.triggerWorkerDispatch();

    return this.detailById(task.id, currentUser);
  }

  async listMessages(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskMessageDto[]> {
    await this.getTaskOrThrow(taskId, currentUser);

    const logs = await this.taskLogRepository.findByTaskIdSince({
      taskId,
      limit: 500,
    });

    return logs.map((log) => {
      const payload =
        log.payload && typeof log.payload === 'object'
          ? (log.payload as Record<string, unknown>)
          : null;

      const payloadRole =
        payload && typeof payload.messageRole === 'string'
          ? payload.messageRole
          : null;

      let role: TaskMessageRole;
      if (
        payloadRole === TaskMessageRole.user ||
        payloadRole === TaskMessageRole.assistant ||
        payloadRole === TaskMessageRole.system ||
        payloadRole === TaskMessageRole.error
      ) {
        role = payloadRole;
      } else if (log.level === TaskLogLevel.error) {
        role = TaskMessageRole.error;
      } else {
        role = TaskMessageRole.system;
      }

      return {
        role,
        content: log.message,
        createdAt: log.createdAt,
        taskNodeId: log.taskNodeId ?? null,
        level: log.level,
      };
    });
  }

  async execute(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.execute',
    );
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
    let task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.execute',
    );
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
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.cancel',
    );

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
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.execute',
    );

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

    // 审批通过后创建产物（节点执行时因 requiresApproval 而跳过了产物创建）
    const outputSummary =
      targetNode.output && typeof targetNode.output.summary === 'string'
        ? targetNode.output.summary
        : `Node ${targetNode.nodeOrder} approved`;
    const generatedBy =
      targetNode.nodeType === TaskNodeType.agent
        ? 'agent-runner:approved'
        : targetNode.nodeType === TaskNodeType.manual
          ? 'manual:approved'
          : 'workflow:approved';
    await this.createNodeExecutionArtifact({
      taskId: task.id,
      task,
      node: targetNode,
      summary: outputSummary,
      generatedBy,
    });

    await this.recalculateTaskStatus(task.id);
    await this.triggerWorkerDispatch();

    return this.detailById(task.id, currentUser);
  }

  async cleanupWorktree(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.create',
    );
    const project = await this.getProjectByIdOrThrow(task.projectId);

    const cleanupResult = await this.taskRuntimeService.cleanupRuntime(
      task,
      project,
    );

    await this.taskRepository.update(task.id, {
      ...(cleanupResult.cleaned ? { gitWorktree: null } : {}),
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: cleanupResult.cleaned ? TaskLogLevel.info : TaskLogLevel.warn,
      message: cleanupResult.cleaned
        ? 'Task worktree cleaned manually'
        : 'Task worktree cleanup skipped or failed',
      payload: {
        gitWorktree: task.gitWorktree,
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

  async listWorktreeFiles(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
    options?: { prefix?: string },
  ): Promise<string[]> {
    const task = await this.getTaskOrThrow(taskId, currentUser);

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
    const task = await this.getTaskOrThrow(taskId, currentUser);

    const content =
      await this.taskRuntimeService.readFileFromWorktree(task, relativePath);
    if (content === null) {
      throw new NotFoundException(
        `Worktree file not found: ${relativePath}`,
      );
    }

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return { path: normalized, content };
  }

  async createArtifact(
    taskId: Task['id'],
    createTaskArtifactDto: CreateTaskArtifactDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskArtifact> {
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.create',
    );

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
            const incrementalLogs =
              await this.taskLogRepository.findByTaskIdSince({
                taskId,
                since: cursorSince,
                afterId: cursorAfterId,
                limit: streamLimit,
              });

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

      const runtime = await this.taskRuntimeService.ensureRuntime(
        runtimeTask,
        project,
      );
      const executionTask = this.createRuntimeTaskSnapshot(runtimeTask, runtime);

      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.info,
        message: 'Runner attached to node',
        payload: {
          nodeOrder: pendingNode.nodeOrder,
          gitBranch: runtime.gitBranch,
          gitBaseBranch: runtime.gitBaseBranch,
          gitWorktree: runtime.gitWorktree,
          worktreePath: runtime.worktreePath,
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
          task: executionTask,
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
    const project = await this.projectsService.assertProjectCapability(
      task.projectId,
      currentUser,
      'project.task.read',
    );

    const runtime = await this.taskRuntimeService.ensureRuntime(task, project);

    const hasRuntimeChanged =
      task.gitBranch !== runtime.gitBranch ||
      task.gitBaseBranch !== runtime.gitBaseBranch ||
      task.gitWorktree !== runtime.gitWorktree;

    const runtimeTaskSnapshot = this.createRuntimeTaskSnapshot(task, runtime);

    if (!hasRuntimeChanged) {
      return { task: runtimeTaskSnapshot, project };
    }

    const updatedTask = await this.taskRepository.update(task.id, {
      gitBranch: runtime.gitBranch,
      gitBaseBranch: runtime.gitBaseBranch,
      gitWorktree: runtime.gitWorktree,
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task sandbox initialized',
      payload: {
        gitBranch: runtime.gitBranch,
        gitBaseBranch: runtime.gitBaseBranch,
        gitWorktree: runtime.gitWorktree,
        worktreePath: runtime.worktreePath,
      },
    });

    return {
      task: this.createRuntimeTaskSnapshot(updatedTask ?? task, runtime),
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
      const fullOutput = executionResult.stdout ?? 'Agent execution finished without stdout output';
      const summary =
        fullOutput.length > 2_000 ? fullOutput.slice(0, 2_000) : fullOutput;

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
          summary: fullOutput,
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
    const fileCount = await this.createGitDiffArtifact({
      task,
      taskNode: node,
    });

    if (fileCount === 0) {
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
    }
  }

  private async createGitDiffArtifact({
    task,
    taskNode,
  }: {
    task: Task;
    taskNode: TaskNode;
  }): Promise<number> {
    const diffArtifact =
      await this.taskRuntimeService.collectGitDiffArtifact(task);

    if (!diffArtifact) {
      return 0;
    }

    const fileCount = await this.createFileArtifactsFromWorktree({
      task,
      taskNode,
      changedFiles: diffArtifact.metadata?.changedFiles as string[] | undefined,
    });

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

    if (!hasSameArtifact) {
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

    return fileCount;
  }

  private async createFileArtifactsFromWorktree({
    task,
    taskNode,
    changedFiles,
  }: {
    task: Task;
    taskNode: TaskNode;
    changedFiles?: string[];
  }): Promise<number> {
    if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
      return 0;
    }

    const existedArtifacts = await this.taskArtifactRepository.findByTaskId(
      task.id,
    );
    const existingFileNames = new Set(
      existedArtifacts
        .filter(
          (a) =>
            a.taskNodeId === taskNode.id &&
            a.artifactType === TaskArtifactType.file,
        )
        .map((a) => a.name),
    );

    let created = 0;
    for (const filePath of changedFiles) {
      const fileName =
        typeof filePath === 'string' && filePath.trim()
          ? filePath.trim()
          : null;
      if (!fileName || existingFileNames.has(fileName)) {
        continue;
      }

      const content =
        await this.taskRuntimeService.readFileFromWorktree(task, fileName);
      if (content === null) {
        continue;
      }

      await this.taskArtifactRepository.create({
        taskId: task.id,
        taskNodeId: taskNode.id,
        artifactType: TaskArtifactType.file,
        name: fileName,
        downloadUrl: null,
        content,
        metadata: { source: 'worktree' },
      });
      existingFileNames.add(fileName);
      created += 1;
    }
    return created;
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
            message:
              'Node execution interrupted due to worker heartbeat timeout',
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

  private async scheduleRetentionCleanup(): Promise<void> {
    if (this.runtimeRole !== 'worker' || this.destroyed) {
      return;
    }

    const now = new Date();
    const expiredTasks =
      await this.taskRepository.findTasksWithExpiredWorktrees(20, now);

    for (const task of expiredTasks) {
      try {
        const cleanupResult =
          await this.taskRuntimeService.cleanupRuntime(task);

        await this.taskRepository.update(task.id, {
          ...(cleanupResult.cleaned ? { gitWorktree: null } : {}),
        });

        await this.appendLog({
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
        await this.appendLog({
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

  private resolveRuntimeRole(): 'api' | 'worker' {
    return this.configService.get('AINATIVE_RUNTIME_ROLE', { infer: true }) ===
      'worker'
      ? 'worker'
      : 'api';
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

  private async applySandboxLifecycle(
    task: Task,
    status: TaskStatus,
  ): Promise<void> {
    if (status === TaskStatus.inReview && task.gitWorktree) {
      await this.appendLog({
        taskId: task.id,
        taskNodeId: null,
        level: TaskLogLevel.warn,
        message: 'Task kept sandbox for troubleshooting',
        payload: {
          gitWorktree: task.gitWorktree,
        },
      });
      return;
    }

    if (status !== TaskStatus.done) {
      return;
    }

    const cleanupResult = await this.taskRuntimeService.cleanupRuntime(
      task,
      await this.getProjectByIdOrThrow(task.projectId),
    );

    await this.taskRepository.update(task.id, {
      ...(cleanupResult.cleaned ? { gitWorktree: null } : {}),
    });

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task completed; worktree retained until retention period expires',
      payload: {
        gitWorktree: task.gitWorktree,
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

  async assertCanAccessTask(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    return this.getTaskOrThrow(taskId, currentUser);
  }

  async assertCanAccessTaskProject(
    taskId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ task: Task; project: Project }> {
    const task = await this.getTaskOrThrow(taskId, currentUser);
    const project = await this.getProjectByIdOrThrow(task.projectId);

    return {
      task,
      project,
    };
  }

  private async getTaskOrThrow(
    taskId: string,
    currentUser: JwtPayloadType,
    capability = 'project.task.read',
  ): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.projectsService.assertProjectCapability(
      task.projectId,
      currentUser,
      capability,
    );

    return task;
  }

  private normalizeNodeType(nodeType: string): TaskNodeType {
    if (Object.values(TaskNodeType).includes(nodeType as TaskNodeType)) {
      return nodeType as TaskNodeType;
    }

    return TaskNodeType.agent;
  }

  private normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeGitBranch(value?: string | null): string | null {
    return this.normalizeOptionalString(value);
  }

  private async resolveCreateTaskNameId({
    gitBranch,
    gitBaseBranch,
    gitWorktree,
    projectDefaultBranch,
  }: {
    gitBranch?: string | null;
    gitBaseBranch?: string | null;
    gitWorktree?: string | null;
    projectDefaultBranch?: string | null;
  }): Promise<string> {
    const normalizedGitBranch = this.normalizeGitBranch(gitBranch);
    const reservedBranches = new Set(
      [gitBaseBranch, projectDefaultBranch, 'main', 'master']
        .map((value) => this.normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value)),
    );
    const gitBranchTaskNameId =
      normalizedGitBranch && !reservedBranches.has(normalizedGitBranch)
        ? this.extractTaskNameIdFromGitBranch(normalizedGitBranch)
        : null;
    const gitWorktreeTaskNameId = gitWorktree
      ? this.extractTaskNameIdFromGitWorktree(gitWorktree)
      : null;

    return (
      gitWorktreeTaskNameId ??
      gitBranchTaskNameId ??
      (await this.buildTaskNameId())
    );
  }

  private async buildTaskNameId(): Promise<string> {
    const datePrefix = this.formatTaskNameDate(new Date());
    const nextSequence =
      (await this.taskRepository.findMaxGitWorktreeSequence(
        this.buildTaskNameSequencePrefix(datePrefix),
      )) + 1;

    return `${datePrefix}-${this.formatTaskNameSequence(nextSequence)}`;
  }

  private formatTaskNameDate(date: Date): string {
    const year = date.getFullYear().toString();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}${month}${day}`;
  }

  private buildTaskNameSequencePrefix(datePrefix: string): string {
    return `wk-${datePrefix}-`;
  }

  private formatTaskNameSequence(sequence: number): string {
    return `${sequence}`.padStart(3, '0');
  }

  private buildDefaultGitBranch(taskNameId: string): string {
    return `feature/${taskNameId}`;
  }

  private buildDefaultGitWorktree(taskNameId: string): string {
    return `wk-${taskNameId}`;
  }

  private extractTaskNameIdFromGitBranch(gitBranch: string): string | null {
    const match = /^feature\/(\d{8}-\d+)$/.exec(gitBranch.trim());

    return match?.[1] ?? null;
  }

  private extractTaskNameIdFromGitWorktree(gitWorktree: string): string | null {
    const worktreeName = path.basename(gitWorktree.trim());
    const match = /^wk-(\d{8}-\d+)$/.exec(worktreeName);

    return match?.[1] ?? null;
  }

  private resolveCreateGitBranch({
    gitBranch,
    gitBaseBranch,
    projectDefaultBranch,
    taskNameId,
  }: {
    gitBranch?: string | null;
    gitBaseBranch?: string | null;
    projectDefaultBranch?: string | null;
    taskNameId: string;
  }): string {
    const normalizedGitBranch = this.normalizeGitBranch(gitBranch);

    if (!normalizedGitBranch) {
      return this.buildDefaultGitBranch(taskNameId);
    }

    const reservedBranches = new Set(
      [gitBaseBranch, projectDefaultBranch, 'main', 'master']
        .map((value) => this.normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value)),
    );

    if (reservedBranches.has(normalizedGitBranch)) {
      return this.buildDefaultGitBranch(taskNameId);
    }

    return normalizedGitBranch;
  }

  private async normalizeGitWorktree(
    value: string,
    project: Project,
  ): Promise<string> {
    const normalized = this.normalizeOptionalString(value);

    if (!normalized) {
      throw new Error('gitWorktree cannot be empty');
    }

    if (path.isAbsolute(normalized)) {
      const resolvedPath =
        await this.taskRuntimeService.resolveAndValidateCreateWorktreePath(
          project,
          normalized,
        );

      return path.basename(resolvedPath);
    }

    const normalizedSegments = normalized
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean);

    if (
      normalizedSegments.length !== 1 ||
      normalizedSegments[0] === '.' ||
      normalizedSegments[0] === '..'
    ) {
      throw new Error('gitWorktree must be a single directory name');
    }

    return normalizedSegments[0] ?? normalized;
  }

  private async getProjectByIdOrThrow(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private createRuntimeTaskSnapshot(
    task: Task,
    runtime: {
      gitBranch: string;
      gitBaseBranch: string;
      worktreePath: string;
    },
  ): Task {
    return {
      ...task,
      gitBranch: runtime.gitBranch,
      gitBaseBranch: runtime.gitBaseBranch,
      gitWorktree: runtime.worktreePath,
    };
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
