import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class FindTaskLogsDto {
  @ApiPropertyOptional({
    type: String,
    description: 'ISO datetime. Return logs created after this timestamp.',
  })
  @IsOptional()
  @IsString()
  since?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Log UUID cursor for deterministic continuation when since timestamp is identical.',
  })
  @IsOptional()
  @IsUUID()
  afterId?: string;

  @ApiPropertyOptional({ type: Number, default: 200 })
  @Transform(({ value }) => (value ? Number(value) : 200))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}
