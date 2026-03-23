import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class StepSummaryItemDto {
  @ApiProperty({ description: '客户端步骤 id，与请求一致回传' })
  @IsString()
  @MaxLength(128)
  id!: string;

  @ApiProperty({ description: '用于压缩的原始步骤说明' })
  @IsString()
  @MaxLength(2000)
  rawText!: string;
}

export class StepSummariesRequestDto {
  @ApiProperty({ type: [StepSummaryItemDto] })
  @IsArray()
  @ArrayMaxSize(48)
  @ValidateNested({ each: true })
  @Type(() => StepSummaryItemDto)
  items!: StepSummaryItemDto[];

  @ApiPropertyOptional({ description: '用于解析 Agent CLI 配置的任务节点 id' })
  @IsOptional()
  @IsUUID()
  taskNodeId?: string;
}

export class StepSummaryResultItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: '不超过 9 字的展示标题' })
  summary!: string;
}

export class StepSummariesResponseDto {
  @ApiProperty({ type: [StepSummaryResultItemDto] })
  items!: StepSummaryResultItemDto[];
}
