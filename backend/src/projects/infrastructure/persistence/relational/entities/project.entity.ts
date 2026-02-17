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

@Entity({
  name: 'projects',
})
export class ProjectEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_projects_business_line_id')
  @Column({ type: 'uuid' })
  businessLineId: string;

  @Index('IDX_projects_name')
  @Column({ type: String, length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text' })
  gitUrl: string;

  @Column({ type: String, length: 120, default: 'main' })
  defaultBranch: string;

  @Column({ type: 'jsonb', nullable: true })
  configJson?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
