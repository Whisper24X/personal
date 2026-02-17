import { ApiProperty } from '@nestjs/swagger';
import { WorkflowTemplateMode } from '../dto/workflow-template-mode.enum';
import { WorkflowTemplateNode } from './workflow-template';

export class WorkflowTemplateVersion {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  templateId: string;

  @ApiProperty({ type: Number })
  version: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({
    enum: WorkflowTemplateMode,
    enumName: 'WorkflowTemplateMode',
  })
  mode: WorkflowTemplateMode;

  @ApiProperty({ type: Array })
  nodesJson: WorkflowTemplateNode[];

  @ApiProperty({ type: String, nullable: true, required: false })
  publishedBy?: string | null;

  @ApiProperty()
  createdAt: Date;
}
