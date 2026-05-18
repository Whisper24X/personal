import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocalMcpProbeResultDto {
  @ApiProperty({ type: Boolean })
  ok: boolean;

  @ApiPropertyOptional({
    enum: ['stdio', 'http', 'sse'],
  })
  transport?: 'stdio' | 'http' | 'sse';

  @ApiPropertyOptional({
    enum: ['backend', 'runner'],
  })
  executionPlane?: 'backend' | 'runner';

  @ApiPropertyOptional({ type: String })
  containerId?: string;

  @ApiPropertyOptional({ type: String })
  cwd?: string;

  @ApiPropertyOptional({ type: Number })
  toolsCount?: number;

  @ApiPropertyOptional({ type: String })
  errorCode?: string;

  @ApiPropertyOptional({ type: String })
  message?: string;

  @ApiPropertyOptional({ type: String })
  stderrPreview?: string;

  @ApiPropertyOptional({ type: [String] })
  warnings?: string[];
}
