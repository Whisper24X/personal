import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGoalDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    description: '从计划项新建 Task 时默认使用的工作流模板 ID',
  })
  @IsOptional()
  @IsUUID()
  defaultWorkflowTemplateId?: string;

  @ApiPropertyOptional({
    description:
      '生成 PRD/任务计划时默认使用的 Agent CLI 工具 ID（须与 agentCliConfigId 同时传或同时省略）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentCliId?: string;

  @ApiPropertyOptional({
    description:
      '生成 PRD/任务计划时默认使用的业务线 Agent 工具配置 ID（须与 agentCliId 同时传或同时省略）',
  })
  @IsOptional()
  @IsUUID()
  agentCliConfigId?: string;
}
