import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BusinessLineEntity } from '../entities/business-line.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { BusinessLine } from '../../../../domain/business-line';
import { BusinessLineRepository } from '../../business-line.repository';
import { BusinessLineMapper } from '../mappers/business-line.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class BusinessLineRelationalRepository
  implements BusinessLineRepository
{
  constructor(
    @InjectRepository(BusinessLineEntity)
    private readonly businessLineRepository: Repository<BusinessLineEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(data: BusinessLine): Promise<BusinessLine> {
    const persistenceModel = BusinessLineMapper.toPersistence(data);
    const newEntity = await this.businessLineRepository.save(
      this.businessLineRepository.create(persistenceModel),
    );
    return BusinessLineMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<BusinessLine[]> {
    const entities = await this.businessLineRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => BusinessLineMapper.toDomain(entity));
  }

  async findById(id: BusinessLine['id']): Promise<NullableType<BusinessLine>> {
    const entity = await this.businessLineRepository.findOne({
      where: { id },
    });

    return entity ? BusinessLineMapper.toDomain(entity) : null;
  }

  async findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]> {
    const entities = await this.businessLineRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => BusinessLineMapper.toDomain(entity));
  }

  async findAllByIdsWithPagination({
    ids,
    paginationOptions,
  }: {
    ids: BusinessLine['id'][];
    paginationOptions: IPaginationOptions;
  }): Promise<BusinessLine[]> {
    if (!ids.length) {
      return [];
    }

    const entities = await this.businessLineRepository.find({
      where: {
        id: In(ids),
      },
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => BusinessLineMapper.toDomain(entity));
  }

  async findByName(
    name: BusinessLine['name'],
  ): Promise<NullableType<BusinessLine>> {
    const entity = await this.businessLineRepository.findOne({
      where: {
        name,
      },
    });

    return entity ? BusinessLineMapper.toDomain(entity) : null;
  }

  async findBySlug(
    slug: BusinessLine['slug'],
  ): Promise<NullableType<BusinessLine>> {
    const entity = await this.businessLineRepository.findOne({
      where: {
        slug,
      },
    });

    return entity ? BusinessLineMapper.toDomain(entity) : null;
  }

  async update(
    id: BusinessLine['id'],
    payload: Partial<BusinessLine>,
  ): Promise<BusinessLine> {
    const entity = await this.businessLineRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException('Business line not found');
    }

    const updatedEntity = await this.businessLineRepository.save(
      this.businessLineRepository.create(
        BusinessLineMapper.toPersistence({
          ...BusinessLineMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return BusinessLineMapper.toDomain(updatedEntity);
  }

  async remove(id: BusinessLine['id']): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.deleteBusinessLineGraph(manager, [id]),
    );
  }

  private async deleteBusinessLineGraph(
    manager: EntityManager,
    businessLineIds: string[],
  ): Promise<void> {
    if (!businessLineIds.length) {
      return;
    }

    const projectIds = await this.queryIds(
      manager,
      `SELECT "id" FROM "projects" WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    const taskIds = await this.queryIds(
      manager,
      `SELECT "id" FROM "tasks"
       WHERE "businessLineId" = ANY($1::uuid[])
          OR "projectId" = ANY($2::uuid[])`,
      [businessLineIds, projectIds],
    );
    const goalIds = await this.queryIds(
      manager,
      `SELECT "id" FROM "goals" WHERE "projectId" = ANY($1::uuid[])`,
      [projectIds],
    );
    const goalPlanItemIds = await this.queryIds(
      manager,
      `SELECT "id" FROM "goal_plan_items" WHERE "goalId" = ANY($1::uuid[])`,
      [goalIds],
    );

    await manager.query(
      `DELETE FROM "notification_events" WHERE "taskId" = ANY($1::uuid[])`,
      [taskIds],
    );
    await manager.query(
      `DELETE FROM "memory_ingest_jobs"
       WHERE "projectId" = ANY($1::uuid[])
          OR "taskId" = ANY($2::uuid[])`,
      [projectIds, taskIds],
    );
    await manager.query(
      `DELETE FROM "memory_fact_signals" WHERE "projectId" = ANY($1::uuid[])`,
      [projectIds],
    );
    await manager.query(
      `DELETE FROM "project_execution_slots"
       WHERE "projectId" = ANY($1::uuid[])
          OR "taskId" = ANY($2::uuid[])`,
      [projectIds, taskIds],
    );
    await manager.query(
      `DELETE FROM "task_dependencies"
       WHERE "predecessorTaskId" = ANY($1::uuid[])
          OR "successorTaskId" = ANY($1::uuid[])`,
      [taskIds],
    );
    await manager.query(
      `DELETE FROM "task_nodes" WHERE "taskId" = ANY($1::uuid[])`,
      [taskIds],
    );
    await manager.query(
      `DELETE FROM "goal_plan_sub_tasks"
       WHERE "taskId" = ANY($1::uuid[])
          OR "goalPlanItemId" = ANY($2::uuid[])`,
      [taskIds, goalPlanItemIds],
    );
    await manager.query(
      `DELETE FROM "goal_plan_items" WHERE "goalId" = ANY($1::uuid[])`,
      [goalIds],
    );
    await manager.query(
      `DELETE FROM "goal_source_docs" WHERE "goalId" = ANY($1::uuid[])`,
      [goalIds],
    );
    await manager.query(
      `DELETE FROM "goals" WHERE "projectId" = ANY($1::uuid[])`,
      [projectIds],
    );
    await manager.query(
      `DELETE FROM "workflow_templates"
       WHERE "businessLineId" = ANY($1::uuid[])
          OR "projectId" = ANY($2::uuid[])`,
      [businessLineIds, projectIds],
    );
    await manager.query(
      `DELETE FROM "automations" WHERE "projectId" = ANY($1::uuid[])`,
      [projectIds],
    );
    await manager.query(
      `DELETE FROM "project_members" WHERE "projectId" = ANY($1::uuid[])`,
      [projectIds],
    );
    await manager.query(
      `DELETE FROM "tasks"
       WHERE "businessLineId" = ANY($1::uuid[])
          OR "projectId" = ANY($2::uuid[])`,
      [businessLineIds, projectIds],
    );
    await manager.query(
      `DELETE FROM "project_roles" WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    await manager.query(
      `DELETE FROM "projects" WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    await manager.query(
      `DELETE FROM "business_line_invitations"
       WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    await manager.query(
      `DELETE FROM "business_line_members"
       WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    await manager.query(
      `DELETE FROM "agent_cli_configs"
       WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    await manager.query(
      `DELETE FROM "business_line_roles"
       WHERE "businessLineId" = ANY($1::uuid[])`,
      [businessLineIds],
    );
    await manager.query(
      `DELETE FROM "business_lines" WHERE "id" = ANY($1::uuid[])`,
      [businessLineIds],
    );
  }

  private async queryIds(
    manager: EntityManager,
    sql: string,
    parameters: unknown[],
  ): Promise<string[]> {
    const rows = await manager.query<{ id: string }[]>(sql, parameters);
    return rows.map((row) => row.id);
  }
}
