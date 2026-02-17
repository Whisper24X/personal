import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TaskNodeType } from '../../../../dto/task-node-type.enum';
import { TaskStatus } from '../../../../dto/task-status.enum';
import { TaskEntity } from './task.entity';

@Entity({
  name: 'task_nodes',
})
@Unique('UQ_task_nodes_task_node_order', ['taskId', 'nodeOrder'])
@Index('IDX_task_nodes_status_lease_until', ['status', 'leaseUntil'])
@Index('IDX_task_nodes_task_status_order', ['taskId', 'status', 'nodeOrder'])
export class TaskNodeEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_task_nodes_task_id')
  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'int' })
  nodeOrder: number;

  @Column({ type: String, length: 160 })
  name: string;

  @Column({
    type: 'enum',
    enum: TaskNodeType,
    enumName: 'task_node_type_enum',
  })
  nodeType: TaskNodeType;

  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  output?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  requiresApproval: boolean;

  @Index('IDX_task_nodes_status')
  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status_enum',
    default: TaskStatus.todo,
  })
  status: TaskStatus;

  @Column({ type: 'int', default: 0 })
  attempt: number;

  @Column({ type: String, length: 120, nullable: true })
  errorCode?: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt?: Date | null;

  @Column({ type: String, length: 120, nullable: true })
  workerId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  leaseUntil?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  heartbeatAt?: Date | null;

  @ManyToOne(() => TaskEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
