import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { AutomationStatus } from '../../../../domain/automation-status.enum';
import { Automation } from '../../../../domain/automation';
import { AutomationRepository } from '../../automation.repository';
import { AutomationEntity } from '../entities/automation.entity';
import { AutomationMapper } from '../mappers/automation.mapper';

@Injectable()
export class AutomationRelationalRepository implements AutomationRepository {
  constructor(
    @InjectRepository(AutomationEntity)
    private readonly automationRepository: Repository<AutomationEntity>,
  ) {}

  async create(
    data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Automation> {
    const entity = await this.automationRepository.save(
      this.automationRepository.create(
        AutomationMapper.toPersistence({
          ...new Automation(),
          ...data,
        }),
      ),
    );

    return AutomationMapper.toDomain(entity);
  }

  async findById(id: Automation['id']): Promise<NullableType<Automation>> {
    const entity = await this.automationRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    return entity ? AutomationMapper.toDomain(entity) : null;
  }

  async findByName(
    name: Automation['name'],
    projectId: Automation['projectId'],
  ): Promise<NullableType<Automation>> {
    const entity = await this.automationRepository.findOne({
      where: {
        projectId,
        name,
        deletedAt: IsNull(),
      },
    });

    return entity ? AutomationMapper.toDomain(entity) : null;
  }

  async findAllWithPagination({
    paginationOptions,
    projectId,
    keyword,
    status,
  }: {
    paginationOptions: IPaginationOptions;
    projectId: Automation['projectId'];
    keyword?: string;
    status?: AutomationStatus;
  }): Promise<Automation[]> {
    const query = this.automationRepository
      .createQueryBuilder('automation')
      .where('automation.deletedAt IS NULL')
      .andWhere('automation.projectId = :projectId', { projectId });

    if (keyword) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('automation.name ILIKE :keyword', {
            keyword: `%${keyword}%`,
          }).orWhere('automation.prompt ILIKE :keyword', {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    if (status) {
      query.andWhere('automation.status = :status', { status });
    }

    const entities = await query
      .orderBy('automation.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => AutomationMapper.toDomain(entity));
  }

  async update(
    id: Automation['id'],
    payload: Partial<Automation>,
  ): Promise<NullableType<Automation>> {
    const entity = await this.automationRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!entity) {
      throw new NotFoundException('Automation not found');
    }

    const updatedEntity = await this.automationRepository.save(
      this.automationRepository.create(
        AutomationMapper.toPersistence({
          ...AutomationMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return AutomationMapper.toDomain(updatedEntity);
  }

  async remove(id: Automation['id']): Promise<void> {
    await this.automationRepository.softDelete(id);
  }
}
