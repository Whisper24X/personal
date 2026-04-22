import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateDefaultAgentCliToolDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'codex',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  defaultAgentCliToolId: string | null;
}
