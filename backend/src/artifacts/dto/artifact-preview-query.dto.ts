import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ArtifactPreviewQueryDto {
  @ApiPropertyOptional({
    type: String,
    description:
      'When artifact is report type (node-X-summary), specify which worktree file to preview (e.g. lyrics.md). Required when multiple worktree files exist.',
  })
  @IsOptional()
  @IsString()
  worktreePath?: string;
}
