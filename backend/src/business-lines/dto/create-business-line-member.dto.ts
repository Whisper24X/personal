import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { BusinessLineMemberRole } from './business-line-member-role.enum';

export class CreateBusinessLineMemberDto {
  @ApiProperty({
    type: String,
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: BusinessLineMemberRole,
    enumName: 'BusinessLineMemberRole',
    default: BusinessLineMemberRole.member,
  })
  @IsEnum(BusinessLineMemberRole)
  role: BusinessLineMemberRole;
}
