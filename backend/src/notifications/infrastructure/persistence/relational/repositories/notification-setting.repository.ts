import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { NotificationSetting } from '../../../../domain/notification-setting';
import { NotificationSettingRepository } from '../../notification-setting.repository';
import { NotificationSettingEntity } from '../entities/notification-setting.entity';
import { NotificationSettingMapper } from '../mappers/notification-setting.mapper';

@Injectable()
export class NotificationSettingRelationalRepository
  implements NotificationSettingRepository
{
  constructor(
    @InjectRepository(NotificationSettingEntity)
    private readonly notificationSettingRepository: Repository<NotificationSettingEntity>,
  ) {}

  async findByUserId(
    userId: NotificationSetting['userId'],
  ): Promise<NullableType<NotificationSetting>> {
    const entity = await this.notificationSettingRepository.findOne({
      where: { userId },
    });

    return entity ? NotificationSettingMapper.toDomain(entity) : null;
  }

  async create(
    data: Omit<NotificationSetting, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationSetting> {
    const entity = await this.notificationSettingRepository.save(
      this.notificationSettingRepository.create({
        userId: data.userId,
        emailEnabled: data.emailEnabled,
        emailAddress: data.emailAddress,
        webhookEnabled: data.webhookEnabled,
        webhookUrl: data.webhookUrl,
        browserEnabled: data.browserEnabled,
      }),
    );

    return NotificationSettingMapper.toDomain(entity);
  }

  async update(
    id: NotificationSetting['id'],
    payload: Partial<NotificationSetting>,
  ): Promise<NullableType<NotificationSetting>> {
    const entity = await this.notificationSettingRepository.findOne({
      where: { id },
    });

    if (!entity) {
      return null;
    }

    const updatedEntity = await this.notificationSettingRepository.save(
      this.notificationSettingRepository.create(
        NotificationSettingMapper.toPersistence({
          ...NotificationSettingMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return NotificationSettingMapper.toDomain(updatedEntity);
  }
}
