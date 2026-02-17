import { ProjectMember } from '../../../../domain/project-member';
import { ProjectMemberEntity } from '../entities/project-member.entity';

export class ProjectMemberMapper {
  static toDomain(raw: ProjectMemberEntity): ProjectMember {
    const domainEntity = new ProjectMember();
    domainEntity.id = raw.id;
    domainEntity.projectId = raw.projectId;
    domainEntity.userId = raw.userId;
    domainEntity.role = raw.role;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: ProjectMember): ProjectMemberEntity {
    const persistenceEntity = new ProjectMemberEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.projectId = domainEntity.projectId;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.role = domainEntity.role;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
