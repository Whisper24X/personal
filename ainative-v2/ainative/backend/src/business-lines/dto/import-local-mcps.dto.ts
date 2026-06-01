import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class ImportLocalMcpsDto {
  @ApiProperty({
    type: Object,
    description:
      'Supports both `{ "mcpServers": { ... } }` and direct server map `{ "serverName": { ... } }`.',
    example: {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        },
      },
    },
  })
  @IsObject()
  payload: Record<string, unknown>;
}
