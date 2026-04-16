import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import path from 'path';
import { JwtPayloadType } from '../../auth/strategies/types/jwt-payload.type';
import {
  buildGeneratedBranchToken,
  buildTaskGitBranchName,
  buildTaskGitWorktreeName,
  extractTaskNameIdFromGitBranch,
  extractTaskNameIdFromGitWorktree,
} from '../../git/branch-name.util';
import { Project } from '../../projects/domain/project';
import { ProjectAccessService } from '../../projects/project-access.service';
import { WorkflowTemplatesService } from '../../workflow-templates/workflow-templates.service';
import { ContainerOrchestrationService } from '../../containers/container-orchestration.service';
import { ProjectExecutionSlotRepository } from '../../containers/infrastructure/persistence/relational/repositories/project-execution-slot.repository';
import { Task } from '../domain/task';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskDetailDto } from '../dto/task-detail.dto';
import { TaskMode } from '../dto/task-mode.enum';
import { TaskNodeStatus } from '../dto/task-node-status.enum';
import { TaskStatus } from '../dto/task-status.enum';
import { UpdateTaskDto } from '../dto/update-task.dto';
import {
  TaskLoopConfig,
  TaskNodeConfig,
  TaskNodeInput,
} from '../types/task-config.type';
import { TaskRuntimeService } from '../task-runtime.service';
import { TaskRepository } from '../infrastructure/persistence/task.repository';
import { TaskNodeRepository } from '../infrastructure/persistence/task-node.repository';
import { TaskConfigResolverService } from './task-config-resolver.service';
import { TaskLogService } from './task-log.service';
import { TaskRuntimeOrchestratorService } from './task-runtime-orchestrator.service';
import { TaskQueryService } from './task-query.service';
import { TaskAccessService } from './task-access.service';
import { TaskTitleSuggestionService } from './task-title-suggestion.service';
import { TaskWorkspaceContextCacheService } from './task-workspace-context-cache.service';
import { TaskWorkspaceWatchService } from './task-workspace-watch.service';
import { TaskLogLevel } from '../dto/task-log-level.enum';
import { initialTitleFromPrompt } from '../utils/task-title-placeholder';
import { GoalRepository } from '../../goals/infrastructure/persistence/goal.repository';

/** 仅用于整需求删除等内部编排；默认仍做计划一致性校验 */
export type RemoveTaskOptions = {
  skipPlanConsistencyCheck?: boolean;
};

@Injectable()
export class TaskCommandService {
  private readonly logger = new Logger(TaskCommandService.name);

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskNodeRepository: TaskNodeRepository,
    private readonly projectAccessService: ProjectAccessService,
    private readonly workflowTemplatesService: WorkflowTemplatesService,
    private readonly taskRuntimeService: TaskRuntimeService,
    private readonly taskConfigResolver: TaskConfigResolverService,
    private readonly taskLogService: TaskLogService,
    private readonly taskRuntimeOrchestrator: TaskRuntimeOrchestratorService,
    private readonly taskQueryService: TaskQueryService,
    private readonly taskAccessService: TaskAccessService,
    private readonly taskTitleSuggestionService: TaskTitleSuggestionService,
    private readonly containerOrchestration: ContainerOrchestrationService,
    private readonly projectExecutionSlotRepository: ProjectExecutionSlotRepository,
    private readonly taskWorkspaceWatchService: TaskWorkspaceWatchService,
    private readonly goalRepository: GoalRepository,
    private readonly taskWorkspaceContextCache: TaskWorkspaceContextCacheService,
  ) {}

  async create(
    createTaskDto: CreateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<Task> {
    const project = await this.projectAccessService.assertProjectCapability(
      createTaskDto.projectId,
      currentUser,
      'project.task.read',
    );

    let resolvedMode: TaskMode = createTaskDto.mode ?? TaskMode.conversation;
    const taskConfig = this.taskConfigResolver.mergeTaskConfig(
      null,
      this.taskConfigResolver.toObjectRecord(createTaskDto.configJson),
    );
    const workflowTemplateId =
      this.taskConfigResolver.readTaskWorkflowTemplateId(taskConfig);
    const defaultNodeExecution =
      this.taskConfigResolver.readNodeExecutionConfig(taskConfig);
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

      this.taskConfigResolver.ensureTemplateNodesSupported(template.nodesJson);
      resolvedMode = TaskMode.workflow;

      nodes = template.nodesJson
        .map((node) => {
          const nodeExecution =
            this.taskConfigResolver.resolveRequiredNodeExecutionConfig(
              node.input,
              defaultNodeExecution,
            );

          return {
            nodeOrder: node.nodeOrder,
            name: node.name,
            input: this.taskConfigResolver.buildTaskNodeInput({
              taskPrompt: createTaskDto.prompt ?? null,
              nodeInput: this.taskConfigResolver.readTemplateNodeInput(
                node.input,
              ),
              source: this.taskConfigResolver.toObjectRecord(node.input),
            }),
            agentCliId: nodeExecution.agentCliId,
            agentCliConfigId: nodeExecution.agentCliConfigId,
            configJson: this.taskConfigResolver.buildTaskNodeConfig(node),
            loopJson: this.taskConfigResolver.resolveNodeLoopJson(
              node.input,
              taskConfig,
            ),
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
        this.taskConfigResolver.resolveRequiredNodeExecutionConfig(taskConfig);

      nodes = [
        {
          nodeOrder: 1,
          name: 'conversation-node',
          input: this.taskConfigResolver.buildTaskNodeInput({
            taskPrompt: createTaskDto.prompt ?? null,
            nodeInput: null,
            source: this.taskConfigResolver.toObjectRecord(taskConfig),
          }),
          agentCliId: conversationNodeExecution.agentCliId,
          agentCliConfigId: conversationNodeExecution.agentCliConfigId,
          configJson: null,
          loopJson: this.taskConfigResolver.resolveNodeLoopJson(
            null,
            taskConfig,
          ),
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

    const promptTrimmed = createTaskDto.prompt?.trim() ?? '';
    const titleForCreate = initialTitleFromPrompt(
      createTaskDto.title?.trim() || promptTrimmed || '',
    );

    const task = await this.taskRepository.create({
      projectId: createTaskDto.projectId,
      businessLineId: project.businessLineId,
      goalId: createTaskDto.goalId ?? null,
      mode: resolvedMode,
      title: titleForCreate,
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
      const initializedRuntime =
        await this.taskRuntimeOrchestrator.initializeTaskRuntime(
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
        status: TaskNodeStatus.todo,
        startedAt: null,
        finishedAt: null,
      })),
    );

    await this.taskLogService.appendLog({
      taskId: runtimeTask.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task created',
      payload: {
        mode: resolvedMode,
        nodeCount: nodes.length,
      },
    });

    void this.taskTitleSuggestionService
      .regenerateTitleAfterCreate(runtimeTask.id, currentUser)
      .catch((error) => {
        this.logger.warn(
          `regenerate_title_after_create_schedule_failed ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    return runtimeTask;
  }

  async update(
    taskId: Task['id'],
    updateTaskDto: UpdateTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<TaskDetailDto> {
    const task = await this.taskAccessService.getTaskOrThrow(
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
            await this.taskAccessService.getProjectByIdOrThrow(task.projectId),
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
      updatePayload.configJson = this.taskConfigResolver.mergeTaskConfig(
        task.configJson,
        this.taskConfigResolver.toObjectRecord(updateTaskDto.configJson),
      );
    }
    if (Object.keys(updatePayload).length === 0) {
      return this.taskQueryService.detailById(task.id, currentUser);
    }

    const updatedTask = await this.taskRepository.update(
      task.id,
      updatePayload,
    );
    const effectiveTask = updatedTask ?? task;

    if (updatePayload.gitWorktree !== undefined) {
      this.taskWorkspaceContextCache.invalidateTask(task.id);
      await this.taskWorkspaceWatchService.syncTaskWatch(task.id);
    }

    if (
      updatePayload.configJson !== undefined ||
      updatePayload.prompt !== undefined
    ) {
      const nodes = await this.taskNodeRepository.findByTaskId(task.id);
      await Promise.all(
        nodes
          .filter((node) => node.status !== TaskNodeStatus.done)
          .map((node) => {
            const nextNodeExecution =
              effectiveTask.mode === TaskMode.workflow
                ? this.taskConfigResolver.resolveRequiredNodeExecutionConfig(
                    effectiveTask.configJson,
                    {
                      agentCliId: node.agentCliId ?? null,
                      agentCliConfigId: node.agentCliConfigId ?? null,
                    },
                  )
                : this.taskConfigResolver.resolveRequiredNodeExecutionConfig(
                    effectiveTask.configJson,
                  );

            return this.taskNodeRepository.update(node.id, {
              agentCliId: nextNodeExecution.agentCliId,
              agentCliConfigId: nextNodeExecution.agentCliConfigId,
              loopJson:
                effectiveTask.mode === TaskMode.conversation &&
                node.nodeOrder === 1
                  ? this.taskConfigResolver.resolveNodeLoopJson(
                      node.input,
                      effectiveTask.configJson,
                      node.loopJson,
                    )
                  : node.loopJson,
              input: this.taskConfigResolver.withTaskInput(
                node.input,
                effectiveTask.prompt ?? null,
              ),
            });
          }),
      );
    }

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task info updated',
      payload: {
        updatedBy: currentUser.sub,
        fields: Object.keys(updatePayload),
      },
    });

    return this.taskQueryService.detailById(task.id, currentUser);
  }

  async remove(
    taskId: Task['id'],
    currentUser: JwtPayloadType,
    options?: RemoveTaskOptions,
  ): Promise<void> {
    const task = await this.taskAccessService.getTaskOrThrow(
      taskId,
      currentUser,
      'project.task.read',
    );

    if (
      !options?.skipPlanConsistencyCheck &&
      (await this.goalRepository.shouldBlockTaskDeletionForPlan(
        task.id,
        task.status,
      ))
    ) {
      throw new BadRequestException(
        '该任务与需求任务计划关联：若有后置子任务尚未物化，或本任务为无后置依赖项且计划子任务尚未标记「分支已合并」，删除会导致计划数据不一致或影响其他功能组。请先处理相关子任务或在任务计划中标记分支已合并后再删除。',
      );
    }

    const runningNode = await this.taskNodeRepository.findInProgressByTaskId(
      task.id,
    );
    const existingSlot = await this.projectExecutionSlotRepository.findByTaskId(
      task.id,
    );
    const slotOwnedByTask = Boolean(existingSlot);

    const shouldAttemptRuntimeCleanup = Boolean(
      runningNode ||
        slotOwnedByTask ||
        task.gitWorktree?.trim() ||
        task.gitBranch?.trim(),
    );
    const shouldRemoveContainer = Boolean(runningNode || slotOwnedByTask);

    this.logger.log(
      `task_delete_cleanup_decision ${JSON.stringify({
        taskId: task.id,
        projectId: task.projectId,
        runningNodeId: runningNode?.id ?? null,
        gitWorktree: task.gitWorktree?.trim() || null,
        gitBranch: task.gitBranch?.trim() || null,
        slotTaskId: existingSlot?.taskId ?? null,
        slotOwnedByTask,
        shouldRemoveContainer,
        shouldAttemptRuntimeCleanup,
      })}`,
    );

    if (shouldAttemptRuntimeCleanup) {
      const project = await this.taskAccessService.getProjectByIdOrThrow(
        task.projectId,
      );

      if (shouldRemoveContainer) {
        this.logger.log(
          `task_delete_remove_runner ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            runningNodeId: runningNode?.id ?? null,
            slotTaskId: existingSlot?.taskId ?? null,
          })}`,
        );
        await this.containerOrchestration.removeContainerForTask(
          task.id,
          task.projectId,
        );
      } else {
        this.logger.log(
          `task_delete_skip_runner_cleanup ${JSON.stringify({
            taskId: task.id,
            projectId: task.projectId,
            reason: 'no_running_node_or_owned_slot',
          })}`,
        );
      }

      const cleanupResult = await this.taskRuntimeService.cleanupRuntime(
        task,
        project,
        {
          deleteBranch: true,
        },
      );

      if (!cleanupResult.cleaned) {
        await this.taskLogService.appendLog({
          taskId: task.id,
          taskNodeId: null,
          level: TaskLogLevel.warn,
          message: 'Task deletion blocked because runtime cleanup failed',
          payload: {
            deletedBy: currentUser.sub,
            gitWorktree: task.gitWorktree,
            gitBranch: task.gitBranch ?? null,
            errorMessage: cleanupResult.errorMessage ?? null,
          },
        });

        throw new ConflictException(
          `Task deletion blocked because runtime cleanup failed: ${
            cleanupResult.errorMessage ?? 'unknown cleanup error'
          }`,
        );
      }
    }

    await this.taskLogService.appendLog({
      taskId: task.id,
      taskNodeId: null,
      level: TaskLogLevel.info,
      message: 'Task deleted',
      payload: {
        deletedBy: currentUser.sub,
        gitWorktree: task.gitWorktree ?? null,
        gitBranch: task.gitBranch ?? null,
      },
    });

    this.logger.log(
      `task_deleted ${JSON.stringify({ taskId: task.id, deletedBy: currentUser.sub, gitWorktree: task.gitWorktree ?? null })}`,
    );

    await this.taskRepository.remove(task.id);
    this.taskWorkspaceContextCache.invalidateTask(task.id);

    if (task.projectId) {
      const project = await this.taskAccessService
        .getProjectByIdOrThrow(task.projectId)
        .catch(() => null);

      if (project) {
        await this.taskRuntimeService.cleanupTaskDataDir(task, project);
      }
    }
  }

  private normalizeOptionalString(value?: string | null): string | null {
    return this.taskConfigResolver.normalizeOptionalString(value);
  }

  private normalizeGitBranch(value?: string | null): string | null {
    return this.taskConfigResolver.normalizeGitBranch(value);
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
    return buildGeneratedBranchToken();
  }

  private buildDefaultGitBranch(taskNameId: string): string {
    return buildTaskGitBranchName(taskNameId);
  }

  private buildDefaultGitWorktree(taskNameId: string): string {
    return buildTaskGitWorktreeName(taskNameId);
  }

  private extractTaskNameIdFromGitBranch(gitBranch: string): string | null {
    return extractTaskNameIdFromGitBranch(gitBranch);
  }

  private extractTaskNameIdFromGitWorktree(gitWorktree: string): string | null {
    return extractTaskNameIdFromGitWorktree(gitWorktree);
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
}
