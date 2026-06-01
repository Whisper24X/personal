import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessLineInviteProjectRole } from './business-line-invite-project-role.enum';

export class BusinessLineInviteDto {
  @ApiProperty({ type: String })
  token: string;

  @ApiProperty({ type: String })
  expiresAt: string;

  @ApiProperty({ type: String })
  businessLineId: string;

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
}
