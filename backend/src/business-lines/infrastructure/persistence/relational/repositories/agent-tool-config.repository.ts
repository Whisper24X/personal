import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { AgentToolConfig } from '../../../../domain/agent-tool-config';
import { AgentToolConfigRepository } from '../../agent-tool-config.repository';
import { AgentToolConfigEntity } from '../entities/agent-tool-config.entity';
import { AgentToolConfigMapper } from '../mappers/agent-tool-config.mapper';

@Injectable()
export class AgentToolConfigRelationalRepository
  implements AgentToolConfigRepository
{
  constructor(
    @InjectRepository(AgentToolConfigEntity)
    private readonly agentToolConfigRepository: Repository<AgentToolConfigEntity>,
  ) {}

  async create(
    data: Omit<AgentToolConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AgentToolConfig> {
    const newEntity = await this.agentToolConfigRepository.save(
      this.agentToolConfigRepository.create(
        AgentToolConfigMapper.toPersistence(data as AgentToolConfig),
      ),
    );

    return AgentToolConfigMapper.toDomain(newEntity);
  }

  async findByBusinessLineId(
    businessLineId: AgentToolConfig['businessLineId'],
    toolId?: string,
  ): Promise<AgentToolConfig[]> {
    const entities = await this.agentToolConfigRepository.find({
      where: {
        businessLineId,
        ...(toolId ? { toolId } : {}),
      },
      order: {
        toolId: 'ASC',
        isDefault: 'DESC',
        name: 'ASC',
      },
    });

    return entities.map((entity) => AgentToolConfigMapper.toDomain(entity));
  }

  async findById(
    id: AgentToolConfig['id'],
  ): Promise<NullableType<AgentToolConfig>> {
    const entity = await this.agentToolConfigRepository.findOne({
      where: {
        id,
      },
    });

    return entity ? AgentToolConfigMapper.toDomain(entity) : null;
  }

  async findDefaultByBusinessLineIdAndToolId(
    businessLineId: AgentToolConfig['businessLineId'],
    toolId: AgentToolConfig['toolId'],
  ): Promise<NullableType<AgentToolConfig>> {
    const entity = await this.agentToolConfigRepository.findOne({
      where: {
        businessLineId,
        toolId,
        isDefault: true,
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    return entity ? AgentToolConfigMapper.toDomain(entity) : null;
  }

  async clearDefaultByBusinessLineIdAndToolId(
    businessLineId: AgentToolConfig['businessLineId'],
    toolId: AgentToolConfig['toolId'],
    excludeId?: AgentToolConfig['id'],
  ): Promise<void> {
    const query = this.agentToolConfigRepository
      .createQueryBuilder()
      .update(AgentToolConfigEntity)
      .set({ isDefault: false })
      .where('"businessLineId" = :businessLineId', {
        businessLineId,
      })
      .andWhere('"toolId" = :toolId', {
        toolId,
      });

    if (excludeId) {
      query.andWhere('"id" != :excludeId', { excludeId });
    }

    await query.execute();
  }

  async update(
    id: AgentToolConfig['id'],
    payload: Partial<AgentToolConfig>,
  ): Promise<NullableType<AgentToolConfig>> {
    const current = await this.agentToolConfigRepository.findOne({
      where: {
        id,
      },
    });

    if (!current) {
      return null;
    }

    const updatedEntity = await this.agentToolConfigRepository.save(
      this.agentToolConfigRepository.create(
        AgentToolConfigMapper.toPersistence({
          ...AgentToolConfigMapper.toDomain(current),
          ...payload,
        }),
      ),
    );

    return AgentToolConfigMapper.toDomain(updatedEntity);
  }

  async remove(id: AgentToolConfig['id']): Promise<void> {
    await this.agentToolConfigRepository.delete(id);
  }
}
