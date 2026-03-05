import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { WorkflowTemplate } from '../../domain/workflow-template';
import { WorkflowTemplateScope } from '../../dto/workflow-template-scope.enum';

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
    options?: {
      scope?: WorkflowTemplateScope;
      businessLineId?: string | null;
      projectId?: string | null;
    },
  ): Promise<NullableType<WorkflowTemplate>>;

  abstract findAllWithPagination({
    paginationOptions,
    keyword,
    isActive,
    scope,
    businessLineId,
    projectId,
    includeGlobal,
    excludeGlobal,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    isActive?: boolean;
    scope?: WorkflowTemplateScope;
    businessLineId?: string;
    projectId?: string;
    includeGlobal?: boolean;
    excludeGlobal?: boolean;
  }): Promise<WorkflowTemplate[]>;

  abstract update(
    id: WorkflowTemplate['id'],
    payload: Partial<WorkflowTemplate>,
  ): Promise<NullableType<WorkflowTemplate>>;

  abstract remove(id: WorkflowTemplate['id']): Promise<void>;
}
