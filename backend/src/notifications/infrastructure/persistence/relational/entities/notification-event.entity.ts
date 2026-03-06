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
  comment: '用户通知事件',
})
export class NotificationEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_notification_events_user_id')
  @Column({ type: 'uuid', comment: '目标用户ID' })
  userId: string;

  @Index('IDX_notification_events_task_id')
  @Column({ type: 'uuid', nullable: true, comment: '关联任务ID' })
  taskId?: string | null;

  @Column({ type: String, length: 120, comment: '通知事件类型' })
  eventType: string;

  @Column({ type: String, length: 200, comment: '通知标题' })
  title: string;

  @Column({ type: 'text', comment: '通知内容' })
  content: string;

  @Column({ type: 'jsonb', nullable: true, comment: '通知载荷JSON' })
  payload?: Record<string, unknown> | null;

  @Index('IDX_notification_events_read_at')
  @Column({ type: 'timestamp', nullable: true, comment: '已读时间' })
  readAt?: Date | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
