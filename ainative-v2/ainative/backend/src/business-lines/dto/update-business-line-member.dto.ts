import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';

export class UpdateBusinessLineMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
  })
  @IsOptional()
  @IsObject()
  projectRoles?: Record<string, string>;
}
