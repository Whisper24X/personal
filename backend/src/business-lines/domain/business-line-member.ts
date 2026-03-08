import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BusinessLineMember {
  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty({
    type: String,
  })
  businessLineId: string;

  @ApiProperty({
    type: String,
  })
  userId: string;

  @ApiProperty({
    type: String,
  })
  role: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  customRoleName?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
