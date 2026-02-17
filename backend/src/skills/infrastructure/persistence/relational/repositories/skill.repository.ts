import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { Skill } from '../../../../domain/skill';
import { SkillRepository } from '../../skill.repository';
import { SkillEntity } from '../entities/skill.entity';
import { SkillMapper } from '../mappers/skill.mapper';

@Injectable()
export class SkillRelationalRepository implements SkillRepository {
  constructor(
    @InjectRepository(SkillEntity)
    private readonly skillRepository: Repository<SkillEntity>,
  ) {}

  async create(
    data: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Skill> {
    const entity = await this.skillRepository.save(
      this.skillRepository.create(
        SkillMapper.toPersistence({
          ...new Skill(),
          ...data,
        }),
      ),
    );

    return SkillMapper.toDomain(entity);
  }

  async findById(id: Skill['id']): Promise<NullableType<Skill>> {
    const entity = await this.skillRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    return entity ? SkillMapper.toDomain(entity) : null;
  }

  async findByNameAndVersion({
    name,
    version,
  }: {
    name: Skill['name'];
    version: Skill['version'];
  }): Promise<NullableType<Skill>> {
    const entity = await this.skillRepository.findOne({
      where: {
        name,
        version,
        deletedAt: IsNull(),
      },
    });

    return entity ? SkillMapper.toDomain(entity) : null;
  }

  async findAllWithPagination({
    paginationOptions,
    keyword,
    enabled,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    enabled?: boolean;
  }): Promise<Skill[]> {
    const query = this.skillRepository
      .createQueryBuilder('skill')
      .where('skill.deletedAt IS NULL');

    if (keyword) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('skill.name ILIKE :keyword', {
            keyword: `%${keyword}%`,
          }).orWhere('skill.description ILIKE :keyword', {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    if (enabled !== undefined) {
      query.andWhere('skill.enabled = :enabled', { enabled });
    }

    const entities = await query
      .orderBy('skill.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => SkillMapper.toDomain(entity));
  }

  async update(
    id: Skill['id'],
    payload: Partial<Skill>,
  ): Promise<NullableType<Skill>> {
    const entity = await this.skillRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!entity) {
      throw new NotFoundException('Skill not found');
    }

    const updatedEntity = await this.skillRepository.save(
      this.skillRepository.create(
        SkillMapper.toPersistence({
          ...SkillMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SkillMapper.toDomain(updatedEntity);
  }

  async remove(id: Skill['id']): Promise<void> {
    await this.skillRepository.softDelete(id);
  }
}
