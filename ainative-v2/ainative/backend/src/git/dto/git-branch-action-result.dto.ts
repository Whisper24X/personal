import { ApiProperty } from '@nestjs/swagger';

export class GitBranchActionResultDto {
  @ApiProperty({
    example: true,
  })
  success: boolean;

  @ApiProperty({
    example: 'main',
  })
  branch: string;

  @ApiProperty({
    example: 'Already up to date.',
  })
  output: string;
}
