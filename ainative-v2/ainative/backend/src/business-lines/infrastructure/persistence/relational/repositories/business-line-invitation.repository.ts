import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { BusinessLineInvitationRepository } from '../../business-line-invitation.repository';
import { BusinessLineInvitationEntity } from '../entities/business-line-invitation.entity';
import { BusinessLineInvitation } from '../../../../domain/business-line-invitation';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { BusinessLineInvitationMapper } from '../mappers/business-line-invitation.mapper';

@Injectable()
export class BusinessLineInvitationRelationalRepository
  implements BusinessLineInvitationRepository
{
  constructor(
    @InjectRepository(BusinessLineInvitationEntity)
    private readonly businessLineInvitationRepository: Repository<BusinessLineInvitationEntity>,
  ) {}

  async findLatestActiveByBusinessLineId(
    businessLineId: BusinessLineInvitation['businessLineId'],
    now: Date,
  ): Promise<NullableType<BusinessLineInvitation>> {
    const entity = await this.businessLineInvitationRepository.findOne({
      where: { businessLineId, revokedAt: IsNull(), expiresAt: MoreThan(now) },
      relations: { roleRef: true },
      order: { createdAt: 'DESC' },
    });

    return entity ? BusinessLineInvitationMapper.toDomain(entity) : null;
  }

  async findActiveByToken(
    token: BusinessLineInvitation['token'],
    now: Date,
  ): Promise<NullableType<BusinessLineInvitation>> {
    const entity = await this.businessLineInvitationRepository.findOne({
      where: { token, revokedAt: IsNull(), expiresAt: MoreThan(now) },
      relations: { roleRef: true },
    });

    return entity ? BusinessLineInvitationMapper.toDomain(entity) : null;
  }

  async revokeActiveByBusinessLineId(
    businessLineId: BusinessLineInvitation['businessLineId'],
    now: Date,
  ): Promise<void> {
    await this.businessLineInvitationRepository
      .createQueryBuilder()
      .update(BusinessLineInvitationEntity)
      .set({ revokedAt: now })
      .where('"businessLineId" = :businessLineId', { businessLineId })
      .andWhere('"revokedAt" IS NULL')
      .execute();
  }

  async create(data: {
    businessLineId: BusinessLineInvitation['businessLineId'];
    token: BusinessLineInvitation['token'];
    roleId: BusinessLineInvitation['roleId'];
    projectRoles: BusinessLineInvitation['projectRoles'];
    createdBy: BusinessLineInvitation['createdBy'];
    expiresAt: BusinessLineInvitation['expiresAt'];
  }): Promise<BusinessLineInvitation> {
    const saved = await this.businessLineInvitationRepository.save(
      this.businessLineInvitationRepository.create({
        businessLineId: data.businessLineId,
        token: data.token,
        roleId: data.roleId,
        projectRoles: data.projectRoles,
        createdBy: data.createdBy,
        expiresAt: data.expiresAt,
        revokedAt: null,
      }),
    );

    const entity = await this.businessLineInvitationRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { roleRef: true },
    });

    return BusinessLineInvitationMapper.toDomain(entity);
  }

  async countActiveByBusinessLineIdAndRoleId(
    businessLineId: string,
    roleId: string,
    now: Date,
  ): Promise<number> {
    return this.businessLineInvitationRepository.count({
      where: {
        businessLineId,
        roleId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
  }
}
