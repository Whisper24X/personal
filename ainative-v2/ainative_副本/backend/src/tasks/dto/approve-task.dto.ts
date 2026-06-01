import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApproveTaskDto {
  @ApiProperty({ type: String })
  @IsUUID()
  nodeId: string;
}
