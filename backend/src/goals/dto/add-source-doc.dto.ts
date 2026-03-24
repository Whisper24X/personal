import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { GoalSourceDocType } from './goal-source-doc-type.enum';

export class AddSourceDocDto {
  @ApiProperty({
    description: '项目 docs 下的相对路径，如 goals/uuid/input/req.md',
  })
  @IsString()
  @MaxLength(500)
  projectDocPath: string;

  @ApiProperty({ enum: GoalSourceDocType, enumName: 'GoalSourceDocType' })
  @IsEnum(GoalSourceDocType)
  docType: GoalSourceDocType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
