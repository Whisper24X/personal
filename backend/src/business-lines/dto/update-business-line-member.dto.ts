import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateBusinessLineMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
