import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Mcp } from '../../domain/mcp';

export abstract class McpRepository {
  abstract create(
    data: Omit<Mcp, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Mcp>;

  abstract findById(id: Mcp['id']): Promise<NullableType<Mcp>>;

  abstract findByNameAndVersion({
    name,
    version,
  }: {
    name: Mcp['name'];
    version: Mcp['version'];
  }): Promise<NullableType<Mcp>>;

  abstract findAllWithPagination({
    paginationOptions,
    keyword,
    enabled,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    enabled?: boolean;
  }): Promise<Mcp[]>;

  abstract update(
    id: Mcp['id'],
    payload: Partial<Mcp>,
  ): Promise<NullableType<Mcp>>;

  abstract remove(id: Mcp['id']): Promise<void>;
}
