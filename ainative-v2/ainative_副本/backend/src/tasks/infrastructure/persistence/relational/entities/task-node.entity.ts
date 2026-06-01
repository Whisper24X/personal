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
import { TaskNodeStatus } from '../../../../dto/task-node-status.enum';
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

  @Column({
    name: 'agentCliId',
    type: String,
    length: 64,
    comment: 'Agent CLI ID',
  })
  agentCliId: string;

  @Column({
    name: 'agentCliConfigId',
    type: 'uuid',
    comment: 'Agent CLI配置ID',
  })
  agentCliConfigId: string;

  @Column({
    name: 'agentClioutput',
    type: 'text',
    nullable: true,
    comment: 'Agent CLI日志JSONL文件地址',
  })
  agentClioutput?: string | null;

  @Column({
    name: 'agentCliSessionId',
    type: 'text',
    nullable: true,
    comment: 'Agent CLI对话会话ID',
  })
  agentCliSessionId?: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: '节点配置JSON' })
  configJson?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, comment: '循环执行配置JSON' })
  loopJson?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, comment: '节点运行时临时状态JSON' })
  runtimeJson?: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '节点执行前记录的 Git HEAD commit SHA',
  })
  beforeRunCommitSha?: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '节点执行结束后记录的 Git HEAD commit SHA',
  })
  afterRunCommitSha?: string | null;

  @Index('IDX_task_nodes_status')
  @Column({
    type: 'enum',
    enum: TaskNodeStatus,
    enumName: 'task_node_status_enum',
    default: TaskNodeStatus.todo,
    comment: '节点状态',
  })
  status: TaskNodeStatus;

  @Column({ type: 'timestamp', nullable: true, comment: '节点执行开始时间' })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true, comment: '节点执行结束时间' })
  finishedAt?: Date | null;

  @ManyToOne(() => TaskEntity, {
    createForeignKeyConstraints: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
