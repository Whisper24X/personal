import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'skills' })
@Index('IDX_skills_name', ['name'])
@Index('IDX_skills_enabled', ['enabled'])
@Index('UQ_skills_name_version', ['name', 'version'], { unique: true })
export class SkillEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: String, length: 120 })
  name: string;

  @Column({ type: String, length: 40 })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: String, length: 60, nullable: true })
  scope?: string | null;

  @Column({ type: String, length: 255, nullable: true })
  homepageUrl?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date | null;
}
