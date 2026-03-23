import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskMode } from './task-mode.enum';

export class SuggestTaskTitleRequestDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ enum: TaskMode, enumName: 'TaskMode' })
  @IsEnum(TaskMode)
  mode!: TaskMode;

  @ApiProperty({ description: '任务说明，用于生成标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16000)
  prompt!: string;

  /** 对话模式：与创建任务时一致 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentCliId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentCliConfigId?: string;

  /** 工作流模式：与创建任务时一致 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workflowTemplateId?: string;
}

export class SuggestTaskTitleResponseDto {
  @ApiProperty({ description: '生成的任务标题（已截断至库表长度）' })
  title!: string;
}
