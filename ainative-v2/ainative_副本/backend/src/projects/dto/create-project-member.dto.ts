import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateProjectMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  userId: string;

  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
