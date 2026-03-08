import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateBusinessLineMemberDto {
  @ApiProperty({
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role: string;
}
