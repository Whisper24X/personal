import { Skill } from '../../../../domain/skill';
import { SkillEntity } from '../entities/skill.entity';

export class SkillMapper {
  static toDomain(raw: SkillEntity): Skill {
    const domainEntity = new Skill();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.version = raw.version;
    domainEntity.description = raw.description;
    domainEntity.scope = raw.scope;
    domainEntity.homepageUrl = raw.homepageUrl;
    domainEntity.metadataJson = raw.metadataJson;
    domainEntity.enabled = raw.enabled;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Skill): SkillEntity {
    const persistenceEntity = new SkillEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.name = domainEntity.name;
    persistenceEntity.version = domainEntity.version;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.scope = domainEntity.scope;
    persistenceEntity.homepageUrl = domainEntity.homepageUrl;
    persistenceEntity.metadataJson = domainEntity.metadataJson;
    persistenceEntity.enabled = domainEntity.enabled;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;

    return persistenceEntity;
  }
}
