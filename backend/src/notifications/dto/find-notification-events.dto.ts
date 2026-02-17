import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class FindNotificationEventsDto {
  @ApiPropertyOptional({ type: Number, default: 20 })
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return value === 'true';
  })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}
