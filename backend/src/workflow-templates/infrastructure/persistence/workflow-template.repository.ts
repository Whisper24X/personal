import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { WorkflowTemplate } from '../../domain/workflow-template';

export abstract class WorkflowTemplateRepository {
  abstract create(
    data: Omit<
      WorkflowTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
    >,
  ): Promise<WorkflowTemplate>;

  abstract findById(
    id: WorkflowTemplate['id'],
  ): Promise<NullableType<WorkflowTemplate>>;

  abstract findByName(
    name: WorkflowTemplate['name'],
  ): Promise<NullableType<WorkflowTemplate>>;

  abstract findAllWithPagination({
    paginationOptions,
    keyword,
    isActive,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    isActive?: boolean;
  }): Promise<WorkflowTemplate[]>;

  abstract update(
    id: WorkflowTemplate['id'],
    payload: Partial<WorkflowTemplate>,
  ): Promise<NullableType<WorkflowTemplate>>;

  abstract remove(id: WorkflowTemplate['id']): Promise<void>;
}
