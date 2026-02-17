import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Skill } from '../../domain/skill';

export abstract class SkillRepository {
  abstract create(
    data: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Skill>;

  abstract findById(id: Skill['id']): Promise<NullableType<Skill>>;

  abstract findByNameAndVersion({
    name,
    version,
  }: {
    name: Skill['name'];
    version: Skill['version'];
  }): Promise<NullableType<Skill>>;

  abstract findAllWithPagination({
    paginationOptions,
    keyword,
    enabled,
  }: {
    paginationOptions: IPaginationOptions;
    keyword?: string;
    enabled?: boolean;
  }): Promise<Skill[]>;

  abstract update(
    id: Skill['id'],
    payload: Partial<Skill>,
  ): Promise<NullableType<Skill>>;

  abstract remove(id: Skill['id']): Promise<void>;
}
