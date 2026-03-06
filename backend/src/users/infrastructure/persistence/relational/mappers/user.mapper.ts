import { User } from '../../../../domain/user';
import { UserEntity } from '../entities/user.entity';

export class UserMapper {
  static toDomain(raw: UserEntity): User {
    const domainEntity = new User();
    domainEntity.id = raw.id;
    domainEntity.username = raw.username;
    domainEntity.password = raw.password;
    domainEntity.salt = raw.salt;
    domainEntity.nickname = raw.nickname;
    domainEntity.avatar = raw.avatar;
    domainEntity.isAdmin = raw.isAdmin;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: User): UserEntity {
    const persistenceEntity = new UserEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.username = domainEntity.username;
    persistenceEntity.password = domainEntity.password;
    persistenceEntity.salt = domainEntity.salt;
    persistenceEntity.nickname = domainEntity.nickname;
    persistenceEntity.avatar = domainEntity.avatar;
    persistenceEntity.isAdmin = domainEntity.isAdmin;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
