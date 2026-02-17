import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'notification_events',
})
export class NotificationEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_notification_events_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  @Index('IDX_notification_events_task_id')
  @Column({ type: 'uuid', nullable: true })
  taskId?: string | null;

  @Column({ type: String, length: 120 })
  eventType: string;

  @Column({ type: String, length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Index('IDX_notification_events_read_at')
  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
