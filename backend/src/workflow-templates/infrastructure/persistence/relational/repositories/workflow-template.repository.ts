import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { WorkflowTemplate } from '../../../../domain/workflow-template';
import { WorkflowTemplateScope } from '../../../../dto/workflow-template-scope.enum';
import { WorkflowTemplateRepository } from '../../workflow-template.repository';
import { WorkflowTemplateEntity } from '../entities/workflow-template.entity';
import { WorkflowTemplateMapper } from '../mappers/workflow-template.mapper';

@Injectable()
export class WorkflowTemplateRelationalRepository
  implements WorkflowTemplateRepository
{
  constructor(
    @InjectRepository(WorkflowTemplateEntity)
    private readonly workflowTemplateRepository: Repository<WorkflowTemplateEntity>,
  ) {}

  async create(
    data: Omit<
      WorkflowTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
    >,
  ): Promise<WorkflowTemplate> {
    const entity = await this.workflowTemplateRepository.save(
      this.workflowTemplateRepository.create(
        WorkflowTemplateMapper.toPersistence({
          ...new WorkflowTemplate(),
          ...data,
        }),
      ),
    );

    return WorkflowTemplateMapper.toDomain(entity);
  }

  async findById(
    id: WorkflowTemplate['id'],
  ): Promise<NullableType<WorkflowTemplate>> {
    const entity = await this.workflowTemplateRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    return entity ? WorkflowTemplateMapper.toDomain(entity) : null;
  }

  async findByName(
    name: WorkflowTemplate['name'],
    options?: {
      scope?: WorkflowTemplateScope;
      businessLineId?: string | null;
      projectId?: string | null;
    },
  ): Promise<NullableType<WorkflowTemplate>> {
    const query = this.workflowTemplateRepository
      .createQueryBuilder('workflowTemplate')
      .where('workflowTemplate.deletedAt IS NULL')
      .andWhere('workflowTemplate.name = :name', { name });

    if (options?.scope) {
      query.andWhere('workflowTemplate.scope = :scope', {
        scope: options.scope,
      });
    }

    if (options?.businessLineId !== undefined) {
      if (options.businessLineId === null) {
        query.andWhere('workflowTemplate.businessLineId IS NULL');
      } else {
        query.andWhere('workflowTemplate.businessLineId = :businessLineId', {
          businessLineId: options.businessLineId,
        });
      }
    }

    if (options?.projectId !== undefined) {
      if (options.projectId === null) {
        query.andWhere('workflowTemplate.projectId IS NULL');
      } else {
        query.andWhere('workflowTemplate.projectId = :projectId', {
          projectId: options.projectId,
        });
      }
    }

    const entity = await query.getOne();

    return entity ? WorkflowTemplateMapper.toDomain(entity) : null;
  }

  async findAllWithPagination({
    paginationOptions,
    keyword,
    isActive,
    scope,
    businessLineId,
    projectId,
    includeGlobal,
    excludeGlobal,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    isActive?: boolean;
    scope?: WorkflowTemplateScope;
    businessLineId?: string;
    projectId?: string;
    includeGlobal?: boolean;
    excludeGlobal?: boolean;
  }): Promise<WorkflowTemplate[]> {
    const query = this.workflowTemplateRepository
      .createQueryBuilder('workflowTemplate')
      .where('workflowTemplate.deletedAt IS NULL');

    if (excludeGlobal) {
      query.andWhere('workflowTemplate.scope <> :globalScope', {
        globalScope: WorkflowTemplateScope.global,
      });
    }

    if (scope) {
      query.andWhere('workflowTemplate.scope = :scope', {
        scope,
      });

      if (scope === WorkflowTemplateScope.businessLine && businessLineId) {
        query.andWhere('workflowTemplate.businessLineId = :businessLineId', {
          businessLineId,
        });
      }

      if (scope === WorkflowTemplateScope.project && projectId) {
        query.andWhere('workflowTemplate.projectId = :projectId', {
          projectId,
        });
      }
    } else if (projectId) {
      if (includeGlobal) {
        query.andWhere(
          new Brackets((qb) => {
            qb.where(
              'workflowTemplate.scope = :businessLineScope AND workflowTemplate.businessLineId = :businessLineId',
              {
                businessLineScope: WorkflowTemplateScope.businessLine,
                businessLineId: businessLineId ?? null,
              },
            ).orWhere(
              'workflowTemplate.scope = :projectScope AND workflowTemplate.projectId = :projectId',
              {
                projectScope: WorkflowTemplateScope.project,
                projectId,
              },
            );
          }),
        );
      } else {
        query.andWhere('workflowTemplate.scope = :projectScope', {
          projectScope: WorkflowTemplateScope.project,
        });
        query.andWhere('workflowTemplate.projectId = :projectId', {
          projectId,
        });
      }
    } else if (businessLineId) {
      query.andWhere('workflowTemplate.scope = :businessLineScope', {
        businessLineScope: WorkflowTemplateScope.businessLine,
      });
      query.andWhere('workflowTemplate.businessLineId = :businessLineId', {
        businessLineId,
      });
    }

    if (keyword) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('workflowTemplate.name ILIKE :keyword', {
            keyword: `%${keyword}%`,
          }).orWhere('workflowTemplate.description ILIKE :keyword', {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    if (isActive !== undefined) {
      query.andWhere('workflowTemplate.isActive = :isActive', {
        isActive,
      });
    }

    const entities = await query
      .orderBy('workflowTemplate.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => WorkflowTemplateMapper.toDomain(entity));
  }

  async update(
    id: WorkflowTemplate['id'],
    payload: Partial<WorkflowTemplate>,
  ): Promise<NullableType<WorkflowTemplate>> {
    const entity = await this.workflowTemplateRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!entity) {
      throw new NotFoundException('Workflow template not found');
    }

    const updatedEntity = await this.workflowTemplateRepository.save(
      this.workflowTemplateRepository.create(
        WorkflowTemplateMapper.toPersistence({
          ...WorkflowTemplateMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return WorkflowTemplateMapper.toDomain(updatedEntity);
  }

  async remove(id: WorkflowTemplate['id']): Promise<void> {
    await this.workflowTemplateRepository.softDelete(id);
  }
}
