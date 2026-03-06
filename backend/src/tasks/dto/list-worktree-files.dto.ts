import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListWorktreeFilesDto {
  @ApiPropertyOptional({
    type: String,
    description:
      'Only return files under this path prefix (e.g. "docs" for docs folder only). Paths use forward slashes.',
  })
  @IsOptional()
  @IsString()
  prefix?: string;
}
