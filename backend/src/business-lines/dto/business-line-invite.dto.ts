import { ApiProperty } from '@nestjs/swagger';
import { BusinessLineMemberRole } from './business-line-member-role.enum';
import { BusinessLineInviteProjectRole } from './business-line-invite-project-role.enum';

export class BusinessLineInviteDto {
  @ApiProperty({
    type: String,
  })
  token: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  expiresAt: string;

  @ApiProperty({
    type: String,
  })
  businessLineId: string;

  @ApiProperty({
    enum: BusinessLineMemberRole,
    enumName: 'BusinessLineMemberRole',
  })
  role: BusinessLineMemberRole;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: Object.values(BusinessLineInviteProjectRole),
    },
  })
  projectRoles: Record<string, BusinessLineInviteProjectRole>;
}
