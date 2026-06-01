import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAgentToolConfigDto {
  @ApiProperty({ type: String, example: 'codex-cli' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  toolId: string;

  @ApiProperty({ type: String, example: 'Default Codex' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  configJson: Record<string, unknown>;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
