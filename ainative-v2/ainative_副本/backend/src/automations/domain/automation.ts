import { ApiProperty } from '@nestjs/swagger';
import { AutomationStatus } from './automation-status.enum';

export class Automation {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  prompt: string;

  @ApiProperty({ type: String })
  rrule: string;

  @ApiProperty({ type: [String], required: false, nullable: true })
  cwds?: string[] | null;

  @ApiProperty({
    enum: AutomationStatus,
    enumName: 'AutomationStatus',
    default: AutomationStatus.ACTIVE,
  })
  status: AutomationStatus;

  @ApiProperty({ type: Date, required: false, nullable: true })
  lastRunAt?: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  nextRunAt?: Date | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  createdBy?: string | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  @ApiProperty({ type: Date, required: false, nullable: true })
  deletedAt?: Date | null;
}
