import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TestProjectLocalMcpDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ type: String, example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: String,
    example: '/path/to/project/.cursor/mcp.json',
  })
  @IsString()
  @IsNotEmpty()
  sourcePath: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  agentToolConfigId: string;
}
