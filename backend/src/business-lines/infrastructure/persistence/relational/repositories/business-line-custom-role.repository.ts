import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { BusinessLineCustomRole } from '../../../../domain/business-line-custom-role';
import { BusinessLineCustomRoleRepository } from '../../business-line-custom-role.repository';
import { BusinessLineCustomRoleEntity } from '../entities/business-line-custom-role.entity';
import { BusinessLineCustomRoleMapper } from '../mappers/business-line-custom-role.mapper';

@Injectable()
export class BusinessLineCustomRoleRelationalRepository
  implements BusinessLineCustomRoleRepository
{
  constructor(
    @InjectRepository(BusinessLineCustomRoleEntity)
    private readonly repository: Repository<BusinessLineCustomRoleEntity>,
  ) {}

  async findById(
    id: BusinessLineCustomRole['id'],
  ): Promise<NullableType<BusinessLineCustomRole>> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? BusinessLineCustomRoleMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: BusinessLineCustomRole['id'][],
  ): Promise<BusinessLineCustomRole[]> {
    if (!ids.length) {
      return [];
    }

    const entities = await this.repository.find({ where: { id: In(ids) } });
    return entities.map((entity) =>
      BusinessLineCustomRoleMapper.toDomain(entity),
    );
  }

  async findAllByBusinessLineId(
    businessLineId: BusinessLineCustomRole['businessLineId'],
  ): Promise<BusinessLineCustomRole[]> {
    const entities = await this.repository
      .createQueryBuilder('role')
      .where('role."businessLineId" = :businessLineId', { businessLineId })
      .orderBy('role."createdAt"', 'ASC')
      .getMany();

    return entities.map((entity) =>
      BusinessLineCustomRoleMapper.toDomain(entity),
    );
  }

  async findByName(
    businessLineId: BusinessLineCustomRole['businessLineId'],
    name: BusinessLineCustomRole['name'],
  ): Promise<NullableType<BusinessLineCustomRole>> {
    const entity = await this.repository
      .createQueryBuilder('role')
      .where('role."businessLineId" = :businessLineId', { businessLineId })
      .andWhere('role."name" = :name', { name })
      .getOne();

    return entity ? BusinessLineCustomRoleMapper.toDomain(entity) : null;
  }

  async create(data: {
    businessLineId: BusinessLineCustomRole['businessLineId'];
    name: BusinessLineCustomRole['name'];
    description?: BusinessLineCustomRole['description'];
    capabilities: BusinessLineCustomRole['capabilities'];
  }): Promise<BusinessLineCustomRole> {
    const entity = await this.repository.save(
      this.repository.create({
        businessLineId: data.businessLineId,
        name: data.name,
        description: data.description ?? null,
        capabilities: data.capabilities,
      }),
    );

    return BusinessLineCustomRoleMapper.toDomain(entity);
  }

  async update(
    id: BusinessLineCustomRole['id'],
    payload: Partial<BusinessLineCustomRole>,
  ): Promise<NullableType<BusinessLineCustomRole>> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      return null;
    }

    const updatedEntity = await this.repository.save(
      this.repository.create({
        ...entity,
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined
          ? { description: payload.description ?? null }
          : {}),
        ...(payload.capabilities !== undefined
          ? { capabilities: payload.capabilities }
          : {}),
      }),
    );

    return BusinessLineCustomRoleMapper.toDomain(updatedEntity);
  }

  async remove(id: BusinessLineCustomRole['id']): Promise<void> {
    await this.repository.delete({ id });
  }
}
