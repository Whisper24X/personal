import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'users',
})
export class UserEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_users_username')
  @Column({ type: String, length: 100, unique: true })
  username: string;

  @Column({ type: String })
  password: string;

  @Column({ type: String, nullable: true })
  salt: string | null;

  @Column({ type: String, nullable: true })
  nickname: string | null;

  @Column({ type: String, nullable: true })
  avatar: string | null;

  @Column({ type: Boolean, default: false })
  isAdmin: boolean;

  @Column({ type: 'int', default: 1 })
  status: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
