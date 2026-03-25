import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import extractZip from 'extract-zip';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskRepository } from '../tasks/infrastructure/persistence/task.repository';
import { TaskMode } from '../tasks/dto/task-mode.enum';
import { TaskStatus } from '../tasks/dto/task-status.enum';
import { GoalRepository } from './infrastructure/persistence/goal.repository';
import { Goal } from './domain/goal';
import { GoalPlanItem } from './domain/goal-plan-item';
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

/** 请求体优先；若请求未带成对 Agent 参数，则回退到 Goal 上保存的默认值 */
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
 * 生成 PRD/拆解计划须走业务线 AgentRunner（含 MCP 等与任务一致的配置），禁止退回到 executeKnowledgeAgent。
 */
function assertGoalAgentCliForGeneration(
  agentCli: { agentCliId: string; agentCliConfigId: string } | undefined,
): asserts agentCli is { agentCliId: string; agentCliConfigId: string } {
  if (!agentCli) {
    throw new BadRequestException(
      '生成 PRD 或拆解计划需要配置业务线 Agent：请在 Goal 上保存 agentCliId 与 agentCliConfigId，或在请求中同时传入二者。',
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
      throw new NotFoundException('Goal not found');
    }
    await this.projectsService.assertProjectCapability(
      goal.projectId,
      currentUser,
      'project.task.read',
    );
    return goal;
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
    const g = await this.goalRepository.create({
      projectId: dto.projectId,
      title: dto.title,
      summary: dto.summary ?? null,
      status: GoalStatus.draft,
      prdDocPath: null,
      planDocPath: null,
      defaultWorkflowTemplateId: dto.defaultWorkflowTemplateId ?? null,
      agentCliId: storedAgent?.agentCliId ?? null,
      agentCliConfigId: storedAgent?.agentCliConfigId ?? null,
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
      this.goalRepository.listPlanItems(id),
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
    const done = statusCounts[TaskStatus.done];
    const total = tasks.length;
    return {
      goal,
      sourceDocs,
      planItems,
      tasks,
      taskDependencies: deps,
      progress: {
        totalTasks: total,
        doneTasks: done,
        statusCounts,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
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
      throw new NotFoundException('Goal not found');
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
      throw new BadRequestException('zip 须位于该 Goal 的 input 目录下');
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
      (await this.goalInputDirHasAnyFile(
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
      throw new NotFoundException('Goal not found');
    }
    return { goal: updated, markdownLength: markdown.length };
  }

  async generatePlan(
    goalId: string,
    dto: GeneratePlanDto,
    currentUser: JwtPayloadType,
  ): Promise<{ goal: Goal; itemCount: number }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    if (
      goal.status !== GoalStatus.prdConfirmed &&
      goal.status !== GoalStatus.prdGenerated &&
      goal.status !== GoalStatus.planned
    ) {
      throw new BadRequestException(
        '请先生成并确认 PRD，或在 prd_confirmed / planned 状态下生成拆解计划',
      );
    }
    if (!goal.prdDocPath) {
      throw new BadRequestException('缺少 PRD 文档路径');
    }
    const overwrite = dto.overwrite !== false;
    if (!overwrite && goal.planDocPath) {
      throw new ConflictException('拆解计划已存在，如需覆盖请设置 overwrite');
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
        lastErr = `plan item items[${missingText.index}] missing or empty ${missingText.field}`;
        this.logger.warn(`Plan text fields attempt ${attempt}: ${lastErr}`);
        continue;
      }
      break;
    }
    if (!markdown || !rawItems.length) {
      this.goalsMetrics.incrementPlanGeneration(false);
      throw new BadRequestException(
        `拆解计划生成失败：${lastErr || 'empty items'}`,
      );
    }
    this.goalsMetrics.incrementPlanGeneration(true);

    const localToUuid = new Map<string, string>();
    for (const it of rawItems) {
      localToUuid.set(it.localId, randomUUID());
    }

    const planItems: GoalPlanItem[] = [];
    let order = 0;
    for (const it of rawItems) {
      const id = localToUuid.get(it.localId)!;
      const depUuids = it.dependsOnLocalIds
        .map((lid) => localToUuid.get(lid))
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
      item.taskId = null;
      item.status = GoalPlanItemStatus.draft;
      item.workflowTemplateId = null;
      item.gitBaseBranch = null;
      item.createdAt = new Date();
      item.updatedAt = new Date();
      planItems.push(item);
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
        '模型输出的计划项依赖存在环，请重试或手工编辑',
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

    await this.goalRepository.replacePlanItems(goalId, planItems);
    const updated = await this.goalRepository.update(goalId, {
      planDocPath: planRel,
      status: GoalStatus.planned,
    });
    if (!updated) {
      throw new NotFoundException('Goal not found');
    }
    return { goal: updated, itemCount: planItems.length };
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
      throw new NotFoundException('Plan item not found');
    }

    if (
      dto.status === GoalPlanItemStatus.approved &&
      existing.status !== GoalPlanItemStatus.approved
    ) {
      const depIds =
        dto.dependsOnItemIds !== undefined
          ? dto.dependsOnItemIds
          : (existing.dependsOnItemIds ?? []);
      const allPlan = await this.goalRepository.listPlanItems(goalId);
      const byId = new Map(allPlan.map((i) => [i.id, i]));
      for (const predId of depIds) {
        const pred = byId.get(predId);
        if (!pred) {
          continue;
        }
        if (
          pred.status !== GoalPlanItemStatus.taskCreated ||
          !pred.taskId?.trim()
        ) {
          throw new BadRequestException(
            `请先物化前置计划项「${pred.title}」后再确认本项`,
          );
        }
      }
    }

    const next = await this.goalRepository.updatePlanItem(goalId, itemId, dto);
    if (!next) {
      throw new NotFoundException('Plan item not found');
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
      throw new BadRequestException('依赖关系存在环');
    }
    return next;
  }

  async materializeTasks(
    goalId: string,
    dto: MaterializeTasksDto,
    currentUser: JwtPayloadType,
  ): Promise<{ tasks: { planItemId: string; taskId: string }[] }> {
    const goal = await this.assertGoalAccess(goalId, currentUser);
    if (
      goal.status !== GoalStatus.planned &&
      goal.status !== GoalStatus.inProgress
    ) {
      throw new BadRequestException('当前状态不允许物化任务');
    }

    const results: { planItemId: string; taskId: string }[] = [];
    const localItemById = new Map(
      (await this.goalRepository.listPlanItems(goalId)).map((i) => [i.id, i]),
    );

    const uniquePlanItemIds = [...new Set(dto.planItemIds)];
    let orderedPlanItemIds: string[];
    try {
      orderedPlanItemIds = topologicalMaterializeOrder(
        uniquePlanItemIds,
        localItemById,
      );
    } catch {
      throw new BadRequestException(
        '计划项依赖存在环，无法按顺序物化（请检查拆解计划依赖）',
      );
    }

    for (const planItemId of orderedPlanItemIds) {
      const item = localItemById.get(planItemId);
      if (!item || item.goalId !== goalId) {
        throw new BadRequestException(`计划项不存在: ${planItemId}`);
      }
      if (item.status === GoalPlanItemStatus.taskCreated && item.taskId) {
        results.push({ planItemId, taskId: item.taskId });
        continue;
      }
      if (item.status === GoalPlanItemStatus.cancelled) {
        throw new BadRequestException(`计划项已取消: ${planItemId}`);
      }
      if (item.status !== GoalPlanItemStatus.approved) {
        throw new BadRequestException(
          `计划项须为已确认(approved)状态才可物化: ${item.title}`,
        );
      }

      if (!item.workflowTemplateId?.trim()) {
        throw new BadRequestException(
          `计划项「${item.title}」未配置工作流模板，请先在拆解计划中为其选择模板后再物化`,
        );
      }

      for (const predItemId of item.dependsOnItemIds ?? []) {
        const predItem = localItemById.get(predItemId);
        if (!predItem) {
          continue;
        }
        if (!predItem.taskId?.trim()) {
          throw new BadRequestException(
            `请先物化前置计划项「${predItem.title}」后再物化本项`,
          );
        }
        const predTask = await this.taskRepository.findById(predItem.taskId);
        if (!predTask) {
          throw new BadRequestException(
            `前置任务不存在，请刷新后重试（计划项「${predItem.title}」）`,
          );
        }
        if (predTask.status !== TaskStatus.done) {
          throw new BadRequestException(
            `前置任务「${predTask.title}」未完成，请完成后再物化本项`,
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
          gitBaseBranch: item.gitBaseBranch?.trim() || undefined,
          configJson: {
            workflowTemplateId: item.workflowTemplateId,
          },
        },
        currentUser,
      );

      await this.goalRepository.updatePlanItem(goalId, planItemId, {
        taskId: created.id,
        status: GoalPlanItemStatus.taskCreated,
      });

      results.push({ planItemId, taskId: created.id });
    }

    const itemToTask = new Map(
      (await this.goalRepository.listPlanItems(goalId))
        .filter((i) => i.taskId)
        .map((i) => [i.id, i.taskId!]),
    );

    for (const planItemId of orderedPlanItemIds) {
      const item = localItemById.get(planItemId)!;
      const succTaskId = itemToTask.get(planItemId);
      if (!succTaskId) {
        continue;
      }
      for (const predItemId of item.dependsOnItemIds ?? []) {
        const predTaskId = itemToTask.get(predItemId);
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

  async replaceTaskDependencies(
    goalId: string,
    dto: ReplaceTaskDependenciesDto,
    currentUser: JwtPayloadType,
  ) {
    await this.assertGoalAccess(goalId, currentUser);
    await this.goalRepository.replaceTaskDependenciesForGoal(goalId, dto.edges);
    return { ok: true as const };
  }

  /** Task 详情补充：返回 Goal 摘要信息 */
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
