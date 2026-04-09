import { ApiProperty } from '@nestjs/swagger';

export class Project {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  businessLineId: string;

  @ApiProperty({ type: String, example: 'AINative Web' })
  name: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({
    type: String,
    example: 'git@gitlab.yc345.tv:frontend/ainative.git',
  })
  gitUrl: string;

  @ApiProperty({ type: String, example: 'main' })
  defaultBranch: string;

  @ApiProperty({
    type: Object,
    nullable: true,
    required: false,
    description:
      'Project execution configuration snapshot, including optional project-level containerRuntime env and runnerOrchestration settings for isolated containers',
  })
  configJson?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date | null;
}
