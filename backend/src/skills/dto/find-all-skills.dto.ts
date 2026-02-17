import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class FindAllSkillsDto {
  @ApiPropertyOptional({ type: Number })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ type: Number })
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  keyword?: string;

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
  enabled?: boolean;
}
