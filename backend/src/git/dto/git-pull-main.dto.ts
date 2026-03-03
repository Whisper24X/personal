import { ApiProperty } from '@nestjs/swagger';

export class GitPullMainDto {
  @ApiProperty({
    example: 'main',
  })
  branch: string;

  @ApiProperty({
    example: 'Already up to date.',
  })
  output: string;
}
