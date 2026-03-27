import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TaskAttachmentConfigDto {
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size: number;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(255)
  type: string;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lastModified: number;
}

export class TaskConfigDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  workflowTemplateId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentCliId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  agentCliConfigId?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  loopEnabled?: boolean;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLoops?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Early-exit marker file name without extension',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  earlyExitMarkerFileName?: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  earlyExitMarkerEnabled?: boolean;

  @ApiPropertyOptional({ type: TaskAttachmentConfigDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentConfigDto)
  attachments?: TaskAttachmentConfigDto[];
}

export class TaskNodeConfigDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentCliId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  agentCliConfigId?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  loopEnabled?: boolean;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLoops?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Early-exit marker file name without extension',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  earlyExitMarkerFileName?: string;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  earlyExitMarkerEnabled?: boolean;
}
