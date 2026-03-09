import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { TaskConfigDto } from './task-config.dto';

export class UpdateTaskDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  gitBranch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  gitBaseBranch?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  gitWorktree?: string;

  @ApiPropertyOptional({
    type: TaskConfigDto,
    description: 'Task execution configuration',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TaskConfigDto)
  configJson?: TaskConfigDto;
}
