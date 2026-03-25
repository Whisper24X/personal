import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { GoalStatus } from './goal-status.enum';

export class FindGoalsDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsNumber()
  limit?: number;

  @ApiProperty({ description: '项目 ID' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ enum: GoalStatus, enumName: 'GoalStatus' })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({ description: '标题模糊搜索' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
