import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetSkillContentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  projectId: string;
}
