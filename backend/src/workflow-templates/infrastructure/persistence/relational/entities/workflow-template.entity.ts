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
import { WorkflowTemplateMode } from '../../../../dto/workflow-template-mode.enum';
import { WorkflowTemplateScope } from '../../../../dto/workflow-template-scope.enum';
import { WorkflowTemplateNode } from '../../../../domain/workflow-template';

@Entity({
  name: 'workflow_templates',
})
export class WorkflowTemplateEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_workflow_templates_name')
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

  @Column({
    type: 'enum',
    enum: WorkflowTemplateScope,
    enumName: 'workflow_template_scope_enum',
    default: WorkflowTemplateScope.global,
  })
  scope: WorkflowTemplateScope;

  @Index('IDX_workflow_templates_business_line_id')
  @Column({ type: 'uuid', nullable: true })
  businessLineId?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb' })
  nodesJson: WorkflowTemplateNode[];

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
