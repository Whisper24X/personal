import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberRole } from '../dto/project-member-role.enum';

export class ProjectMember {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  role: ProjectMemberRole;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
