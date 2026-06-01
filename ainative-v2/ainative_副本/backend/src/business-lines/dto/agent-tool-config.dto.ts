import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AgentToolConfigDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ type: String })
  @IsUUID()
  businessLineId: string;

  @ApiProperty({ type: String, example: 'codex-cli' })
  @IsString()
  @IsNotEmpty()
  toolId: string;

  @ApiProperty({ type: String, example: 'Default Codex' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ type: Object })
  @IsObject()
  configJson: Record<string, unknown>;

  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  isDefault: boolean;

  @ApiProperty({ type: String })
  @IsString()
  createdAt: string;

  @ApiProperty({ type: String })
  @IsString()
  updatedAt: string;
}
