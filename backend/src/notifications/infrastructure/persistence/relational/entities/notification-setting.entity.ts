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
})
export class NotificationSettingEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_notification_settings_user_id', { unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean', default: true })
  emailEnabled: boolean;

  @Column({ type: String, length: 255, nullable: true })
  emailAddress?: string | null;

  @Column({ type: 'boolean', default: false })
  webhookEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  webhookUrl?: string | null;

  @Column({ type: 'boolean', default: true })
  browserEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
