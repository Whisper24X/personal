import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsUUID } from 'class-validator';

const projectLocalMcpProviders = [
  'cursor',
  'gemini',
  'opencode',
  'claude-code',
  'codex',
] as const;

export type ProjectLocalMcpProvider = (typeof projectLocalMcpProviders)[number];

export class ImportProjectLocalMcpsDto {
  @ApiProperty({ type: String })
  @IsUUID()
  projectId: string;

  @ApiProperty({
    type: String,
    enum: projectLocalMcpProviders,
  })
  @IsIn(projectLocalMcpProviders)
  provider: ProjectLocalMcpProvider;

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
