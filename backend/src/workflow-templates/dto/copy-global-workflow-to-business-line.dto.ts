import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CopyGlobalWorkflowToBusinessLineDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  businessLineId!: string;
}
