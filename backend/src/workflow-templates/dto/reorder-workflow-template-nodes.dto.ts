import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { WorkflowTemplateNodeDto } from './workflow-template-node.dto';

export class ReorderWorkflowTemplateNodesDto {
  @ApiProperty({ type: [WorkflowTemplateNodeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowTemplateNodeDto)
  nodes: WorkflowTemplateNodeDto[];
}
