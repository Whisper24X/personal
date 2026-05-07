import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MemoryIngestJobStatus =
  | 'pending'
  | 'processing'
  | 'done'
  | 'failed';

@Entity({ name: 'memory_ingest_jobs' })
@Index('UQ_memory_ingest_jobs_idempotency', ['idempotencyKey'], {
  unique: true,
})
export class MemoryIngestJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  idempotencyKey: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'varchar', length: 32, default: 'task_done' })
  kind: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: MemoryIngestJobStatus;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
