import {
  // decorators here
  Transform,
} from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  // decorators here
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsString,
  Min,
} from 'class-validator';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe', type: String })
  @Transform(lowerCaseTransformer)
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    type: String,
    required: false,
  })
  @Transform(lowerCaseTransformer)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiProperty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe', type: String, required: false })
  @IsOptional()
  @IsString()
  nickname?: string | null;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar?: string | null;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  status?: number;
}
