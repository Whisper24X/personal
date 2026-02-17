import { ApiProperty } from '@nestjs/swagger';

export class ProjectContextDocumentDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  preview: string;

  @ApiProperty({ type: Number })
  length: number;
}

export class ProjectContextDto {
  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  gitUrl: string;

  @ApiProperty({ type: String })
  defaultBranch: string;

  @ApiProperty({ type: String })
  source: 'local_repository' | 'project_config' | 'empty';

  @ApiProperty({ type: Date })
  generatedAt: Date;

  @ApiProperty({ type: ProjectContextDocumentDto, isArray: true })
  documents: ProjectContextDocumentDto[];

  @ApiProperty({ type: String, isArray: true })
  warnings: string[];
}
