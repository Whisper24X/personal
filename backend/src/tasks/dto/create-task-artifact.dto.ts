import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskArtifactType } from './task-artifact-type.enum';

export class CreateTaskArtifactDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  taskNodeId?: string;

  @ApiProperty({ enum: TaskArtifactType, enumName: 'TaskArtifactType' })
  @IsEnum(TaskArtifactType)
  artifactType: TaskArtifactType;

  @ApiProperty({ type: String })
  @IsString()
  name: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
