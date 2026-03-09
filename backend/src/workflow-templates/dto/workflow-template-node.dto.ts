import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { WorkflowNodeType } from './workflow-node-type.enum';

export class WorkflowTemplateNodeDto {
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  nodeOrder: number;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: WorkflowNodeType, enumName: 'WorkflowNodeType' })
  @IsEnum(WorkflowNodeType)
  type: WorkflowNodeType;

  @ApiPropertyOptional({
    type: Object,
    description: 'Node input payload schema/data',
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
