import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PROJECT_SKILL_PROVIDER_VALUES,
  type ProjectSkillProvider,
} from '../../utils/local-agent-catalog';

export class ProjectLocalSkillResultDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty({ type: String })
  directoryName: string;

  @ApiProperty({
    type: String,
    enum: PROJECT_SKILL_PROVIDER_VALUES,
  })
  provider: ProjectSkillProvider;
}
