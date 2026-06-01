import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateBusinessLineMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
