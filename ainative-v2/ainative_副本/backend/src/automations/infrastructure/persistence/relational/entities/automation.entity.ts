import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AutomationStatus } from '../../../../domain/automation-status.enum';

@Entity({ name: 'automations', comment: '定时自动化定义' })
@Index('IDX_automations_project_id', ['projectId'])
@Index('IDX_automations_name', ['name'])
@Index('IDX_automations_status', ['status'])
@Index('IDX_automations_created_by', ['createdBy'])
@Index('UQ_automations_project_name', ['projectId', 'name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class AutomationEntity {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Column({ type: 'uuid', comment: '所属项目ID' })
  projectId: string;

  @Column({ type: String, length: 120, comment: '自动化名称' })
  name: string;

  @Column({ type: 'text', comment: '自动化提示词内容' })
  prompt: string;

  @Column({ type: String, length: 255, comment: '自动化调度规则' })
  rrule: string;

  @Column({ type: 'jsonb', nullable: true, comment: '工作目录列表(JSON)' })
  cwds?: string[] | null;

  @Column({
    type: String,
    length: 20,
    default: AutomationStatus.ACTIVE,
    comment: '自动化状态',
  })
  status: AutomationStatus;

  @Column({ type: 'timestamp', nullable: true, comment: '最近执行时间' })
  lastRunAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true, comment: '下次执行时间' })
  nextRunAt?: Date | null;

  @Column({ type: 'uuid', nullable: true, comment: '创建者用户ID' })
  createdBy?: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt?: Date | null;
}
