import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({ type: Array })
  @IsOptional()
  @IsArray()
  acceptanceCriteria?: unknown[];

  @ApiPropertyOptional({
    type: String,
    description: 'Selected CLI tool id for this task',
  })
  @IsOptional()
  @IsString()
  cliToolId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Selected CLI config id for this task',
  })
  @IsOptional()
  @IsUUID()
  agentToolConfigId?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Template/skill/mcp resolved versions snapshot',
  })
  @IsOptional()
  @IsObject()
  toolVersionsSnapshot?: Record<string, unknown>;
}
