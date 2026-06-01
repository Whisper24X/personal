import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GetCurrentAccessDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  businessLineId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
