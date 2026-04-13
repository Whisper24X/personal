import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
    type: Boolean,
    description: 'Whether node execution requires manual approval',
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Whether node execution requires at least one artifact before auto-advance',
  })
  @IsOptional()
  @IsBoolean()
  requiresArtifact?: boolean;

  @ApiPropertyOptional({
    type: Object,
    description: 'Node input payload schema/data',
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
