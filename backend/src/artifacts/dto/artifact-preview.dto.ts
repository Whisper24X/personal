import { ApiProperty } from '@nestjs/swagger';
import { TaskArtifactType } from '../../tasks/dto/task-artifact-type.enum';

export class ArtifactPreviewFileTreeNodeDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ enum: ['file', 'directory'] })
  type: 'file' | 'directory';

  @ApiProperty({ type: () => ArtifactPreviewFileTreeNodeDto, isArray: true })
  children: ArtifactPreviewFileTreeNodeDto[];
}

export class ArtifactPreviewDto {
  @ApiProperty({ type: String })
  artifactId: string;

  @ApiProperty({ enum: ['diff', 'text', 'external'] })
  mode: 'diff' | 'text' | 'external';

  @ApiProperty({ enum: TaskArtifactType, enumName: 'TaskArtifactType' })
  artifactType: TaskArtifactType;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  patch?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  text?: string | null;

  @ApiProperty({ type: String, isArray: true })
  changedFiles: string[];

  @ApiProperty({ type: ArtifactPreviewFileTreeNodeDto, isArray: true })
  fileTree: ArtifactPreviewFileTreeNodeDto[];

  @ApiProperty({ type: Boolean })
  truncated: boolean;

  @ApiProperty({ type: String, required: false, nullable: true })
  downloadUrl?: string | null;
}
