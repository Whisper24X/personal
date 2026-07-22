import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateGoalPrdDocDto {
  @ApiProperty({ type: String, description: 'PRD Markdown content' })
  @IsString()
  content: string;
}
