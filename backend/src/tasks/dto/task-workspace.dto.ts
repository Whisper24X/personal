import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TaskWorkspaceTreeQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Relative path under task workspace',
  })
  @IsOptional()
  @IsString()
  path?: string;
}

export class TaskWorkspaceFileQueryDto {
  @ApiProperty({
    type: String,
    description: 'Relative path under task workspace',
  })
  @IsString()
  @IsNotEmpty()
  path: string;
}

export class TaskWorkspaceEntryDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({
    type: String,
    description: 'Relative path under task workspace',
  })
  path: string;

  @ApiProperty({ type: Boolean })
  isDir: boolean;
}

export class TaskWorkspaceTreeDto {
  @ApiProperty({ type: String, description: 'Current directory relative path' })
  cwd: string;

  @ApiProperty({ type: TaskWorkspaceEntryDto, isArray: true })
  entries: TaskWorkspaceEntryDto[];
}

export class TaskWorkspaceFileDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  size: number;

  @ApiProperty({ type: Boolean })
  tooLarge: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  encoding?: 'utf8' | 'base64' | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  content?: string | null;
}

export class TaskWorkspacePreviewDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({
    type: String,
    enum: ['text', 'image', 'binary', 'pdf', 'video', 'audio'],
  })
  previewType: 'text' | 'image' | 'binary' | 'pdf' | 'video' | 'audio';

  @ApiProperty({ type: Boolean })
  tooLarge: boolean;

  @ApiProperty({ type: Number })
  size: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  text?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'data:image/*;base64,...',
  })
  dataUrl?: string | null;
}
