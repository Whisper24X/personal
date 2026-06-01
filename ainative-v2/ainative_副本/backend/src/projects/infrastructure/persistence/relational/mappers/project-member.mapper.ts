import { ProjectMember } from '../../../../domain/project-member';
import { defineMemberRoleCapabilities } from '../../../../../utils/member-role-capabilities';
import { ProjectMemberEntity } from '../entities/project-member.entity';

export class ProjectMemberMapper {
  static toDomain(raw: ProjectMemberEntity): ProjectMember {
    const domainEntity = new ProjectMember();
    domainEntity.id = raw.id;
    domainEntity.projectId = raw.projectId;
    domainEntity.userId = raw.userId;
    domainEntity.roleId = raw.roleId;
    domainEntity.customRoleName = raw.roleRef?.name ?? null;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    defineMemberRoleCapabilities(domainEntity, raw.roleRef?.capabilities);
    return domainEntity;
  }

  static toPersistence(domainEntity: ProjectMember): ProjectMemberEntity {
    const persistenceEntity = new ProjectMemberEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.projectId = domainEntity.projectId;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.roleId = domainEntity.roleId;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
