import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  cliToolId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  agentToolConfigId?: string;

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
  cliToolId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  agentToolConfigId?: string;
}
