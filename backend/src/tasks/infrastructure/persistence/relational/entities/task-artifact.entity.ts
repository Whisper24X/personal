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
  comment: '任务执行产生的工件',
})
export class TaskArtifactEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_task_artifacts_task_id')
  @Column({ type: 'uuid', comment: '关联任务ID' })
  taskId: string;

  @Index('IDX_task_artifacts_task_node_id')
  @Column({ type: 'uuid', nullable: true, comment: '关联任务节点ID' })
  taskNodeId?: string | null;

  @Column({
    type: 'enum',
    enum: TaskArtifactType,
    enumName: 'task_artifact_type_enum',
    comment: '工件类型',
  })
  artifactType: TaskArtifactType;

  @Column({ type: String, length: 200, comment: '工件名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '工件下载地址' })
  downloadUrl?: string | null;

  @Column({ type: 'text', nullable: true, comment: '内联工件内容' })
  content?: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: '工件元数据JSON' })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
