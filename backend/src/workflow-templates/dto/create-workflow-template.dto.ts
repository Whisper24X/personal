import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowTemplateMode } from './workflow-template-mode.enum';
import { WorkflowTemplateNodeDto } from './workflow-template-node.dto';

export class CreateWorkflowTemplateDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: WorkflowTemplateMode,
    enumName: 'WorkflowTemplateMode',
  })
  @IsEnum(WorkflowTemplateMode)
  mode: WorkflowTemplateMode;

  @ApiProperty({ type: [WorkflowTemplateNodeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowTemplateNodeDto)
  nodes: WorkflowTemplateNodeDto[];

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  isActive?: boolean;
}
