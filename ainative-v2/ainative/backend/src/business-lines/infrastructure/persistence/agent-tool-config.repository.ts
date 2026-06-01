import { NullableType } from '../../../utils/types/nullable.type';
import { AgentToolConfig } from '../../domain/agent-tool-config';

export abstract class AgentToolConfigRepository {
  abstract create(
    data: Omit<AgentToolConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AgentToolConfig>;

  abstract findByBusinessLineId(
    businessLineId: AgentToolConfig['businessLineId'],
    toolId?: string,
  ): Promise<AgentToolConfig[]>;

  abstract findById(
    id: AgentToolConfig['id'],
  ): Promise<NullableType<AgentToolConfig>>;

  abstract findDefaultByBusinessLineIdAndToolId(
    businessLineId: AgentToolConfig['businessLineId'],
    toolId: AgentToolConfig['toolId'],
  ): Promise<NullableType<AgentToolConfig>>;

  abstract clearDefaultByBusinessLineIdAndToolId(
    businessLineId: AgentToolConfig['businessLineId'],
    toolId: AgentToolConfig['toolId'],
    excludeId?: AgentToolConfig['id'],
  ): Promise<void>;

  abstract update(
    id: AgentToolConfig['id'],
    payload: Partial<AgentToolConfig>,
  ): Promise<NullableType<AgentToolConfig>>;

  abstract remove(id: AgentToolConfig['id']): Promise<void>;
}
