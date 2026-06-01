import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadLocalSkillResultDto {
  @ApiProperty({ type: String, example: 'code-review' })
  name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Analyze code quality and suggest fixes',
  })
  description?: string | null;

  @ApiProperty({ type: String, example: 'code-review' })
  directoryName: string;
}
