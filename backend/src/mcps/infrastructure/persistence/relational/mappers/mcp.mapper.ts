import { Mcp } from '../../../../domain/mcp';
import { McpEntity } from '../entities/mcp.entity';

export class McpMapper {
  static toDomain(raw: McpEntity): Mcp {
    const domainEntity = new Mcp();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.version = raw.version;
    domainEntity.description = raw.description;
    domainEntity.provider = raw.provider;
    domainEntity.toolsCount = raw.toolsCount;
    domainEntity.configSchema = raw.configSchema;
    domainEntity.metadataJson = raw.metadataJson;
    domainEntity.enabled = raw.enabled;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Mcp): McpEntity {
    const persistenceEntity = new McpEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.name = domainEntity.name;
    persistenceEntity.version = domainEntity.version;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.provider = domainEntity.provider;
    persistenceEntity.toolsCount = domainEntity.toolsCount;
    persistenceEntity.configSchema = domainEntity.configSchema;
    persistenceEntity.metadataJson = domainEntity.metadataJson;
    persistenceEntity.enabled = domainEntity.enabled;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;

    return persistenceEntity;
  }
}
