import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
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
      where: {
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => BusinessLineMapper.toDomain(entity));
  }

  async findById(id: BusinessLine['id']): Promise<NullableType<BusinessLine>> {
    const entity = await this.businessLineRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    return entity ? BusinessLineMapper.toDomain(entity) : null;
  }

  async findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]> {
    const entities = await this.businessLineRepository.find({
      where: { id: In(ids), deletedAt: IsNull() },
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
        deletedAt: IsNull(),
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
        deletedAt: IsNull(),
      },
    });

    return entity ? BusinessLineMapper.toDomain(entity) : null;
  }

  async update(
    id: BusinessLine['id'],
    payload: Partial<BusinessLine>,
  ): Promise<BusinessLine> {
    const entity = await this.businessLineRepository.findOne({
      where: { id, deletedAt: IsNull() },
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
    await this.businessLineRepository.softDelete(id);
  }
}
