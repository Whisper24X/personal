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
import { promises as fs } from 'fs';
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
import {
  TaskConfig,
  TaskLoopConfig,
  TaskNodeConfig,
  TaskNodeInput,
  TaskNodeRuntime,
} from './types/task-config.type';
import { resolveAinativeDataRootDir } from '../utils/workspace-paths';

@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly agentCliLogChunkLength = 4_000;
  private readonly runningNodeSet = new Set<string>();
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
  private readonly defaultDataRootDir = path.resolve(
    resolveAinativeDataRootDir(),
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
      'project.task.read',
    );

    let resolvedMode: TaskMode = createTaskDto.mode ?? TaskMode.conversation;
    const taskConfig = this.mergeTaskConfig(
      null,
      this.toObjectRecord(createTaskDto.configJson),
    );
    const workflowTemplateId = this.readTaskWorkflowTemplateId(taskConfig);
    const defaultNodeExecution = this.readNodeExecutionConfig(taskConfig);
    let nodes: Array<{
      nodeOrder: number;
      name: string;
      input?: TaskNodeInput | null;
      agentCliId: string;
      agentCliConfigId: string;
      configJson: TaskNodeConfig | null;
      loopJson: TaskLoopConfig | null;
    }> = [];

    if (workflowTemplateId) {
      const template = await this.workflowTemplatesService.getTemplateForTask({
        templateId: workflowTemplateId,
        projectId: project.id,
        projectBusinessLineId: project.businessLineId,
      });

      this.ensureTemplateNodesSupported(template.nodesJson);
      resolvedMode = TaskMode.workflow;

      nodes = template.nodesJson
        .map((node) => {
          const nodeExecution = this.resolveRequiredNodeExecutionConfig(
            node.input,
            defaultNodeExecution,
          );

          return {
            nodeOrder: node.nodeOrder,
            name: node.name,
            input: this.buildTaskNodeInput({
              taskPrompt: createTaskDto.prompt ?? null,
              nodeInput: this.readTemplateNodeInput(node.input),
              source: this.toObjectRecord(node.input),
            }),
            agentCliId: nodeExecution.agentCliId,
            agentCliConfigId: nodeExecution.agentCliConfigId,
            configJson: this.buildTaskNodeConfig(node),
            loopJson: this.resolveNodeLoopJson(node.input, taskConfig),
          };
        })
        .sort((left, right) => left.nodeOrder - right.nodeOrder);
    } else {
      if (resolvedMode === TaskMode.workflow) {
        throw new ConflictException(
          'Workflow mode requires configJson.workflowTemplateId',
        );
      }

      const conversationNodeExecution =
        this.resolveRequiredNodeExecutionConfig(taskConfig);

      nodes = [
        {
          nodeOrder: 1,
          name: 'conversation-node',
          input: this.buildTaskNodeInput({
            taskPrompt: createTaskDto.prompt ?? null,
            nodeInput: null,
          }),
          agentCliId: conversationNodeExecution.agentCliId,
          agentCliConfigId: conversationNodeExecution.agentCliConfigId,
          configJson: null,
          loopJson: this.resolveNodeLoopJson(null, taskConfig),
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
    const taskNameId = this.resolveCreateTaskNameId({
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
      mode: resolvedMode,
      title: createTaskDto.title,
      prompt: createTaskDto.prompt ?? null,
      status: TaskStatus.todo,
      gitBranch: normalizedGitBranch,
      configJson: taskConfig,
      createdBy: currentUser.sub,
      gitBaseBranch: normalizedGitBaseBranch,
      gitWorktree: normalizedGitWorktree,
      startedAt: null,
      finishedAt: null,
    });

    let runtimeTask = task;

    try {
      const initializedRuntime = await this.initializeTaskRuntime(
        task,
        project,
        {
          forceLog: true,
        },
      );
      runtimeTask = initializedRuntime.task;
    } catch (error) {
      await this.taskRuntimeService.cleanupRuntime(task, project).catch(() => ({
        cleaned: false,
      }));
      await this.taskRepository.remove(task.id).catch(() => undefined);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to initialize task runtime';

      throw new ConflictException(
        `Task runtime initialization failed: ${errorMessage}`,
      );
    }

    await this.taskNodeRepository.createMany(
      nodes.map((node) => ({
        taskId: runtimeTask.id,
        nodeOrder: node.nodeOrder,
        name: node.name,
        input: node.input ?? null,
        agentCliId: node.agentCliId,
        agentCliConfigId: node.agentCliConfigId,
        agentClioutput: null,
        agentCliSessionId: null,
        configJson: node.configJson,
        loopJson: node.loopJson,
        runtimeJson: null,
        status: TaskStatus.todo,
        startedAt: null,
        finishedAt: null,
      })),
    );

    await this.appendLog({
      taskId: runtimeTask.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task created',
      payload: {
        mode: resolvedMode,
        nodeCount: nodes.length,
      },
    });

    return runtimeTask;
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
      'project.task.read',
    );
    const updatePayload: Partial<Task> = {};

    if (updateTaskDto.title !== undefined) {
      updatePayload.title = updateTaskDto.title;
    }
    if (updateTaskDto.prompt !== undefined) {
      updatePayload.prompt = updateTaskDto.prompt;
    }
    if (updateTaskDto.gitBranch !== undefined) {
      updatePayload.gitBranch = this.normalizeGitBranch(
        updateTaskDto.gitBranch,
      );
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
    if (updateTaskDto.configJson !== undefined) {
      updatePayload.configJson = this.mergeTaskConfig(
        task.configJson,
        this.toObjectRecord(updateTaskDto.configJson),
      );
    }
    if (Object.keys(updatePayload).length === 0) {
      return this.detailById(task.id, currentUser);
    }

    const updatedTask = await this.taskRepository.update(
      task.id,
      updatePayload,
    );
    const effectiveTask = updatedTask ?? task;

    if (
      updatePayload.configJson !== undefined ||
      updatePayload.prompt !== undefined
    ) {
      const nodes = await this.taskNodeRepository.findByTaskId(task.id);
      await Promise.all(
        nodes
          .filter((node) => node.status !== TaskStatus.done)
          .map((node) => {
            const nextNodeExecution =
              effectiveTask.mode === TaskMode.workflow
                ? this.resolveRequiredNodeExecutionConfig(
                    effectiveTask.configJson,
                    {
                      agentCliId: node.agentCliId ?? null,
                      agentCliConfigId: node.agentCliConfigId ?? null,
                    },
                  )
                : this.resolveRequiredNodeExecutionConfig(
                    effectiveTask.configJson,
                  );

            return this.taskNodeRepository.update(node.id, {
              agentCliId: nextNodeExecution.agentCliId,
              agentCliConfigId: nextNodeExecution.agentCliConfigId,
              loopJson:
                effectiveTask.mode === TaskMode.conversation &&
                node.nodeOrder === 1
                  ? this.resolveNodeLoopJson(
                      node.input,
                      effectiveTask.configJson,
                      node.loopJson,
                    )
                  : node.loopJson,
              input: this.withTaskInput(
                node.input,
                effectiveTask.prompt ?? null,
              ),
            });
          }),
      );
    }

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
      'project.task.read',
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
      'project.task.read',
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
        runtimeJson: this.buildPendingReplyRuntimeJson(normalizedMessage),
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

      if (todoNode) {
        await this.taskNodeRepository.update(todoNode.id, {
          runtimeJson: this.buildPendingReplyRuntimeJson(normalizedMessage),
        });
      } else {
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
          runtimeJson: this.buildPendingReplyRuntimeJson(normalizedMessage),
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
    const task = await this.getTaskOrThrow(taskId, currentUser);
    const nodes = await this.taskNodeRepository.findByTaskId(taskId);
    const nodeMessages = await Promise.all(
      nodes.map((node) => this.readNodeOutputMessages(task, node)),
    );

    return nodeMessages.flat();
  }

  async execute(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    let task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
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
      'project.task.read',
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
      agentClioutput: null,
      runtimeJson: null,
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
      'project.task.read',
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
      agentClioutput: await this.writeNodeOutputJsonl({
        task,
        node: runningNode,
        output: {
          summary: 'Execution cancelled by user',
          finishedAt: new Date().toISOString(),
          error: {
            code: 'CANCELLED',
            message: 'Execution cancelled by user',
          },
        },
      }),
      runtimeJson: null,
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
      'project.task.read',
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
      runtimeJson: null,
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
      (await this.readNodeOutputSummary(targetNode)) ??
      `Node ${targetNode.nodeOrder} approved`;
    const generatedBy = 'agent-runner:approved';
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
      'project.task.read',
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

  async createArtifact(
    taskId: Task['id'],
    createTaskArtifactDto: CreateTaskArtifactDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskArtifact> {
    const task = await this.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
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
    let executionTask: Task | null = null;

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
      executionTask = this.createRuntimeTaskSnapshot(runtimeTask, runtime);

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

      await this.executeAgentNode({
        taskId,
        nodeId,
        task: executionTask,
        node: runningNode,
        project,
      });
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected execution error';

      const latestNode = await this.taskNodeRepository.findById(nodeId);
      const outputTask =
        executionTask ?? (await this.taskRepository.findById(taskId));

      if (latestNode && outputTask) {
        const agentClioutput = await this.writeNodeOutputJsonl({
          task: outputTask,
          node: latestNode,
          output: {
            summary: errorMessage,
            finishedAt: new Date().toISOString(),
            error: {
              code: 'UNKNOWN',
              message: errorMessage,
            },
          },
        });

        await this.finalizeNodeAsFailure({
          nodeId,
          agentClioutput,
          agentCliSessionId: latestNode.agentCliSessionId ?? null,
        });
      }

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

    const initializedRuntime = await this.initializeTaskRuntime(task, project);

    return {
      task: this.createRuntimeTaskSnapshot(
        initializedRuntime.task,
        initializedRuntime.runtime,
      ),
      project,
    };
  }

  private async initializeTaskRuntime(
    task: Task,
    project: Project,
    options?: { forceLog?: boolean },
  ): Promise<{
    task: Task;
    runtime: {
      gitBranch: string;
      gitBaseBranch: string;
      gitWorktree: string;
      worktreePath: string;
    };
  }> {
    const runtime = await this.taskRuntimeService.ensureRuntime(task, project);

    const hasRuntimeChanged =
      task.gitBranch !== runtime.gitBranch ||
      task.gitBaseBranch !== runtime.gitBaseBranch ||
      task.gitWorktree !== runtime.gitWorktree;

    const runtimeTask = hasRuntimeChanged
      ? ((await this.taskRepository.update(task.id, {
          gitBranch: runtime.gitBranch,
          gitBaseBranch: runtime.gitBaseBranch,
          gitWorktree: runtime.gitWorktree,
        })) ?? task)
      : task;

    if (options?.forceLog || hasRuntimeChanged) {
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
    }

    return {
      task: runtimeTask,
      runtime,
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
    let streamedStdoutLineCount = 0;
    let streamedStderrLineCount = 0;
    let streamPersistQueue = Promise.resolve();

    const executionResult = await this.agentRunnerService.executeAgentNode({
      task,
      node,
      project,
      callbacks: {
        onStdoutLine: (line) => {
          streamedStdoutLineCount += 1;
          const lineIndex = streamedStdoutLineCount;
          streamPersistQueue = streamPersistQueue.then(() => {
            return this.persistAgentCliStreamLine({
              taskId,
              nodeId,
              task,
              node,
              stream: 'stdout',
              line,
              lineIndex,
            });
          });
        },
        onStderrLine: (line) => {
          streamedStderrLineCount += 1;
          const lineIndex = streamedStderrLineCount;
          streamPersistQueue = streamPersistQueue.then(() => {
            return this.persistAgentCliStreamLine({
              taskId,
              nodeId,
              task,
              node,
              stream: 'stderr',
              line,
              lineIndex,
            });
          });
        },
      },
    });

    await streamPersistQueue;

    await this.appendAgentCliProcessLogs({
      taskId,
      nodeId,
      executionResult,
      streamedStdoutLineCount,
      streamedStderrLineCount,
    });

    const isContinuation = !!this.normalizeOptionalString(
      node.agentCliSessionId,
    );

    if (executionResult.success) {
      const fullOutput =
        executionResult.stdout ??
        'Agent execution finished without stdout output';
      const summary =
        fullOutput.length > 2_000 ? fullOutput.slice(0, 2_000) : fullOutput;
      const finishedAt = new Date().toISOString();
      const agentClioutput = isContinuation
        ? this.resolveNodeOutputPath(task, node)
        : await this.writeNodeOutputJsonl({
            task,
            node,
            output: {
              summary,
              stdout: executionResult.stdout,
              stderr: executionResult.stderr || null,
              exitCode: executionResult.exitCode,
              durationMs: executionResult.durationMs,
              finishedAt,
              command: executionResult.command,
              args: executionResult.args,
              prompt: executionResult.prompt,
              sessionId: executionResult.sessionId ?? null,
            },
          });

      const loopResult = await this.finalizeNodeAsSuccess({
        node,
        agentClioutput,
        agentCliSessionId: executionResult.sessionId ?? null,
      });

      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level: TaskLogLevel.info,
        message: loopResult.queuedNextLoop
          ? 'Agent node loop completed; queued next loop'
          : loopResult.pendingApproval
            ? 'Agent node completed; pending approval'
            : 'Agent node completed successfully',
        payload: {
          status: loopResult.status,
          durationMs: executionResult.durationMs,
          command: executionResult.command,
          args: executionResult.args,
          loopJson: loopResult.loopJson,
          pendingApproval: loopResult.pendingApproval,
        },
      });

      if (!loopResult.queuedNextLoop && !loopResult.pendingApproval) {
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

    const agentClioutput = isContinuation
      ? this.resolveNodeOutputPath(task, node)
      : await this.writeNodeOutputJsonl({
          task,
          node,
          output: {
            summary: executionResult.errorMessage ?? 'Agent execution failed',
            stdout: executionResult.stdout || null,
            stderr: executionResult.stderr || null,
            exitCode: executionResult.exitCode,
            signal: executionResult.signal,
            durationMs: executionResult.durationMs,
            timedOut: executionResult.timedOut,
            finishedAt: new Date().toISOString(),
            command: executionResult.command,
            args: executionResult.args,
            prompt: executionResult.prompt,
            sessionId: executionResult.sessionId ?? null,
            error: {
              code: executionResult.timedOut ? 'TIMEOUT' : 'RUNNER_FAILED',
              message: executionResult.errorMessage ?? 'Agent execution failed',
            },
          },
        });

    await this.finalizeNodeAsFailure({
      nodeId,
      agentClioutput,
      agentCliSessionId: executionResult.sessionId ?? null,
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

  private async appendAgentCliProcessLogs({
    taskId,
    nodeId,
    executionResult,
    streamedStdoutLineCount,
    streamedStderrLineCount,
  }: {
    taskId: string;
    nodeId: string;
    executionResult: {
      stdout: string;
      stderr: string;
      durationMs: number;
      command: string;
      args: string[];
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      timedOut: boolean;
    };
    streamedStdoutLineCount?: number;
    streamedStderrLineCount?: number;
  }): Promise<void> {
    if (!streamedStdoutLineCount) {
      await this.appendAgentCliStreamLogs({
        taskId,
        nodeId,
        stream: 'stdout',
        content: executionResult.stdout,
        level: TaskLogLevel.info,
        executionResult,
      });
    }
    if (!streamedStderrLineCount) {
      await this.appendAgentCliStreamLogs({
        taskId,
        nodeId,
        stream: 'stderr',
        content: executionResult.stderr,
        level: TaskLogLevel.warn,
        executionResult,
      });
    }
  }

  private async persistAgentCliStreamLine({
    taskId,
    nodeId,
    task,
    node,
    stream,
    line,
    lineIndex,
  }: {
    taskId: string;
    nodeId: string;
    task: Task;
    node: TaskNode;
    stream: 'stdout' | 'stderr';
    line: string;
    lineIndex: number;
  }): Promise<void> {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      return;
    }

    if (stream === 'stdout' && this.isJsonLine(normalizedLine)) {
      await this.appendNodeOutputJsonlLines({
        task,
        node,
        lines: [normalizedLine],
      });
    }

    await this.appendLog({
      taskId,
      taskNodeId: nodeId,
      level: stream === 'stdout' ? TaskLogLevel.info : TaskLogLevel.warn,
      message: `Agent CLI ${stream} chunk`,
      payload: {
        stream,
        lineIndex,
        text: normalizedLine,
      },
    });
  }

  private async appendAgentCliStreamLogs({
    taskId,
    nodeId,
    stream,
    content,
    level,
    executionResult,
  }: {
    taskId: string;
    nodeId: string;
    stream: 'stdout' | 'stderr';
    content: string;
    level: TaskLogLevel;
    executionResult: {
      durationMs: number;
      command: string;
      args: string[];
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      timedOut: boolean;
    };
  }): Promise<void> {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    const chunks = this.chunkAgentCliLogContent(normalizedContent);

    for (let index = 0; index < chunks.length; index += 1) {
      await this.appendLog({
        taskId,
        taskNodeId: nodeId,
        level,
        message: `Agent CLI ${stream} chunk`,
        payload: {
          stream,
          chunkIndex: index + 1,
          chunkCount: chunks.length,
          text: chunks[index],
          durationMs: executionResult.durationMs,
          command: executionResult.command,
          args: executionResult.args,
          exitCode: executionResult.exitCode,
          signal: executionResult.signal,
          timedOut: executionResult.timedOut,
        },
      });
    }
  }

  private chunkAgentCliLogContent(content: string): string[] {
    const chunks: string[] = [];

    for (
      let index = 0;
      index < content.length;
      index += this.agentCliLogChunkLength
    ) {
      chunks.push(content.slice(index, index + this.agentCliLogChunkLength));
    }

    return chunks;
  }

  private async finalizeNodeAsSuccess({
    node,
    agentClioutput,
    agentCliSessionId,
  }: {
    node: TaskNode;
    agentClioutput: string;
    agentCliSessionId?: string | null;
  }): Promise<{
    status: TaskStatus;
    loopJson: TaskLoopConfig;
    queuedNextLoop: boolean;
    pendingApproval: boolean;
  }> {
    const currentLoop = this.readNodeLoopConfig(node.loopJson);
    const nextLoopJson: TaskLoopConfig = {
      enabled: currentLoop.enabled,
      loopCount: Math.max(currentLoop.loopCount + 1, 1),
      maxLoops: currentLoop.maxLoops,
    };
    const queuedNextLoop =
      nextLoopJson.enabled && nextLoopJson.loopCount < nextLoopJson.maxLoops;
    const pendingApproval =
      !queuedNextLoop && this.readNodeRequiresApproval(node);
    const status = queuedNextLoop
      ? TaskStatus.todo
      : pendingApproval
        ? TaskStatus.inReview
        : TaskStatus.done;

    await this.taskNodeRepository.update(node.id, {
      status,
      loopJson: nextLoopJson,
      startedAt: queuedNextLoop ? null : (node.startedAt ?? null),
      finishedAt: queuedNextLoop ? null : new Date(),
      agentClioutput,
      agentCliSessionId: agentCliSessionId ?? node.agentCliSessionId ?? null,
      runtimeJson: null,
    });

    return {
      status,
      loopJson: nextLoopJson,
      queuedNextLoop,
      pendingApproval,
    };
  }

  private async finalizeNodeAsFailure({
    nodeId,
    agentClioutput,
    agentCliSessionId,
  }: {
    nodeId: string;
    agentClioutput: string;
    agentCliSessionId?: string | null;
  }): Promise<void> {
    const latestNode = await this.taskNodeRepository.findById(nodeId);

    if (!latestNode || latestNode.status !== TaskStatus.inProgress) {
      return;
    }

    await this.taskNodeRepository.update(nodeId, {
      status: TaskStatus.inReview,
      finishedAt: new Date(),
      agentClioutput,
      agentCliSessionId:
        agentCliSessionId ?? latestNode.agentCliSessionId ?? null,
      runtimeJson: null,
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

      const content = await this.taskRuntimeService.readFileFromWorktree(
        task,
        fileName,
      );
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
            !this.readNodeLeaseUntil(latestNode) ||
            this.readNodeLeaseUntil(latestNode)! > now
          ) {
            continue;
          }

          const leaseUntil = this.readNodeLeaseUntil(latestNode);
          const workerId = this.readRuntimeWorkerId(latestNode);
          const agentClioutput = await this.writeNodeOutputJsonl({
            task: await this.getTaskByIdOrThrow(latestNode.taskId),
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

          await this.appendLog({
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
    await this.scheduleQueuedNodes();
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

    await this.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task completed; worktree preserved',
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
          taskTitle: currentTask.title,
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
    const hasQueuedLoop = nodes.some((node) => {
      const loopJson = this.readNodeLoopConfig(node.loopJson);
      return (
        node.status === TaskStatus.todo &&
        loopJson.enabled &&
        loopJson.loopCount > 0 &&
        loopJson.loopCount < loopJson.maxLoops
      );
    });

    if (hasQueuedLoop || (hasTodo && hasDone)) {
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

  private async getTaskByIdOrThrow(taskId: string): Promise<Task> {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
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

  private toObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  private mergeTaskConfig(
    currentConfig: Record<string, unknown> | null | undefined,
    incomingConfig: Record<string, unknown> | null | undefined,
  ): TaskConfig | null {
    const merged = {
      ...this.toObjectRecord(currentConfig),
      ...this.toObjectRecord(incomingConfig),
    } as TaskConfig;

    const workflowTemplateId = this.normalizeOptionalString(
      typeof merged.workflowTemplateId === 'string'
        ? merged.workflowTemplateId
        : null,
    );
    const agentCliId = this.normalizeOptionalString(
      typeof merged.agentCliId === 'string'
        ? merged.agentCliId
        : typeof merged.cliToolId === 'string'
          ? merged.cliToolId
          : null,
    );
    const agentCliConfigId = this.normalizeOptionalString(
      typeof merged.agentCliConfigId === 'string'
        ? merged.agentCliConfigId
        : typeof merged.agentToolConfigId === 'string'
          ? merged.agentToolConfigId
          : null,
    );
    const loopEnabled = this.normalizeBoolean(
      typeof merged.loopEnabled === 'boolean' ? merged.loopEnabled : null,
    );
    const maxLoops = this.normalizeMaxLoops(merged.maxLoops, false);

    if (workflowTemplateId) {
      merged.workflowTemplateId = workflowTemplateId;
    } else {
      delete merged.workflowTemplateId;
    }

    if (agentCliId) {
      merged.agentCliId = agentCliId;
    } else {
      delete merged.agentCliId;
    }

    if (agentCliConfigId) {
      merged.agentCliConfigId = agentCliConfigId;
    } else {
      delete merged.agentCliConfigId;
    }

    if (loopEnabled !== null) {
      merged.loopEnabled = loopEnabled;
    } else {
      delete merged.loopEnabled;
    }

    if (maxLoops !== null) {
      merged.maxLoops = maxLoops;
    } else {
      delete merged.maxLoops;
    }

    delete merged.cliToolId;
    delete merged.agentToolConfigId;

    return Object.keys(merged).length ? merged : null;
  }

  private readTaskWorkflowTemplateId(
    configJson: Record<string, unknown> | null | undefined,
  ): string | null {
    const config = this.toObjectRecord(configJson);

    return this.normalizeOptionalString(
      typeof config.workflowTemplateId === 'string'
        ? config.workflowTemplateId
        : null,
    );
  }

  private readNodeExecutionConfig(
    configJson: Record<string, unknown> | null | undefined,
  ): {
    agentCliId: string | null;
    agentCliConfigId: string | null;
  } {
    const config = this.toObjectRecord(configJson);
    const agentCliId = this.normalizeOptionalString(
      typeof config.agentCliId === 'string'
        ? config.agentCliId
        : typeof config.cliToolId === 'string'
          ? config.cliToolId
          : null,
    );
    const agentCliConfigId = this.normalizeOptionalString(
      typeof config.agentCliConfigId === 'string'
        ? config.agentCliConfigId
        : typeof config.agentToolConfigId === 'string'
          ? config.agentToolConfigId
          : null,
    );

    return {
      agentCliId,
      agentCliConfigId,
    };
  }

  private resolveRequiredNodeExecutionConfig(
    configJson: Record<string, unknown> | null | undefined,
    fallback?: {
      agentCliId: string | null;
      agentCliConfigId: string | null;
    } | null,
  ): {
    agentCliId: string;
    agentCliConfigId: string;
  } {
    const config = this.readNodeExecutionConfig(configJson);
    const agentCliId = config.agentCliId ?? fallback?.agentCliId ?? null;
    const agentCliConfigId =
      config.agentCliConfigId ?? fallback?.agentCliConfigId ?? null;

    if (!agentCliId) {
      throw new ConflictException(
        'Task config must include agentCliId for executable task nodes',
      );
    }

    if (!agentCliConfigId) {
      throw new ConflictException(
        'Task config must include agentCliConfigId for executable task nodes',
      );
    }

    return {
      agentCliId,
      agentCliConfigId,
    };
  }

  private resolveNodeLoopJson(
    input: Record<string, unknown> | null | undefined,
    taskConfig?: Record<string, unknown> | null,
    currentLoopJson?: Record<string, unknown> | null,
  ): TaskLoopConfig {
    const source = this.toObjectRecord(input);
    const config = this.toObjectRecord(taskConfig);
    const current = this.readNodeLoopConfig(currentLoopJson);
    const maxLoops =
      this.normalizeMaxLoops(source.maxLoops, false) ??
      this.normalizeMaxLoops(config.maxLoops, false) ??
      current.maxLoops;
    const explicitEnabled =
      this.normalizeBoolean(
        typeof source.loopEnabled === 'boolean' ? source.loopEnabled : null,
      ) ??
      this.normalizeBoolean(
        typeof config.loopEnabled === 'boolean' ? config.loopEnabled : null,
      );
    const enabled = explicitEnabled ?? maxLoops > 1;

    return {
      enabled,
      loopCount: current.loopCount,
      maxLoops,
    };
  }

  private readNodeLoopConfig(
    loopJson: Record<string, unknown> | null | undefined,
  ): TaskLoopConfig {
    const source = this.toObjectRecord(loopJson);
    const maxLoops = this.normalizeMaxLoops(source.maxLoops) ?? 1;
    const loopCount = Math.max(
      this.normalizeNonNegativeInteger(source.loopCount) ?? 0,
      0,
    );
    const enabled =
      this.normalizeBoolean(
        typeof source.enabled === 'boolean' ? source.enabled : null,
      ) ?? maxLoops > 1;

    return {
      enabled,
      loopCount,
      maxLoops,
    };
  }

  private normalizeBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    return null;
  }

  private normalizeNonNegativeInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalized = Math.floor(value);
      return normalized >= 0 ? normalized : null;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        const normalized = Math.floor(parsed);
        return normalized >= 0 ? normalized : null;
      }
    }

    return null;
  }

  private normalizeMaxLoops(
    value: unknown,
    fallbackToOne = true,
  ): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalized = Math.floor(value);
      if (normalized >= 1) {
        return normalized;
      }
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        const normalized = Math.floor(parsed);
        if (normalized >= 1) {
          return normalized;
        }
      }
    }

    return fallbackToOne ? 1 : null;
  }

  private buildTaskNodeInput({
    taskPrompt,
    nodeInput,
    source,
  }: {
    taskPrompt?: string | null;
    nodeInput?: string | null;
    source?: Record<string, unknown> | null;
  }): TaskNodeInput {
    const normalized = {
      ...this.toObjectRecord(source),
      taskInput: this.normalizeOptionalString(taskPrompt),
      nodeInput: this.normalizeOptionalString(nodeInput),
    } as TaskNodeInput;

    delete normalized.prompt;
    delete normalized.instructions;
    delete normalized.loopEnabled;
    delete normalized.maxLoops;
    delete normalized.agentCliId;
    delete normalized.agentCliConfigId;
    delete normalized.cliToolId;
    delete normalized.agentToolConfigId;

    return normalized;
  }

  private withTaskInput(
    currentInput: Record<string, unknown> | null | undefined,
    taskPrompt?: string | null,
  ): TaskNodeInput {
    const source = this.toObjectRecord(currentInput);
    const nodeInput = this.normalizeOptionalString(
      typeof source.nodeInput === 'string'
        ? source.nodeInput
        : typeof source.prompt === 'string'
          ? source.prompt
          : typeof source.instructions === 'string'
            ? source.instructions
            : null,
    );

    return this.buildTaskNodeInput({
      source,
      taskPrompt,
      nodeInput,
    });
  }

  private readTemplateNodeInput(
    input: Record<string, unknown> | null | undefined,
  ): string | null {
    const source = this.toObjectRecord(input);

    return this.normalizeOptionalString(
      typeof source.nodeInput === 'string'
        ? source.nodeInput
        : typeof source.prompt === 'string'
          ? source.prompt
          : typeof source.instructions === 'string'
            ? source.instructions
            : null,
    );
  }

  private buildPendingReplyRuntimeJson(message: string): TaskNodeRuntime {
    return {
      pendingUserMessage: message,
    };
  }

  private readNodeRequiresApproval(node: TaskNode): boolean {
    const config = this.toObjectRecord(node.configJson);
    const input = this.toObjectRecord(node.input);

    return (
      this.normalizeBooleanLike(config.requiresApproval) ??
      this.normalizeBooleanLike(input.requiresApproval) ??
      false
    );
  }

  private normalizeBooleanLike(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }

    return null;
  }

  private buildTaskNodeConfig(templateNode: {
    requiresApproval?: boolean;
  }): TaskNodeConfig | null {
    const requiresApproval = templateNode.requiresApproval === true;

    if (!requiresApproval) {
      return null;
    }

    return { requiresApproval };
  }

  private readNodeRuntime(node: TaskNode): TaskNodeRuntime | null {
    const runtime = this.toObjectRecord(node.runtimeJson);

    return Object.keys(runtime).length ? (runtime as TaskNodeRuntime) : null;
  }

  private readRuntimeWorkerId(node: TaskNode): string | null {
    const runtime = this.readNodeRuntime(node);

    return this.normalizeOptionalString(
      typeof runtime?.workerId === 'string' ? runtime.workerId : null,
    );
  }

  private readNodeLeaseUntil(node: TaskNode): Date | null {
    const runtime = this.readNodeRuntime(node);
    const raw = this.normalizeOptionalString(
      typeof runtime?.leaseUntil === 'string' ? runtime.leaseUntil : null,
    );

    if (!raw) {
      return null;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async writeNodeOutputJsonl({
    task,
    node,
    output,
  }: {
    task: Task;
    node: TaskNode;
    output: Record<string, unknown>;
  }): Promise<string> {
    const outputPath = this.resolveNodeOutputPath(task, node);
    const serializedOutput = this.serializeNodeOutputJsonl(output);

    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
    });
    await fs.writeFile(outputPath, serializedOutput, 'utf-8');

    return outputPath;
  }

  private async appendNodeOutputJsonlLines({
    task,
    node,
    lines,
  }: {
    task: Task;
    node: TaskNode;
    lines: string[];
  }): Promise<string> {
    const normalizedLines = lines.flatMap((line) =>
      this.extractJsonLinesFromContent(line),
    );

    const outputPath = this.resolveNodeOutputPath(task, node);
    if (!normalizedLines.length) {
      return outputPath;
    }

    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
    });
    await fs.appendFile(outputPath, `${normalizedLines.join('\n')}\n`, 'utf-8');

    return outputPath;
  }

  private serializeNodeOutputJsonl(output: Record<string, unknown>): string {
    const stdout =
      typeof output.stdout === 'string' && output.stdout.trim()
        ? output.stdout
        : null;
    const stdoutJsonlLines = stdout
      ? this.extractJsonLinesFromContent(stdout)
      : [];

    if (!stdoutJsonlLines.length) {
      return '';
    }

    return `${stdoutJsonlLines.join('\n')}\n`;
  }

  private extractJsonLinesFromContent(content: string): string[] {
    return content
      .split(/\r?\n/)
      .flatMap((line) => this.extractJsonCandidatesFromLine(line));
  }

  private extractJsonCandidatesFromLine(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }

    if (this.isJsonLine(trimmed)) {
      return [trimmed];
    }

    const candidates: string[] = [];

    for (let index = 0; index < trimmed.length; index += 1) {
      const marker = trimmed[index];
      if (marker !== '{' && marker !== '[') {
        continue;
      }

      const candidate = trimmed.slice(index).trim();
      if (!candidate || !this.isJsonLine(candidate)) {
        continue;
      }

      candidates.push(candidate);
      break;
    }

    return candidates;
  }

  private isJsonLine(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  private async readNodeOutputSummary(node: TaskNode): Promise<string | null> {
    const agentClioutput = this.normalizeOptionalString(node.agentClioutput);

    if (!agentClioutput) {
      return null;
    }

    try {
      const content = await fs.readFile(agentClioutput, 'utf-8');
      const records = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (let index = records.length - 1; index >= 0; index -= 1) {
        try {
          const parsed = JSON.parse(records[index]) as Record<string, unknown>;
          if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
            return parsed.summary.trim();
          }
        } catch {
          continue;
        }
      }

      const fallbackSummary = records.join('\n').trim();
      if (fallbackSummary) {
        return fallbackSummary.length > 2_000
          ? fallbackSummary.slice(0, 2_000)
          : fallbackSummary;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async readNodeOutputMessages(
    task: Task,
    node: TaskNode,
  ): Promise<TaskMessageDto[]> {
    const outputPath = this.resolveReadableNodeOutputPath(task, node);

    if (!outputPath) {
      return [];
    }

    try {
      const content = await fs.readFile(outputPath, 'utf-8');
      const records = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const fallbackTimeMs = (
        node.startedAt ??
        node.finishedAt ??
        node.createdAt ??
        task.createdAt ??
        new Date()
      ).getTime();

      return records.flatMap((line, index) => {
        const metadata = this.resolveNodeOutputMessageMetadata(line);

        if (!metadata) {
          return [];
        }

        return [
          {
            role: metadata.role,
            content: line,
            createdAt: new Date(metadata.createdAtMs ?? fallbackTimeMs + index),
            taskNodeId: node.id,
            level:
              metadata.role === TaskMessageRole.error
                ? TaskLogLevel.error
                : TaskLogLevel.info,
          },
        ];
      });
    } catch {
      return [];
    }
  }

  private resolveReadableNodeOutputPath(task: Task, node: TaskNode): string {
    return (
      this.normalizeOptionalString(node.agentClioutput) ??
      this.resolveNodeOutputPath(task, node)
    );
  }

  private resolveNodeOutputMessageMetadata(
    line: string,
  ): { role: TaskMessageRole; createdAtMs?: number } | null {
    const record = this.tryParseNodeOutputRecord(line);

    if (!record) {
      return {
        role: TaskMessageRole.system,
      };
    }

    const createdAt = this.resolveNodeOutputRecordDate(record);

    return {
      role: this.resolveNodeOutputRecordRole(record),
      createdAtMs: createdAt?.getTime(),
    };
  }

  private tryParseNodeOutputRecord(
    line: string,
  ): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private resolveNodeOutputRecordRole(
    record: Record<string, unknown>,
  ): TaskMessageRole {
    const descriptors = this.collectNodeOutputDescriptors(record);

    if (
      descriptors.some((descriptor) => {
        return descriptor === 'user' || descriptor === 'user_message';
      })
    ) {
      return TaskMessageRole.user;
    }

    if (
      descriptors.some((descriptor) => {
        return (
          descriptor === 'assistant' ||
          descriptor === 'assistant_message' ||
          descriptor === 'agent_message' ||
          descriptor === 'agent_message_delta' ||
          descriptor === 'model'
        );
      })
    ) {
      return TaskMessageRole.assistant;
    }

    if (
      descriptors.some((descriptor) => {
        return (
          descriptor === 'error' ||
          descriptor.endsWith('_error') ||
          descriptor.includes('error')
        );
      })
    ) {
      return TaskMessageRole.error;
    }

    if (record.is_error === true) {
      return TaskMessageRole.error;
    }

    return TaskMessageRole.system;
  }

  private collectNodeOutputDescriptors(
    record: Record<string, unknown>,
  ): string[] {
    const descriptors = new Set<string>();
    const queue: Array<{ value: Record<string, unknown>; depth: number }> = [
      { value: record, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      if (current.depth > 2) {
        continue;
      }

      ['type', 'event', 'method', 'kind', 'role', 'subtype'].forEach((key) => {
        const value = current.value[key];
        if (typeof value === 'string' && value.trim()) {
          descriptors.add(value.trim().toLowerCase().replace(/\./g, '_'));
        }
      });

      ['item', 'message', 'params', 'result', 'event'].forEach((key) => {
        const nested = current.value[key];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          queue.push({
            value: nested as Record<string, unknown>,
            depth: current.depth + 1,
          });
        }
      });
    }

    return [...descriptors];
  }

  private resolveNodeOutputRecordDate(
    record: Record<string, unknown>,
  ): Date | null {
    const timestampMs = this.normalizeTimestampNumber(record.timestamp_ms);
    if (timestampMs !== null) {
      return new Date(timestampMs);
    }

    const timestamp = this.normalizeTimestampNumber(record.timestamp);
    if (timestamp !== null) {
      return new Date(timestamp);
    }

    const directDateCandidates = [
      record.createdAt,
      record.created_at,
      record.updatedAt,
      record.updated_at,
      record.time,
      record.ts,
    ];

    for (const candidate of directDateCandidates) {
      const parsed = this.parseOptionalDateLike(candidate);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private normalizeTimestampNumber(value: unknown): number | null {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }

    if (value < 100_000_000_000) {
      return value * 1_000;
    }

    return value;
  }

  private parseOptionalDateLike(value: unknown): Date | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return new Date(this.normalizeTimestampNumber(value) ?? value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue)) {
      const normalized = this.normalizeTimestampNumber(numericValue);
      return normalized === null ? null : new Date(normalized);
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private resolveNodeOutputPath(task: Task, node: TaskNode): string {
    return path.resolve(
      this.defaultDataRootDir,
      task.businessLineId?.trim() || 'unknown-business-line',
      'projects',
      task.projectId?.trim() || 'unknown-project',
      'tasks',
      task.id,
      'nodes',
      node.id,
      'output.jsonl',
    );
  }

  private ensureTemplateNodesSupported(
    nodes: Array<{ type?: string | null }>,
  ): void {
    const unsupportedNode = nodes.find((node) => node.type !== 'agent');

    if (unsupportedNode) {
      throw new ConflictException(
        'Workflow template only supports agent nodes',
      );
    }
  }

  private resolveCreateTaskNameId({
    gitBranch,
    gitBaseBranch,
    gitWorktree,
    projectDefaultBranch,
  }: {
    gitBranch?: string | null;
    gitBaseBranch?: string | null;
    gitWorktree?: string | null;
    projectDefaultBranch?: string | null;
  }): string {
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
      gitWorktreeTaskNameId ?? gitBranchTaskNameId ?? this.buildTaskNameId()
    );
  }

  private buildTaskNameId(): string {
    const now = new Date();
    const datePrefix = this.formatTaskNameDate(now);

    return `${datePrefix}-${this.formatTaskNameTime(now)}`;
  }

  private formatTaskNameDate(date: Date): string {
    const year = date.getFullYear().toString();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}${month}${day}`;
  }

  private formatTaskNameTime(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');

    return `${hours}${minutes}${seconds}`;
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
