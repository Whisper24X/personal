import { ApiProperty } from '@nestjs/swagger';

export class NotificationEvent {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  taskId?: string | null;

  @ApiProperty({ type: String })
  eventType: string;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  content: string;

  @ApiProperty({ type: Object, required: false, nullable: true })
  payload?: Record<string, unknown> | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  readAt?: Date | null;

  @ApiProperty({ type: Date })
  createdAt: Date;
}
