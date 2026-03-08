import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProjectMemberRole } from './project-member-role.enum';

export class CreateProjectMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  userId: string;

  @ApiProperty({ type: String, default: ProjectMemberRole.developer })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role: string;
}
