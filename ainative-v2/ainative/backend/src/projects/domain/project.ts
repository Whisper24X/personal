import { ApiProperty } from '@nestjs/swagger';
import { RepositoryProvisioningStatus } from './repository-provisioning-status.enum';

export class Project {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  businessLineId: string;

  @ApiProperty({ type: String, example: 'AINative Web' })
  name: string;

  @ApiProperty({
    type: String,
    example: 'admin-console',
    description: '项目在 ainative-workspace 中的稳定标识',
  })
  slug: string;

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
      'Project execution configuration snapshot, including optional project-level containerRuntime env and runnerOrchestration settings for isolated containers. Optional `runnerWorkingSubdirectory` (relative to the task Git worktree root) sets the agent process cwd inside the runner container when using docker exec.',
  })
  configJson?: Record<string, unknown> | null;

  @ApiProperty({
    enum: RepositoryProvisioningStatus,
    description: 'Repository provisioning state for local workspace clone',
    example: RepositoryProvisioningStatus.Ready,
  })
  repositoryProvisioningStatus?: RepositoryProvisioningStatus;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description:
      'Latest repository provisioning failure message, when status is failed',
  })
  repositoryProvisioningError?: string | null;

  @ApiProperty({
    type: Date,
    required: false,
    nullable: true,
    description: 'Timestamp when repository provisioning last succeeded',
  })
  repositoryProvisionedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date | null;
}
