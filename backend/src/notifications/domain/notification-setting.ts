import { ApiProperty } from '@nestjs/swagger';

export class NotificationSetting {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ type: Boolean, default: false })
  webhookEnabled: boolean;

  @ApiProperty({ type: String, required: false, nullable: true })
  webhookUrl?: string | null;

  @ApiProperty({ type: Boolean, default: true })
  browserEnabled: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}
