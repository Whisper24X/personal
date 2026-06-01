import { ApiProperty } from '@nestjs/swagger';

export class LocalSkillContentDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  content: string;
}
