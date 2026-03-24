import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'notification_settings',
  comment: '用户通知偏好设置',
})
export class NotificationSettingEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('UQ_notification_settings_user_id', { unique: true })
  @Column({ type: 'uuid', comment: '关联用户ID' })
  userId: string;

  @Column({ type: 'boolean', default: false, comment: '是否启用Webhook通知' })
  webhookEnabled: boolean;

  @Column({ type: 'text', nullable: true, comment: '回调地址' })
  webhookUrl?: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '飞书等平台 Webhook 签名密钥',
  })
  webhookSecret?: string | null;

  @Column({ type: 'boolean', default: true, comment: '是否启用浏览器通知' })
  browserEnabled: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
