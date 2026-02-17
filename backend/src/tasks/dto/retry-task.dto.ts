import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RetryTaskDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  nodeId?: string;
}
