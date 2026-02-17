import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TaskMode } from './task-mode.enum';

export class CreateTaskDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  workflowTemplateId?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  workflowTemplateVersion?: number;

  @ApiPropertyOptional({ enum: TaskMode, enumName: 'TaskMode' })
  @IsOptional()
  @IsEnum(TaskMode)
  mode?: TaskMode;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: Array,
    description: 'Checklist or structured acceptance criteria',
  })
  @IsOptional()
  @IsArray()
  acceptanceCriteria?: unknown[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Template/skill/mcp resolved versions snapshot',
  })
  @IsOptional()
  @IsObject()
  toolVersionsSnapshot?: Record<string, unknown>;
}
