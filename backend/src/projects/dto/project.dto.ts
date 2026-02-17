import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
