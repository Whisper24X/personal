import { ApiProperty } from '@nestjs/swagger';

export class LocalMcpConfigDto {
  @ApiProperty({ type: String, example: 'filesystem' })
  name: string;

  @ApiProperty({
    type: String,
    example: '/Users/fuzhifei/.ainative/data/{businessLineId}/mcp/mcp.json',
  })
  sourcePath: string;

  @ApiProperty({ type: Object })
  config: Record<string, unknown>;
}
