import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  buildGoalGitBranchName,
  buildPlanItemGitBranchName,
} from '../git/branch-name.util';
import { ProjectDocsService } from '../projects/project-docs.service';
import { ProjectKnowledgeService } from '../projects/project-knowledge.service';
import { ProjectsService } from '../projects/projects.service';
import { buildPullRequestUrl } from '../git/pull-request-url.util';
import { GitService } from '../git/git.service';
import { GitBranchMergeResultDto } from '../git/dto/git-branch-merge-result.dto';
import { WorkspaceRepositoryService } from '../git/workspace-repository.service';
import { resolveSubRepoConfigs, SubRepoConfig } from '../git/sub-repo.types';
import { isWorkspaceNativeEnabled } from '../git/snapshot-sync.types';
import { ProjectRepositoryWorkspaceService } from '../projects/project-repository-workspace.service';
import { BusinessLineRepository } from '../business-lines/infrastructure/persistence/business-line.repository';
import { ProjectWorkspacePathsService } from '../project-workspace/project-workspace-paths.service';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import type { Task } from '../tasks/domain/task';
import { WorkspaceNativeDeployService } from '../tasks/application/workspace-native-deploy.service';
import { TaskGitActionResultDto } from '../tasks/dto/task-git.dto';
import { TaskMode } from '../tasks/dto/task-mode.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { TaskProvisioningService } from '../tasks/application/task-provisioning.service';
import { GoalSourceDocsService } from './goal-source-docs.service';
import { GoalRepository } from './infrastructure/persistence/goal.repository';
import { Goal } from './domain/goal';
import { GoalPlanItem } from './domain/goal-plan-item';
import { GoalPlanSubTask } from './domain/goal-plan-sub-task';
import type { Project } from '../projects/domain/project';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalPlanItemStatus } from './dto/goal-plan-item-status.enum';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { FindGoalsDto } from './dto/find-goals.dto';
import { AddSourceDocDto } from './dto/add-source-doc.dto';
import { UnpackGoalInputZipDto } from './dto/unpack-goal-input-zip.dto';
import { GeneratePrdDto } from './dto/generate-prd.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { UpdateGoalPrdDocDto } from './dto/update-goal-prd-doc.dto';
import { PatchPlanItemDto } from './dto/patch-plan-item.dto';
import { PatchPlanSubTaskDto } from './dto/patch-plan-sub-task.dto';
import { MaterializeTasksDto } from './dto/materialize-tasks.dto';
import { ReplaceTaskDependenciesDto } from './dto/replace-task-dependencies.dto';
import {
  goalPrdRelativePath,
  goalTaskPlanRelativePath,
} from './goal-doc-paths';
import { buildPrdGenerationPrompt } from './goal-prd-prompt';
import { buildPlanGenerationPrompt } from './goal-plan-prompt';
import {
  buildPlanItemAdjacency,
  directedGraphHasCycle,
  topologicalMaterializeOrder,
} from './goal-plan-dag';
import {
  findFirstMissingPlanItemTextField,
  normalizePlanItemsFromAgent,
  type NormalizedPlanItemFromAgent,
} from './plan-items-normalize';
import { TaskDependencyRelation } from './dto/task-dependency-relation.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { infinityPagination } from '../utils/infinity-pagination';
import { GoalDetailDto } from './dto/goal-detail.dto';
import { GoalsMetricsService } from './goals-metrics.service';
import {
  parsePlanJsonFromAgentStdout,
  parsePrdJsonFromAgentStdout,
} from '../utils/stream-json-assistant-text';

const PRD_MAX_ATTEMPTS = 3;
const PLAN_MAX_ATTEMPTS = 3;

function resolveGoalAgentCliOptions(dto: {
  agentCliId?: string;
  agentCliConfigId?: string;
}): { agentCliId: string; agentCliConfigId: string } | undefined {
  const id = dto.agentCliId?.trim();
  const configId = dto.agentCliConfigId?.trim();
  if (id && configId) {
    return { agentCliId: id, agentCliConfigId: configId };
  }
  if (!id && !configId) {
    return undefined;
  }
  throw new BadRequestException(
    'agentCliId 与 agentCliConfigId 必须同时提供或同时省略',
  );
}

/** 请求体优先；若请求未带成对 Agent 参数，则回退到需求上保存的默认值 */
function resolveGoalAgentCliForGeneration(
  dto: { agentCliId?: string; agentCliConfigId?: string },
  goal: Pick<Goal, 'agentCliId' | 'agentCliConfigId'>,
): { agentCliId: string; agentCliConfigId: string } | undefined {
  const qId = dto.agentCliId?.trim();
  const qCfg = dto.agentCliConfigId?.trim();
  if (qId || qCfg) {
    if (!qId || !qCfg) {
      throw new BadRequestException(
        'agentCliId 与 agentCliConfigId 必须同时提供或同时省略',
      );
    }
    return { agentCliId: qId, agentCliConfigId: qCfg };
  }
  return resolveGoalAgentCliOptions({
    agentCliId: goal.agentCliId ?? undefined,
    agentCliConfigId: goal.agentCliConfigId ?? undefined,
  });
}

/**
 * 生成 PRD/任务计划须走业务线 AgentRunner（含 MCP 等与任务一致的配置），禁止退回到 executeKnowledgeAgent。
 */
function assertGoalAgentCliForGeneration(
  agentCli: { agentCliId: string; agentCliConfigId: string } | undefined,
): asserts agentCli is { agentCliId: string; agentCliConfigId: string } {
  if (!agentCli) {
    throw new BadRequestException(
      '生成 PRD 或任务计划需要配置业务线 Agent：请在需求上保存 agentCliId 与 agentCliConfigId，或在请求中同时传入二者。',
    );
  }
}

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  /** 同一 goal 上并发的 PRD 生成请求复用同一次执行（进程内） */
  private readonly prdGenerationInFlight = new Map<
    string,
    Promise<{ goal: Goal; markdownLength: number }>
  >();

  /** 同一 goal 上并发的任务计划生成请求复用同一次执行（进程内） */
  private readonly planGenerationInFlight = new Map<
    string,
    Promise<{ goal: Goal; itemCount: number; subTaskCount: number }>
  >();

  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly projectsService: ProjectsService,
    private readonly projectDocsService: ProjectDocsService,
    private readonly projectKnowledgeService: ProjectKnowledgeService,
    private readonly gitService: GitService,
    private readonly taskRepository: TaskRepository,
    private readonly taskProvisioningService: TaskProvisioningService,
    private readonly goalSourceDocsService: GoalSourceDocsService,
    private readonly goalsMetrics: GoalsMetricsService,
    private readonly workspaceRepositoryService: WorkspaceRepositoryService,
    private readonly projectWorkspacePathsService: ProjectWorkspacePathsService,
    private readonly businessLineRepository: BusinessLineRepository,
    @Optional()
    private readonly projectRepositoryWorkspaceService?: ProjectRepositoryWorkspaceService,
    @Optional()
    private readonly workspaceNativeDeployService?: WorkspaceNativeDeployService,
  ) {}

  private async resolveWorkspaceNativeSubRepos(
    project: Project,
  ): Promise<SubRepoConfig[]> {
    let subRepos = resolveSubRepoConfigs(
      project.configJson as Record<string, unknown>,
    );
    if (subRepos.length === 0) {
      const businessLine = await this.businessLineRepository.findById(
        project.businessLineId,
      );
      if (businessLine) {
        subRepos = resolveSubRepoConfigs(
          businessLine.configJson as Record<string, unknown>,
        );
      }
    }
    return subRepos;
  }

  /**
   * Demand branch for workspace-native projects must contain embedded sub-repo prefixes
   * before functional groups or tasks branch from it.
   */
  private async ensureDemandBranchEmbeddedIfNeededForWorkspaceNative(params: {
    projectId: Project['id'];
    demandGitBranch: string;
    /** Sync origin remote-tracking for this ref before inspecting demand branch (typically gitBaseBranch). */
    gitBaseBranch: string;
    currentUser: JwtPayloadType;
  }): Promise<void> {
    const workspaceProject = await this.projectsService.findByIdInternal(
      params.projectId,
      params.currentUser,
    );
    if (!workspaceProject || !isWorkspaceNativeEnabled(workspaceProject)) {
      return;
    }

    const subRepos =
      await this.resolveWorkspaceNativeSubRepos(workspaceProject);
    if (!subRepos.length) {
      return;
    }

    const repositoryRoot =
      this.projectWorkspacePathsService.resolveRepositoryRoot(workspaceProject);
    const prefixes = subRepos.map((s) => s.prefix);
    const hasAll =
      await this.workspaceRepositoryService.branchIncludesTopLevelPrefixes(
        repositoryRoot,
        params.demandGitBranch,
        params.gitBaseBranch,
        prefixes,
      );
    if (hasAll) {
      return;
    }

    try {
      await this.workspaceRepositoryService.embedSubReposOntoBranch(
        repositoryRoot,
        params.demandGitBranch,
        subRepos,
        params.gitBaseBranch,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`embed_subrepos_onto_demand_branch_failed ${msg}`);
      throw new BadRequestException(
        `无法在需求分支上写入子仓，请检查子仓配置或网络：${msg}`,
      );
    }
  }

  private async persistGoalDocToGit(
    goal: Goal,
    currentUser: JwtPayloadType,
    docPath: string,
    content: string,
    commitMessage: string,
  ): Promise<void> {
    const branch = goal.gitBranch?.trim();
    if (!branch) {
      throw new BadRequestException('需求未配置 Git 分支，无法保存文档');
    }

    await this.projectsService.runWithProjectRepositoryLock(
      goal.projectId,
      currentUser,
      { syncRemote: true },
      async ({ repositoryRoot }) => {
        await this.persistGoalDocToGitAtRoot(
          repositoryRoot,
          goal,
          currentUser,
          docPath,
          content,
          commitMessage,
        );
      },
    );
  }

  private async persistGoalDocToGitAtRoot(
    repositoryRoot: string,
    goal: Goal,
    currentUser: JwtPayloadType,
    docPath: string,
    content: string,
    commitMessage: string,
  ): Promise<void> {
    const branch = goal.gitBranch?.trim();
    if (!branch) {
      throw new BadRequestException('需求未配置 Git 分支，无法保存文档');
    }

    await this.gitService.runInTemporaryBranchWorktree(
      repositoryRoot,
      branch,
      async (worktreeRoot) => {
        await this.gitService.cleanupForeignUntrackedGoalDirs(
          worktreeRoot,
          goal.id,
        );
        const { absolutePath } =
          await this.projectDocsService.writeDocInRepositoryRoot(worktreeRoot, {
            path: docPath,
            content,
          });
        const committed =
          await this.gitService.commitPathsInRepositoryRootIfDirty(
            worktreeRoot,
            [absolutePath],
            commitMessage,
            {
              name: currentUser.username || 'ainative-user',
              email: `${currentUser.username || currentUser.sub}@ainative.local`,
            },
          );
        if (!committed) {
          const status =
            await this.gitService.readStatusForPathsInRepositoryRoot(
              worktreeRoot,
              [absolutePath],
            );
          if (status) {
            throw new BadRequestException(
              `文档已写入但未能生成提交，请清理工作区后重试: ${status}`,
            );
          }
        }
        await this.gitService.pushRepositoryHeadToBranch(worktreeRoot, branch);
      },
    );
  }

  private async assertGoalAccess(
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<Goal> {
    const goal = await this.goalRepository.findById(goalId);
    if (!goal) {
      throw new NotFoundException('未找到需求');
    }
    await this.projectsService.assertProjectCapability(
      goal.projectId,
      currentUser,
      'project.task.read',
    );
    return goal;
  }

  async readPrdDoc(
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    return this.readPrdDocForGoal(goal, currentUser);
  }

  async updatePrdDoc(
    goalId: string,
    dto: UpdateGoalPrdDocDto,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    return this.savePrdDocOnGoalBranch(goal, dto.content, currentUser);
  }

  private async readPrdDocForGoal(
    goal: Goal,
    currentUser: JwtPayloadType,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    const prdDocPath = goal.prdDocPath?.trim();
    const gitBranch = goal.gitBranch?.trim();
    if (!prdDocPath) {
      throw new BadRequestException('缺少 PRD 文档路径');
    }
    if (!gitBranch) {
      throw new BadRequestException('需求未配置 Git 分支，无法读取 PRD');
    }

    return this.projectDocsService.readDocFromBranch(
      goal.projectId,
      prdDocPath,
      gitBranch,
      currentUser,
    );
  }

  private async savePrdDocOnGoalBranch(
    goal: Goal,
    content: string,
    currentUser: JwtPayloadType,
    pathOverride?: string,
  ): Promise<{
    path: string;
    name: string;
    size: number;
    updatedAt: Date;
    content: string;
  }> {
    if (!this.projectRepositoryWorkspaceService) {
      throw new ConflictException('Project repository service unavailable');
    }

    const prdDocPath = pathOverride?.trim() || goal.prdDocPath?.trim();
    const gitBranch = goal.gitBranch?.trim();
    if (!prdDocPath) {
      throw new BadRequestException('缺少 PRD 文档路径');
    }
    if (!gitBranch) {
      throw new BadRequestException('需求未配置 Git 分支，无法保存 PRD');
    }

    return this.projectRepositoryWorkspaceService.runWithProjectRepositoryLock(
      goal.projectId,
      currentUser,
      { syncRemote: true },
      async ({ project, repositoryRoot }) => {
        const worktreePath = await this.ensureGoalPrdWorktree({
          goal,
          project,
          repositoryRoot,
          gitBranch,
        });
        const savedDoc = await this.projectDocsService.saveDocInRepositoryRoot(
          worktreePath,
          { path: prdDocPath, content },
          { overwrite: true },
        );
        await this.commitGoalPrdWorktreeChanges({
          worktreePath,
          docPath: savedDoc.path,
          goal,
          currentUser,
        });
        return savedDoc;
      },
    );
  }

  private async ensureGoalPrdWorktree(params: {
    goal: Goal;
    project: Project;
    repositoryRoot: string;
    gitBranch: string;
  }): Promise<string> {
    const worktreePath = this.resolveGoalPrdWorktreePath(
      params.project,
      params.goal,
    );
    const hasWorktreeGit = await this.pathExists(
      path.join(worktreePath, '.git'),
    );

    if (hasWorktreeGit) {
      const currentBranch = await this.runGitCommand(worktreePath, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);
      if (currentBranch.stdout.trim() === params.gitBranch) {
        return worktreePath;
      }

      await this.runGitCommand(params.repositoryRoot, [
        'worktree',
        'remove',
        '--force',
        worktreePath,
      ]);
    }

    await fs.rm(worktreePath, { recursive: true, force: true });
    await this.runGitCommand(params.repositoryRoot, ['worktree', 'prune']);
    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    const localBranch = await this.runGitCommand(params.repositoryRoot, [
      'rev-parse',
      '--verify',
      `refs/heads/${params.gitBranch}`,
    ]);
    const addArgs = localBranch.success
      ? ['worktree', 'add', '--force', worktreePath, params.gitBranch]
      : [
          'worktree',
          'add',
          '--force',
          '-b',
          params.gitBranch,
          worktreePath,
          `origin/${params.gitBranch}`,
        ];
    const addResult = await this.runGitCommand(params.repositoryRoot, addArgs);
    if (!addResult.success) {
      throw new BadRequestException(
        `无法创建 PRD 临时 worktree：${addResult.stderr || 'git worktree add failed'}`,
      );
    }

    return worktreePath;
  }

  private resolveGoalPrdWorktreePath(project: Project, goal: Goal): string {
    return path.join(
      this.projectWorkspacePathsService.resolveWorktreeBaseDir(project),
      '.goal-prd',
      goal.id,
    );
  }

  private async commitGoalPrdWorktreeChanges(params: {
    worktreePath: string;
    docPath: string;
    goal: Goal;
    currentUser: JwtPayloadType;
  }): Promise<void> {
    const gitDocPath = `docs/${params.docPath}`;
    const statusResult = await this.runGitCommand(params.worktreePath, [
      'status',
      '--porcelain',
      '--',
      gitDocPath,
    ]);
    if (!statusResult.success) {
      throw new BadRequestException(
        `读取 PRD 临时 worktree 状态失败：${statusResult.stderr}`,
      );
    }
    if (!statusResult.stdout.trim()) {
      return;
    }

    const addResult = await this.runGitCommand(params.worktreePath, [
      'add',
      '--',
      gitDocPath,
    ]);
    if (!addResult.success) {
      throw new BadRequestException(`暂存 PRD 文件失败：${addResult.stderr}`);
    }

    const gitName = params.currentUser.username || 'ainative-user';
    const gitEmail = `${params.currentUser.username || params.currentUser.sub}@ainative.local`;
    const commitResult = await this.runGitCommand(params.worktreePath, [
      '-c',
      `user.name=${gitName}`,
      '-c',
      `user.email=${gitEmail}`,
      'commit',
      '-m',
      `chore(goal): update PRD ${params.goal.id}`,
    ]);
    if (!commitResult.success) {
      throw new BadRequestException(
        `提交 PRD 文件失败：${commitResult.stderr}`,
      );
    }
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async runGitCommand(
    cwd: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const childProcess = spawn('git', ['-C', cwd, ...args], {
        env: process.env,
        stdio: 'pipe',
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      childProcess.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
      childProcess.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
      childProcess.on('error', (error) => {
        resolve({
          success: false,
          stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderr:
            Buffer.concat(stderrChunks).toString('utf-8') || error.message,
        });
      });
      childProcess.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        });
      });
    });
  }

  private async completeGoalWhenAllPlanSubTasksMerged(
    goal: Goal,
    planItems: GoalPlanItem[],
  ): Promise<void> {
    if (
      goal.status === GoalStatus.done ||
      goal.status === GoalStatus.archived
    ) {
      return;
    }

    const countableSubTasks = planItems.flatMap((item) =>
      (item.subTasks ?? []).filter(
        (subTask) => subTask.status !== GoalPlanItemStatus.cancelled,
      ),
    );
    if (countableSubTasks.length === 0) {
      return;
    }

    const allMerged = countableSubTasks.every(
      (subTask) => subTask.status === GoalPlanItemStatus.branchMerged,
    );
    if (!allMerged) {
      return;
    }

    await this.goalRepository.update(goal.id, { status: GoalStatus.done });
  }

  /**
   * 功能组 dependsOnItemIds：本组子任务在确认/物化前，每个前置功能组内全部子任务须已物化且已标记「分支已合并」。
   */
  /**
   * 创建本功能组 Git 分支前：每个有子任务的前置功能组须已将组分支合并入需求分支（避免从过时需求线派生）。
   */
  private assertPredecessorGroupsMergedIntoGoal(
    goalPlanItemId: string,
    groups: GoalPlanItem[],
  ): void {
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const parent = groupById.get(goalPlanItemId);
    if (!parent) {
      return;
    }
    for (const predId of parent.dependsOnItemIds ?? []) {
      const predGroup = groupById.get(predId);
      if (!predGroup) {
        continue;
      }
      const subs = predGroup.subTasks ?? [];
      const countable = subs.filter(
        (s) => s.status !== GoalPlanItemStatus.cancelled,
      );
      if (countable.length === 0) {
        continue;
      }
      if (!predGroup.groupMergedIntoGoalAt) {
        throw new BadRequestException(
          `请先将前置功能组「${predGroup.title}」的分支合并入需求分支后，再创建本功能组分支`,
        );
      }
    }
  }

  private assertPredecessorGroupsFulfilledForSubTask(
    goalPlanItemId: string,
    groups: GoalPlanItem[],
  ): void {
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const parent = groupById.get(goalPlanItemId);
    if (!parent) {
      return;
    }
    for (const predId of parent.dependsOnItemIds ?? []) {
      const predGroup = groupById.get(predId);
      if (!predGroup) {
        continue;
      }
      const subs = predGroup.subTasks ?? [];
      if (subs.length === 0) {
        throw new BadRequestException(
          `前置功能组「${predGroup.title}」无子任务，无法处理本组子任务`,
        );
      }
      for (const st of subs) {
        if (!st.taskId?.trim()) {
          throw new BadRequestException(
            `请先为前置功能组「${predGroup.title}」的全部子任务创建任务后再继续`,
          );
        }
        if (st.status !== GoalPlanItemStatus.branchMerged) {
          throw new BadRequestException(
            `请先将前置功能组「${predGroup.title}」的子任务「${st.title}」对应分支通过任务计划「合并分支」并入该功能组分支，并标记为「分支已合并」后再继续`,
          );
        }
      }
    }
  }

  private assertNoBlockingExistingPlanWorkBeforeMaterialize(params: {
    groups: GoalPlanItem[];
    tasks: Task[];
    targetGroupIds: Set<string>;
  }): void {
    const unfinishedTask = params.tasks.find(
      (task) => task.status !== TaskStatus.done,
    );
    if (unfinishedTask) {
      throw new BadRequestException(
        `任务「${unfinishedTask.title}」尚未完成，请先完成后再创建新的计划任务`,
      );
    }

    const subTaskByTaskId = new Map<string, GoalPlanSubTask>();
    for (const group of params.groups) {
      for (const subTask of group.subTasks ?? []) {
        const taskId = subTask.taskId?.trim();
        if (taskId) {
          subTaskByTaskId.set(taskId, subTask);
        }
      }
    }

    for (const task of params.tasks) {
      const subTask = subTaskByTaskId.get(task.id);
      if (!subTask || subTask.status === GoalPlanItemStatus.branchMerged) {
        continue;
      }
      throw new BadRequestException(
        `任务「${task.title}」已完成但尚未合并分支，请先在任务计划中执行「合并分支」`,
      );
    }

    const unmergedOtherGroup = params.groups.find((group) => {
      if (params.targetGroupIds.has(group.id)) {
        return false;
      }
      return Boolean(group.gitBranch?.trim()) && !group.groupMergedIntoGoalAt;
    });
    if (unmergedOtherGroup) {
      throw new BadRequestException(
        `功能组「${unmergedOtherGroup.title}」分支尚未并入需求分支，请先合并后再创建新的计划任务`,
      );
    }
  }

  /**
   * 子任务级依赖未满足「分支已合并」时的提示。
   * 同组：合并目标是本功能组分支，且需推送远端以便后续物化拉到最新 tip。
   * 跨组：前置须先并回其功能组；整体流程上依赖「前置功能组并入需求分支」。
   */
  private messageForUnmergedPlanSubTaskDependency(
    predTitle: string,
    samePlanGroup: boolean,
  ): string {
    if (samePlanGroup) {
      return (
        `请先将前置子任务「${predTitle}」对应分支通过任务计划「合并分支」并入本功能组分支，并标记为「分支已合并」；` +
        `合并后请将功能组分支推送至远端，再为本项新建任务`
      );
    }
    return (
      `请先将前置子任务「${predTitle}」对应分支并入其所属功能组分支，并标记为「分支已合并」；` +
      `若依赖跨功能组，请确保前置功能组已整体并入需求分支后，再为本项新建任务`
    );
  }

  /**
   * 首次确认功能组下子任务时，若功能组尚无 Git 分支则在仓库创建并落库。
   */
  private async ensurePlanItemGitBranchIfMissing(
    goal: Goal,
    goalId: string,
    planItemId: string,
    currentUser: JwtPayloadType,
  ): Promise<void> {
    let parent = await this.goalRepository.findPlanItem(goalId, planItemId);
    if (!parent) {
      throw new NotFoundException('未找到计划功能组');
    }
    if (parent.gitBranch?.trim()) {
      return;
    }
    const groupsWithSubs =
      await this.goalRepository.listPlanItemsWithSubTasks(goalId);
    this.assertPredecessorGroupsMergedIntoGoal(planItemId, groupsWithSubs);

    if (!goal.gitBranch?.trim()) {
      throw new BadRequestException('需求未配置 Git 分支，无法创建功能组分支');
    }
    const base = goal.gitBranch.trim();
    const name = buildPlanItemGitBranchName(base, parent.itemOrder);

    await this.ensureDemandBranchEmbeddedIfNeededForWorkspaceNative({
      projectId: goal.projectId,
      demandGitBranch: base,
      gitBaseBranch: goal.gitBaseBranch,
      currentUser,
    });

    try {
      await this.gitService.createBranch(
        goal.projectId,
        name,
        base,
        currentUser,
        { prepareRequirementBranchWorkingTree: true },
      );
    } catch (e) {
      parent = await this.goalRepository.findPlanItem(goalId, planItemId);
      if (parent?.gitBranch?.trim()) {
        return;
      }
      throw e;
    }
    const updated = await this.goalRepository.updatePlanItem(
      goalId,
      planItemId,
      {
        gitBranch: name,
      },
    );
    if (!updated) {
      throw new NotFoundException('未找到计划功能组');
    }
  }

  async create(dto: CreateGoalDto, currentUser: JwtPayloadType): Promise<Goal> {
    const project = dto.businessLineId
      ? await this.projectsService.assertWorkspaceProjectByBusinessLineCapability(
          dto.businessLineId,
          currentUser,
          'businessLine.read',
        )
      : await this.projectsService.assertProjectCapability(
          dto.projectId ?? '',
          currentUser,
          'project.task.read',
        );
    const storedAgent = resolveGoalAgentCliOptions({
      agentCliId: dto.agentCliId,
      agentCliConfigId: dto.agentCliConfigId,
    });
    const goalId = randomUUID();
    const gitBaseBranch = dto.gitBaseBranch.trim();
    const gitBranch = buildGoalGitBranchName();

    await this.gitService.createBranch(
      project.id,
      gitBranch,
      gitBaseBranch,
      currentUser,
    );

    await this.ensureDemandBranchEmbeddedIfNeededForWorkspaceNative({
      projectId: project.id,
      demandGitBranch: gitBranch,
      gitBaseBranch,
      currentUser,
    });

    const g = await this.goalRepository.create({
      id: goalId,
      projectId: project.id,
      title: dto.title,
      summary: dto.summary ?? null,
      status: GoalStatus.draft,
      prdDocPath: null,
      planDocPath: null,
      defaultWorkflowTemplateId: dto.defaultWorkflowTemplateId ?? null,
      agentCliId: storedAgent?.agentCliId ?? null,
      agentCliConfigId: storedAgent?.agentCliConfigId ?? null,
      gitBaseBranch,
      gitBranch,
      createdBy: currentUser.sub,
    });
    this.goalsMetrics.incrementGoalCreated();
    return g;
  }

  async findAll(
    query: FindGoalsDto,
    currentUser: JwtPayloadType,
  ): Promise<ReturnType<typeof infinityPagination<Goal>>> {
    await this.projectsService.assertProjectCapability(
      query.projectId,
      currentUser,
      'project.task.read',
    );
    const paginationOptions: IPaginationOptions = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
    await this.goalRepository.completeGoalsWithAllPlanSubTasksMerged({
      projectId: query.projectId,
    });
    const rows = await this.goalRepository.findMany({
      paginationOptions,
      projectId: query.projectId,
      status: query.status,
      titleContains: query.title,
      createdBy: query.createdBy,
    });
    return infinityPagination(rows, {
      page: paginationOptions.page,
      limit: paginationOptions.limit,
    });
  }

  async findOne(
    id: string,
    currentUser: JwtPayloadType,
  ): Promise<GoalDetailDto> {
    const accessibleGoal = await this.assertGoalAccess(id, currentUser);
    await this.goalRepository.completeGoalsWithAllPlanSubTasksMerged({
      goalId: id,
    });
    const goal = (await this.goalRepository.findById(id)) ?? accessibleGoal;

    const [sourceDocs, planItems, tasks, deps] = await Promise.all([
      this.goalRepository.listSourceDocs(id),
      this.goalRepository.listPlanItemsWithSubTasks(id),
      this.taskRepository.findByGoalId(id),
      this.goalRepository.listTaskDependenciesForGoal(id),
    ]);
    const statusCounts: Record<TaskStatus, number> = {
      [TaskStatus.todo]: 0,
      [TaskStatus.inProgress]: 0,
      [TaskStatus.inReview]: 0,
      [TaskStatus.done]: 0,
    };
    for (const t of tasks) {
      statusCounts[t.status] += 1;
    }

    const taskById = new Map(tasks.map((t) => [t.id, t]));
    let subTotal = 0;
    let subDone = 0;
    for (const pi of planItems) {
      for (const st of pi.subTasks ?? []) {
        if (st.status === GoalPlanItemStatus.cancelled) {
          continue;
        }
        subTotal += 1;
        const tid = st.taskId?.trim();
        if (tid) {
          const linked = taskById.get(tid);
          if (linked?.status === TaskStatus.done) {
            subDone += 1;
          }
        }
      }
    }

    return {
      goal,
      sourceDocs,
      planItems,
      tasks,
      taskDependencies: deps,
      progress: {
        totalTasks: subTotal,
        doneTasks: subDone,
        statusCounts,
        percent: subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0,
      },
    };
  }

  async update(
    id: string,
    dto: UpdateGoalDto,
    currentUser: JwtPayloadType,
  ): Promise<Goal> {
    await this.assertGoalAccess(id, currentUser);
    if (dto.agentCliId !== undefined || dto.agentCliConfigId !== undefined) {
      resolveGoalAgentCliOptions({
        agentCliId: dto.agentCliId,
        agentCliConfigId: dto.agentCliConfigId,
      });
    }
    const updated = await this.goalRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('未找到需求');
    }
    return updated;
  }

  async remove(id: string, currentUser: JwtPayloadType): Promise<void> {
    const goal = await this.assertGoalAccess(id, currentUser);

    const planItems = await this.goalRepository.listPlanItems(id);
    const localBranchesToDelete = new Set<string>();
    const collectBranch = (name?: string | null): void => {
      const trimmed = name?.trim();
      if (trimmed) {
        localBranchesToDelete.add(trimmed);
      }
    };
    collectBranch(goal.gitBranch);
    for (const item of planItems) {
      collectBranch(item.gitBranch);
    }

    const tasks = await this.taskRepository.findByGoalId(id);
    await this.goalRepository.deleteSourceDocsAndPlanItemsByGoalId(id);
    for (const task of tasks) {
      await this.taskProvisioningService.remove(task.id, currentUser, {
        skipPlanConsistencyCheck: true,
      });
    }

    for (const branch of localBranchesToDelete) {
      await this.gitService.deleteLocalBranch(
        goal.projectId,
        branch,
        currentUser,
      );
    }

    await this.projectDocsService.removeGoalDocsSubtree(
      goal.projectId,
      id,
      currentUser,
    );

    await this.goalRepository.softRemove(id);
  }

  async addSourceDoc(
    goalId: string,
    dto: AddSourceDocDto,
    currentUser: JwtPayloadType,
  ) {
    const goal = await this.assertGoalAccess(goalId, currentUser);

    return this.goalSourceDocsService.addSourceDoc(goal, dto, currentUser);
  }

  async uploadSourceDoc(
    goalId: string,
    dto: AddSourceDocDto,
    file: Buffer,
    currentUser: JwtPayloadType,
  ) {
    const goal = await this.assertGoalAccess(goalId, currentUser);

    return this.goalSourceDocsService.uploadSourceDoc(
      goal,
      dto,
      file,
      currentUser,
    );
  }

  async uploadAndUnpackInputZip(
    goalId: string,
    dto: AddSourceDocDto,
    file: Buffer,
    currentUser: JwtPayloadType,
  ): Promise<{ extractedFileCount: number; paths: string[] }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);

    return this.goalSourceDocsService.uploadAndUnpackInputZip(
      goal,
      dto,
      file,
      currentUser,
    );
  }

  /**
   * 将已上传到 goals/{goalId}/input/ 的 zip 解压到同目录下子文件夹，登记 source-docs，并删除 zip 文件与对应 source-doc 行。
   */
  async unpackInputZip(
    goalId: string,
    dto: UnpackGoalInputZipDto,
    currentUser: JwtPayloadType,
  ): Promise<{ extractedFileCount: number; paths: string[] }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    return this.goalSourceDocsService.unpackInputZip(goal, dto, currentUser);
  }

  async generatePrd(
    goalId: string,
    dto: GeneratePrdDto,
    currentUser: JwtPayloadType,
  ): Promise<{ goal: Goal; markdownLength: number }> {
    const existing = this.prdGenerationInFlight.get(goalId);
    if (existing) {
      return existing;
    }
    const run = this.generatePrdImpl(goalId, dto, currentUser).finally(() => {
      this.prdGenerationInFlight.delete(goalId);
    });
    this.prdGenerationInFlight.set(goalId, run);
    return run;
  }

  private async generatePrdImpl(
    goalId: string,
    dto: GeneratePrdDto,
    currentUser: JwtPayloadType,
  ): Promise<{ goal: Goal; markdownLength: number }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    const overwrite = dto.overwrite !== false;
    const rel = goalPrdRelativePath(goalId);
    if (!overwrite && goal.prdDocPath) {
      throw new ConflictException('PRD 已存在，如需覆盖请设置 overwrite');
    }
    if (!goal.gitBranch?.trim()) {
      throw new BadRequestException('需求未配置 Git 分支，无法生成 PRD');
    }
    if (
      goal.status !== GoalStatus.draft &&
      goal.status !== GoalStatus.prdGenerated &&
      goal.status !== GoalStatus.prdConfirmed
    ) {
      throw new BadRequestException('当前状态不允许生成 PRD');
    }

    const sourceDocs = await this.goalRepository.listSourceDocs(goalId);
    const hasSourceDocs =
      sourceDocs.length > 0 ||
      (await this.goalSourceDocsService.goalInputDirHasAnyFile(
        goal.projectId,
        goalId,
        currentUser,
      ));

    const agentCli = resolveGoalAgentCliForGeneration(dto, goal);
    assertGoalAgentCliForGeneration(agentCli);

    const prompt = buildPrdGenerationPrompt({
      goalTitle: goal.title,
      goalSummary: goal.summary,
      goalId,
      hasSourceDocs,
      extraNotes: dto.extraNotes,
    });

    let lastErr = '';
    let markdown = '';

    const prdAgentContext =
      await this.projectsService.runWithProjectRepositoryLock(
        goal.projectId,
        currentUser,
        { syncRemote: true },
        async ({ project, repositoryRoot }) =>
          await Promise.resolve({ project, repositoryRoot }),
      );

    markdown = await this.gitService.runInTemporaryBranchWorktree(
      prdAgentContext.repositoryRoot,
      goal.gitBranch.trim(),
      async (worktreeRoot) => {
        for (let attempt = 1; attempt <= PRD_MAX_ATTEMPTS; attempt++) {
          const result =
            await this.projectKnowledgeService.executeProjectAgentPromptPrepared(
              prdAgentContext.project,
              worktreeRoot,
              prompt,
              agentCli,
            );
          if (!result.success) {
            lastErr = result.stderr || 'agent failed';
            this.logger.warn(`PRD agent attempt ${attempt} failed: ${lastErr}`);
            continue;
          }
          const parsed = parsePrdJsonFromAgentStdout(result.stdout);
          if (!parsed) {
            lastErr =
              'invalid PRD JSON: missing markdown (stream-json 需含 assistant 正文或合法 JSON)';
            this.logger.warn(`PRD parse attempt ${attempt}: ${lastErr}`);
            continue;
          }
          return parsed.markdown;
        }

        return '';
      },
      {
        tempParentDir:
          this.projectWorkspacePathsService.resolveWorktreeAllowedRoot(
            prdAgentContext.project,
          ),
      },
    );

    if (!markdown) {
      this.goalsMetrics.incrementPrdGeneration(false);
      throw new BadRequestException(
        `PRD 生成失败（${PRD_MAX_ATTEMPTS} 次尝试）：${lastErr}`,
      );
    }
    this.goalsMetrics.incrementPrdGeneration(true);

    await this.persistGoalDocToGit(
      goal,
      currentUser,
      rel,
      markdown,
      `docs(goal): generate PRD for ${goalId}`,
    );

    const updated = await this.goalRepository.update(goalId, {
      prdDocPath: rel,
      status: GoalStatus.prdGenerated,
    });
    if (!updated) {
      throw new NotFoundException('未找到需求');
    }
    return { goal: updated, markdownLength: markdown.length };
  }

  async generatePlan(
    goalId: string,
    dto: GeneratePlanDto,
    currentUser: JwtPayloadType,
  ): Promise<{ goal: Goal; itemCount: number; subTaskCount: number }> {
    const existing = this.planGenerationInFlight.get(goalId);
    if (existing) {
      return existing;
    }
    const run = this.generatePlanImpl(goalId, dto, currentUser).finally(() => {
      this.planGenerationInFlight.delete(goalId);
    });
    this.planGenerationInFlight.set(goalId, run);
    return run;
  }

  private async generatePlanImpl(
    goalId: string,
    dto: GeneratePlanDto,
    currentUser: JwtPayloadType,
  ): Promise<{ goal: Goal; itemCount: number; subTaskCount: number }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    if (
      goal.status !== GoalStatus.prdConfirmed &&
      goal.status !== GoalStatus.prdGenerated &&
      goal.status !== GoalStatus.planned
    ) {
      throw new BadRequestException(
        '请先生成并确认 PRD，或在 prd_confirmed / planned 状态下生成任务计划',
      );
    }
    if (!goal.prdDocPath) {
      throw new BadRequestException('缺少 PRD 文档路径');
    }
    if (!goal.gitBranch?.trim()) {
      throw new BadRequestException('需求未配置 Git 分支，无法生成任务计划');
    }
    const overwrite = dto.overwrite !== false;
    if (!overwrite && goal.planDocPath) {
      throw new ConflictException('任务计划已存在，如需覆盖请设置 overwrite');
    }

    const agentCli = resolveGoalAgentCliForGeneration(dto, goal);
    assertGoalAgentCliForGeneration(agentCli);
    const planRel = goalTaskPlanRelativePath(goalId);

    let lastErr = '';
    let markdown = '';
    let rawItems: NormalizedPlanItemFromAgent[] = [];
    let planItems: GoalPlanItem[] = [];
    let subTasksFlat: GoalPlanSubTask[] = [];

    const planAgentContext =
      await this.projectsService.runWithProjectRepositoryLock(
        goal.projectId,
        currentUser,
        { syncRemote: true },
        async ({ project, repositoryRoot }) => {
          const prdContent = await this.gitService.runInTemporaryBranchWorktree(
            repositoryRoot,
            goal.gitBranch!.trim(),
            async (worktreeRoot) => {
              try {
                const doc =
                  await this.projectDocsService.readDocInRepositoryRoot(
                    worktreeRoot,
                    goal.prdDocPath!,
                  );
                return doc.content;
              } catch {
                throw new BadRequestException('无法读取 PRD 文件');
              }
            },
          );

          return { project, repositoryRoot, prdContent };
        },
      );

    const prompt = buildPlanGenerationPrompt({
      goalTitle: goal.title,
      goalSummary: goal.summary,
      prdMarkdown: planAgentContext.prdContent,
      granularity: dto.granularity,
    });

    for (let attempt = 1; attempt <= PLAN_MAX_ATTEMPTS; attempt++) {
      const result =
        await this.projectKnowledgeService.executeProjectAgentPromptPrepared(
          planAgentContext.project,
          planAgentContext.repositoryRoot,
          prompt,
          agentCli,
        );
      if (!result.success) {
        lastErr = result.stderr || 'agent failed';
        continue;
      }
      const planParsed = parsePlanJsonFromAgentStdout(result.stdout);
      if (
        !planParsed ||
        !Array.isArray(planParsed.items) ||
        !planParsed.items.length
      ) {
        lastErr =
          'invalid plan JSON (stream-json 需含 assistant 正文或合法 JSON)';
        this.logger.warn(`Plan parse attempt ${attempt}: ${lastErr}`);
        continue;
      }
      markdown = planParsed.markdown;
      try {
        rawItems = normalizePlanItemsFromAgent(planParsed.items);
      } catch (e) {
        lastErr =
          e instanceof Error ? e.message : 'normalize plan items failed';
        this.logger.warn(`Plan normalize attempt ${attempt}: ${lastErr}`);
        continue;
      }
      const missingText = findFirstMissingPlanItemTextField(rawItems);
      if (missingText) {
        lastErr =
          missingText.kind === 'parent'
            ? `plan item items[${missingText.index}] missing or empty ${missingText.field}`
            : `plan item items[${missingText.itemIndex}].subTasks[${missingText.subIndex}] missing or empty ${missingText.field}`;
        this.logger.warn(`Plan text fields attempt ${attempt}: ${lastErr}`);
        continue;
      }
      break;
    }

    if (!markdown || !rawItems.length) {
      this.goalsMetrics.incrementPlanGeneration(false);
      throw new BadRequestException(
        `任务计划生成失败：${lastErr || 'empty items'}`,
      );
    }
    this.goalsMetrics.incrementPlanGeneration(true);
    ({ planItems, subTasksFlat } = this.buildGoalPlanRows(goalId, rawItems));

    await this.persistGoalDocToGit(
      goal,
      currentUser,
      planRel,
      markdown,
      `docs(goal): generate task plan for ${goalId}`,
    );

    await this.goalRepository.replacePlanItems(goalId, planItems, subTasksFlat);
    const updated = await this.goalRepository.update(goalId, {
      planDocPath: planRel,
      status: GoalStatus.planned,
    });
    if (!updated) {
      throw new NotFoundException('未找到需求');
    }
    return {
      goal: updated,
      itemCount: planItems.length,
      subTaskCount: subTasksFlat.length,
    };
  }

  private buildGoalPlanRows(
    goalId: string,
    rawItems: NormalizedPlanItemFromAgent[],
  ): {
    planItems: GoalPlanItem[];
    subTasksFlat: GoalPlanSubTask[];
  } {
    const itemLocalToUuid = new Map<string, string>();
    for (const it of rawItems) {
      itemLocalToUuid.set(it.localId, randomUUID());
    }
    const subLocalToUuid = new Map<string, string>();
    for (const it of rawItems) {
      for (const st of it.subTasks) {
        subLocalToUuid.set(st.subLocalId, randomUUID());
      }
    }

    const planItems: GoalPlanItem[] = [];
    let order = 0;
    for (const it of rawItems) {
      const id = itemLocalToUuid.get(it.localId)!;
      const depUuids = it.dependsOnLocalIds
        .map((lid) => itemLocalToUuid.get(lid))
        .filter((x): x is string => Boolean(x));
      const item = new GoalPlanItem();
      item.id = id;
      item.goalId = goalId;
      item.title = it.title;
      item.summary = it.summary ?? null;
      item.acceptanceCriteria = it.acceptanceCriteria ?? null;
      item.suggestedPrompt = it.suggestedPrompt ?? null;
      item.dependsOnItemIds = depUuids;
      item.itemOrder = order++;
      item.gitBranch = null;
      item.createdAt = new Date();
      item.updatedAt = new Date();
      planItems.push(item);
    }

    const subTasksFlat: GoalPlanSubTask[] = [];
    for (const it of rawItems) {
      const parentId = itemLocalToUuid.get(it.localId)!;
      let subOrder = 0;
      for (const st of it.subTasks) {
        const sid = subLocalToUuid.get(st.subLocalId)!;
        const depUuids = st.dependsOnSubLocalIds
          .map((lid) => subLocalToUuid.get(lid))
          .filter((x): x is string => Boolean(x));
        const row = new GoalPlanSubTask();
        row.id = sid;
        row.goalPlanItemId = parentId;
        row.title = st.title;
        row.summary = st.summary ?? null;
        row.acceptanceCriteria = st.acceptanceCriteria ?? null;
        row.suggestedPrompt = st.suggestedPrompt ?? null;
        row.dependsOnSubTaskIds = depUuids;
        row.itemOrder = subOrder++;
        row.taskId = null;
        row.status = GoalPlanItemStatus.draft;
        row.workflowTemplateId = null;
        row.createdAt = new Date();
        row.updatedAt = new Date();
        subTasksFlat.push(row);
      }
    }

    const idSet = new Set(planItems.map((p) => p.id));
    const adj = buildPlanItemAdjacency(
      planItems.map((p) => ({
        id: p.id,
        dependsOnItemIds: p.dependsOnItemIds,
      })),
    );
    if (directedGraphHasCycle(idSet, adj)) {
      throw new BadRequestException(
        '模型输出的功能组依赖存在环，请重试或手工编辑',
      );
    }

    const subIdSet = new Set(subTasksFlat.map((s) => s.id));
    const subAdj = buildPlanItemAdjacency(
      subTasksFlat.map((s) => ({
        id: s.id,
        dependsOnItemIds: s.dependsOnSubTaskIds,
      })),
    );
    if (directedGraphHasCycle(subIdSet, subAdj)) {
      throw new BadRequestException(
        '模型输出的子任务依赖存在环，请重试或手工编辑',
      );
    }

    return { planItems, subTasksFlat };
  }

  async patchPlanItem(
    goalId: string,
    itemId: string,
    dto: PatchPlanItemDto,
    currentUser: JwtPayloadType,
  ): Promise<GoalPlanItem> {
    await this.assertGoalAccess(goalId, currentUser);
    const existing = await this.goalRepository.findPlanItem(goalId, itemId);
    if (!existing) {
      throw new NotFoundException('未找到计划项');
    }

    const next = await this.goalRepository.updatePlanItem(goalId, itemId, dto);
    if (!next) {
      throw new NotFoundException('未找到计划项');
    }
    const all = await this.goalRepository.listPlanItems(goalId);
    const idSet = new Set(all.map((i) => i.id));
    const adj = buildPlanItemAdjacency(
      all.map((p) => ({
        id: p.id,
        dependsOnItemIds: p.dependsOnItemIds,
      })),
    );
    if (directedGraphHasCycle(idSet, adj)) {
      throw new BadRequestException('功能组依赖关系存在环');
    }
    return next;
  }

  async patchPlanSubTask(
    goalId: string,
    subTaskId: string,
    dto: PatchPlanSubTaskDto,
    currentUser: JwtPayloadType,
  ): Promise<GoalPlanSubTask> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    const existing = await this.goalRepository.findPlanSubTask(
      goalId,
      subTaskId,
    );
    if (!existing) {
      throw new NotFoundException('未找到计划子任务');
    }

    if (dto.status === GoalPlanItemStatus.completed) {
      throw new BadRequestException(
        '计划子任务「任务已完成」状态由系统在关联任务完成时自动同步，不可手动设置',
      );
    }

    if (dto.status === GoalPlanItemStatus.branchMerged) {
      if (existing.status !== GoalPlanItemStatus.completed) {
        throw new BadRequestException(
          '仅当子任务为「任务已完成」时，可手动标记为「分支已合并」',
        );
      }
      const linkedTaskId = existing.taskId?.trim();
      if (!linkedTaskId) {
        throw new BadRequestException('未找到关联任务，无法标记分支已合并');
      }
      const linkedTask = await this.taskRepository.findById(linkedTaskId);
      if (!linkedTask || linkedTask.status !== TaskStatus.done) {
        throw new BadRequestException(
          '关联任务须为已完成状态后，方可标记分支已合并',
        );
      }
    }

    if (
      dto.status === GoalPlanItemStatus.approved &&
      existing.status !== GoalPlanItemStatus.approved
    ) {
      const groupsWithSubs =
        await this.goalRepository.listPlanItemsWithSubTasks(goalId);
      this.assertPredecessorGroupsFulfilledForSubTask(
        existing.goalPlanItemId,
        groupsWithSubs,
      );
      await this.ensurePlanItemGitBranchIfMissing(
        goal,
        goalId,
        existing.goalPlanItemId,
        currentUser,
      );
    }

    const next = await this.goalRepository.updatePlanSubTask(
      goalId,
      subTaskId,
      dto,
    );
    if (!next) {
      throw new NotFoundException('未找到计划子任务');
    }

    const groups = await this.goalRepository.listPlanItemsWithSubTasks(goalId);
    const flat: GoalPlanSubTask[] = [];
    for (const g of groups) {
      for (const st of g.subTasks ?? []) {
        flat.push(st);
      }
    }
    const idSet = new Set(flat.map((s) => s.id));
    const adj = buildPlanItemAdjacency(
      flat.map((s) => ({
        id: s.id,
        dependsOnItemIds: s.dependsOnSubTaskIds,
      })),
    );
    if (directedGraphHasCycle(idSet, adj)) {
      throw new BadRequestException('子任务依赖关系存在环');
    }
    if (dto.status === GoalPlanItemStatus.branchMerged) {
      await this.completeGoalWhenAllPlanSubTasksMerged(goal, groups);
    }
    return next;
  }

  /**
   * 任务计划物化：任务分支自功能组分支开出；`gitBaseBranch` 为功能组分支供后续「合并分支」合回组线。
   * 主仓两阶段合并：子任务合并 → 功能组分支 →（组级）功能组并入需求分支；同组后继任务依赖已推送的功能组 tip。
   */
  async materializeTasks(
    goalId: string,
    dto: MaterializeTasksDto,
    currentUser: JwtPayloadType,
  ): Promise<{ tasks: { planSubTaskId: string; taskId: string }[] }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    if (
      goal.status !== GoalStatus.planned &&
      goal.status !== GoalStatus.inProgress
    ) {
      throw new BadRequestException('当前状态不允许新建任务');
    }

    const groups = await this.goalRepository.listPlanItemsWithSubTasks(goalId);
    const planItemGitBranchById = new Map(
      groups.map((g) => [g.id, g.gitBranch]),
    );
    const flat: GoalPlanSubTask[] = [];
    for (const g of groups) {
      for (const st of g.subTasks ?? []) {
        flat.push(st);
      }
    }
    const localSubById = new Map(flat.map((s) => [s.id, s]));

    const forOrder = new Map(
      flat.map((s) => [
        s.id,
        { dependsOnItemIds: s.dependsOnSubTaskIds ?? [] },
      ]),
    );

    const uniqueIds = [...new Set(dto.planSubTaskIds)];
    let orderedIds: string[];
    try {
      orderedIds = topologicalMaterializeOrder(uniqueIds, forOrder);
    } catch {
      throw new BadRequestException(
        '子任务依赖存在环，无法按顺序新建任务（请检查任务计划依赖）',
      );
    }

    const orderedItems = orderedIds.map((subTaskId) => {
      const item = localSubById.get(subTaskId);
      if (!item) {
        throw new BadRequestException(`计划子任务不存在: ${subTaskId}`);
      }
      return item;
    });
    const itemsToCreate = orderedItems.filter(
      (item) =>
        !(
          (item.status === GoalPlanItemStatus.taskCreated ||
            item.status === GoalPlanItemStatus.completed ||
            item.status === GoalPlanItemStatus.branchMerged) &&
          item.taskId
        ),
    );
    if (itemsToCreate.length > 0) {
      const tasks = await this.taskRepository.findByGoalId(goalId);
      this.assertNoBlockingExistingPlanWorkBeforeMaterialize({
        groups,
        tasks,
        targetGroupIds: new Set(
          itemsToCreate.map((item) => item.goalPlanItemId),
        ),
      });
    }

    const results: { planSubTaskId: string; taskId: string }[] = [];

    for (const subTaskId of orderedIds) {
      const item = localSubById.get(subTaskId);
      if (!item) {
        throw new BadRequestException(`计划子任务不存在: ${subTaskId}`);
      }
      if (
        (item.status === GoalPlanItemStatus.taskCreated ||
          item.status === GoalPlanItemStatus.completed ||
          item.status === GoalPlanItemStatus.branchMerged) &&
        item.taskId
      ) {
        results.push({ planSubTaskId: subTaskId, taskId: item.taskId });
        continue;
      }
      if (item.status === GoalPlanItemStatus.cancelled) {
        throw new BadRequestException(`计划子任务已取消: ${subTaskId}`);
      }
      if (item.status !== GoalPlanItemStatus.approved) {
        throw new BadRequestException(
          `子任务须为已确认(approved)状态才可新建任务: ${item.title}`,
        );
      }

      if (!item.workflowTemplateId?.trim()) {
        throw new BadRequestException(
          `子任务「${item.title}」未配置工作流模板，请先在任务计划中为其选择模板后再新建任务`,
        );
      }

      const groupGitBranch = planItemGitBranchById.get(item.goalPlanItemId);
      if (!groupGitBranch?.trim()) {
        throw new BadRequestException(
          `功能组尚未创建 Git 分支，请先确认该功能组下至少一条子任务后再物化「${item.title}」`,
        );
      }

      this.assertPredecessorGroupsFulfilledForSubTask(
        item.goalPlanItemId,
        groups,
      );

      for (const predId of item.dependsOnSubTaskIds ?? []) {
        const predItem = localSubById.get(predId);
        if (!predItem) {
          continue;
        }
        if (!predItem.taskId?.trim()) {
          throw new BadRequestException(
            `请先为前置子任务「${predItem.title}」创建任务后再为本项新建任务`,
          );
        }
        if (predItem.status !== GoalPlanItemStatus.branchMerged) {
          throw new BadRequestException(
            this.messageForUnmergedPlanSubTaskDependency(
              predItem.title,
              predItem.goalPlanItemId === item.goalPlanItemId,
            ),
          );
        }
      }

      const prdHint = goal.prdDocPath
        ? `\n\n【关联 PRD 路径】${goal.prdDocPath}`
        : '';
      const ac = item.acceptanceCriteria
        ? `\n\n【验收标准】${item.acceptanceCriteria}`
        : '';
      const prompt = `${item.suggestedPrompt ?? goal.summary ?? ''}${prdHint}${ac}`;

      const created = await this.taskProvisioningService.create(
        {
          projectId: goal.projectId,
          goalId,
          mode: TaskMode.workflow,
          title: item.title,
          prompt,
          gitBaseBranch: groupGitBranch.trim(),
          configJson: {
            workflowTemplateId: item.workflowTemplateId,
          },
        },
        currentUser,
      );

      await this.goalRepository.updatePlanSubTask(goalId, subTaskId, {
        taskId: created.id,
        status: GoalPlanItemStatus.taskCreated,
      });

      item.taskId = created.id;
      item.status = GoalPlanItemStatus.taskCreated;
      localSubById.set(subTaskId, item);

      results.push({ planSubTaskId: subTaskId, taskId: created.id });
    }

    const subToTask = new Map(
      (await this.goalRepository.listPlanItemsWithSubTasks(goalId))
        .flatMap((g) => g.subTasks ?? [])
        .filter((s) => s.taskId)
        .map((s) => [s.id, s.taskId!]),
    );

    for (const subTaskId of orderedIds) {
      const st = localSubById.get(subTaskId)!;
      const succTaskId = subToTask.get(subTaskId);
      if (!succTaskId) {
        continue;
      }
      for (const predId of st.dependsOnSubTaskIds ?? []) {
        const predTaskId = subToTask.get(predId);
        if (!predTaskId || predTaskId === succTaskId) {
          continue;
        }
        try {
          await this.goalRepository.insertTaskDependency({
            predecessorTaskId: predTaskId,
            successorTaskId: succTaskId,
            relationType: TaskDependencyRelation.blocks,
          });
        } catch {
          /* unique violation — ignore */
        }
      }
    }

    const nextStatus =
      goal.status === GoalStatus.planned ? GoalStatus.inProgress : goal.status;
    await this.goalRepository.update(goalId, { status: nextStatus });

    this.goalsMetrics.incrementMaterializedTasks(results.length);

    return { tasks: results };
  }

  async listGoalTasks(goalId: string, currentUser: JwtPayloadType) {
    await this.assertGoalAccess(goalId, currentUser);
    return this.taskRepository.findByGoalId(goalId);
  }

  async pushDemandBranchToSubRepos(
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<TaskGitActionResultDto> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    const demandBranch = goal.gitBranch?.trim();
    if (!demandBranch) {
      throw new BadRequestException('需求尚未设置需求分支，无法推送');
    }

    const [groups, tasks] = await Promise.all([
      this.goalRepository.listPlanItemsWithSubTasks(goalId),
      this.taskRepository.findByGoalId(goalId),
    ]);

    const countableGroups = groups.filter((group) =>
      (group.subTasks ?? []).some(
        (subTask) => subTask.status !== GoalPlanItemStatus.cancelled,
      ),
    );
    if (countableGroups.length === 0) {
      throw new BadRequestException('需求下没有有效功能组，无法推送');
    }

    const unmergedGroup = countableGroups.find(
      (group) => !group.groupMergedIntoGoalAt,
    );
    if (unmergedGroup) {
      throw new BadRequestException(
        `功能组「${unmergedGroup.title}」尚未并入需求分支，请先完成合并`,
      );
    }

    if (tasks.length === 0) {
      throw new BadRequestException('需求下尚无已物化任务，无法推送');
    }
    const unfinishedTask = tasks.find(
      (task) => task.status !== TaskStatus.done,
    );
    if (unfinishedTask) {
      throw new BadRequestException(
        `任务「${unfinishedTask.title}」尚未完成，请先完成所有已物化任务`,
      );
    }

    const project = await this.projectsService.findByIdInternal(
      goal.projectId,
      currentUser,
    );
    if (!project || !isWorkspaceNativeEnabled(project)) {
      throw new BadRequestException(
        '仅 workspace-native 项目支持从需求分支推送到子仓',
      );
    }

    const subRepos = await this.resolveWorkspaceNativeSubRepos(project);
    if (subRepos.length === 0) {
      throw new BadRequestException('项目未配置子仓，无法推送');
    }

    if (
      !this.projectRepositoryWorkspaceService ||
      !this.workspaceNativeDeployService
    ) {
      throw new ConflictException('Workspace-native push service unavailable');
    }

    return this.projectRepositoryWorkspaceService.runWithProjectRepositoryLock(
      goal.projectId,
      currentUser,
      { syncRemote: true },
      async ({ project, repositoryRoot }) => {
        const demandWorktreeRoot =
          await this.projectRepositoryWorkspaceService!.ensureBranchWorktree({
            project,
            repositoryRoot,
            branchName: demandBranch,
            namespace: 'goal-branches',
          });

        try {
          return await this.workspaceNativeDeployService!.pushBranchToSubReposFromRoot(
            {
              repositoryRoot: demandWorktreeRoot,
              branch: demandBranch,
              subRepos,
              requireCleanWorktree: true,
            },
          );
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : '需求分支推送失败',
          );
        }
      },
    );
  }

  /**
   * 在项目主仓库将功能组分支合并入需求分支，并记录 `groupMergedIntoGoalAt`。
   */
  async mergePlanItemBranchIntoGoal(
    goalId: string,
    planItemId: string,
    currentUser: JwtPayloadType,
  ): Promise<GitBranchMergeResultDto> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    const groups = await this.goalRepository.listPlanItemsWithSubTasks(goalId);
    const planItem = groups.find((g) => g.id === planItemId);
    if (!planItem) {
      throw new NotFoundException('未找到计划功能组');
    }
    if (planItem.groupMergedIntoGoalAt) {
      throw new BadRequestException('该功能组分支已并入需求分支');
    }
    const baseBranch = goal.gitBranch?.trim();
    const headBranch = planItem.gitBranch?.trim();
    if (!baseBranch) {
      throw new BadRequestException('需求尚未设置需求分支，无法合并');
    }
    if (!headBranch) {
      throw new BadRequestException('功能组尚未创建 Git 分支，无法合并');
    }

    const countable = (planItem.subTasks ?? []).filter(
      (s) => s.status !== GoalPlanItemStatus.cancelled,
    );
    if (countable.length === 0) {
      throw new BadRequestException('功能组下没有有效子任务，无法合并');
    }
    const allMerged = countable.every(
      (s) => s.status === GoalPlanItemStatus.branchMerged,
    );
    if (!allMerged) {
      throw new BadRequestException(
        '须将该功能组下全部子任务标记为「分支已合并」后，方可将功能组分支并入需求分支',
      );
    }

    const result = await this.gitService.mergeBranchIntoBase(
      goal.projectId,
      baseBranch,
      headBranch,
      currentUser,
    );

    if (result.success) {
      const updated = await this.goalRepository.updatePlanItem(
        goalId,
        planItemId,
        { groupMergedIntoGoalAt: new Date() },
      );
      if (!updated) {
        throw new NotFoundException('未找到计划功能组');
      }
    }

    return result;
  }

  /**
   * 功能组分支 → 需求分支 的托管平台「新建 PR」链接（与任务 worktree 无关）。
   */
  async getPlanItemPrLink(
    goalId: string,
    planItemId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ url: string | null }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    const planItem = await this.goalRepository.findPlanItem(goalId, planItemId);
    if (!planItem) {
      throw new NotFoundException('未找到计划功能组');
    }
    const baseBranch = goal.gitBranch?.trim();
    const headBranch = planItem.gitBranch?.trim();
    if (!baseBranch) {
      throw new BadRequestException('需求尚未设置需求分支，无法生成 PR 链接');
    }
    if (!headBranch) {
      throw new BadRequestException(
        '功能组尚未创建 Git 分支，无法生成 PR 链接',
      );
    }
    const project = await this.projectsService.findById(
      goal.projectId,
      currentUser,
    );
    if (!project) {
      throw new NotFoundException('未找到项目');
    }
    const url = buildPullRequestUrl(project.gitUrl, baseBranch, headBranch);
    return { url: url ?? null };
  }

  /**
   * 关联 Task 聚合状态变化时由 TaskStatusService 调用，同步计划子任务 completed / 回退。
   */
  async syncPlanSubTaskStatusFromLinkedTask(
    taskId: string,
    taskStatus: TaskStatus,
  ): Promise<void> {
    await this.goalRepository.syncPlanSubTaskStatusByLinkedTaskId(
      taskId,
      taskStatus === TaskStatus.done,
    );
  }

  async replaceTaskDependencies(
    goalId: string,
    dto: ReplaceTaskDependenciesDto,
    currentUser: JwtPayloadType,
  ) {
    await this.assertGoalAccess(goalId, currentUser);
    await this.goalRepository.replaceTaskDependenciesForGoal(goalId, dto.edges);
    return { ok: true as const };
  }

  /** Task 详情补充：返回需求摘要信息 */
  async getGoalSummaryForTask(
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<{ id: string; title: string; status: GoalStatus } | null> {
    const goal = await this.goalRepository.findById(goalId);
    if (!goal) {
      return null;
    }
    await this.projectsService.assertProjectCapability(
      goal.projectId,
      currentUser,
      'project.task.read',
    );
    return {
      id: goal.id,
      title: goal.title,
      status: goal.status,
    };
  }
}
