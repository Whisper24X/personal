import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TaskLogLevel } from '../../../../dto/task-log-level.enum';

@Entity({
  name: 'task_logs',
  comment: '任务执行日志',
})
export class TaskLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_task_logs_task_id')
  @Column({ type: 'uuid', comment: '关联任务ID' })
  taskId: string;

  @Index('IDX_task_logs_task_node_id')
  @Column({ type: 'uuid', nullable: true, comment: '关联任务节点ID' })
  taskNodeId?: string | null;

  @Column({
    type: 'enum',
    enum: TaskLogLevel,
    enumName: 'task_log_level_enum',
    default: TaskLogLevel.info,
    comment: '日志级别',
  })
  level: TaskLogLevel;

  @Column({ type: 'text', comment: '日志消息内容' })
  message: string;

  @Column({ type: 'jsonb', nullable: true, comment: '结构化日志载荷JSON' })
  payload?: Record<string, unknown> | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
