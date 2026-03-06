import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'john.doe', type: String })
  @Transform(lowerCaseTransformer)
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'John Doe', type: String })
  @IsOptional()
  @IsString()
  nickname?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    type: String,
  })
  @IsOptional()
  @IsString()
  avatar?: string | null;
}
