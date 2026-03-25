import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UnpackGoalInputZipDto {
  @ApiProperty({
    description:
      '已上传的 zip 在项目 docs 下的相对路径，须位于 goals/{goalId}/input/ 下',
    example: 'goals/uuid/input/uuid-archive.zip',
  })
  @IsString()
  @MinLength(1)
  projectDocPath: string;
}
