import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
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

  @ApiPropertyOptional({
    enum: WorkflowTemplateScope,
    enumName: 'WorkflowTemplateScope',
    default: WorkflowTemplateScope.global,
  })
  @IsOptional()
  @IsEnum(WorkflowTemplateScope)
  scope?: WorkflowTemplateScope;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  businessLineId?: string;

  @ApiProperty({ type: [WorkflowTemplateNodeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowTemplateNodeDto)
  nodes: WorkflowTemplateNodeDto[];

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  isActive?: boolean;
}
