import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Project } from '../../domain/project';

export abstract class ProjectRepository {
  abstract create(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Project>;

  abstract findById(id: Project['id']): Promise<NullableType<Project>>;

  abstract findByIds(ids: Project['id'][]): Promise<Project[]>;

  abstract findByBusinessLineIdAndName(
    businessLineId: Project['businessLineId'],
    name: Project['name'],
  ): Promise<NullableType<Project>>;

  abstract findAllWithPagination({
    paginationOptions,
    businessLineId,
    keyword,
  }: {
    paginationOptions: IPaginationOptions;
    businessLineId?: string;
    keyword?: string;
  }): Promise<Project[]>;

  abstract findAccessibleWithPagination({
    paginationOptions,
    projectIds,
    businessLineIds,
    keyword,
    businessLineId,
  }: {
    paginationOptions: IPaginationOptions;
    projectIds: string[];
    businessLineIds: string[];
    keyword?: string;
    businessLineId?: string;
  }): Promise<Project[]>;

  abstract update(
    id: Project['id'],
    payload: Partial<Project>,
  ): Promise<NullableType<Project>>;

  abstract remove(id: Project['id']): Promise<void>;
}
