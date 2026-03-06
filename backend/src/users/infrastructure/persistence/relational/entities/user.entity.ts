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
  comment: '系统用户',
})
export class UserEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { comment: '主键（UUID）' })
  id: string;

  @Index('UQ_users_username', { unique: true, where: '"deletedAt" IS NULL' })
  @Column({ type: String, length: 100, comment: '登录用户名' })
  username: string;

  @Column({ type: String, comment: '加密密码' })
  password: string;

  @Column({ type: String, nullable: true, comment: '密码盐' })
  salt: string | null;

  @Column({ type: String, nullable: true, comment: '显示昵称' })
  nickname: string | null;

  @Column({ type: String, nullable: true, comment: '头像地址' })
  avatar: string | null;

  @Column({ type: Boolean, default: false, comment: '是否管理员' })
  isAdmin: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @DeleteDateColumn({ comment: '软删除时间' })
  deletedAt: Date | null;
}
