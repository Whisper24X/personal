import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
  prompt?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  gitBranch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  gitBaseBranch?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Worktree identifier; runtime path is derived from project config',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  gitWorktree?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cliToolId?: string;

  @ApiPropertyOptional({ type: String })
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
