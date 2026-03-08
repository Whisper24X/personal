import { NullableType } from '../../../utils/types/nullable.type';
import { ProjectCustomRole } from '../../domain/project-custom-role';

export abstract class ProjectCustomRoleRepository {
  abstract findById(
    id: ProjectCustomRole['id'],
  ): Promise<NullableType<ProjectCustomRole>>;

  abstract findByIds(
    ids: ProjectCustomRole['id'][],
  ): Promise<ProjectCustomRole[]>;

  abstract findAllByBusinessLineId(
    businessLineId: ProjectCustomRole['businessLineId'],
  ): Promise<ProjectCustomRole[]>;

  abstract findByName(
    businessLineId: ProjectCustomRole['businessLineId'],
    name: ProjectCustomRole['name'],
  ): Promise<NullableType<ProjectCustomRole>>;

  abstract findByCode(
    businessLineId: ProjectCustomRole['businessLineId'],
    code: string,
  ): Promise<NullableType<ProjectCustomRole>>;

  abstract create(data: {
    businessLineId: ProjectCustomRole['businessLineId'];
    code: ProjectCustomRole['code'];
    name: ProjectCustomRole['name'];
    description?: ProjectCustomRole['description'];
    capabilities: ProjectCustomRole['capabilities'];
  }): Promise<ProjectCustomRole>;

  abstract update(
    id: ProjectCustomRole['id'],
    payload: Partial<ProjectCustomRole>,
  ): Promise<NullableType<ProjectCustomRole>>;

  abstract remove(id: ProjectCustomRole['id']): Promise<void>;
}
