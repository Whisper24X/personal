import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentToolConfigSmokeTestResultDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty({ nullable: true, type: Number })
  exitCode: number | null;

  @ApiProperty()
  command: string;

  @ApiProperty({ type: [String] })
  args: string[];

  @ApiPropertyOptional()
  stdoutPreview?: string;

  @ApiPropertyOptional()
  stderrPreview?: string;

  @ApiPropertyOptional({
    enum: ['ENOENT', 'TIMEOUT', 'NON_ZERO', 'SPAWN_ERROR', 'AUTH_ERROR'],
    description:
      'AUTH_ERROR: exit code was 0 but output suggested authentication failure.',
  })
  errorCode?: string;
}
