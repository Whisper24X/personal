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

  @ApiPropertyOptional({
    type: String,
    description: 'Target workflow node id for artifact resolution',
  })
  @IsOptional()
  @IsString()
  nodeId?: string;
}

export class TaskWorkspaceFileQueryDto {
  @ApiProperty({
    type: String,
    description: 'Relative path under task workspace',
  })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Target workflow node id for artifact resolution',
  })
  @IsOptional()
  @IsString()
  nodeId?: string;
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

export class TaskArtifactSourceDto {
  @ApiProperty({
    type: String,
    enum: ['commit_range', 'workspace_unstaged_fallback', 'unavailable'],
  })
  sourceType: 'commit_range' | 'workspace_unstaged_fallback' | 'unavailable';

  @ApiPropertyOptional({ type: String, nullable: true })
  nodeId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  beforeCommitSha?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  afterCommitSha?: string | null;
}

export class TaskArtifactFileDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  status?: string | null;

  @ApiProperty({ type: Boolean })
  deleted: boolean;
}

export class TaskArtifactTreeDto extends TaskWorkspaceTreeDto {
  @ApiProperty({ type: TaskArtifactFileDto, isArray: true })
  files: TaskArtifactFileDto[];

  @ApiProperty({ type: TaskArtifactSourceDto })
  artifactSource: TaskArtifactSourceDto;
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

export class TaskArtifactPreviewDto extends TaskWorkspacePreviewDto {
  @ApiProperty({ type: TaskArtifactSourceDto })
  artifactSource: TaskArtifactSourceDto;
}
