import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BusinessLineMemberRole } from './business-line-member-role.enum';
import { BusinessLineInviteProjectRole } from './business-line-invite-project-role.enum';

export class CreateBusinessLineInviteDto {
  @ApiProperty({
    type: String,
    default: BusinessLineMemberRole.member,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role: string;

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
