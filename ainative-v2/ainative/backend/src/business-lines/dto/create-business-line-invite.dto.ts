import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { BusinessLineInviteProjectRole } from './business-line-invite-project-role.enum';

export class CreateBusinessLineInviteDto {
  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

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
