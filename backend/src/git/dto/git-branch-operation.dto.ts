import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GitBranchOperationDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({
    example: 'feature/login-refactor',
  })
  @IsString()
  @IsNotEmpty()
  branch: string;
}
