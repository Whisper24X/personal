import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class InspectProjectRepositoryDto {
  @ApiProperty({ type: String })
  @IsUUID()
  businessLineId: string;

  @ApiProperty({
    type: String,
    example: 'git@gitlab.yc345.tv:frontend/ainative-workspace.git',
  })
  @IsString()
  @IsNotEmpty()
  gitUrl: string;
}

export class ProjectRepositoryInspectionDto {
  @ApiProperty({ type: String, example: 'ainative-workspace' })
  repoName: string;

  @ApiProperty({ type: [String] })
  branches: string[];

  @ApiProperty({ type: String, nullable: true, required: false })
  recommendedDefaultBranch: string | null;
}
