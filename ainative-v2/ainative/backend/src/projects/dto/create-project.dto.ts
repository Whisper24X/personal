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

  @ApiProperty({
    type: String,
    example: 'admin-console',
    description: '项目在 ainative-workspace 中的稳定标识（Git 分支片段）',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Project execution config snapshot, including optional project-level containerRuntime env and runnerOrchestration settings',
  })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}
