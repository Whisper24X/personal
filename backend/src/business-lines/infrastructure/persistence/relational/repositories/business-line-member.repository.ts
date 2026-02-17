import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessLineMemberRepository } from '../../business-line-member.repository';
import { BusinessLineMemberEntity } from '../entities/business-line-member.entity';
import { BusinessLineMember } from '../../../../domain/business-line-member';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { BusinessLineMemberMapper } from '../mappers/business-line-member.mapper';

@Injectable()
export class BusinessLineMemberRelationalRepository
  implements BusinessLineMemberRepository
{
  constructor(
    @InjectRepository(BusinessLineMemberEntity)
    private readonly businessLineMemberRepository: Repository<BusinessLineMemberEntity>,
  ) {}

  async findByBusinessLineId(
    businessLineId: BusinessLineMember['businessLineId'],
  ): Promise<BusinessLineMember[]> {
    const entities = await this.businessLineMemberRepository.find({
      where: { businessLineId },
      order: {
        createdAt: 'ASC',
      },
    });

    return entities.map((entity) => BusinessLineMemberMapper.toDomain(entity));
  }

  async findByUserId(
    userId: BusinessLineMember['userId'],
  ): Promise<BusinessLineMember[]> {
    const entities = await this.businessLineMemberRepository.find({
      where: { userId },
      order: {
        createdAt: 'ASC',
      },
    });

    return entities.map((entity) => BusinessLineMemberMapper.toDomain(entity));
  }

  async findByBusinessLineIdAndUserId(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
  ): Promise<NullableType<BusinessLineMember>> {
    const entity = await this.businessLineMemberRepository.findOne({
      where: {
        businessLineId,
        userId,
      },
    });

    return entity ? BusinessLineMemberMapper.toDomain(entity) : null;
  }

  async create(data: {
    businessLineId: BusinessLineMember['businessLineId'];
    userId: BusinessLineMember['userId'];
    role: BusinessLineMember['role'];
  }): Promise<BusinessLineMember> {
    const newEntity = await this.businessLineMemberRepository.save(
      this.businessLineMemberRepository.create({
        businessLineId: data.businessLineId,
        userId: data.userId,
        role: data.role,
      }),
    );

    return BusinessLineMemberMapper.toDomain(newEntity);
  }

  async update(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
    payload: Partial<BusinessLineMember>,
  ): Promise<NullableType<BusinessLineMember>> {
    const entity = await this.businessLineMemberRepository.findOne({
      where: {
        businessLineId,
        userId,
      },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.businessLineMemberRepository.save(
      this.businessLineMemberRepository.create({
        ...entity,
        role: payload.role ?? entity.role,
      }),
    );

    return BusinessLineMemberMapper.toDomain(updatedEntity);
  }

  async remove(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
  ): Promise<void> {
    await this.businessLineMemberRepository.delete({
      businessLineId,
      userId,
    });
  }
}
