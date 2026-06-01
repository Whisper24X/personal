import { ApiProperty } from '@nestjs/swagger';

export class ProjectLocalMcpConfigDto {
  @ApiProperty({ type: String, example: 'filesystem' })
  name: string;

  @ApiProperty({
    type: String,
    example: '/Users/fuzhifei/code/ainative-workspace/.cursor/mcp.json',
  })
  sourcePath: string;

  @ApiProperty({ type: Object })
  config: Record<string, unknown>;
}
