import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { WorkflowTemplateMode } from '../../../../dto/workflow-template-mode.enum';
import { WorkflowTemplateNode } from '../../../../domain/workflow-template';
import { WorkflowTemplateEntity } from './workflow-template.entity';

@Entity({
  name: 'workflow_template_versions',
})
@Unique('UQ_workflow_template_version_unique', ['templateId', 'version'])
export class WorkflowTemplateVersionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_workflow_template_versions_template_id')
  @Column({ type: 'uuid' })
  templateId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: String, length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({
    type: 'enum',
    enum: WorkflowTemplateMode,
    enumName: 'workflow_template_mode_enum',
  })
  mode: WorkflowTemplateMode;

  @Column({ type: 'jsonb' })
  nodesJson: WorkflowTemplateNode[];

  @Column({ type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => WorkflowTemplateEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: WorkflowTemplateEntity;

  @CreateDateColumn()
  createdAt: Date;
}
