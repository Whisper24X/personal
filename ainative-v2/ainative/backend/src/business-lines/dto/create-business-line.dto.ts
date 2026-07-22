import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateBusinessLineDto {
  @ApiProperty({
    type: String,
    example: 'Retail',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: String,
    example: 'ainative-web',
    description: '业务线在 ainative-workspace 中的稳定标识（Git 分支片段）',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Retail business line',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: Object,
    description: '业务线配置JSON（子仓列表等）',
  })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}
