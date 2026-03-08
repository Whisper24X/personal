import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

const projectLocalMcpProviders = [
  'cursor',
  'gemini',
  'opencode',
  'claude-code',
  'codex',
] as const;

export class RemoveProjectLocalMcpDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({ type: String, enum: projectLocalMcpProviders })
  @IsString()
  @IsIn(projectLocalMcpProviders)
  provider: (typeof projectLocalMcpProviders)[number];

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
