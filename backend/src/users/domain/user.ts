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
