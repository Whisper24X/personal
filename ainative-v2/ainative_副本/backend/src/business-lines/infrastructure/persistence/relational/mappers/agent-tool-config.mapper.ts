import { AgentToolConfig } from '../../../../domain/agent-tool-config';
import { AgentToolConfigEntity } from '../entities/agent-tool-config.entity';

export class AgentToolConfigMapper {
  static toDomain(raw: AgentToolConfigEntity): AgentToolConfig {
    const domainEntity = new AgentToolConfig();
    domainEntity.id = raw.id;
    domainEntity.businessLineId = raw.businessLineId;
    domainEntity.toolId = raw.toolId;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.configJson = raw.configJson;
    domainEntity.isDefault = raw.isDefault;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: AgentToolConfig): AgentToolConfigEntity {
    const persistenceEntity = new AgentToolConfigEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.businessLineId = domainEntity.businessLineId;
    persistenceEntity.toolId = domainEntity.toolId;
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.configJson = domainEntity.configJson;
    persistenceEntity.isDefault = domainEntity.isDefault;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
