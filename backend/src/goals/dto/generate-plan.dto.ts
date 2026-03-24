import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanGranularity } from './plan-granularity.enum';

export class GeneratePlanDto {
  @ApiPropertyOptional({ enum: PlanGranularity, enumName: 'PlanGranularity' })
  @IsOptional()
  @IsEnum(PlanGranularity)
  granularity?: PlanGranularity;

  @ApiPropertyOptional({ description: '覆盖已有拆解计划与计划项' })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;

  @ApiPropertyOptional({
    description:
      '业务线 Agent CLI 工具 ID（须与 agentCliConfigId 同时传；传则走与对话任务相同的 CLI 与工具配置）',
  })
  @IsOptional()
  @IsString()
  agentCliId?: string;

  @ApiPropertyOptional({
    description: '业务线 Agent 工具配置 ID（须与 agentCliId 同时传）',
  })
  @IsOptional()
  @IsString()
  agentCliConfigId?: string;
}
