import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ResetNodeDto {
  @ApiProperty({ type: String })
  @IsUUID()
  nodeId: string;
}
