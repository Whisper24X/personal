import { ApiProperty } from '@nestjs/swagger';

export class AgentToolConfig {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  businessLineId: string;

  @ApiProperty({ type: String, example: 'codex-cli' })
  toolId: string;

  @ApiProperty({ type: String, example: 'Default Codex' })
  name: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ type: String, description: 'Raw JSON string' })
  configJson: string;

  @ApiProperty({ type: Boolean, default: false })
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
