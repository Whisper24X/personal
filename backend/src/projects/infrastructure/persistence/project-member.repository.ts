import { NullableType } from '../../../utils/types/nullable.type';
import { ProjectMember } from '../../domain/project-member';

export abstract class ProjectMemberRepository {
  abstract findByProjectId(
    projectId: ProjectMember['projectId'],
  ): Promise<ProjectMember[]>;

  abstract findByUserId(
    userId: ProjectMember['userId'],
  ): Promise<ProjectMember[]>;

  abstract findByProjectIdAndUserId(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
  ): Promise<NullableType<ProjectMember>>;

  abstract create(data: {
    projectId: ProjectMember['projectId'];
    userId: ProjectMember['userId'];
    role: ProjectMember['role'];
  }): Promise<ProjectMember>;

  abstract update(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
    payload: Partial<ProjectMember>,
  ): Promise<NullableType<ProjectMember>>;

  abstract remove(
    projectId: ProjectMember['projectId'],
    userId: ProjectMember['userId'],
  ): Promise<void>;

  abstract countByProjectIdAndRole(
    projectId: string,
    role: string,
  ): Promise<number>;
}
