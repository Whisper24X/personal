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

@Entity({ name: 'automations' })
@Index('IDX_automations_name', ['name'])
@Index('IDX_automations_status', ['status'])
@Index('IDX_automations_created_by', ['createdBy'])
@Index('UQ_automations_name', ['name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class AutomationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: String, length: 120 })
  name: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: String, length: 255 })
  rrule: string;

  @Column({ type: 'jsonb', nullable: true })
  cwds?: string[] | null;

  @Column({ type: String, length: 20, default: AutomationStatus.ACTIVE })
  status: AutomationStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  nextRunAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date | null;
}
