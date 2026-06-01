import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyTaskDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  message: string;
}
