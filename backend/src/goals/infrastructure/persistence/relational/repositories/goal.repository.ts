import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Goal } from '../../../../domain/goal';
import { GoalPlanItem } from '../../../../domain/goal-plan-item';
import { GoalSourceDoc } from '../../../../domain/goal-source-doc';
import { TaskDependencyEdge } from '../../../../domain/task-dependency-edge';
import { GoalStatus } from '../../../../dto/goal-status.enum';
import { GoalRepository } from '../../goal.repository';
import { GoalMapper } from '../mappers/goal.mapper';
import { GoalEntity } from '../entities/goal.entity';
import { GoalPlanItemEntity } from '../entities/goal-plan-item.entity';
import { GoalPlanItemStatus } from '../../../../dto/goal-plan-item-status.enum';
import { GoalSourceDocEntity } from '../entities/goal-source-doc.entity';
import { TaskDependencyEntity } from '../entities/task-dependency.entity';
import { TaskDependencyRelation } from '../../../../dto/task-dependency-relation.enum';
import { TaskEntity } from '../../../../../tasks/infrastructure/persistence/relational/entities/task.entity';

@Injectable()
export class GoalRelationalRepository extends GoalRepository {
  constructor(
    @InjectRepository(GoalEntity)
    private readonly goalRepo: Repository<GoalEntity>,
    @InjectRepository(GoalSourceDocEntity)
    private readonly sourceDocRepo: Repository<GoalSourceDocEntity>,
    @InjectRepository(GoalPlanItemEntity)
    private readonly planItemRepo: Repository<GoalPlanItemEntity>,
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

  async replacePlanItems(goalId: string, items: GoalPlanItem[]): Promise<void> {
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
          taskId: item.taskId ?? null,
          status: item.status ?? GoalPlanItemStatus.draft,
          workflowTemplateId: item.workflowTemplateId ?? null,
          gitBaseBranch: item.gitBaseBranch ?? null,
          createdAt: item.createdAt ?? new Date(),
          updatedAt: item.updatedAt ?? new Date(),
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
    if (payload.status !== undefined) {
      patch.status = payload.status;
    }
    if (payload.taskId !== undefined) {
      patch.taskId = payload.taskId;
    }
    if (payload.workflowTemplateId !== undefined) {
      patch.workflowTemplateId = payload.workflowTemplateId;
    }
    if (payload.gitBaseBranch !== undefined) {
      patch.gitBaseBranch = payload.gitBaseBranch;
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
}
