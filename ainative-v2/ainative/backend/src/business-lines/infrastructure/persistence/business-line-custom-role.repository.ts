import { NullableType } from '../../../utils/types/nullable.type';
import { BusinessLineCustomRole } from '../../domain/business-line-custom-role';

export abstract class BusinessLineCustomRoleRepository {
  abstract findById(
    id: BusinessLineCustomRole['id'],
  ): Promise<NullableType<BusinessLineCustomRole>>;

  abstract findByIds(
    ids: BusinessLineCustomRole['id'][],
  ): Promise<BusinessLineCustomRole[]>;

  abstract findAllByBusinessLineId(
    businessLineId: BusinessLineCustomRole['businessLineId'],
  ): Promise<BusinessLineCustomRole[]>;

  abstract findByName(
    businessLineId: BusinessLineCustomRole['businessLineId'],
    name: BusinessLineCustomRole['name'],
  ): Promise<NullableType<BusinessLineCustomRole>>;

  abstract create(data: {
    businessLineId: BusinessLineCustomRole['businessLineId'];
    name: BusinessLineCustomRole['name'];
    description?: BusinessLineCustomRole['description'];
    capabilities: BusinessLineCustomRole['capabilities'];
  }): Promise<BusinessLineCustomRole>;

  abstract update(
    id: BusinessLineCustomRole['id'],
    payload: Partial<BusinessLineCustomRole>,
  ): Promise<NullableType<BusinessLineCustomRole>>;

  abstract remove(id: BusinessLineCustomRole['id']): Promise<void>;
}
