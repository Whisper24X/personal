import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Force a project runner image rebuild after saving, even when containerRuntime and runnerTemplate are unchanged',
  })
  @IsOptional()
  @IsBoolean()
  rebuildRunnerImage?: boolean;
}
