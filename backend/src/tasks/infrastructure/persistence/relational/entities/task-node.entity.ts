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
import { TaskStatus } from '../../../../dto/task-status.enum';
import { TaskEntity } from './task.entity';

@Entity({
  name: 'task_nodes',
  comment: '任务执行节点',
})
@Unique('UQ_task_nodes_task_node_order', ['taskId', 'nodeOrder'])
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

  @Column({ type: 'jsonb', nullable: true, comment: '节点输入JSON' })
  input?: Record<string, unknown> | null;

  @Column({ type: String, length: 64, comment: 'CLI工具ID' })
  cliToolId: string;

  @Column({ type: 'uuid', comment: 'Agent工具配置ID' })
  agentToolConfigId: string;

  @Column({ type: 'text', nullable: true, comment: 'Agent CLI输出JSONL文件地址' })
  outputRef?: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: '节点运行时临时状态JSON' })
  runtimeJson?: Record<string, unknown> | null;

  @Index('IDX_task_nodes_status')
  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_node_status_enum',
    default: TaskStatus.todo,
    comment: '节点状态',
  })
  status: TaskStatus;

  @Column({ type: 'int', default: 0, comment: '重试次数' })
  attempt: number;

  @Column({ type: 'timestamp', nullable: true, comment: '节点执行开始时间' })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true, comment: '节点执行结束时间' })
  finishedAt?: Date | null;

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
