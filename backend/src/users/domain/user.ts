import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const idType = String;

export class User {
  @ApiProperty({
    type: idType,
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'john.doe',
  })
  @Expose({ groups: ['me', 'admin'] })
  username: string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
    nullable: true,
    required: false,
  })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @ApiProperty({
    type: String,
    example: 'John Doe',
    nullable: true,
    required: false,
  })
  @Expose({ groups: ['me', 'admin'] })
  nickname: string | null;

  @ApiProperty({
    type: String,
    example: 'https://example.com/avatar.png',
    nullable: true,
    required: false,
  })
  @Expose({ groups: ['me', 'admin'] })
  avatar: string | null;

  @ApiProperty({
    type: Boolean,
    default: false,
  })
  @Expose({ groups: ['me', 'admin'] })
  isAdmin: boolean;

  @ApiProperty({
    type: Number,
    default: 1,
    description: '1 means active',
  })
  @Expose({ groups: ['me', 'admin'] })
  status: number;

  @Exclude({ toPlainOnly: true })
  password: string;

  @Exclude({ toPlainOnly: true })
  salt: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date | null;
}
