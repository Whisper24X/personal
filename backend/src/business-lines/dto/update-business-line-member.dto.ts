import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BusinessLineMemberRole } from './business-line-member-role.enum';

export class UpdateBusinessLineMemberDto {
  @ApiProperty({
    enum: BusinessLineMemberRole,
    enumName: 'BusinessLineMemberRole',
  })
  @IsEnum(BusinessLineMemberRole)
  role: BusinessLineMemberRole;
}
