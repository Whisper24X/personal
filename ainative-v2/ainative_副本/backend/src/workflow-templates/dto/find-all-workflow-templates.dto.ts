import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { WorkflowTemplateScope } from './workflow-template-scope.enum';

export class FindAllWorkflowTemplatesDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  keyword?: string;

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
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: WorkflowTemplateScope,
    enumName: 'WorkflowTemplateScope',
  })
  @IsOptional()
  @IsEnum(WorkflowTemplateScope)
  @IsIn([
    WorkflowTemplateScope.businessLine,
    WorkflowTemplateScope.project,
    WorkflowTemplateScope.global,
  ])
  scope?: WorkflowTemplateScope;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  businessLineId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
