import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GetProjectLocalMcpConfigDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({ type: String, example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: String,
    example: '/Users/fuzhifei/code/ainative-workspace/.cursor/mcp.json',
  })
  @IsString()
  @IsNotEmpty()
  sourcePath: string;
}
