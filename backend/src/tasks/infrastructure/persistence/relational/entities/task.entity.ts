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
})
export class TaskEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_tasks_project_id')
  @Column({ type: 'uuid' })
  projectId: string;

  @Index('IDX_tasks_workflow_template_id')
  @Column({ type: 'uuid', nullable: true })
  workflowTemplateId?: string | null;

  @Column({
    type: 'enum',
    enum: TaskMode,
    enumName: 'task_mode_enum',
  })
  mode: TaskMode;

  @Column({ type: String, length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  acceptanceCriteria?: unknown[] | null;

  @Index('IDX_tasks_status')
  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status_enum',
    default: TaskStatus.todo,
  })
  status: TaskStatus;

  @Column({ type: String, length: 120, nullable: true })
  branch?: string | null;

  @Column({ type: String, length: 120, nullable: true })
  gitBaseBranch?: string | null;

  @Column({ type: String, length: 500, nullable: true })
  gitWorktreePath?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sandboxCleanupAt?: Date | null;

  @Column({ type: String, length: 120, nullable: true })
  environment?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  toolVersionsSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
