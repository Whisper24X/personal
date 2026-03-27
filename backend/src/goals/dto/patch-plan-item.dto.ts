import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** 仅功能组（父级）字段；执行态在子任务上 */
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
}
