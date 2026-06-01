import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Goal } from '../../../../domain/goal';
import { GoalPlanItem } from '../../../../domain/goal-plan-item';
import { GoalPlanSubTask } from '../../../../domain/goal-plan-sub-task';
import { GoalSourceDoc } from '../../../../domain/goal-source-doc';
import { TaskDependencyEdge } from '../../../../domain/task-dependency-edge';
import { GoalPlanItemStatus } from '../../../../dto/goal-plan-item-status.enum';
import { GoalStatus } from '../../../../dto/goal-status.enum';
import { GoalRepository } from '../../goal.repository';
import { GoalMapper } from '../mappers/goal.mapper';
import { GoalEntity } from '../entities/goal.entity';
import { GoalPlanItemEntity } from '../entities/goal-plan-item.entity';
import { GoalPlanSubTaskEntity } from '../entities/goal-plan-sub-task.entity';
import { GoalSourceDocEntity } from '../entities/goal-source-doc.entity';
import { TaskDependencyEntity } from '../entities/task-dependency.entity';
import { TaskDependencyRelation } from '../../../../dto/task-dependency-relation.enum';
import { TaskEntity } from '../../../../../tasks/infrastructure/persistence/relational/entities/task.entity';
import { TaskStatus } from '../../../../../tasks/dto/task-status.enum';

@Injectable()
export class GoalRelationalRepository extends GoalRepository {
  constructor(
    @InjectRepository(GoalEntity)
    private readonly goalRepo: Repository<GoalEntity>,
    @InjectRepository(GoalSourceDocEntity)
    private readonly sourceDocRepo: Repository<GoalSourceDocEntity>,
    @InjectRepository(GoalPlanItemEntity)
    private readonly planItemRepo: Repository<GoalPlanItemEntity>,
    @InjectRepository(GoalPlanSubTaskEntity)
    private readonly planSubTaskRepo: Repository<GoalPlanSubTaskEntity>,
    @InjectRepository(TaskDependencyEntity)
    private readonly depRepo: Repository<TaskDependencyEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {
    super();
  }

  async create(
    data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
      id?: string;
    },
  ): Promise<Goal> {
    const row = await this.goalRepo.save(
      this.goalRepo.create({
        projectId: data.projectId,
        title: data.title,
        summary: data.summary ?? null,
        status: data.status ?? GoalStatus.draft,
        prdDocPath: data.prdDocPath ?? null,
        planDocPath: data.planDocPath ?? null,
        defaultWorkflowTemplateId: data.defaultWorkflowTemplateId ?? null,
        agentCliId: data.agentCliId ?? null,
        agentCliConfigId: data.agentCliConfigId ?? null,
        gitBaseBranch: data.gitBaseBranch,
        gitBranch: data.gitBranch,
        createdBy: data.createdBy ?? null,
      }),
    );
    return GoalMapper.goalToDomain(row);
  }

  async findById(id: string): Promise<NullableType<Goal>> {
    const row = await this.goalRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    return row ? GoalMapper.goalToDomain(row) : null;
  }

  async update(
    id: string,
    payload: Partial<Goal>,
  ): Promise<NullableType<Goal>> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.title !== undefined) {
      patch.title = payload.title;
    }
    if (payload.summary !== undefined) {
      patch.summary = payload.summary;
    }
    if (payload.status !== undefined) {
      patch.status = payload.status;
    }
    if (payload.prdDocPath !== undefined) {
      patch.prdDocPath = payload.prdDocPath;
    }
    if (payload.planDocPath !== undefined) {
      patch.planDocPath = payload.planDocPath;
    }
    if (payload.defaultWorkflowTemplateId !== undefined) {
      patch.defaultWorkflowTemplateId = payload.defaultWorkflowTemplateId;
    }
    if (payload.agentCliId !== undefined) {
      patch.agentCliId = payload.agentCliId;
    }
    if (payload.agentCliConfigId !== undefined) {
      patch.agentCliConfigId = payload.agentCliConfigId;
    }
    if (payload.gitBaseBranch !== undefined) {
      patch.gitBaseBranch = payload.gitBaseBranch;
    }
    if (payload.gitBranch !== undefined) {
      patch.gitBranch = payload.gitBranch;
    }
    await this.goalRepo.update({ id, deletedAt: IsNull() }, patch);
    return this.findById(id);
  }

  async softRemove(id: string): Promise<void> {
    await this.goalRepo.softDelete({ id });
  }

  async deleteSourceDocsAndPlanItemsByGoalId(goalId: string): Promise<void> {
    await this.sourceDocRepo.manager.transaction(async (em) => {
      await em.delete(GoalSourceDocEntity, { goalId });
      await em.delete(GoalPlanItemEntity, { goalId });
    });
  }

  async findMany(params: {
    paginationOptions: IPaginationOptions;
    projectId: string;
    status?: GoalStatus;
    titleContains?: string;
    createdBy?: string;
  }): Promise<Goal[]> {
    const qb = this.goalRepo
      .createQueryBuilder('g')
      .where('g.deletedAt IS NULL')
      .andWhere('g.projectId = :projectId', { projectId: params.projectId });

    if (params.status) {
      qb.andWhere('g.status = :status', { status: params.status });
    }
    if (params.titleContains?.trim()) {
      qb.andWhere('g.title ILIKE :title', {
        title: `%${params.titleContains.trim()}%`,
      });
    }
    if (params.createdBy) {
      qb.andWhere('g.createdBy = :createdBy', { createdBy: params.createdBy });
    }

    const rows = await qb
      .orderBy('g.createdAt', 'DESC')
      .skip(
        (params.paginationOptions.page - 1) * params.paginationOptions.limit,
      )
      .take(params.paginationOptions.limit)
      .getMany();

    return rows.map((r) => GoalMapper.goalToDomain(r));
  }

  async completeGoalsWithAllPlanSubTasksMerged(params: {
    projectId?: string;
    goalId?: string;
  }): Promise<void> {
    const scopeValue = params.goalId ?? params.projectId;
    if (!scopeValue) {
      return;
    }
    const scopeWhere = params.goalId ? `g."id" = $1` : `g."projectId" = $1`;

    await this.goalRepo.query(
      `
      UPDATE "goals" g
      SET "status" = $2::goal_status_enum,
          "updatedAt" = now()
      WHERE g."deletedAt" IS NULL
        AND ${scopeWhere}
        AND g."status" <> $2::goal_status_enum
        AND g."status" <> $3::goal_status_enum
        AND EXISTS (
          SELECT 1
          FROM "goal_plan_items" pi
          JOIN "goal_plan_sub_tasks" st ON st."goalPlanItemId" = pi."id"
          WHERE pi."goalId" = g."id"
            AND st."status" <> $4::goal_plan_item_status_enum
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "goal_plan_items" pi
          JOIN "goal_plan_sub_tasks" st ON st."goalPlanItemId" = pi."id"
          WHERE pi."goalId" = g."id"
            AND st."status" <> $4::goal_plan_item_status_enum
            AND st."status" <> $5::goal_plan_item_status_enum
        )
      `,
      [
        scopeValue,
        GoalStatus.done,
        GoalStatus.archived,
        GoalPlanItemStatus.cancelled,
        GoalPlanItemStatus.branchMerged,
      ],
    );
  }

  async listSourceDocs(goalId: string): Promise<GoalSourceDoc[]> {
    const rows = await this.sourceDocRepo.find({
      where: { goalId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((r) => GoalMapper.sourceDocToDomain(r));
  }

  async insertSourceDoc(
    data: Omit<GoalSourceDoc, 'id' | 'createdAt'> & { id?: string },
  ): Promise<GoalSourceDoc> {
    const row = await this.sourceDocRepo.save(
      this.sourceDocRepo.create({
        goalId: data.goalId,
        projectDocPath: data.projectDocPath,
        docType: data.docType,
        sortOrder: data.sortOrder ?? 0,
      }),
    );
    return GoalMapper.sourceDocToDomain(row);
  }

  async removeSourceDoc(id: string, goalId: string): Promise<void> {
    await this.sourceDocRepo.delete({ id, goalId });
  }

  async listPlanItems(goalId: string): Promise<GoalPlanItem[]> {
    const rows = await this.planItemRepo.find({
      where: { goalId },
      order: { itemOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((r) => GoalMapper.planItemToDomain(r));
  }

  async listPlanItemsWithSubTasks(goalId: string): Promise<GoalPlanItem[]> {
    const items = await this.listPlanItems(goalId);
    if (items.length === 0) {
      return [];
    }
    const itemIds = items.map((i) => i.id);
    const subs = await this.planSubTaskRepo.find({
      where: { goalPlanItemId: In(itemIds) },
      order: { itemOrder: 'ASC', createdAt: 'ASC' },
    });
    const byParent = new Map<string, GoalPlanSubTask[]>();
    for (const row of subs) {
      const d = GoalMapper.planSubTaskToDomain(row);
      const list = byParent.get(d.goalPlanItemId) ?? [];
      list.push(d);
      byParent.set(d.goalPlanItemId, list);
    }
    return items.map((it) => {
      it.subTasks = byParent.get(it.id) ?? [];
      return it;
    });
  }

  async replacePlanItems(
    goalId: string,
    items: GoalPlanItem[],
    subTasks: GoalPlanSubTask[],
  ): Promise<void> {
    await this.planItemRepo.manager.transaction(async (em) => {
      await em.delete(GoalPlanItemEntity, { goalId });
      for (const item of items) {
        const row = em.create(GoalPlanItemEntity, {
          id: item.id,
          goalId,
          title: item.title,
          summary: item.summary ?? null,
          acceptanceCriteria: item.acceptanceCriteria ?? null,
          suggestedPrompt: item.suggestedPrompt ?? null,
          dependsOnItemIds: item.dependsOnItemIds ?? [],
          itemOrder: item.itemOrder,
          gitBranch: item.gitBranch ?? null,
          groupMergedIntoGoalAt: item.groupMergedIntoGoalAt ?? null,
          createdAt: item.createdAt ?? new Date(),
          updatedAt: item.updatedAt ?? new Date(),
        });
        await em.save(row);
      }
      for (const st of subTasks) {
        const row = em.create(GoalPlanSubTaskEntity, {
          id: st.id,
          goalPlanItemId: st.goalPlanItemId,
          title: st.title,
          summary: st.summary ?? null,
          acceptanceCriteria: st.acceptanceCriteria ?? null,
          suggestedPrompt: st.suggestedPrompt ?? null,
          dependsOnSubTaskIds: st.dependsOnSubTaskIds ?? [],
          itemOrder: st.itemOrder,
          taskId: st.taskId ?? null,
          status: st.status,
          workflowTemplateId: st.workflowTemplateId ?? null,
          createdAt: st.createdAt ?? new Date(),
          updatedAt: st.updatedAt ?? new Date(),
        });
        await em.save(row);
      }
    });
  }

  async updatePlanItem(
    goalId: string,
    itemId: string,
    payload: Partial<GoalPlanItem>,
  ): Promise<NullableType<GoalPlanItem>> {
    const existing = await this.planItemRepo.findOne({
      where: { id: itemId, goalId },
    });
    if (!existing) {
      return null;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.title !== undefined) {
      patch.title = payload.title;
    }
    if (payload.summary !== undefined) {
      patch.summary = payload.summary;
    }
    if (payload.acceptanceCriteria !== undefined) {
      patch.acceptanceCriteria = payload.acceptanceCriteria;
    }
    if (payload.suggestedPrompt !== undefined) {
      patch.suggestedPrompt = payload.suggestedPrompt;
    }
    if (payload.dependsOnItemIds !== undefined) {
      patch.dependsOnItemIds = payload.dependsOnItemIds;
    }
    if (payload.itemOrder !== undefined) {
      patch.itemOrder = payload.itemOrder;
    }
    if (payload.gitBranch !== undefined) {
      patch.gitBranch = payload.gitBranch;
    }
    if (payload.groupMergedIntoGoalAt !== undefined) {
      patch.groupMergedIntoGoalAt = payload.groupMergedIntoGoalAt;
    }
    await this.planItemRepo.update({ id: itemId, goalId }, patch);
    const next = await this.planItemRepo.findOne({
      where: { id: itemId, goalId },
    });
    return next ? GoalMapper.planItemToDomain(next) : null;
  }

  async findPlanItem(
    goalId: string,
    itemId: string,
  ): Promise<NullableType<GoalPlanItem>> {
    const row = await this.planItemRepo.findOne({
      where: { id: itemId, goalId },
    });
    return row ? GoalMapper.planItemToDomain(row) : null;
  }

  async findPlanSubTask(
    goalId: string,
    subTaskId: string,
  ): Promise<NullableType<GoalPlanSubTask>> {
    const row = await this.planSubTaskRepo.findOne({
      where: { id: subTaskId },
    });
    if (!row) {
      return null;
    }
    const parent = await this.planItemRepo.findOne({
      where: { id: row.goalPlanItemId, goalId },
    });
    if (!parent) {
      return null;
    }
    return GoalMapper.planSubTaskToDomain(row);
  }

  async updatePlanSubTask(
    goalId: string,
    subTaskId: string,
    payload: Partial<GoalPlanSubTask>,
  ): Promise<NullableType<GoalPlanSubTask>> {
    const existing = await this.findPlanSubTask(goalId, subTaskId);
    if (!existing) {
      return null;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.title !== undefined) {
      patch.title = payload.title;
    }
    if (payload.summary !== undefined) {
      patch.summary = payload.summary;
    }
    if (payload.acceptanceCriteria !== undefined) {
      patch.acceptanceCriteria = payload.acceptanceCriteria;
    }
    if (payload.suggestedPrompt !== undefined) {
      patch.suggestedPrompt = payload.suggestedPrompt;
    }
    if (payload.dependsOnSubTaskIds !== undefined) {
      patch.dependsOnSubTaskIds = payload.dependsOnSubTaskIds;
    }
    if (payload.itemOrder !== undefined) {
      patch.itemOrder = payload.itemOrder;
    }
    if (payload.status !== undefined) {
      patch.status = payload.status;
    }
    if (payload.taskId !== undefined) {
      patch.taskId = payload.taskId;
    }
    if (payload.workflowTemplateId !== undefined) {
      patch.workflowTemplateId = payload.workflowTemplateId;
    }
    await this.planSubTaskRepo.update({ id: subTaskId }, patch);
    const next = await this.planSubTaskRepo.findOne({
      where: { id: subTaskId },
    });
    return next ? GoalMapper.planSubTaskToDomain(next) : null;
  }

  async listTaskDependenciesForGoal(
    goalId: string,
  ): Promise<TaskDependencyEdge[]> {
    const tasks = await this.taskRepo.find({
      where: { goalId, deletedAt: IsNull() },
      select: ['id'],
    });
    const ids = tasks.map((t) => t.id);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.depRepo.find({
      where: {
        predecessorTaskId: In(ids),
        successorTaskId: In(ids),
      },
    });
    const idSet = new Set(ids);
    return rows
      .filter(
        (r) => idSet.has(r.predecessorTaskId) && idSet.has(r.successorTaskId),
      )
      .map((r) => GoalMapper.dependencyToDomain(r));
  }

  async replaceTaskDependenciesForGoal(
    goalId: string,
    edges: Array<
      Pick<TaskDependencyEdge, 'predecessorTaskId' | 'successorTaskId'>
    >,
  ): Promise<void> {
    const tasks = await this.taskRepo.find({
      where: { goalId, deletedAt: IsNull() },
      select: ['id'],
    });
    const ids = new Set(tasks.map((t) => t.id));
    if (ids.size === 0) {
      return;
    }
    const idList = [...ids];
    await this.depRepo.manager.transaction(async (em) => {
      const existing = await em.find(TaskDependencyEntity, {
        where: {
          predecessorTaskId: In(idList),
          successorTaskId: In(idList),
        },
      });
      for (const e of existing) {
        if (ids.has(e.predecessorTaskId) && ids.has(e.successorTaskId)) {
          await em.delete(TaskDependencyEntity, { id: e.id });
        }
      }
      for (const edge of edges) {
        if (
          !ids.has(edge.predecessorTaskId) ||
          !ids.has(edge.successorTaskId)
        ) {
          continue;
        }
        if (edge.predecessorTaskId === edge.successorTaskId) {
          continue;
        }
        await em.save(
          em.create(TaskDependencyEntity, {
            predecessorTaskId: edge.predecessorTaskId,
            successorTaskId: edge.successorTaskId,
            relationType: TaskDependencyRelation.blocks,
          }),
        );
      }
    });
  }

  async insertTaskDependency(
    data: Omit<TaskDependencyEdge, 'id' | 'createdAt'> & { id?: string },
  ): Promise<TaskDependencyEdge> {
    const row = await this.depRepo.save(
      this.depRepo.create({
        predecessorTaskId: data.predecessorTaskId,
        successorTaskId: data.successorTaskId,
        relationType: data.relationType,
      }),
    );
    return GoalMapper.dependencyToDomain(row);
  }

  async removeTaskDependency(id: string): Promise<void> {
    await this.depRepo.delete({ id });
  }

  async shouldBlockTaskDeletionForPlan(
    taskId: string,
    taskStatus: TaskStatus,
  ): Promise<boolean> {
    void taskStatus;
    const rows = await this.planSubTaskRepo.find({ where: { taskId } });
    if (rows.length === 0) {
      return false;
    }
    const st = rows[0];
    const planItem = await this.planItemRepo.findOne({
      where: { id: st.goalPlanItemId },
    });
    if (!planItem) {
      return true;
    }
    const items = await this.listPlanItemsWithSubTasks(planItem.goalId);
    const flat = items.flatMap((it) => it.subTasks ?? []);
    const parentGroupId = st.goalPlanItemId;
    let hasNonCancelledDependent = false;
    for (const d of flat) {
      const deps = d.dependsOnSubTaskIds ?? [];
      const dependsOnSt = deps.includes(st.id);
      if (!dependsOnSt) {
        continue;
      }
      const cancelled = d.status === GoalPlanItemStatus.cancelled;
      const hasTaskId = Boolean(d.taskId?.trim());
      if (cancelled) {
        continue;
      }
      hasNonCancelledDependent = true;
      if (!hasTaskId) {
        return true;
      }
    }
    // 功能组 dependsOnItemIds：本计划子任务非 branch_merged 时，任后置组未物化子任务均拦截。
    // 已 branch_merged 时：若当前为「叶子」无直接子任务依赖，后置组仍有任未物化即拦截；
    // 若非叶子，仅拦截「已确认待物化」，避免草稿占位长期卡死非叶子节点。
    for (const item of items) {
      if (item.id === parentGroupId) {
        continue;
      }
      const groupDeps = item.dependsOnItemIds ?? [];
      if (!groupDeps.includes(parentGroupId)) {
        continue;
      }
      for (const h of item.subTasks ?? []) {
        if (h.status === GoalPlanItemStatus.cancelled) {
          continue;
        }
        if (!h.taskId?.trim()) {
          if (
            st.status === GoalPlanItemStatus.branchMerged &&
            hasNonCancelledDependent &&
            h.status !== GoalPlanItemStatus.approved
          ) {
            continue;
          }
          return true;
        }
      }
    }
    if (
      !hasNonCancelledDependent &&
      st.status !== GoalPlanItemStatus.branchMerged
    ) {
      return true;
    }
    return false;
  }

  async syncPlanSubTaskStatusByLinkedTaskId(
    taskId: string,
    isDone: boolean,
  ): Promise<void> {
    const rows = await this.planSubTaskRepo.find({ where: { taskId } });
    for (const row of rows) {
      if (isDone) {
        if (row.status === GoalPlanItemStatus.taskCreated) {
          await this.planSubTaskRepo.update(
            { id: row.id },
            {
              status: GoalPlanItemStatus.completed,
              updatedAt: new Date(),
            },
          );
        }
      } else if (
        row.status === GoalPlanItemStatus.completed ||
        row.status === GoalPlanItemStatus.branchMerged
      ) {
        await this.planSubTaskRepo.update(
          { id: row.id },
          {
            status: GoalPlanItemStatus.taskCreated,
            updatedAt: new Date(),
          },
        );
      }
    }
  }
}
