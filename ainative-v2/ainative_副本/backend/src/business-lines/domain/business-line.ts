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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date | null;
}
