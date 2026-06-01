import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

const SKILL_PROVIDER_VALUES = [
  'codex',
  'cursor',
  'curso',
  'gemini',
  'opencode',
  'claude',
] as const;

export class UploadProjectLocalSkillDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    enum: SKILL_PROVIDER_VALUES,
    description:
      'Target project CLI provider root. Defaults to first existing provider or cursor.',
  })
  @IsOptional()
  @IsIn(SKILL_PROVIDER_VALUES)
  provider?: (typeof SKILL_PROVIDER_VALUES)[number];
}
