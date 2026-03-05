import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReadWorktreeFileDto {
  @ApiProperty({
    type: String,
    description: 'Relative path to the file within the worktree (e.g. lyrics.md or docs/plan.md)',
  })
  @IsString()
  path: string;
}
