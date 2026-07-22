import { ApiProperty } from '@nestjs/swagger';

export class BusinessLine {
  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'Retail',
  })
  name: string;

  @ApiProperty({
    type: String,
    example: 'ainative-web',
    description: '业务线在 ainative-workspace 中的稳定标识',
  })
  slug: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    example: 'Retail business line',
  })
  description?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    example: 'codex',
  })
  defaultAgentCliToolId?: string | null;

  @ApiProperty({
    type: Object,
    required: false,
    nullable: true,
    description: '业务线配置JSON（子仓/Runner缓存等）',
  })
  configJson?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
