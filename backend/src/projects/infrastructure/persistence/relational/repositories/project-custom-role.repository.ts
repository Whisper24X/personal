import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { ProjectCustomRole } from '../../../../domain/project-custom-role';
import { ProjectCustomRoleRepository } from '../../project-custom-role.repository';
import { ProjectCustomRoleEntity } from '../entities/project-custom-role.entity';
import { ProjectCustomRoleMapper } from '../mappers/project-custom-role.mapper';

@Injectable()
export class ProjectCustomRoleRelationalRepository
  implements ProjectCustomRoleRepository
{
  constructor(
    @InjectRepository(ProjectCustomRoleEntity)
    private readonly repository: Repository<ProjectCustomRoleEntity>,
  ) {}

  async findById(
    id: ProjectCustomRole['id'],
  ): Promise<NullableType<ProjectCustomRole>> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? ProjectCustomRoleMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: ProjectCustomRole['id'][],
  ): Promise<ProjectCustomRole[]> {
    if (!ids.length) {
      return [];
    }

    const entities = await this.repository.find({
      where: {
        id: In(ids),
      },
    });

    return entities.map((entity) => ProjectCustomRoleMapper.toDomain(entity));
  }

  async findAllByBusinessLineId(
    businessLineId: ProjectCustomRole['businessLineId'],
  ): Promise<ProjectCustomRole[]> {
    const entities = await this.repository
      .createQueryBuilder('role')
      .where('role."businessLineId" = :businessLineId', { businessLineId })
      .orderBy('role."createdAt"', 'ASC')
      .getMany();

    return entities.map((entity) => ProjectCustomRoleMapper.toDomain(entity));
  }

  async findByName(
    businessLineId: ProjectCustomRole['businessLineId'],
    name: ProjectCustomRole['name'],
  ): Promise<NullableType<ProjectCustomRole>> {
    const entity = await this.repository
      .createQueryBuilder('role')
      .where('role."businessLineId" = :businessLineId', { businessLineId })
      .andWhere('role."name" = :name', { name })
      .getOne();

    return entity ? ProjectCustomRoleMapper.toDomain(entity) : null;
  }

  async findByCode(
    businessLineId: ProjectCustomRole['businessLineId'],
    code: string,
  ): Promise<NullableType<ProjectCustomRole>> {
    const entity = await this.repository
      .createQueryBuilder('role')
      .where('role."businessLineId" = :businessLineId', { businessLineId })
      .andWhere('role."code" = :code', { code })
      .getOne();

    return entity ? ProjectCustomRoleMapper.toDomain(entity) : null;
  }

  async create(data: {
    businessLineId: ProjectCustomRole['businessLineId'];
    code: ProjectCustomRole['code'];
    name: ProjectCustomRole['name'];
    description?: ProjectCustomRole['description'];
    capabilities: ProjectCustomRole['capabilities'];
  }): Promise<ProjectCustomRole> {
    const entity = await this.repository.save(
      this.repository.create({
        businessLineId: data.businessLineId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        capabilities: data.capabilities,
      }),
    );

    return ProjectCustomRoleMapper.toDomain(entity);
  }

  async update(
    id: ProjectCustomRole['id'],
    payload: Partial<ProjectCustomRole>,
  ): Promise<NullableType<ProjectCustomRole>> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      return null;
    }

    const updatedEntity = await this.repository.save(
      this.repository.create({
        ...entity,
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description ?? null }
          : {}),
        ...(payload.capabilities !== undefined
          ? { capabilities: payload.capabilities }
          : {}),
      }),
    );

    return ProjectCustomRoleMapper.toDomain(updatedEntity);
  }

  async remove(id: ProjectCustomRole['id']): Promise<void> {
    await this.repository.delete({ id });
  }
}
