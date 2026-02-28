import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { BusinessLineMemberRole } from './business-line-member-role.enum';
import { BusinessLineInviteProjectRole } from './business-line-invite-project-role.enum';

export class CreateBusinessLineInviteDto {
  @ApiProperty({
    enum: BusinessLineMemberRole,
    enumName: 'BusinessLineMemberRole',
    default: BusinessLineMemberRole.member,
  })
  @IsEnum(BusinessLineMemberRole)
  role: BusinessLineMemberRole;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: Object.values(BusinessLineInviteProjectRole),
    },
  })
  @IsOptional()
  @IsObject()
  projectRoles?: Record<string, BusinessLineInviteProjectRole>;
}
