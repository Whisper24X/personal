import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class FindTaskStatsDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  projectId: string;
}
