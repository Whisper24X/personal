import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { BusinessLineMemberRole } from './business-line-member-role.enum';

export class CreateBusinessLineMemberDto {
  @ApiProperty({
    type: String,
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    type: String,
    default: BusinessLineMemberRole.member,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role: string;
}
