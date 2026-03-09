import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TaskConfigDto } from './task-config.dto';

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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  workflowTemplateId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Deprecated top-level task config field; prefer configJson.cliToolId',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cliToolId?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Deprecated top-level task config field; prefer configJson.agentToolConfigId',
  })
  @IsOptional()
  @IsUUID()
  agentToolConfigId?: string;

  @ApiPropertyOptional({
    type: TaskConfigDto,
    description: 'Task execution configuration',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskConfigDto)
  configJson?: TaskConfigDto;

}
