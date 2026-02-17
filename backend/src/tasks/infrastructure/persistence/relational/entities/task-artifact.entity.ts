import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TaskArtifactType } from '../../../../dto/task-artifact-type.enum';

@Entity({
  name: 'task_artifacts',
})
export class TaskArtifactEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_task_artifacts_task_id')
  @Column({ type: 'uuid' })
  taskId: string;

  @Index('IDX_task_artifacts_task_node_id')
  @Column({ type: 'uuid', nullable: true })
  taskNodeId?: string | null;

  @Column({
    type: 'enum',
    enum: TaskArtifactType,
    enumName: 'task_artifact_type_enum',
  })
  artifactType: TaskArtifactType;

  @Column({ type: String, length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  downloadUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
