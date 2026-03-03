import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GitProjectDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;
}
