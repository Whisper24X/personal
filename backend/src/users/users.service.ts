import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { User } from './domain/user';
import bcrypt from 'bcryptjs';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    const existedUser = await this.usersRepository.findByUsername(
      createUserDto.username,
    );

    if (existedUser) {
      throw new ConflictException('usernameAlreadyExists');
    }

    if (createUserDto.email) {
      const existedUserByEmail = await this.usersRepository.findByEmail(
        createUserDto.email,
      );

      if (existedUserByEmail) {
        throw new ConflictException('emailAlreadyExists');
      }
    }

    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash(createUserDto.password, salt);

    return this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      username: createUserDto.username,
      email: createUserDto.email ?? null,
      password,
      salt,
      nickname: createUserDto.nickname ?? null,
      avatar: createUserDto.avatar ?? null,
      isAdmin: createUserDto.isAdmin ?? false,
      status: createUserDto.status ?? 1,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByUsername(username: User['username']): Promise<NullableType<User>> {
    return this.usersRepository.findByUsername(username);
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    let password: string | undefined = undefined;
    let salt: string | null | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.findById(id);

      if (userObject && userObject.password !== updateUserDto.password) {
        const generatedSalt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, generatedSalt);
        salt = generatedSalt;
      }
    }

    let username: string | undefined = undefined;

    if (updateUserDto.username) {
      const userObject = await this.usersRepository.findByUsername(
        updateUserDto.username,
      );

      if (userObject && userObject.id !== id) {
        throw new ConflictException('usernameAlreadyExists');
      }

      username = updateUserDto.username;
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email !== undefined) {
      if (updateUserDto.email === null) {
        email = null;
      } else {
        const userByEmail = await this.usersRepository.findByEmail(
          updateUserDto.email,
        );

        if (userByEmail && userByEmail.id !== id) {
          throw new ConflictException('emailAlreadyExists');
        }

        email = updateUserDto.email;
      }
    }

    const updatedUser = await this.usersRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      ...(username !== undefined ? { username } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(updateUserDto.nickname !== undefined
        ? { nickname: updateUserDto.nickname }
        : {}),
      ...(updateUserDto.avatar !== undefined
        ? { avatar: updateUserDto.avatar }
        : {}),
      ...(updateUserDto.isAdmin !== undefined
        ? { isAdmin: updateUserDto.isAdmin }
        : {}),
      ...(updateUserDto.status !== undefined
        ? { status: updateUserDto.status }
        : {}),
      password,
      ...(salt !== undefined ? { salt } : {}),
    });

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.remove(id);
  }
}
