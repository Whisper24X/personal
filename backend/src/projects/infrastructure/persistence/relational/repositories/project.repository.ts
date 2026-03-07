import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Project } from '../../../../domain/project';
import { ProjectRepository } from '../../project.repository';
import { ProjectEntity } from '../entities/project.entity';
import { ProjectMapper } from '../mappers/project.mapper';

@Injectable()
export class ProjectRelationalRepository implements ProjectRepository {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

  async create(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Project> {
    const entity = await this.projectRepository.save(
      this.projectRepository.create(
        ProjectMapper.toPersistence({
          ...new Project(),
          ...data,
        }),
      ),
    );

    return ProjectMapper.toDomain(entity);
  }

  async findById(id: Project['id']): Promise<NullableType<Project>> {
    const entity = await this.projectRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    return entity ? ProjectMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Project['id'][]): Promise<Project[]> {
    if (!ids.length) {
      return [];
    }

    const entities = await this.projectRepository.find({
      where: {
        id: In(ids),
        deletedAt: IsNull(),
      },
    });

    return entities.map((entity) => ProjectMapper.toDomain(entity));
  }

  async findByBusinessLineId(
    businessLineId: Project['businessLineId'],
  ): Promise<Project[]> {
    const entities = await this.projectRepository.find({
      where: {
        businessLineId,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => ProjectMapper.toDomain(entity));
  }

  async findByBusinessLineIdAndName(
    businessLineId: Project['businessLineId'],
    name: Project['name'],
  ): Promise<NullableType<Project>> {
    const entity = await this.projectRepository.findOne({
      where: {
        businessLineId,
        name,
        deletedAt: IsNull(),
      },
    });

    return entity ? ProjectMapper.toDomain(entity) : null;
  }

  async findAllWithPagination({
    paginationOptions,
    businessLineId,
    keyword,
  }: {
    paginationOptions: IPaginationOptions;
    businessLineId?: string;
    keyword?: string;
  }): Promise<Project[]> {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .where('project.deletedAt IS NULL');

    if (businessLineId) {
      query.andWhere('project.businessLineId = :businessLineId', {
        businessLineId,
      });
    }

    if (keyword) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('project.name ILIKE :keyword', {
            keyword: `%${keyword}%`,
          }).orWhere('project.gitUrl ILIKE :keyword', {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    const entities = await query
      .orderBy('project.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => ProjectMapper.toDomain(entity));
  }

  async findAccessibleWithPagination({
    paginationOptions,
    projectIds,
    businessLineIds,
    keyword,
    businessLineId,
  }: {
    paginationOptions: IPaginationOptions;
    projectIds: string[];
    businessLineIds: string[];
    keyword?: string;
    businessLineId?: string;
  }): Promise<Project[]> {
    if (!projectIds.length && !businessLineIds.length) {
      return [];
    }

    const query = this.projectRepository
      .createQueryBuilder('project')
      .where('project.deletedAt IS NULL')
      .andWhere(
        new Brackets((qb) => {
          if (projectIds.length) {
            qb.where('project.id IN (:...projectIds)', {
              projectIds,
            });
          }

          if (businessLineIds.length) {
            if (projectIds.length) {
              qb.orWhere('project.businessLineId IN (:...businessLineIds)', {
                businessLineIds,
              });
            } else {
              qb.where('project.businessLineId IN (:...businessLineIds)', {
                businessLineIds,
              });
            }
          }
        }),
      );

    if (businessLineId) {
      query.andWhere('project.businessLineId = :businessLineId', {
        businessLineId,
      });
    }

    if (keyword) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('project.name ILIKE :keyword', {
            keyword: `%${keyword}%`,
          }).orWhere('project.gitUrl ILIKE :keyword', {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    const entities = await query
      .orderBy('project.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => ProjectMapper.toDomain(entity));
  }

  async update(
    id: Project['id'],
    payload: Partial<Project>,
  ): Promise<NullableType<Project>> {
    const entity = await this.projectRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!entity) {
      throw new NotFoundException('Project not found');
    }

    const updatedEntity = await this.projectRepository.save(
      this.projectRepository.create(
        ProjectMapper.toPersistence({
          ...ProjectMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProjectMapper.toDomain(updatedEntity);
  }

  async remove(id: Project['id']): Promise<void> {
    await this.projectRepository.softDelete(id);
  }
}
