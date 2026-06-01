import { ApiProperty } from '@nestjs/swagger';

export class GitBranchLastCommitDto {
  @ApiProperty({
    example: '8b4d6c798d82d8d7f2e25b8f86ef6dc3b54c9840',
  })
  sha: string;

  @ApiProperty({
    example: '8b4d6c7',
  })
  shortSha: string;

  @ApiProperty({
    example: 'feat(git): add branch detail endpoint',
  })
  message: string;

  @ApiProperty({
    example: 'Alice',
  })
  author: string;

  @ApiProperty({
    example: '2026-03-19T12:30:00.000Z',
  })
  committedAt: string;
}

export class GitBranchDetailDto {
  @ApiProperty({
    example: 'main',
  })
  name: string;

  @ApiProperty({
    enum: ['local', 'remote', 'both'],
    example: 'both',
  })
  type: 'local' | 'remote' | 'both';

  @ApiProperty({
    example: true,
  })
  isCurrent: boolean;

  @ApiProperty({
    example: 'origin/main',
    nullable: true,
    required: false,
  })
  tracking?: string;

  @ApiProperty({
    example: 1,
  })
  ahead: number;

  @ApiProperty({
    example: 2,
  })
  behind: number;

  @ApiProperty({
    type: GitBranchLastCommitDto,
  })
  lastCommit: GitBranchLastCommitDto;
}

export class GitBranchesDetailDto {
  @ApiProperty({
    type: GitBranchDetailDto,
    isArray: true,
  })
  branches: GitBranchDetailDto[];
}
