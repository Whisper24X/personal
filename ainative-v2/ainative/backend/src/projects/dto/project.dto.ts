import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RepositoryProvisioningStatus } from '../domain/repository-provisioning-status.enum';

export class ProjectDto {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  businessLineId: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  gitUrl: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  defaultBranch: string;

  @ApiProperty({
    enum: RepositoryProvisioningStatus,
    example: RepositoryProvisioningStatus.Ready,
  })
  @IsNotEmpty()
  @IsString()
  repositoryProvisioningStatus: RepositoryProvisioningStatus;

  @ApiProperty({ type: String, required: false, nullable: true })
  @IsOptional()
  @IsString()
  repositoryProvisioningError?: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  repositoryProvisionedAt?: string | null;
}
