import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class GitCreateBranchDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'New local branch name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Start point ref (branch, tag, or commit)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  from: string;
}
