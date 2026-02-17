import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectMemberRole } from './project-member-role.enum';

export class UpdateProjectMemberDto {
  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
