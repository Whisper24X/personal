import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { ProjectMemberRole } from './project-member-role.enum';

export class CreateProjectMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
