import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { BusinessLine } from '../../domain/business-line';

export abstract class BusinessLineRepository {
  abstract create(
    data: Omit<BusinessLine, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BusinessLine>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<BusinessLine[]>;

  abstract findById(
    id: BusinessLine['id'],
  ): Promise<NullableType<BusinessLine>>;

  abstract findByIds(ids: BusinessLine['id'][]): Promise<BusinessLine[]>;

  abstract findAllByIdsWithPagination({
    ids,
    paginationOptions,
  }: {
    ids: BusinessLine['id'][];
    paginationOptions: IPaginationOptions;
  }): Promise<BusinessLine[]>;

  abstract findByName(
    name: BusinessLine['name'],
  ): Promise<NullableType<BusinessLine>>;

  abstract findBySlug(
    slug: BusinessLine['slug'],
  ): Promise<NullableType<BusinessLine>>;

  abstract update(
    id: BusinessLine['id'],
    payload: Partial<BusinessLine>,
  ): Promise<BusinessLine | null>;

  abstract remove(id: BusinessLine['id']): Promise<void>;
}
