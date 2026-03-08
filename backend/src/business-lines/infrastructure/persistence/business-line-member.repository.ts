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
    role: BusinessLineMember['role'];
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

  abstract countByBusinessLineIdAndRole(
    businessLineId: string,
    role: string,
  ): Promise<number>;
}
