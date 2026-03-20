import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RepeatNodeDto {
  @ApiProperty({ type: String })
  @IsUUID()
  nodeId: string;
}
