import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const LOCAL_MCP_TRANSPORT_TYPES = ['stdio', 'http', 'sse'] as const;

export class CreateLocalMcpDto {
  @ApiProperty({ type: String, example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    type: String,
    enum: LOCAL_MCP_TRANSPORT_TYPES,
    example: 'stdio',
  })
  @IsString()
  @IsIn(LOCAL_MCP_TRANSPORT_TYPES)
  transportType: 'stdio' | 'http' | 'sse';

  @ApiPropertyOptional({ type: String, example: 'npx' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  command?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];

  @ApiPropertyOptional({
    type: Object,
    example: { NODE_ENV: 'production' },
  })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @ApiPropertyOptional({ type: String, example: 'http://127.0.0.1:8080/mcp' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  url?: string;

  @ApiPropertyOptional({
    type: Object,
    example: { Authorization: 'Bearer token' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
