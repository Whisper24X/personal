import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ type: String })
  @IsUUID()
  businessLineId: string;

  @ApiProperty({ type: String, example: 'AINative Web' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: String,
    example: 'git@gitlab.yc345.tv:frontend/ainative.git',
  })
  @IsString()
  @IsNotEmpty()
  gitUrl: string;

  @ApiPropertyOptional({ type: String, default: 'main' })
  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Project execution config snapshot, including optional project-level containerRuntime overrides and runnerTemplate text files for project-specific runner images',
  })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}
