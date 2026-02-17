import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'mcps' })
@Index('IDX_mcps_name', ['name'])
@Index('IDX_mcps_enabled', ['enabled'])
@Index('UQ_mcps_name_version', ['name', 'version'], { unique: true })
export class McpEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: String, length: 120 })
  name: string;

  @Column({ type: String, length: 40 })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: String, length: 120, nullable: true })
  provider?: string | null;

  @Column({ type: 'integer', default: 0 })
  toolsCount: number;

  @Column({ type: 'jsonb', nullable: true })
  configSchema?: Record<string, unknown> | null;

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
