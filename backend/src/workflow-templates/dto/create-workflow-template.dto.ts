import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowTemplateNodeDto } from './workflow-template-node.dto';
import { WorkflowTemplateScope } from './workflow-template-scope.enum';

export class CreateWorkflowTemplateDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: WorkflowTemplateScope,
    enumName: 'WorkflowTemplateScope',
  })
  @IsEnum(WorkflowTemplateScope)
  @IsIn([
    WorkflowTemplateScope.businessLine,
    WorkflowTemplateScope.project,
    WorkflowTemplateScope.global,
  ])
  scope: WorkflowTemplateScope;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  businessLineId?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ type: [WorkflowTemplateNodeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowTemplateNodeDto)
  nodes: WorkflowTemplateNodeDto[];

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: '仅 global 母版：新建业务线时是否复制此模板',
  })
  @IsOptional()
  @IsBoolean()
  seedOnBusinessLineCreate?: boolean;

  @ApiPropertyOptional({
    type: Number,
    description: '仅 global 母版：多条种子母版的排序（升序）',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  businessLineSeedOrder?: number;
}
