import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Workspace-native 需求可直接传业务线，由后端解析内部执行项目',
  })
  @IsOptional()
  @IsUUID()
  businessLineId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: '创建需求时在仓库中作为起点的 Git 基准分支（须已存在）',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  gitBaseBranch: string;

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
