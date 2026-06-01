import { NullableType } from '../../../utils/types/nullable.type';
import { BusinessLineMember } from '../../domain/business-line-member';

export abstract class BusinessLineMemberRepository {
  abstract findByBusinessLineId(
    businessLineId: BusinessLineMember['businessLineId'],
  ): Promise<BusinessLineMember[]>;

  abstract findByUserId(
    userId: BusinessLineMember['userId'],
  ): Promise<BusinessLineMember[]>;

  abstract findByBusinessLineIdAndUserId(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
  ): Promise<NullableType<BusinessLineMember>>;

  abstract create(data: {
    businessLineId: BusinessLineMember['businessLineId'];
    userId: BusinessLineMember['userId'];
    roleId: BusinessLineMember['roleId'];
  }): Promise<BusinessLineMember>;

  abstract update(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
    payload: Partial<BusinessLineMember>,
  ): Promise<NullableType<BusinessLineMember>>;

  abstract remove(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
  ): Promise<void>;

  abstract countByBusinessLineIdAndRoleId(
    businessLineId: string,
    roleId: string,
  ): Promise<number>;
}
