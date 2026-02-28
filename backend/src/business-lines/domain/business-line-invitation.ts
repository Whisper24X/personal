import { ApiProperty } from '@nestjs/swagger';
import { BusinessLineMemberRole } from '../dto/business-line-member-role.enum';
import { BusinessLineInviteProjectRole } from '../dto/business-line-invite-project-role.enum';

export class BusinessLineInvitation {
  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty({
    type: String,
  })
  businessLineId: string;

  @ApiProperty({
    type: String,
  })
  token: string;

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

  @ApiProperty({
    type: String,
  })
  createdBy: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  revokedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
