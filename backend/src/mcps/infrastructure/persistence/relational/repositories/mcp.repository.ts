import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { Mcp } from '../../../../domain/mcp';
import { McpRepository } from '../../mcp.repository';
import { McpEntity } from '../entities/mcp.entity';
import { McpMapper } from '../mappers/mcp.mapper';

@Injectable()
export class McpRelationalRepository implements McpRepository {
  constructor(
    @InjectRepository(McpEntity)
    private readonly mcpRepository: Repository<McpEntity>,
  ) {}

  async create(
    data: Omit<Mcp, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Mcp> {
    const entity = await this.mcpRepository.save(
      this.mcpRepository.create(
        McpMapper.toPersistence({
          ...new Mcp(),
          ...data,
        }),
      ),
    );

    return McpMapper.toDomain(entity);
  }

  async findById(id: Mcp['id']): Promise<NullableType<Mcp>> {
    const entity = await this.mcpRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    return entity ? McpMapper.toDomain(entity) : null;
  }

  async findByNameAndVersion({
    name,
    version,
  }: {
    name: Mcp['name'];
    version: Mcp['version'];
  }): Promise<NullableType<Mcp>> {
    const entity = await this.mcpRepository.findOne({
      where: {
        name,
        version,
        deletedAt: IsNull(),
      },
    });

    return entity ? McpMapper.toDomain(entity) : null;
  }

  async findAllWithPagination({
    paginationOptions,
    keyword,
    enabled,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    enabled?: boolean;
  }): Promise<Mcp[]> {
    const query = this.mcpRepository
      .createQueryBuilder('mcp')
      .where('mcp.deletedAt IS NULL');

    if (keyword) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('mcp.name ILIKE :keyword', {
            keyword: `%${keyword}%`,
          }).orWhere('mcp.description ILIKE :keyword', {
            keyword: `%${keyword}%`,
          });
        }),
      );
    }

    if (enabled !== undefined) {
      query.andWhere('mcp.enabled = :enabled', { enabled });
    }

    const entities = await query
      .orderBy('mcp.createdAt', 'DESC')
      .offset((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .getMany();

    return entities.map((entity) => McpMapper.toDomain(entity));
  }

  async update(
    id: Mcp['id'],
    payload: Partial<Mcp>,
  ): Promise<NullableType<Mcp>> {
    const entity = await this.mcpRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });

    if (!entity) {
      throw new NotFoundException('MCP not found');
    }

    const updatedEntity = await this.mcpRepository.save(
      this.mcpRepository.create(
        McpMapper.toPersistence({
          ...McpMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return McpMapper.toDomain(updatedEntity);
  }

  async remove(id: Mcp['id']): Promise<void> {
    await this.mcpRepository.softDelete(id);
  }
}
