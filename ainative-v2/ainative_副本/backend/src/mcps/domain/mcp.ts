import { ApiProperty } from '@nestjs/swagger';

export class Mcp {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  version: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  provider?: string | null;

  @ApiProperty({ type: Number, default: 0 })
  toolsCount: number;

  @ApiProperty({ type: Object, required: false, nullable: true })
  configSchema?: Record<string, unknown> | null;

  @ApiProperty({ type: Object, required: false, nullable: true })
  metadataJson?: Record<string, unknown> | null;

  @ApiProperty({ type: Boolean, default: true })
  enabled: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  @ApiProperty({ type: Date, required: false, nullable: true })
  deletedAt?: Date | null;
}
