import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  gitBranch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  gitBaseBranch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  gitWorktree?: string;

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
    description: 'Task input snapshot (attachments and mode metadata)',
  })
  @IsOptional()
  @IsObject()
  clientInputSnapshot?: Record<string, unknown>;
}
