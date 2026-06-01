import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessLineInviteProjectRole } from '../dto/business-line-invite-project-role.enum';

export class BusinessLineInvitation {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  businessLineId: string;

  @ApiProperty({ type: String })
  token: string;

  @ApiProperty({ type: String })
  roleId: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: Object.values(BusinessLineInviteProjectRole),
    },
  })
  projectRoles: Record<string, BusinessLineInviteProjectRole>;

  @ApiPropertyOptional({ type: String, nullable: true })
  customRoleName?: string | null;

  @ApiProperty({ type: String })
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
