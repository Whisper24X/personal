import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import extractZip from 'extract-zip';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import { buildPullRequestUrl } from '../git/pull-request-url.util';
import { GitService } from '../git/git.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { TaskMode } from '../tasks/dto/task-mode.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { GoalRepository } from './infrastructure/persistence/goal.repository';
import { Goal } from './domain/goal';
import { GoalPlanItem } from './domain/goal-plan-item';
import { GoalPlanSubTask } from './domain/goal-plan-sub-task';
import { GoalStatus } from './dto/goal-status.enum';
import { GoalPlanItemStatus } from './dto/goal-plan-item-status.enum';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { FindGoalsDto } from './dto/find-goals.dto';
import { AddSourceDocDto } from './dto/add-source-doc.dto';
import { UnpackGoalInputZipDto } from './dto/unpack-goal-input-zip.dto';
import { GeneratePrdDto } from './dto/generate-prd.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { PatchPlanItemDto } from './dto/patch-plan-item.dto';
import { PatchPlanSubTaskDto } from './dto/patch-plan-sub-task.dto';
import { MaterializeTasksDto } from './dto/materialize-tasks.dto';
import { ReplaceTaskDependenciesDto } from './dto/replace-task-dependencies.dto';
import {
  goalInputDirRelativePath,
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
  GOAL_UNPACK_MAX_DEPTH,
  GOAL_UNPACK_MAX_FILES,
  assertSafeZipEntry,
  assertUnpackedPathDepth,
  docTypeForUnpackedFile,
  isProbablyTextBuffer,
  shouldSkipUnpackedRelativePath,
} from './goal-unpack-input';

const PRD_MAX_ATTEMPTS = 3;
const PLAN_MAX_ATTEMPTS = 3;

/** 需求分支：feature/goal-<YYYYMMDD>-<HHMMSS + 毫秒(3) + 随机 4 位> */
function buildGoalGitBranchName(): string {
  const now = new Date();
  const y = now.getFullYear().toString();
  const mo = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  const datePrefix = `${y}${mo}${d}`;
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');
  const ss = `${now.getSeconds()}`.padStart(2, '0');
  const timePart = `${hh}${mm}${ss}`;
  const ms = `${now.getMilliseconds()}`.padStart(3, '0');
  const salt = randomInt(0, 10_000).toString().padStart(4, '0');
  const secondSegment = `${timePart}${ms}${salt}`;
  return `feature/goal-${datePrefix}-${secondSegment}`.slice(0, 255);
}

/** 功能组分支：需求分支名 + `-g<顺序>`（顺序从 1 起），总长不超过 255。 */
function buildPlanItemGitBranchName(
  goalGitBranch: string,
  itemOrder: number,
): string {
  const tail = `-g${itemOrder + 1}`;
  const base = goalGitBranch.trim();
  const maxLen = 255;
  if (base.length + tail.length <= maxLen) {
    return `${base}${tail}`;
  }
  return `${base.slice(0, Math.max(0, maxLen - tail.length))}${tail}`;
}

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

/**
 * Cursor/Claude 等 CLI 使用 stream-json 时 stdout 为 NDJSON，不能整段当单个 JSON 解析。
 * 与 task-title-suggestion / task-step-label-summary 一致：先抽取 type=assistant 的正文再解析目标 JSON。
 */
function findMatchingJsonObjectEnd(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function extractAssistantMessageText(
  msg: Record<string, unknown>,
): string | null {
  const message = msg.message;
  if (message && typeof message === 'object' && !Array.isArray(message)) {
    const m = message as Record<string, unknown>;
    const content = m.content;
    if (typeof content === 'string') {
      return content.trim() || null;
    }
    if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const item of content) {
        if (typeof item === 'string') {
          textParts.push(item);
          continue;
        }
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const t =
            typeof r.text === 'string'
              ? r.text
              : typeof r.content === 'string'
                ? r.content
                : '';
          if (t) {
            textParts.push(t);
          }
        }
      }
      const joined = textParts.join('').trim();
      return joined || null;
    }
  }
  return null;
}

/** 拼接 stream-json 中 assistant / result 里可能含 PRD JSON 的片段 */
function extractStreamJsonGoalChunks(stdout: string): string {
  const parts: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') {
      continue;
    }
    const rec = obj as Record<string, unknown>;
    const type = typeof rec.type === 'string' ? rec.type.toLowerCase() : '';
    if (type === 'assistant') {
      const text = extractAssistantMessageText(rec);
      if (text) {
        parts.push(text);
      }
      continue;
    }
    if (type === 'result') {
      const r = rec.result;
      if (
        typeof r === 'string' &&
        (r.includes('{') || r.includes('markdown'))
      ) {
        parts.push(r);
      }
    }
  }
  return parts.join('\n');
}

function tryParsePrdJsonObject(
  text: string,
): { markdown: string; uncertainPoints?: unknown } | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();

  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '{') {
      continue;
    }
    const end = findMatchingJsonObjectEnd(body, i);
    if (end < 0) {
      continue;
    }
    const slice = body.slice(i, end + 1);
    try {
      const parsed = JSON.parse(slice) as Record<string, unknown>;
      if (typeof parsed.markdown === 'string' && parsed.markdown.trim()) {
        return parsed as { markdown: string; uncertainPoints?: unknown };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parsePrdJsonFromAgentStdout(stdout: string): {
  markdown: string;
} | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  const fromChunks = extractStreamJsonGoalChunks(trimmed);
  if (fromChunks) {
    const parsed = tryParsePrdJsonObject(fromChunks);
    if (parsed) {
      return { markdown: parsed.markdown };
    }
  }

  const fromWhole = tryParsePrdJsonObject(trimmed);
  if (fromWhole) {
    return { markdown: fromWhole.markdown };
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      if (typeof obj.markdown === 'string' && obj.markdown.trim()) {
        return { markdown: obj.markdown };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function tryParsePlanJsonObject(text: string): {
  markdown: string;
  items: unknown[];
} | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();

  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '{') {
      continue;
    }
    const end = findMatchingJsonObjectEnd(body, i);
    if (end < 0) {
      continue;
    }
    const slice = body.slice(i, end + 1);
    try {
      const parsed = JSON.parse(slice) as Record<string, unknown>;
      if (
        typeof parsed.markdown === 'string' &&
        parsed.markdown.trim() &&
        Array.isArray(parsed.items)
      ) {
        return { markdown: parsed.markdown, items: parsed.items };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parsePlanJsonFromAgentStdout(stdout: string): {
  markdown: string;
  items: unknown[];
} | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  const fromChunks = extractStreamJsonGoalChunks(trimmed);
  if (fromChunks) {
    const parsed = tryParsePlanJsonObject(fromChunks);
    if (parsed) {
      return parsed;
    }
  }

  const fromWhole = tryParsePlanJsonObject(trimmed);
  if (fromWhole) {
    return fromWhole;
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      if (
        typeof obj.markdown === 'string' &&
        obj.markdown.trim() &&
        Array.isArray(obj.items)
      ) {
        return { markdown: obj.markdown, items: obj.items };
      }
    } catch {
      continue;
    }
  }

  return null;
}

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly projectsService: ProjectsService,
    private readonly gitService: GitService,
    private readonly taskRepository: TaskRepository,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    private readonly goalsMetrics: GoalsMetricsService,
  ) {}

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

  /**
   * 功能组 dependsOnItemIds：本组子任务在确认/物化前，每个前置功能组内全部子任务对应 Task 须已存在且已完成。
   */
  private async assertPredecessorGroupsFulfilledForSubTask(
    goalPlanItemId: string,
    groups: GoalPlanItem[],
  ): Promise<void> {
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
        const predTask = await this.taskRepository.findById(st.taskId);
        if (!predTask) {
          throw new BadRequestException(
            `前置任务不存在，请刷新后重试（功能组「${predGroup.title}」·「${st.title}」）`,
          );
        }
        if (predTask.status !== TaskStatus.done) {
          throw new BadRequestException(
            `请先完成前置功能组「${predGroup.title}」的全部子任务（「${st.title}」对应任务未完成）`,
          );
        }
      }
    }
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
    if (!goal.gitBranch?.trim()) {
      throw new BadRequestException('需求未配置 Git 分支，无法创建功能组分支');
    }
    const base = goal.gitBranch.trim();
    const name = buildPlanItemGitBranchName(base, parent.itemOrder);
    try {
      await this.gitService.createBranch(
        goal.projectId,
        name,
        base,
        currentUser,
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
    await this.projectsService.assertProjectCapability(
      dto.projectId,
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
      dto.projectId,
      gitBranch,
      gitBaseBranch,
      currentUser,
    );

    const g = await this.goalRepository.create({
      id: goalId,
      projectId: dto.projectId,
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
    const goal = await this.assertGoalAccess(id, currentUser);
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

    const tasks = await this.taskRepository.findByGoalId(id);
    for (const task of tasks) {
      await this.tasksService.remove(task.id, currentUser);
    }

    await this.projectsService.removeGoalDocsSubtree(
      goal.projectId,
      id,
      currentUser,
    );

    await this.goalRepository.deleteSourceDocsAndPlanItemsByGoalId(id);
    await this.goalRepository.softRemove(id);
  }

  async addSourceDoc(
    goalId: string,
    dto: AddSourceDocDto,
    currentUser: JwtPayloadType,
  ) {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    const path = this.projectsService.normalizeProjectDocPath(
      dto.projectDocPath,
    );
    await this.projectsService.readDoc(goal.projectId, path, currentUser);
    return this.goalRepository.insertSourceDoc({
      goalId,
      projectDocPath: path,
      docType: dto.docType,
      sortOrder: dto.sortOrder ?? 0,
    });
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
    const normalizedZipPath = this.projectsService.normalizeProjectDocPath(
      dto.projectDocPath,
    );
    const inputPrefix = `goals/${goalId}/input/`;
    if (!normalizedZipPath.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('仅支持解压 .zip 文件');
    }
    if (!normalizedZipPath.startsWith(inputPrefix)) {
      throw new BadRequestException('zip 须位于该需求的 input 目录下');
    }

    const { repositoryRoot } =
      await this.projectsService.ensureProjectRepositoryReady(
        goal.projectId,
        currentUser,
        { syncRemote: false },
      );
    const docsRoot = path.join(repositoryRoot, 'docs');
    const zipAbsPath = path.join(docsRoot, normalizedZipPath);
    const zipStat = await fs.stat(zipAbsPath).catch(() => null);
    if (!zipStat?.isFile()) {
      throw new NotFoundException('未找到 zip 文件');
    }

    const extractDirName = `${randomUUID()}-unpacked`;
    const extractRelative = `${inputPrefix}${extractDirName}`;
    const extractAbsPath = path.join(docsRoot, extractRelative);

    await fs.mkdir(extractAbsPath, { recursive: true });

    try {
      await extractZip(zipAbsPath, {
        dir: extractAbsPath,
        onEntry: (entry) => {
          assertSafeZipEntry(extractAbsPath, entry);
        },
      });
    } catch (e) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw e;
    }

    const sourceDocs = await this.goalRepository.listSourceDocs(goalId);
    const maxSort = sourceDocs.reduce((m, d) => Math.max(m, d.sortOrder), -1);
    let sortOrder = maxSort + 1;

    const collected = await this.collectFilesUnderExtractDir(extractAbsPath);
    if (collected.length > GOAL_UNPACK_MAX_FILES) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        `解压文件过多（超过 ${GOAL_UNPACK_MAX_FILES} 个）`,
      );
    }

    const writtenPaths: string[] = [];
    for (const abs of collected) {
      assertUnpackedPathDepth(extractAbsPath, abs);
      const relFromDocs = path
        .relative(docsRoot, abs)
        .split(path.sep)
        .join('/');
      if (shouldSkipUnpackedRelativePath(relFromDocs)) {
        continue;
      }
      const buf = await fs.readFile(abs);
      const docType = docTypeForUnpackedFile(relFromDocs);
      const payload = isProbablyTextBuffer(buf)
        ? { path: relFromDocs, content: buf.toString('utf-8') }
        : { path: relFromDocs, contentBase64: buf.toString('base64') };
      try {
        await this.projectsService.createDoc(
          goal.projectId,
          payload,
          currentUser,
        );
      } catch (e) {
        if (e instanceof ConflictException) {
          await this.projectsService.updateDoc(
            goal.projectId,
            payload,
            currentUser,
          );
        } else {
          throw e;
        }
      }
      await this.goalRepository.insertSourceDoc({
        goalId,
        projectDocPath: relFromDocs,
        docType,
        sortOrder: sortOrder++,
      });
      writtenPaths.push(relFromDocs);
    }

    if (writtenPaths.length === 0) {
      await fs.rm(extractAbsPath, { recursive: true, force: true });
      throw new BadRequestException(
        '压缩包解压后没有可登记的有效文件（空包、仅目录、或仅有系统元数据如 __MACOSX）。请更换压缩包后重试；原 zip 已保留。',
      );
    }

    await this.projectsService.removeDoc(
      goal.projectId,
      normalizedZipPath,
      currentUser,
    );
    const zipRow = sourceDocs.find(
      (d) => d.projectDocPath === normalizedZipPath,
    );
    if (zipRow) {
      await this.goalRepository.removeSourceDoc(zipRow.id, goalId);
    }

    return { extractedFileCount: writtenPaths.length, paths: writtenPaths };
  }

  /**
   * 检查 docs/goals/{goalId}/input 下是否存在任意文件（含子目录），用于 PRD 提示与 DB 行数对齐。
   */
  private async goalInputDirHasAnyFile(
    projectId: string,
    goalId: string,
    currentUser: JwtPayloadType,
  ): Promise<boolean> {
    const { repositoryRoot } =
      await this.projectsService.ensureProjectRepositoryReady(
        projectId,
        currentUser,
        { syncRemote: false },
      );
    const inputAbs = path.join(
      repositoryRoot,
      'docs',
      goalInputDirRelativePath(goalId),
    );
    const stat = await fs.stat(inputAbs).catch(() => null);
    if (!stat?.isDirectory()) {
      return false;
    }
    return this.dirHasAnyFileUnder(inputAbs, 0);
  }

  private readonly goalInputDirWalkMaxDepth = 12;

  private async dirHasAnyFileUnder(
    dirAbs: string,
    depth: number,
  ): Promise<boolean> {
    if (depth > this.goalInputDirWalkMaxDepth) {
      return false;
    }
    try {
      const entries = await fs.readdir(dirAbs, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dirAbs, e.name);
        if (e.isDirectory()) {
          if (await this.dirHasAnyFileUnder(p, depth + 1)) {
            return true;
          }
        } else if (e.isFile()) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  private async collectFilesUnderExtractDir(dir: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dirPath: string, depth: number): Promise<void> => {
      if (depth > GOAL_UNPACK_MAX_DEPTH + 1) {
        throw new BadRequestException(
          `解压目录过深（超过 ${GOAL_UNPACK_MAX_DEPTH} 层）`,
        );
      }
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dirPath, e.name);
        if (e.isDirectory()) {
          await walk(p, depth + 1);
        } else if (e.isFile()) {
          out.push(p);
        }
      }
    };
    await walk(dir, 0);
    return out;
  }

  async generatePrd(
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
      (await this.goalInputDirHasAnyFile(goal.projectId, goalId, currentUser));

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

    for (let attempt = 1; attempt <= PRD_MAX_ATTEMPTS; attempt++) {
      const result = await this.projectsService.executeProjectAgentPrompt(
        goal.projectId,
        prompt,
        currentUser,
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
      markdown = parsed.markdown;
      break;
    }
    if (!markdown) {
      this.goalsMetrics.incrementPrdGeneration(false);
      throw new BadRequestException(
        `PRD 生成失败（${PRD_MAX_ATTEMPTS} 次尝试）：${lastErr}`,
      );
    }
    this.goalsMetrics.incrementPrdGeneration(true);

    try {
      await this.projectsService.createDoc(
        goal.projectId,
        { path: rel, content: markdown },
        currentUser,
      );
    } catch (e) {
      if (e instanceof ConflictException) {
        await this.projectsService.updateDoc(
          goal.projectId,
          { path: rel, content: markdown },
          currentUser,
        );
      } else {
        throw e;
      }
    }

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

    let prdContent = '';
    try {
      const doc = await this.projectsService.readDoc(
        goal.projectId,
        goal.prdDocPath,
        currentUser,
      );
      prdContent = doc.content;
    } catch {
      throw new BadRequestException('无法读取 PRD 文件');
    }

    const agentCli = resolveGoalAgentCliForGeneration(dto, goal);
    assertGoalAgentCliForGeneration(agentCli);

    const prompt = buildPlanGenerationPrompt({
      goalTitle: goal.title,
      goalSummary: goal.summary,
      prdMarkdown: prdContent,
      granularity: dto.granularity,
    });

    let lastErr = '';
    let markdown = '';
    let rawItems: NormalizedPlanItemFromAgent[] = [];

    for (let attempt = 1; attempt <= PLAN_MAX_ATTEMPTS; attempt++) {
      const result = await this.projectsService.executeProjectAgentPrompt(
        goal.projectId,
        prompt,
        currentUser,
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

    const planRel = goalTaskPlanRelativePath(goalId);
    try {
      await this.projectsService.createDoc(
        goal.projectId,
        { path: planRel, content: markdown },
        currentUser,
      );
    } catch (e) {
      if (e instanceof ConflictException) {
        await this.projectsService.updateDoc(
          goal.projectId,
          { path: planRel, content: markdown },
          currentUser,
        );
      } else {
        throw e;
      }
    }

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
        '计划子任务「已完成」状态由系统在关联任务完成时自动同步，不可手动设置',
      );
    }

    if (
      dto.status === GoalPlanItemStatus.approved &&
      existing.status !== GoalPlanItemStatus.approved
    ) {
      const groupsWithSubs =
        await this.goalRepository.listPlanItemsWithSubTasks(goalId);
      await this.assertPredecessorGroupsFulfilledForSubTask(
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
    return next;
  }

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

    const results: { planSubTaskId: string; taskId: string }[] = [];

    for (const subTaskId of orderedIds) {
      const item = localSubById.get(subTaskId);
      if (!item) {
        throw new BadRequestException(`计划子任务不存在: ${subTaskId}`);
      }
      if (
        (item.status === GoalPlanItemStatus.taskCreated ||
          item.status === GoalPlanItemStatus.completed) &&
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

      await this.assertPredecessorGroupsFulfilledForSubTask(
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
        const predTask = await this.taskRepository.findById(predItem.taskId);
        if (!predTask) {
          throw new BadRequestException(
            `前置任务不存在，请刷新后重试（子任务「${predItem.title}」）`,
          );
        }
        if (predTask.status !== TaskStatus.done) {
          throw new BadRequestException(
            `前置任务「${predTask.title}」未完成，请完成后再为本项新建任务`,
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

      const created = await this.tasksService.create(
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
