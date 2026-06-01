import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'memory_fact_signals' })
@Index('IDX_memory_fact_signals_project_dedup', ['projectId', 'dedupKey'], {
  unique: true,
})
export class MemoryFactSignalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 200 })
  dedupKey: string;

  @Column({ type: 'int', default: 0 })
  recallCount: number;

  @Column({ type: 'int', default: 0 })
  distinctQueryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
