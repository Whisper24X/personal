import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AutomationStatus } from '../domain/automation-status.enum';

export class CreateAutomationDto {
  @ApiProperty({ type: String, example: 'Daily queue digest' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    type: String,
    example: 'Summarize queue health and notify owners.',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    type: String,
    example: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  rrule: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['/workspace/ainative/backend', '/workspace/ainative/frontend'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  cwds?: string[];

  @ApiPropertyOptional({
    enum: AutomationStatus,
    enumName: 'AutomationStatus',
    default: AutomationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AutomationStatus)
  status?: AutomationStatus;
}
