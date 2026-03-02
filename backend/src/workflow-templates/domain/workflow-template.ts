import { ApiProperty } from '@nestjs/swagger';
import { WorkflowTemplateMode } from '../dto/workflow-template-mode.enum';
import { WorkflowTemplateScope } from '../dto/workflow-template-scope.enum';

export type WorkflowTemplateNode = {
  nodeOrder: number;
  name: string;
  type: string;
  requiresApproval?: boolean;
  input?: Record<string, unknown> | null;
};

export class WorkflowTemplate {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({
    enum: WorkflowTemplateMode,
    enumName: 'WorkflowTemplateMode',
  })
  mode: WorkflowTemplateMode;

  @ApiProperty({
    enum: WorkflowTemplateScope,
    enumName: 'WorkflowTemplateScope',
  })
  scope: WorkflowTemplateScope;

  @ApiProperty({ type: String, required: false, nullable: true })
  businessLineId?: string | null;

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({
    type: Number,
    default: 0,
    description: 'Latest published version number',
  })
  latestVersion: number;

  @ApiProperty({ type: Array, required: false })
  nodesJson: WorkflowTemplateNode[];

  @ApiProperty({ type: String, nullable: true, required: false })
  createdBy?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date | null;
}
