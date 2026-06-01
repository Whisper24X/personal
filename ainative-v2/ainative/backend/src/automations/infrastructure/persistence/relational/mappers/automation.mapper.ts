import { Automation } from '../../../../domain/automation';
import { AutomationEntity } from '../entities/automation.entity';

export class AutomationMapper {
  static toDomain(entity: AutomationEntity): Automation {
    const domain = new Automation();
    domain.id = entity.id;
    domain.projectId = entity.projectId;
    domain.name = entity.name;
    domain.prompt = entity.prompt;
    domain.rrule = entity.rrule;
    domain.cwds = entity.cwds ?? null;
    domain.status = entity.status;
    domain.lastRunAt = entity.lastRunAt ?? null;
    domain.nextRunAt = entity.nextRunAt ?? null;
    domain.createdBy = entity.createdBy ?? null;
    domain.createdAt = entity.createdAt;
    domain.updatedAt = entity.updatedAt;
    domain.deletedAt = entity.deletedAt ?? null;

    return domain;
  }

  static toPersistence(domain: Automation): AutomationEntity {
    const entity = new AutomationEntity();
    entity.id = domain.id;
    entity.projectId = domain.projectId;
    entity.name = domain.name;
    entity.prompt = domain.prompt;
    entity.rrule = domain.rrule;
    entity.cwds = domain.cwds ?? null;
    entity.status = domain.status;
    entity.lastRunAt = domain.lastRunAt ?? null;
    entity.nextRunAt = domain.nextRunAt ?? null;
    entity.createdBy = domain.createdBy ?? null;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.deletedAt = domain.deletedAt ?? null;

    return entity;
  }
}
