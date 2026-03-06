import {
  // decorators here
  Transform,
} from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  // decorators here
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsString,
} from 'class-validator';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe', type: String })
  @Transform(lowerCaseTransformer)
  @IsNotEmpty()
  @IsString()
  username: string;

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
}
