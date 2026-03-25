import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { GoalStatus } from './goal-status.enum';

export class UpdateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ enum: GoalStatus, enumName: 'GoalStatus' })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultWorkflowTemplateId?: string;

  @ApiPropertyOptional({
    description:
      '生成 PRD/拆解计划时默认使用的 Agent CLI 工具 ID（须与 agentCliConfigId 同时传或同时省略）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentCliId?: string;

  @ApiPropertyOptional({
    description:
      '生成 PRD/拆解计划时默认使用的业务线 Agent 工具配置 ID（须与 agentCliId 同时传或同时省略）',
  })
  @IsOptional()
  @IsUUID()
  agentCliConfigId?: string;
}
