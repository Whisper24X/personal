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
  comment: '工作流模板',
})
@Index('UQ_workflow_templates_global_name', ['name'], {
  unique: true,
  where: '"deletedAt" IS NULL AND "scope" = \'global\'',
})
@Index('UQ_workflow_templates_business_line_name', ['businessLineId', 'name'], {
  unique: true,
  where: '"deletedAt" IS NULL AND "scope" = \'business_line\'',
})
@Index('UQ_workflow_templates_project_name', ['projectId', 'name'], {
  unique: true,
  where: '"deletedAt" IS NULL AND "scope" = \'project\'',
})
export class WorkflowTemplateEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('IDX_workflow_templates_business_line_id')
  @Column({
    type: 'uuid',
    nullable: true,
    comment: '所属业务线ID（业务线作用域时填写）',
  })
  businessLineId?: string | null;

  @Index('IDX_workflow_templates_project_id')
  @Column({
    type: 'uuid',
    nullable: true,
    comment: '所属项目ID（项目作用域时填写）',
  })
  projectId?: string | null;

  @Index('IDX_workflow_templates_name')
  @Column({ type: String, length: 120, comment: '模板名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '模板描述' })
  description?: string | null;

  @Column({
    type: 'enum',
    enum: WorkflowTemplateMode,
    enumName: 'workflow_template_mode_enum',
    comment: '模板模式',
  })
  mode: WorkflowTemplateMode;

  @Column({
    type: 'enum',
    enum: WorkflowTemplateScope,
    enumName: 'workflow_template_scope_enum',
    default: WorkflowTemplateScope.global,
    comment: '模板作用域（全局/业务线/项目）',
  })
  scope: WorkflowTemplateScope;

  @Column({ type: 'boolean', default: true, comment: '模板是否启用' })
  isActive: boolean;

  @Column({ type: 'jsonb', comment: '模板工作流节点JSON' })
  nodesJson: WorkflowTemplateNode[];

  @Column({ type: 'uuid', nullable: true, comment: '创建者用户ID' })
  createdBy?: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date | null;
}
