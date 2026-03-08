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
      relations: { roleRef: true },
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => BusinessLineMemberMapper.toDomain(entity));
  }

  async findByUserId(
    userId: BusinessLineMember['userId'],
  ): Promise<BusinessLineMember[]> {
    const entities = await this.businessLineMemberRepository.find({
      where: { userId },
      relations: { roleRef: true },
      order: { createdAt: 'ASC' },
    });

    return entities.map((entity) => BusinessLineMemberMapper.toDomain(entity));
  }

  async findByBusinessLineIdAndUserId(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
  ): Promise<NullableType<BusinessLineMember>> {
    const entity = await this.businessLineMemberRepository.findOne({
      where: { businessLineId, userId },
      relations: { roleRef: true },
    });

    return entity ? BusinessLineMemberMapper.toDomain(entity) : null;
  }

  async create(data: {
    businessLineId: BusinessLineMember['businessLineId'];
    userId: BusinessLineMember['userId'];
    roleId: BusinessLineMember['roleId'];
  }): Promise<BusinessLineMember> {
    const newEntity = await this.businessLineMemberRepository.save(
      this.businessLineMemberRepository.create({
        businessLineId: data.businessLineId,
        userId: data.userId,
        roleId: data.roleId,
      }),
    );

    const entity = await this.businessLineMemberRepository.findOneOrFail({
      where: { id: newEntity.id },
      relations: { roleRef: true },
    });

    return BusinessLineMemberMapper.toDomain(entity);
  }

  async update(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
    payload: Partial<BusinessLineMember>,
  ): Promise<NullableType<BusinessLineMember>> {
    const entity = await this.businessLineMemberRepository.findOne({
      where: { businessLineId, userId },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.businessLineMemberRepository.save(
      this.businessLineMemberRepository.create({
        ...entity,
        roleId: payload.roleId ?? entity.roleId,
      }),
    );

    const nextEntity = await this.businessLineMemberRepository.findOneOrFail({
      where: { id: updatedEntity.id },
      relations: { roleRef: true },
    });

    return BusinessLineMemberMapper.toDomain(nextEntity);
  }

  async remove(
    businessLineId: BusinessLineMember['businessLineId'],
    userId: BusinessLineMember['userId'],
  ): Promise<void> {
    await this.businessLineMemberRepository.delete({ businessLineId, userId });
  }

  async countByBusinessLineIdAndRoleId(
    businessLineId: string,
    roleId: string,
  ): Promise<number> {
    return this.businessLineMemberRepository.count({
      where: { businessLineId, roleId },
    });
  }
}
