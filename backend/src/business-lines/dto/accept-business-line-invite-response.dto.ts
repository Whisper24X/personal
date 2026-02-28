import { ApiProperty } from '@nestjs/swagger';
import { BusinessLineMember } from '../domain/business-line-member';

export class AcceptBusinessLineInviteResponseDto {
  @ApiProperty({
    type: BusinessLineMember,
  })
  member: BusinessLineMember;

  @ApiProperty({
    type: String,
    isArray: true,
  })
  failedProjects: string[];
}
