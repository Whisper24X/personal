import { ApiProperty } from '@nestjs/swagger';

export class LocalMcpConfigDto {
  @ApiProperty({ type: String, example: 'filesystem' })
  name: string;

  @ApiProperty({
    type: String,
    example: '/path/to/app/tmp/{businessLineId}/mcp/mcp.json',
  })
  sourcePath: string;

  @ApiProperty({ type: Object })
  config: Record<string, unknown>;
}
