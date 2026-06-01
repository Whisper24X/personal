import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptBusinessLineInviteDto {
  @ApiProperty({
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
