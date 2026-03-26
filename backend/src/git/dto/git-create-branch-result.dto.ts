import { ApiProperty } from '@nestjs/swagger';

export class GitCreateBranchResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  branch: string;
}
