import { ApiProperty } from '@nestjs/swagger';

export class GitPushResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'branch main -> main',
  })
  output: string;

  @ApiProperty({
    example: 2,
    description:
      '推送前统计的、相对远端的领先提交数（首次推送时为相对默认分支的近似值）',
  })
  pushedCommits: number;
}
