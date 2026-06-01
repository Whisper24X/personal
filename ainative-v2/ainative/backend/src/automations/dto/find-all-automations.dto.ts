import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AutomationStatus } from '../domain/automation-status.enum';

export class FindAllAutomationsDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ type: Number })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ type: Number })
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    enum: AutomationStatus,
    enumName: 'AutomationStatus',
  })
  @IsOptional()
  @IsEnum(AutomationStatus)
  status?: AutomationStatus;
}
