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
  comment: '任务执行节点',
})
@Unique('UQ_task_nodes_task_node_order', ['taskId', 'nodeOrder'])
@Index('IDX_task_nodes_status_lease_until', ['status', 'leaseUntil'])
@Index('IDX_task_nodes_task_status_order', ['taskId', 'status', 'nodeOrder'])
@Index('UQ_task_nodes_single_in_progress', ['taskId'], {
  unique: true,
  where: '"status" = \'in_progress\'',
})
export class TaskNodeEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_task_nodes_task_id')
  @Column({ type: 'uuid', comment: '关联任务ID' })
  taskId: string;

  @Column({ type: 'int', comment: '节点在任务中的顺序' })
  nodeOrder: number;

  @Column({ type: String, length: 160, comment: '节点名称' })
  name: string;

  @Column({
    type: 'enum',
    enum: TaskNodeType,
    enumName: 'task_node_type_enum',
    comment: '节点类型',
  })
  nodeType: TaskNodeType;

  @Column({ type: 'jsonb', nullable: true, comment: '节点输入JSON' })
  input?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, comment: '节点输出JSON' })
  output?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false, comment: '节点是否需要人工审批' })
  requiresApproval: boolean;

  @Index('IDX_task_nodes_status')
  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status_enum',
    default: TaskStatus.todo,
    comment: '节点状态',
  })
  status: TaskStatus;

  @Column({ type: 'int', default: 0, comment: '重试次数' })
  attempt: number;

  @Column({ type: String, length: 120, nullable: true, comment: '错误码' })
  errorCode?: string | null;

  @Column({ type: 'text', nullable: true, comment: '错误详情' })
  errorMessage?: string | null;

  @Column({ type: 'timestamp', nullable: true, comment: '节点执行开始时间' })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true, comment: '节点执行结束时间' })
  finishedAt?: Date | null;

  @Column({
    type: String,
    length: 120,
    nullable: true,
    comment: '持有租约的工作进程ID',
  })
  workerId?: string | null;

  @Column({ type: 'timestamp', nullable: true, comment: '租约过期时间' })
  leaseUntil?: Date | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '最近工作进程心跳时间',
  })
  heartbeatAt?: Date | null;

  @ManyToOne(() => TaskEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
