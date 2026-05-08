import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PROJECT_SKILL_PROVIDER_VALUES } from '../../utils/local-agent-catalog';

export class UploadProjectLocalSkillDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    enum: PROJECT_SKILL_PROVIDER_VALUES,
    description:
      'Target project CLI provider root. Defaults to first existing provider or cursor.',
  })
  @IsOptional()
  @IsIn([...PROJECT_SKILL_PROVIDER_VALUES])
  provider?: (typeof PROJECT_SKILL_PROVIDER_VALUES)[number];
}
