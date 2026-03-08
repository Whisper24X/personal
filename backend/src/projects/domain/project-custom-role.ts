import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectCustomRole {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  businessLineId: string;

  @ApiProperty({ type: String })
  code: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty({ type: [String] })
  capabilities: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
