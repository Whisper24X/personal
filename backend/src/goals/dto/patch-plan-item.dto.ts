import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { GoalPlanItemStatus } from './goal-plan-item-status.enum';

export class PatchPlanItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suggestedPrompt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  dependsOnItemIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  itemOrder?: number;

  @ApiPropertyOptional({ enum: GoalPlanItemStatus, enumName: 'GoalPlanItemStatus' })
  @IsOptional()
  @IsEnum(GoalPlanItemStatus)
  status?: GoalPlanItemStatus;

  @ApiPropertyOptional({
    description: '物化该计划项时使用的项目工作流模板 ID',
  })
  @IsOptional()
  @IsUUID()
  workflowTemplateId?: string;
}
