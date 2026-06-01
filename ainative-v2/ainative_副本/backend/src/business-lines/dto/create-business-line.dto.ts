import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBusinessLineDto {
  @ApiProperty({
    type: String,
    example: 'Retail',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Retail business line',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
