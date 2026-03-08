import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateProjectMemberDto {
  @ApiProperty({ type: String })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
