import { ApiProperty } from '@nestjs/swagger';
import { BusinessLineMemberRole } from '../dto/business-line-member-role.enum';

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
    enum: BusinessLineMemberRole,
    enumName: 'BusinessLineMemberRole',
  })
  role: BusinessLineMemberRole;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
