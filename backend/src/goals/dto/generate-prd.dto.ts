import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GeneratePrdDto {
  @ApiPropertyOptional({ description: '额外需求备注，会一并送入模型' })
  @IsOptional()
  @IsString()
  extraNotes?: string;

  @ApiPropertyOptional({
    description: '为 true 时若 PRD.md 已存在则覆盖写入',
    default: true,
  })
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
