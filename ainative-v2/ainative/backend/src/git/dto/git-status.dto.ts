import { ApiProperty } from '@nestjs/swagger';

export class GitStatusDto {
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
    type: Boolean,
    example: true,
  })
  isOnDefaultBranch: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
  })
  hasUncommittedChanges: boolean;

  @ApiProperty({
    type: Number,
    example: 0,
  })
  changedFilesCount: number;
}
