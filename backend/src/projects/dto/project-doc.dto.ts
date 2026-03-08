import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ProjectDocItemDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  size: number;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

export class ProjectDocContentDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  size: number;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  @ApiProperty({ type: String })
  content: string;
}

export class ReadProjectDocDto {
  @ApiProperty({
    type: String,
    description:
      'Relative path under project docs directory (e.g. architecture/overview.md)',
  })
  @IsString()
  @IsNotEmpty()
  path: string;
}

export class SaveProjectDocDto {
  @ApiProperty({
    type: String,
    description:
      'Relative path under project docs directory (e.g. architecture/overview.md)',
  })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({ type: String })
  @IsString()
  content: string;
}

export class QueryProjectDocsDto {
  @ApiProperty({
    type: String,
    description: 'Question for project docs knowledge query',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    type: String,
    required: false,
    enum: ['project', 'current_doc'],
    default: 'project',
    description: 'Query scope for knowledge retrieval',
  })
  @IsOptional()
  @IsString()
  @IsIn(['project', 'current_doc'])
  scope?: 'project' | 'current_doc';

  @ApiProperty({
    type: String,
    required: false,
    description: 'Current selected doc path when scope is current_doc',
  })
  @IsOptional()
  @IsString()
  currentPath?: string;

  @ApiProperty({
    type: Number,
    required: false,
    default: 6,
    minimum: 1,
    maximum: 20,
    description: 'Maximum number of context docs used for answering',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxContextDocs?: number;
}

export class ProjectDocCitationDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  snippet: string;
}

export class QueryProjectDocsResponseDto {
  @ApiProperty({ type: String })
  answer: string;

  @ApiProperty({ type: ProjectDocCitationDto, isArray: true })
  citations: ProjectDocCitationDto[];

  @ApiProperty({ type: Number })
  durationMs: number;

  @ApiProperty({ type: String, required: false })
  traceId?: string;
}
