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

export class TaskGitStatusDto {
  @ApiProperty({ type: String, nullable: true })
  branchName: string | null;

  @ApiProperty({ type: String, nullable: true })
  baseBranch: string | null;

  @ApiProperty({ type: TaskGitChangedFileDto, isArray: true })
  files: TaskGitChangedFileDto[];
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
}

export class TaskGitPrLinkDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  url?: string | null;
}
