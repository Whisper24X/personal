import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessLineMemberRole } from '../../business-lines/dto/business-line-member-role.enum';
import { ProjectMemberRole } from '../../projects/dto/project-member-role.enum';

export class CurrentAccessUserDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  username: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nickname?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatar?: string | null;
}

export class CurrentAccessContextDto {
  @ApiPropertyOptional({ type: String })
  businessLineId?: string;

  @ApiPropertyOptional({ type: String })
  projectId?: string;

  @ApiPropertyOptional({
    enum: BusinessLineMemberRole,
    enumName: 'BusinessLineMemberRole',
    nullable: true,
  })
  businessRole?: BusinessLineMemberRole | null;

  @ApiPropertyOptional({
    enum: ProjectMemberRole,
    enumName: 'ProjectMemberRole',
    nullable: true,
  })
  projectRole?: ProjectMemberRole | null;
}

export class CurrentAccessVisibilityDto {
  @ApiProperty({ type: [String] })
  visibleBusinessLineIds: string[];

  @ApiProperty({ type: [String] })
  visibleProjectIds: string[];
}

export class CurrentAccessDto {
  @ApiProperty({ type: CurrentAccessUserDto })
  user: CurrentAccessUserDto;

  @ApiProperty({ type: CurrentAccessContextDto })
  currentContext: CurrentAccessContextDto;

  @ApiProperty({ type: [String] })
  capabilities: string[];

  @ApiProperty({ type: CurrentAccessVisibilityDto })
  visibility: CurrentAccessVisibilityDto;
}
