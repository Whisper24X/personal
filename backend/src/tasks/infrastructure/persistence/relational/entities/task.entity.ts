import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TaskMode } from '../../../../dto/task-mode.enum';
import { TaskStatus } from '../../../../dto/task-status.enum';

@Entity({
  name: 'tasks',
  comment: '执行任务',
})
@Index('UQ_tasks_git_worktree', ['gitWorktree'], {
  unique: true,
  where: '"gitWorktree" IS NOT NULL',
})
export class TaskEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_tasks_business_line_id')
  @Column({ type: 'uuid', comment: '所属业务线ID' })
  businessLineId: string;

  @Index('IDX_tasks_project_id')
  @Column({ type: 'uuid', comment: '关联项目ID' })
  projectId: string;

  @Index('IDX_tasks_workflow_template_id')
  @Column({ type: 'uuid', nullable: true, comment: '关联工作流模板ID' })
  workflowTemplateId?: string | null;

  @Column({
    type: 'enum',
    enum: TaskMode,
    enumName: 'task_mode_enum',
    comment: '任务模式',
  })
  mode: TaskMode;

  @Column({ type: String, length: 160, comment: '任务标题' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '任务提示词' })
  prompt?: string | null;

  @Index('IDX_tasks_status')
  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status_enum',
    default: TaskStatus.todo,
    comment: '任务状态',
  })
  status: TaskStatus;

  @Column({
    type: String,
    length: 120,
    nullable: true,
    comment: '任务Git分支名称',
  })
  gitBranch?: string | null;

  @Column({
    type: String,
    length: 120,
    nullable: true,
    comment: '任务工作树基线分支',
  })
  gitBaseBranch?: string | null;

  @Column({
    type: String,
    length: 500,
    nullable: true,
    comment: '任务Git工作树名称/标识（运行时路径可推导）',
  })
  gitWorktree?: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: '客户端输入快照JSON' })
  clientInputSnapshot?: Record<string, unknown> | null;

  @Column({ type: String, length: 64, nullable: true, comment: 'CLI工具标识' })
  cliToolId?: string | null;

  @Column({ type: 'uuid', nullable: true, comment: '关联工具配置ID' })
  agentToolConfigId?: string | null;

  @Column({ type: 'uuid', nullable: true, comment: '创建者用户ID' })
  createdBy?: string | null;

  @Column({ type: 'timestamp', nullable: true, comment: '任务执行开始时间' })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true, comment: '任务执行结束时间' })
  finishedAt?: Date | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date | null;
}
