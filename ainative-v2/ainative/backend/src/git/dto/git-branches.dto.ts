import { ApiProperty } from '@nestjs/swagger';

export class GitBranchesDto {
  @ApiProperty({
    type: String,
    example: 'main',
  })
  defaultBranch: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'main',
  })
  currentBranch: string | null;

  @ApiProperty({
    type: [String],
    example: ['main', 'feature/example'],
  })
  localBranches: string[];

  @ApiProperty({
    type: [String],
    example: ['main', 'release/v1'],
  })
  remoteBranches: string[];
}
