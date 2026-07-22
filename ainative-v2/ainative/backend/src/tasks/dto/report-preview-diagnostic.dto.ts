import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportPreviewDiagnosticDto {
  @ApiProperty({
    enum: ['platform-hmr-relay-failed', 'workspace-runtime-error'],
  })
  @IsString()
  @IsIn(['platform-hmr-relay-failed', 'workspace-runtime-error'])
  kind: 'platform-hmr-relay-failed' | 'workspace-runtime-error';

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  message?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  summary?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  dedupeKey?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;
}
