import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TaskMode } from './task-mode.enum';
import { TaskConfigDto } from './task-config.dto';

export class CreateTaskDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Workspace-native 任务可直接传业务线，由后端解析内部执行项目',
  })
  @IsOptional()
  @IsUUID()
  businessLineId?: string;

  @ApiPropertyOptional({
    type: String,
    description: '所属需求（可选，由任务计划项新建任务时写入）',
  })
  @IsOptional()
  @IsUUID()
  goalId?: string;

  @ApiPropertyOptional({ enum: TaskMode, enumName: 'TaskMode' })
  @IsOptional()
  @IsEnum(TaskMode)
  mode?: TaskMode;

  @ApiProperty({ type: String, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
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
    description:
      'Worktree identifier; runtime path is derived from project config',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  gitWorktree?: string;

  @ApiPropertyOptional({
    type: TaskConfigDto,
    description: 'Task execution configuration',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskConfigDto)
  configJson?: TaskConfigDto;
}
