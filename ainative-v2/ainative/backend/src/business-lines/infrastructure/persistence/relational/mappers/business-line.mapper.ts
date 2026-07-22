import { BusinessLine } from '../../../../domain/business-line';
import { BusinessLineEntity } from '../entities/business-line.entity';

export class BusinessLineMapper {
  static toDomain(raw: BusinessLineEntity): BusinessLine {
    const domainEntity = new BusinessLine();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.slug = raw.slug;
    domainEntity.description = raw.description;
    domainEntity.defaultAgentCliToolId = raw.defaultAgentCliToolId;
    domainEntity.configJson = raw.configJson;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: BusinessLine): BusinessLineEntity {
    const persistenceEntity = new BusinessLineEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.slug = domainEntity.slug;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.defaultAgentCliToolId =
      domainEntity.defaultAgentCliToolId;
    persistenceEntity.configJson = domainEntity.configJson;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
