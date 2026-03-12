import { ApiProperty } from '@nestjs/swagger';

export class GitCommitSummaryDto {
  @ApiProperty({
    type: String,
    example: '8f4d0da343b4b83ff5b8c7cb5f60895c2f4fb8a5',
  })
  sha: string;

  @ApiProperty({
    type: String,
    example: '8f4d0da',
  })
  shortSha: string;

  @ApiProperty({
    type: String,
    example: 'feat(git): add project repository status endpoint',
  })
  message: string;

  @ApiProperty({
    type: String,
    example: 'OpenAI Agent',
  })
  authorName: string;

  @ApiProperty({
    type: String,
    example: '2026-03-11T16:28:00+08:00',
  })
  committedAt: string;
}

export class GitLogDto {
  @ApiProperty({
    type: GitCommitSummaryDto,
    isArray: true,
  })
  commits: GitCommitSummaryDto[];
}
