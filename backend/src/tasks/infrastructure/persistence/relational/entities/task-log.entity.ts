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
})
export class TaskLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_task_logs_task_id')
  @Column({ type: 'uuid' })
  taskId: string;

  @Index('IDX_task_logs_task_node_id')
  @Column({ type: 'uuid', nullable: true })
  taskNodeId?: string | null;

  @Column({
    type: 'enum',
    enum: TaskLogLevel,
    enumName: 'task_log_level_enum',
    default: TaskLogLevel.info,
  })
  level: TaskLogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
