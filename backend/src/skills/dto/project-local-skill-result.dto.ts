import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectLocalSkillResultDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty({ type: String })
  directoryName: string;

  @ApiProperty({
    type: String,
    enum: ['codex', 'cursor', 'curso'],
  })
  provider: 'codex' | 'cursor' | 'curso';
}
