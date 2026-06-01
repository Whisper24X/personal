import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { AutomationStatus } from '../../domain/automation-status.enum';
import { Automation } from '../../domain/automation';

export abstract class AutomationRepository {
  abstract create(
    data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Automation>;

  abstract findById(id: Automation['id']): Promise<NullableType<Automation>>;

  abstract findByName(
    name: Automation['name'],
    projectId: Automation['projectId'],
  ): Promise<NullableType<Automation>>;

  abstract findAllWithPagination({
    paginationOptions,
    projectId,
    keyword,
    status,
  }: {
    paginationOptions: IPaginationOptions;
    projectId: Automation['projectId'];
    keyword?: string;
    status?: AutomationStatus;
  }): Promise<Automation[]>;

  abstract update(
    id: Automation['id'],
    payload: Partial<Automation>,
  ): Promise<NullableType<Automation>>;

  abstract remove(id: Automation['id']): Promise<void>;
}
