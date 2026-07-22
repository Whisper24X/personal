import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class TaskGitChangedFileDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: Boolean })
  staged: boolean;
}

export class SubRepoBranchInfoDto {
  @ApiProperty({ type: String })
  prefix: string;

  @ApiProperty({ type: String, nullable: true })
  branchName: string | null;

  @ApiProperty({ type: String })
  baseBranch: string;
}

export class TaskGitAsyncOperationDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String, enum: ['push', 'merge', 'deploy'] })
  type: 'push' | 'merge' | 'deploy';

  @ApiProperty({
    type: String,
    enum: ['running', 'success', 'failed', 'cancelled'],
  })
  status: 'running' | 'success' | 'failed' | 'cancelled';

  @ApiProperty({ type: String })
  startedAt: string;

  @ApiPropertyOptional({ type: String })
  finishedAt?: string;

  @ApiProperty({ type: [String] })
  logs: string[];

  @ApiPropertyOptional({ type: String })
  message?: string;
}

export class TaskGitStatusDto {
  @ApiProperty({ type: String, nullable: true })
  branchName: string | null;

  @ApiProperty({ type: String, nullable: true })
  baseBranch: string | null;

  @ApiProperty({ type: TaskGitChangedFileDto, isArray: true })
  files: TaskGitChangedFileDto[];

  @ApiPropertyOptional({ type: [SubRepoBranchInfoDto] })
  subRepoBranches?: SubRepoBranchInfoDto[];

  @ApiPropertyOptional({ type: TaskGitAsyncOperationDto })
  operation?: TaskGitAsyncOperationDto;
}

export class TaskGitDiffQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return value === 'true';
  })
  @IsOptional()
  @IsBoolean()
  staged?: boolean;
}

export class TaskGitBranchDiffQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  baseBranch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  path?: string;
}

export class TaskGitDiffDto {
  @ApiProperty({ type: String })
  diffText: string;
}

export class TaskGitBranchDiffFileDto {
  @ApiProperty({ type: String })
  path: string;

  @ApiProperty({ type: String })
  status: string;
}

export class TaskGitBranchDiffFilesDto {
  @ApiProperty({ type: String, nullable: true })
  baseBranch: string | null;

  @ApiProperty({ type: String, nullable: true })
  currentBranch: string | null;

  @ApiProperty({ type: TaskGitBranchDiffFileDto, isArray: true })
  files: TaskGitBranchDiffFileDto[];
}

export class TaskGitFilesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  files: string[];
}

export class TaskGitCommitDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class TaskGitBaseBranchDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  baseBranch?: string;
}

export class TaskGitActionResultDto {
  @ApiProperty({ type: Boolean })
  success: boolean;

  @ApiProperty({ type: String })
  message: string;

  @ApiPropertyOptional({ type: [String] })
  conflicts?: string[];

  @ApiPropertyOptional({ type: String })
  operationId?: string;
}

export class TaskGitPrLinkItemDto {
  @ApiProperty({ type: String })
  prefix: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  url?: string | null;

  @ApiPropertyOptional({ type: String })
  hint?: string;
}

export class TaskGitPrLinkDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  url?: string | null;

  @ApiPropertyOptional({ type: [TaskGitPrLinkItemDto] })
  urls?: TaskGitPrLinkItemDto[];
}
