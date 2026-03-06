import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Injectable()
export class UserSeedService {
  constructor(
    @InjectRepository(UserEntity)
    private repository: Repository<UserEntity>,
  ) {}

  async run() {
    const countAdmin = await this.repository.count({
      where: {
        username: 'admin',
      },
    });

    if (!countAdmin) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      await this.repository.save(
        this.repository.create({
          username: 'admin',
          password,
          salt,
          nickname: 'Super Admin',
          avatar: null,
          isAdmin: true,
        }),
      );
    }

    const countUser = await this.repository.count({
      where: {
        username: 'john.doe',
      },
    });

    if (!countUser) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      await this.repository.save(
        this.repository.create({
          username: 'john.doe',
          password,
          salt,
          nickname: 'John Doe',
          avatar: null,
          isAdmin: false,
        }),
      );
    }
  }
}
